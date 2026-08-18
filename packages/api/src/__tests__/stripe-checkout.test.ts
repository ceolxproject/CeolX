import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VENUE_USER_ID = 'venue-user-1';
const VENUE_ID = 'venue-profile-1';

const { mockSelectLimit, mockDb, mockCreateSession, envState } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  return {
    mockSelectLimit,
    mockDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
    } as Record<string, unknown>,
    mockCreateSession: vi.fn(),
    envState: {
      BETTER_AUTH_URL: 'https://api.ceolx.com',
      STRIPE_TRIAL_DAYS: 183,
    } as Record<string, unknown>,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));
vi.mock('../services/stripe', () => ({ createSubscriptionCheckoutSession: mockCreateSession }));

import * as stripeModule from '../routers/stripe';
import { buildCheckoutSessionForVenue } from '../routers/stripe';

async function expectCode(promise: Promise<unknown>, code: TRPCError['code']) {
  try {
    await promise;
    throw new Error(`expected TRPCError ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([]);
  mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x', sessionId: 'cs_1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildCheckoutSessionForVenue — guards', () => {
  const base = {
    userId: VENUE_USER_ID,
    venueId: VENUE_ID,
    email: 'venue@example.com',
    interval: 'monthly' as const,
  };

  it('NOT_FOUNDs an unknown venue', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    await expectCode(buildCheckoutSessionForVenue(base), 'NOT_FOUND');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it.each(['trialing', 'active', 'past_due'])(
    'CONFLICTs a venue already subscribed (%s) — this is the no-double-charge guard (D-49)',
    async (status) => {
      mockSelectLimit.mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: status }]);
      await expectCode(buildCheckoutSessionForVenue(base), 'CONFLICT');
      expect(mockCreateSession).not.toHaveBeenCalled();
    }
  );

  it.each(['inactive', 'cancelled'])('allows checkout from %s', async (status) => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: status }])
      .mockResolvedValueOnce([]);
    await buildCheckoutSessionForVenue(base);
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it('FORBIDs a billing-blocked account (D-51)', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([{ billingBlocked: true, stripeCustomerId: null, trialEndsAt: null }]);
    await expectCode(buildCheckoutSessionForVenue(base), 'FORBIDDEN');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

describe('buildCheckoutSessionForVenue — trial eligibility (D-42)', () => {
  const base = {
    userId: VENUE_USER_ID,
    venueId: VENUE_ID,
    email: 'venue@example.com',
    interval: 'monthly' as const,
  };

  it('grants the configured trial to a venue that has never had one', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([]);
    await buildCheckoutSessionForVenue(base);
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({ trialDays: 183 }));
  });

  it('grants NO trial to a returning venue — one trial per account, ever', async () => {
    // A recorded trial end date is the proof the trial was consumed. It is never
    // cleared, which is exactly why no separate `trial_used` flag exists.
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'cancelled' }])
      .mockResolvedValueOnce([
        {
          billingBlocked: false,
          stripeCustomerId: 'cus_1',
          trialEndsAt: new Date('2027-02-17T00:00:00.000Z'),
        },
      ]);
    await buildCheckoutSessionForVenue(base);
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({ trialDays: null }));
  });

  it('reuses the existing Stripe customer, which is what makes D-42 enforceable', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'cancelled' }])
      .mockResolvedValueOnce([
        { billingBlocked: false, stripeCustomerId: 'cus_1', trialEndsAt: null },
      ]);
    await buildCheckoutSessionForVenue(base);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: 'cus_1' })
    );
  });

  it('sends return URLs on our own origin', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([]);
    await buildCheckoutSessionForVenue(base);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: 'https://api.ceolx.com/activate/complete',
        cancelUrl: 'https://api.ceolx.com/activate/cancelled',
      })
    );
  });
});

describe('no tRPC checkout surface (D-16)', () => {
  it('exports no router, so there is nothing to mount', () => {
    // Apple Rule 3.1.1 turns on whether a payment URL is reachable from inside the app,
    // not on which screen chooses to open it. `stripe.createCheckoutSession` returned a
    // live Checkout URL to any authenticated venue; nothing called it, but that left the
    // compliance position one client change away from breaking.
    //
    // Asserted on the module rather than on appRouter, which would drag Typesense and
    // the rest of the tree into a unit test.
    expect(Object.keys(stripeModule)).not.toContain('stripeRouter');
    expect(Object.keys(stripeModule)).toEqual(['buildCheckoutSessionForVenue']);
  });

  it('still mints checkout server-side through the guarded builder', async () => {
    // The capability did not go away — it moved to GET /activate, which 302s the
    // browser to Stripe without the URL ever reaching the app.
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([]);

    await buildCheckoutSessionForVenue({
      userId: VENUE_USER_ID,
      venueId: VENUE_ID,
      email: 'venue@example.com',
      interval: 'monthly' as const,
    });

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });
});
