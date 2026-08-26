import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = 'user-1';
const VENUE_ID = '550e8400-e29b-41d4-a716-446655440000';

const {
  mockSelectLimit,
  mockReminderClaim,
  mockBuildLinks,
  mockGetPrices,
  mockSendReminder,
  mockSendTrialEnding,
  envState,
} = vi.hoisted(() => ({
  mockSelectLimit: vi.fn(),
  // The conditional UPDATE that claims one nudge. Returns a row on a first delivery
  // and [] when this attempt (or a later one) has already been sent.
  mockReminderClaim: vi.fn(),
  mockBuildLinks: vi.fn(),
  mockGetPrices: vi.fn(),
  mockSendReminder: vi.fn(),
  mockSendTrialEnding: vi.fn(),
  envState: {
    BETTER_AUTH_URL: 'https://api.ceolx.com',
    ACTIVATION_TOKEN_TTL_MINUTES: 45,
  } as Record<string, unknown>,
}));

vi.mock('@CeolX/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: mockSelectLimit })),
        innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReminderClaim })) })),
    })),
  },
}));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));
vi.mock('@CeolX/api/services/activation-links', () => ({ buildActivationLinks: mockBuildLinks }));
vi.mock('@CeolX/api/services/stripe', () => ({ getPriceSummaries: mockGetPrices }));
vi.mock('@CeolX/email', () => ({
  sendActivationReminderEmail: mockSendReminder,
  sendTrialEndingEmail: mockSendTrialEnding,
}));

import {
  handleSubscriptionActivationReminder,
  handleSubscriptionTrialEnding,
} from '../../jobs/handlers/subscription.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([]);
  mockReminderClaim.mockResolvedValue([{ id: VENUE_ID }]);
  mockBuildLinks.mockResolvedValue({
    monthlyUrl: 'https://api.ceolx.com/activate?token=fresh&plan=monthly',
    annualUrl: 'https://api.ceolx.com/activate?token=fresh&plan=annual',
    expiresAt: new Date('2026-08-18T10:45:00.000Z'),
    tokenId: 'tok_1',
  });
  mockGetPrices.mockResolvedValue({
    monthly: { formatted: '€19.99', unitAmount: 1999, currency: 'EUR' },
    annual: { formatted: '€199.00', unitAmount: 19900, currency: 'EUR' },
  });
  mockSendReminder.mockResolvedValue(undefined);
  mockSendTrialEnding.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleSubscriptionActivationReminder', () => {
  const inactiveVenue = {
    id: VENUE_ID,
    venueName: 'The Cobblestone',
    subscriptionStatus: 'inactive',
  };

  /** profile lookup → subscription lookup → account lookup, in call order. */
  function prime({
    profile = inactiveVenue as Record<string, unknown> | null,
    subscription = undefined as Record<string, unknown> | undefined,
    account = { email: 'venue@example.com', name: 'Sean' } as Record<string, unknown> | null,
  } = {}) {
    mockSelectLimit
      .mockResolvedValueOnce(profile ? [profile] : [])
      .mockResolvedValueOnce(subscription ? [subscription] : [])
      .mockResolvedValueOnce(account ? [account] : []);
  }

  it('sends a nudge to a venue still sitting inactive', async () => {
    prime();
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });

    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'venue@example.com',
        venueName: 'The Cobblestone',
        monthlyUrl: 'https://api.ceolx.com/activate?token=fresh&plan=monthly',
        expiresInMinutes: 45,
      })
    );
  });

  it('mints a FRESH token rather than reusing one from the queued payload', async () => {
    // By the 3-day nudge the original token is long expired (D-17), and a queued
    // payload carrying a live one would have parked a credential in Upstash.
    prime();
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 2 });
    expect(mockBuildLinks).toHaveBeenCalledWith(USER_ID);
  });

  it.each(['trialing', 'active', 'past_due', 'cancelled'])(
    'no-ops when the venue has moved to %s',
    async (status) => {
      // Three jobs are queued at once, so without this a venue who activated an
      // hour later would get all three telling them to do what they already did.
      prime({ profile: { ...inactiveVenue, subscriptionStatus: status } });
      await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });
      expect(mockSendReminder).not.toHaveBeenCalled();
      expect(mockBuildLinks).not.toHaveBeenCalled();
    }
  );

  it('no-ops when the venue profile is gone', async () => {
    prime({ profile: null });
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });
    expect(mockSendReminder).not.toHaveBeenCalled();
  });

  it('never invites a disputed account back in (D-51)', async () => {
    prime({ subscription: { billingBlocked: true } });
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });
    expect(mockSendReminder).not.toHaveBeenCalled();
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });

  it('no-ops when the account has no email address', async () => {
    prime({ account: { email: null, name: null } });
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });
    expect(mockSendReminder).not.toHaveBeenCalled();
  });

  it('still sends, without prices, when Stripe is unreachable', async () => {
    prime();
    mockGetPrices.mockRejectedValue(new Error('stripe down'));
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });

    expect(mockSendReminder).toHaveBeenCalledWith(
      expect.objectContaining({ monthlyPrice: undefined, annualPrice: undefined })
    );
  });

  it('sends nothing on a re-delivery of a nudge already sent', async () => {
    // QStash is at-least-once, and the status guard above does not cover this: a venue
    // still `inactive` is exactly who the nudge is for, so a second delivery used to
    // send the same email again. The claim losing means someone else already sent it.
    prime();
    mockReminderClaim.mockResolvedValue([]);

    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 1 });

    expect(mockSendReminder).not.toHaveBeenCalled();
    // No token minted either — a fresh one would silently invalidate the link the
    // venue is holding from the delivery that did go out (D-18).
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });

  it('claims the nudge before sending, so a failed send cannot be retried into a duplicate', async () => {
    prime();
    await handleSubscriptionActivationReminder({ userId: USER_ID, attempt: 2 });

    // Ordering is the substance: stamped first, sent second. The reverse would let a
    // crash between the two produce a second email on redelivery.
    const claimOrder = mockReminderClaim.mock.invocationCallOrder[0];
    const sendOrder = mockSendReminder.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(sendOrder);
  });
});

