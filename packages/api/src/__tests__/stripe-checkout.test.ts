import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VENUE_USER_ID = 'venue-user-1';
const VENUE_ID = 'venue-profile-1';

const {
  mockSelectLimit,
  mockUpdateSet,
  mockUpdateReturning,
  mockDb,
  mockCreateSession,
  mockRetrieveSession,
  mockExpireSession,
  envState,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockUpdateSet = vi.fn(() => ({
    where: vi.fn(() => ({ returning: mockUpdateReturning })),
  }));
  return {
    mockSelectLimit,
    mockUpdateSet,
    mockUpdateReturning,
    mockDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
      update: vi.fn(() => ({ set: mockUpdateSet })),
    } as Record<string, unknown>,
    mockCreateSession: vi.fn(),
    mockRetrieveSession: vi.fn(),
    mockExpireSession: vi.fn(),
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
vi.mock('../services/stripe', () => ({
  createSubscriptionCheckoutSession: mockCreateSession,
  retrieveCheckoutSession: mockRetrieveSession,
  expireCheckoutSession: mockExpireSession,
}));

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
  mockUpdateReturning.mockResolvedValue([{ id: 'token-1' }]);
  mockCreateSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x', sessionId: 'cs_1' });
  mockRetrieveSession.mockResolvedValue(null);
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

describe('buildCheckoutSessionForVenue — one payable session per activation token (D-49)', () => {
  const TOKEN_ID = 'token-1';

  const base = {
    userId: VENUE_USER_ID,
    venueId: VENUE_ID,
    email: 'venue@example.com',
    interval: 'monthly' as const,
    activationTokenId: TOKEN_ID,
  };

  /** Queue the profile row, the subscription row and the token row, in read order. */
  function withStoredSession(sessionId: string | null) {
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ sessionId }]);
  }

  it('records the session against the token on a first click', async () => {
    withStoredSession(null);

    await buildCheckoutSessionForVenue(base);

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledWith({ checkoutSessionId: 'cs_1' });
  });

  it('returns the same session for a repeat click on the same plan', async () => {
    // A double-tap, an impatient reload and a second device all reach here. Before this
    // guard each one minted its own Stripe Customer, subscription and six-month trial.
    withStoredSession('cs_existing');
    mockRetrieveSession.mockResolvedValueOnce({
      id: 'cs_existing',
      url: 'https://checkout.stripe.com/existing',
      status: 'open',
      interval: 'monthly',
    });

    const result = await buildCheckoutSessionForVenue(base);

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/existing',
      sessionId: 'cs_existing',
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockExpireSession).not.toHaveBeenCalled();
  });

  it('closes the abandoned page and opens the new one when the venue switches plan', async () => {
    // The activation email carries both plans behind one token and D-63 keeps that
    // choice open, so this is a supported flow — not an abuse to be refused. What must
    // not survive is the first page staying payable alongside the second.
    withStoredSession('cs_monthly');
    mockRetrieveSession.mockResolvedValueOnce({
      id: 'cs_monthly',
      url: 'https://checkout.stripe.com/monthly',
      status: 'open',
      interval: 'monthly',
    });

    const result = await buildCheckoutSessionForVenue({ ...base, interval: 'annual' });

    expect(mockExpireSession).toHaveBeenCalledWith('cs_monthly');
    expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({ interval: 'annual' }));
    expect(result.sessionId).toBe('cs_1');
  });

  it('CONFLICTs once the token’s session has been paid, before any webhook arrives', async () => {
    // This is the window the profile-status guard cannot see: payment has happened but
    // nothing has written it down yet. Answering CONFLICT keeps the reply the same as it
    // will be a second later instead of offering a second payment page.
    withStoredSession('cs_paid');
    mockRetrieveSession.mockResolvedValueOnce({
      id: 'cs_paid',
      url: null,
      status: 'complete',
      interval: 'monthly',
    });

    await expectCode(buildCheckoutSessionForVenue(base), 'CONFLICT');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('mints a fresh session when Stripe no longer knows the stored one', async () => {
    // A stored id from a rotated key or another account. Stripe cannot see it, so nobody
    // can pay it, and refusing checkout over it would strand a venue who owes us money.
    withStoredSession('cs_gone');
    mockRetrieveSession.mockResolvedValueOnce(null);

    await buildCheckoutSessionForVenue(base);

    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it('abandons its own session and defers to the winner when the claim is lost', async () => {
    // Two requests got past the read together. Exactly one may end up recorded, and the
    // loser's session must not be left payable — that is the two-subscriptions bug in
    // miniature, just with a much narrower window.
    withStoredSession(null);
    mockUpdateReturning.mockResolvedValueOnce([]);
    mockSelectLimit.mockResolvedValueOnce([{ sessionId: 'cs_winner' }]);
    mockRetrieveSession.mockResolvedValueOnce({
      id: 'cs_winner',
      url: 'https://checkout.stripe.com/winner',
      status: 'open',
      interval: 'monthly',
    });

    const result = await buildCheckoutSessionForVenue(base);

    expect(mockExpireSession).toHaveBeenCalledWith('cs_1');
    expect(result.sessionId).toBe('cs_winner');
  });

  it('reads no token row and claims nothing when there is no token', async () => {
    // The authenticated path has no token to enforce against. It is unreachable today
    // (D-16 removed the tRPC surface), so this pins that it stays harmless rather than
    // reading a row that does not exist.
    mockSelectLimit
      .mockResolvedValueOnce([{ id: VENUE_ID, subscriptionStatus: 'inactive' }])
      .mockResolvedValueOnce([]);

    await buildCheckoutSessionForVenue({ ...base, activationTokenId: undefined });

    expect(mockRetrieveSession).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
