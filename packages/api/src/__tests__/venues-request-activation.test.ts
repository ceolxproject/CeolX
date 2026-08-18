import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

const VENUE_USER_ID = 'venue-user-1';
const VENUE_ID = 'venue-profile-1';

const {
  mockSelectLimit,
  mockDb,
  mockSendVenueActivation,
  mockBuildLinks,
  mockRevokeToken,
  mockMillisSince,
  mockGetPrices,
  envState,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockDb: Record<string, unknown> = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
  };
  return {
    mockSelectLimit,
    mockDb,
    mockSendVenueActivation: vi.fn(),
    mockBuildLinks: vi.fn(),
    mockRevokeToken: vi.fn(),
    mockMillisSince: vi.fn(),
    mockGetPrices: vi.fn(),
    envState: {
      BETTER_AUTH_URL: 'https://api.ceolx.com',
      ACTIVATION_TOKEN_TTL_MINUTES: 45,
      VENUE_GATE_ENABLED: 'false',
    } as Record<string, unknown>,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));
vi.mock('@CeolX/email', () => ({ sendVenueActivationEmail: mockSendVenueActivation }));
vi.mock('../services/activation-links', () => ({ buildActivationLinks: mockBuildLinks }));
vi.mock('../services/activation-token', () => ({
  revokeActivationToken: mockRevokeToken,
  millisSinceNewestActivationToken: mockMillisSince,
}));
vi.mock('../services/stripe', () => ({ getPriceSummaries: mockGetPrices }));

import type { Context } from '../context';
import { router, t } from '../index';
import { venuesRouter } from '../routers/venues';

const createCaller = t.createCallerFactory(router({ venues: venuesRouter }));

/**
 * The activation email payload we handed the sender.
 *
 * Typed rather than left as `any` so the assertions below are genuinely checked —
 * an `any` here would let a renamed field pass silently.
 */
interface SentActivationEmail {
  to?: string;
  venueName?: string;
  userName?: string;
  monthlyUrl?: string;
  annualUrl?: string;
  monthlyPrice?: string;
  annualPrice?: string;
  expiresInMinutes?: number;
}

const sentEmail = (): SentActivationEmail =>
  mockSendVenueActivation.mock.calls[0]?.[0] as SentActivationEmail;

const mockScheduleReminder = vi.fn();

function authedContext(role: UserRole, userId = VENUE_USER_ID): Context {
  return {
    session: { user: { id: userId, currentRole: role }, session: { userId } },
    dispatchNotification: vi.fn(async () => {}),
    scheduleActivationReminder: mockScheduleReminder,
  } as unknown as Context;
}