describe('handleSubscriptionTrialEnding', () => {
  const trialing = {
    venueName: 'The Cobblestone',
    userId: USER_ID,
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    plan: 'monthly',
  };

  function prime({
    row = trialing as Record<string, unknown> | null,
    account = { email: 'venue@example.com', name: 'Sean' } as Record<string, unknown> | null,
  } = {}) {
    mockSelectLimit
      .mockResolvedValueOnce(row ? [row] : [])
      .mockResolvedValueOnce(account ? [account] : []);
  }

  it('warns a trialing venue with the amount and date from Stripe', async () => {
    prime();
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });

    expect(mockSendTrialEnding).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'venue@example.com',
        venueName: 'The Cobblestone',
        amount: '€19.99',
        interval: 'monthly',
      })
    );
    // The date must be a real formatted date, not an ISO string dumped into copy.
    const sent = mockSendTrialEnding.mock.calls[0]?.[0] as { chargeDate?: string } | undefined;
    expect(sent?.chargeDate).toMatch(/\d{1,2} \w+ \d{4}/);
  });

  it('quotes the annual amount for an annual subscriber', async () => {
    prime({ row: { ...trialing, plan: 'annual' } });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '€199.00', interval: 'annual' })
    );
  });

  it.each(['active', 'inactive', 'cancelled', 'past_due'])(
    'stays silent when the venue is %s rather than trialing',
    async (status) => {
      // Queued up to six months earlier. If they already converted or cancelled,
      // warning them about an upcoming first charge would simply be false.
      prime({ row: { ...trialing, subscriptionStatus: status } });
      await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
      expect(mockSendTrialEnding).not.toHaveBeenCalled();
    }
  );

  it('stays silent for a venue who cancelled during the trial (D-29)', async () => {
    // They keep access to the trial end date but are never charged, so a charge
    // warning would be wrong.
    prime({ row: { ...trialing, cancelAtPeriodEnd: true } });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });

  it('stays silent when the trial end date has already passed', async () => {
    prime({ row: { ...trialing, trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });

  it('stays silent when no trial end date is recorded', async () => {
    prime({ row: { ...trialing, trialEndsAt: null } });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });

  it('no-ops for an unknown venue', async () => {
    prime({ row: null });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });

  it('no-ops when the account has no email', async () => {
    prime({ account: { email: null, name: null } });
    await handleSubscriptionTrialEnding({ venueId: VENUE_ID });
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });

  it('propagates a Stripe failure rather than quoting an unverified amount', async () => {
    // This is the one email where a wrong figure becomes a chargeback, so failing
    // and retrying beats sending a guess.
    prime();
    mockGetPrices.mockRejectedValue(new Error('stripe down'));
    await expect(handleSubscriptionTrialEnding({ venueId: VENUE_ID })).rejects.toThrow(
      'stripe down'
    );
    expect(mockSendTrialEnding).not.toHaveBeenCalled();
  });
});
