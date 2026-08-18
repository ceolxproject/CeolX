import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

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

import type { Context } from '../context';
import { router, t } from '../index';
import { buildCheckoutSessionForVenue, stripeRouter } from '../routers/stripe';

const createCaller = t.createCallerFactory(router({ stripe: stripeRouter }));

function authedContext(role: UserRole, userId = VENUE_USER_ID): Context {
  return {
    session: { user: { id: userId, currentRole: role }, session: { userId } },
    dispatchNotification: vi.fn(async () => {}),
  } as unknown as Context;
}

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

describe('stripe.createCheckoutSession', () => {
  it('rejects an unauthenticated caller', async () => {
    await expectCode(
      createCaller({ session: null } as unknown as Context).stripe.createCheckoutSession({
        plan: 'monthly',
      }),
      'UNAUTHORIZED'
    );
  });

  it('rejects a non-venue role', async () => {
    await expectCode(
      createCaller(authedContext('artist')).stripe.createCheckoutSession({ plan: 'monthly' }),
      'FORBIDDEN'
    );
  });

  it('rejects an unknown interval at the schema boundary', async () => {
    await expect(
      createCaller(authedContext('venue')).stripe.createCheckoutSession({
        plan: 'weekly' as unknown as 'monthly',
      })
    ).rejects.toThrow();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('resolves the venue from the session, never from caller input', async () => {
    // profile-by-userId, account, then the guards inside the shared builder.
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID }])
      .mockResolvedValueOnce([{ email: 'venue@example.com' }])
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([]);

    const res = await createCaller(authedContext('venue')).stripe.createCheckoutSession({
      plan: 'annual',
    });

    expect(res).toEqual({ checkoutUrl: 'https://checkout.stripe.com/x', sessionId: 'cs_1' });
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: VENUE_USER_ID, venueId: VENUE_ID, interval: 'annual' })
    );
  });

  it('PRECONDITION_FAILEDs when the account has no email to prefill', async () => {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID }])
      .mockResolvedValueOnce([{ email: null }]);
    await expectCode(
      createCaller(authedContext('venue')).stripe.createCheckoutSession({ plan: 'monthly' }),
      'PRECONDITION_FAILED'
    );
  });
});