/** Sequences the three lookups requestActivation makes, in order. */
function primeLookups({
  profile = { id: VENUE_ID, venueName: 'The Cobblestone', subscriptionStatus: 'inactive' },
  subscription = undefined as Record<string, unknown> | undefined,
  account = { email: 'venue@example.com', name: 'Sean' },
}: {
  profile?: Record<string, unknown> | null;
  subscription?: Record<string, unknown>;
  account?: Record<string, unknown> | null;
} = {}) {
  mockSelectLimit
    .mockResolvedValueOnce(profile ? [profile] : [])
    .mockResolvedValueOnce(subscription ? [subscription] : [])
    .mockResolvedValueOnce(account ? [account] : []);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([]);
  mockMillisSince.mockResolvedValue(null);
  mockBuildLinks.mockResolvedValue({
    monthlyUrl: 'https://api.ceolx.com/activate?token=raw-token-value&plan=monthly',
    annualUrl: 'https://api.ceolx.com/activate?token=raw-token-value&plan=annual',
    expiresAt: new Date('2026-08-18T10:45:00.000Z'),
    tokenId: 'tok_1',
  });
  mockScheduleReminder.mockResolvedValue(undefined);
  mockGetPrices.mockResolvedValue({
    monthly: { formatted: '€19.99', unitAmount: 1999, currency: 'EUR' },
    annual: { formatted: '€199.00', unitAmount: 19900, currency: 'EUR' },
  });
  mockSendVenueActivation.mockResolvedValue(undefined);
  mockRevokeToken.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function expectCode(promise: Promise<unknown>, code: TRPCError['code']) {
  try {
    await promise;
    throw new Error(`expected TRPCError ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

describe('venues.requestActivation — access', () => {
  it('rejects an unauthenticated caller', async () => {
    const caller = createCaller({ session: null } as unknown as Context);
    await expectCode(caller.venues.requestActivation(), 'UNAUTHORIZED');
  });

  it('rejects an artist', async () => {
    await expectCode(createCaller(authedContext('artist')).venues.requestActivation(), 'FORBIDDEN');
  });

  it('NOT_FOUNDs an admin, who passes the role gate but owns no venue profile', async () => {
    // requireRole gives ADMIN a blanket bypass, so this is a reachable branch
    // rather than defensive padding.
    primeLookups({ profile: null });
    await expectCode(createCaller(authedContext('admin')).venues.requestActivation(), 'NOT_FOUND');
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });
});

describe('venues.requestActivation — guards', () => {
  it.each(['trialing', 'active', 'past_due'])(
    'CONFLICTs a venue already subscribed (%s) rather than issuing a second link',
    async (status) => {
      primeLookups({
        profile: { id: VENUE_ID, venueName: 'The Cobblestone', subscriptionStatus: status },
      });
      await expectCode(createCaller(authedContext('venue')).venues.requestActivation(), 'CONFLICT');
      expect(mockBuildLinks).not.toHaveBeenCalled();
      expect(mockSendVenueActivation).not.toHaveBeenCalled();
    }
  );

  it('FORBIDs a billing-blocked account pending admin review (D-51)', async () => {
    primeLookups({ subscription: { billingBlocked: true } });
    await expectCode(createCaller(authedContext('venue')).venues.requestActivation(), 'FORBIDDEN');
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });

  it('TOO_MANY_REQUESTS inside the cooldown window', async () => {
    primeLookups();
    mockMillisSince.mockResolvedValue(5_000);
    await expectCode(
      createCaller(authedContext('venue')).venues.requestActivation(),
      'TOO_MANY_REQUESTS'
    );
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });

  it('allows a resend once the cooldown has elapsed', async () => {
    primeLookups();
    mockMillisSince.mockResolvedValue(120_000);
    await createCaller(authedContext('venue')).venues.requestActivation();
    expect(mockSendVenueActivation).toHaveBeenCalledTimes(1);
  });

  it('PRECONDITION_FAILEDs an account with no email — the email is the only route', async () => {
    primeLookups({ account: { email: null, name: 'Sean' } });
    await expectCode(
      createCaller(authedContext('venue')).venues.requestActivation(),
      'PRECONDITION_FAILED'
    );
    expect(mockBuildLinks).not.toHaveBeenCalled();
  });
});

describe('venues.requestActivation — the email', () => {
  it('sends both interval links off the API origin, each with the same token', async () => {
    primeLookups();
    await createCaller(authedContext('venue')).venues.requestActivation();

    const arg = sentEmail();
    expect(arg.to).toBe('venue@example.com');
    expect(arg.venueName).toBe('The Cobblestone');
    expect(arg.monthlyUrl).toBe(
      'https://api.ceolx.com/activate?token=raw-token-value&plan=monthly'
    );
    expect(arg.annualUrl).toBe('https://api.ceolx.com/activate?token=raw-token-value&plan=annual');
    expect(arg.expiresInMinutes).toBe(45);
  });

  it('quotes the prices Stripe reports rather than any local constant', async () => {
    primeLookups();
    await createCaller(authedContext('venue')).venues.requestActivation();
    const arg = sentEmail();
    expect(arg.monthlyPrice).toBe('€19.99');
    expect(arg.annualPrice).toBe('€199.00');
  });

  it('still sends, without prices, when Stripe is unreachable', async () => {
    // The activation email is the venue's ONLY route to payment (D-16). A Stripe
    // outage must degrade the button labels, not block the flow entirely.
    primeLookups();
    mockGetPrices.mockRejectedValue(new Error('stripe down'));
    await createCaller(authedContext('venue')).venues.requestActivation();

    const arg = sentEmail();
    expect(arg.monthlyPrice).toBeUndefined();
    expect(arg.annualPrice).toBeUndefined();
    expect(arg.monthlyUrl).toContain('plan=monthly');
  });

  it('never returns the token or a payment URL to the caller (D-16)', async () => {
    primeLookups();
    const res = await createCaller(authedContext('venue')).venues.requestActivation();

    expect(res).toEqual({
      sentTo: 'venue@example.com',
      expiresAt: new Date('2026-08-18T10:45:00.000Z'),
    });
    const serialised = JSON.stringify(res);
    expect(serialised).not.toContain('raw-token-value');
    expect(serialised).not.toContain('/activate');
  });
});

describe('venues.requestActivation — send failure', () => {
  it('propagates the failure instead of claiming an email was sent', async () => {
    primeLookups();
    mockSendVenueActivation.mockRejectedValue(new Error('postmark down'));

    await expect(createCaller(authedContext('venue')).venues.requestActivation()).rejects.toThrow(
      'postmark down'
    );
  });

  it('revokes the token it just issued, so the cooldown cannot lock out a retry', async () => {
    primeLookups();
    mockSendVenueActivation.mockRejectedValue(new Error('postmark down'));

    await createCaller(authedContext('venue'))
      .venues.requestActivation()
      .catch(() => {});

    expect(mockRevokeToken).toHaveBeenCalledWith('tok_1');
  });
});

describe('venues.requestActivation — reminder scheduling (D-26)', () => {
  it('queues exactly three nudges at 24 h, 3 days and 7 days', async () => {
    primeLookups();
    await createCaller(authedContext('venue')).venues.requestActivation();

    expect(mockScheduleReminder).toHaveBeenCalledTimes(3);
    const scheduled = mockScheduleReminder.mock.calls as [string, number, string][];
    expect(scheduled.map(([, attempt, delay]) => [attempt, delay])).toEqual([
      [1, '24h'],
      [2, '3d'],
      [3, '7d'],
    ]);
  });

  it('passes only the user id — never a token or a URL — into the queue', async () => {
    // A queued payload carrying a live activation token would park a credential in
    // Upstash's message store for its retention window.
    primeLookups();
    await createCaller(authedContext('venue')).venues.requestActivation();

    for (const [userId] of mockScheduleReminder.mock.calls) {
      expect(userId).toBe(VENUE_USER_ID);
      expect(JSON.stringify(mockScheduleReminder.mock.calls)).not.toContain('raw-token-value');
    }
  });

  it('still succeeds when queuing a reminder fails', async () => {
    // The activation email is already away by this point. Failing the mutation
    // would tell the venue their email did not send when it did.
    primeLookups();
    mockScheduleReminder.mockRejectedValue(new Error('qstash down'));

    await expect(
      createCaller(authedContext('venue')).venues.requestActivation()
    ).resolves.toMatchObject({ sentTo: 'venue@example.com' });
  });

  it('does not queue reminders when a guard rejected the request', async () => {
    primeLookups({
      profile: { id: VENUE_ID, venueName: 'The Cobblestone', subscriptionStatus: 'active' },
    });
    await createCaller(authedContext('venue'))
      .venues.requestActivation()
      .catch(() => {});
    expect(mockScheduleReminder).not.toHaveBeenCalled();
  });
});
