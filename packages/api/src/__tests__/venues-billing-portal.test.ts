import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRole } from '@CeolX/shared';

const VENUE_USER_ID = 'venue-user-1';
const VENUE_ID = 'venue-profile-1';
const PORTAL_URL = 'https://billing.stripe.com/p/session_abc';

const {
  mockSelectLimit,
  mockDb,
  mockSendManage,
  mockCreatePortal,
  mockMillisSincePortal,
  mockRecordPortal,
  envState,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  return {
    mockSelectLimit,
    mockDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
      })),
    } as Record<string, unknown>,
    mockSendManage: vi.fn(),
    mockCreatePortal: vi.fn(),
    mockMillisSincePortal: vi.fn(),
    mockRecordPortal: vi.fn(),
    envState: { BETTER_AUTH_URL: 'https://api.ceolx.com' } as Record<string, unknown>,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));
vi.mock('@CeolX/email', () => ({
  sendManageSubscriptionEmail: mockSendManage,
  sendVenueActivationEmail: vi.fn(),
}));
vi.mock('../services/stripe', () => ({
  createBillingPortalSession: mockCreatePortal,
  getPriceSummaries: vi.fn(),
}));
vi.mock('../services/portal-throttle', () => ({
  millisSinceNewestPortalRequest: mockMillisSincePortal,
  recordPortalRequest: mockRecordPortal,
}));
vi.mock('../services/activation-links', () => ({ buildActivationLinks: vi.fn() }));
vi.mock('../services/activation-token', () => ({
  revokeActivationToken: vi.fn(),
  millisSinceNewestActivationToken: vi.fn(),
}));

import type { Context } from '../context';
import { router, t } from '../index';
import { venuesRouter } from '../routers/venues';

const createCaller = t.createCallerFactory(router({ venues: venuesRouter }));

function authedContext(role: UserRole, userId = VENUE_USER_ID): Context {
  return {
    session: { user: { id: userId, currentRole: role }, session: { userId } },
    dispatchNotification: vi.fn(async () => {}),
    scheduleActivationReminder: vi.fn(),
  } as unknown as Context;
}

/** profile lookup → subscription lookup → account lookup, in call order. */
function prime({
  profile = { id: VENUE_ID, venueName: 'The Cobblestone' } as Record<string, unknown> | null,
  subscription = { stripeCustomerId: 'cus_1' } as Record<string, unknown> | null,
  account = { email: 'venue@example.com', name: 'Sean' } as Record<string, unknown> | null,
} = {}) {
  mockSelectLimit
    .mockResolvedValueOnce(profile ? [profile] : [])
    .mockResolvedValueOnce(subscription ? [subscription] : [])
    .mockResolvedValueOnce(account ? [account] : []);
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
  mockCreatePortal.mockResolvedValue(PORTAL_URL);
  mockSendManage.mockResolvedValue(undefined);
  mockMillisSincePortal.mockResolvedValue(null);
  mockRecordPortal.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('venues.requestBillingPortal — access', () => {
  it('rejects an unauthenticated caller', async () => {
    await expectCode(
      createCaller({ session: null } as unknown as Context).venues.requestBillingPortal(),
      'UNAUTHORIZED'
    );
  });

  it('rejects an artist', async () => {
    await expectCode(
      createCaller(authedContext('artist')).venues.requestBillingPortal(),
      'FORBIDDEN'
    );
  });

  it('NOT_FOUNDs an admin with no venue profile', async () => {
    prime({ profile: null });
    await expectCode(
      createCaller(authedContext('admin')).venues.requestBillingPortal(),
      'NOT_FOUND'
    );
  });
});

describe('venues.requestBillingPortal — guards', () => {
  it('PRECONDITION_FAILEDs a venue that never subscribed', async () => {
    // No Stripe customer means there is no billing to manage — showing them an
    // empty Portal would be worse than telling them to activate.
    prime({ subscription: null });
    await expectCode(
      createCaller(authedContext('venue')).venues.requestBillingPortal(),
      'PRECONDITION_FAILED'
    );
    expect(mockCreatePortal).not.toHaveBeenCalled();
  });

  it('PRECONDITION_FAILEDs when the customer id is null', async () => {
    prime({ subscription: { stripeCustomerId: null } });
    await expectCode(
      createCaller(authedContext('venue')).venues.requestBillingPortal(),
      'PRECONDITION_FAILED'
    );
    expect(mockCreatePortal).not.toHaveBeenCalled();
  });

  it('TOO_MANY_REQUESTS inside the cooldown, without minting a Stripe session', async () => {
    // Each request costs a real Stripe API call, so the cooldown guards spend as
    // well as inbox spam.
    prime();
    mockMillisSincePortal.mockResolvedValue(5_000);
    await expectCode(
      createCaller(authedContext('venue')).venues.requestBillingPortal(),
      'TOO_MANY_REQUESTS'
    );
    expect(mockCreatePortal).not.toHaveBeenCalled();
    expect(mockSendManage).not.toHaveBeenCalled();
  });

  it('allows a request once the cooldown has elapsed', async () => {
    prime();
    mockMillisSincePortal.mockResolvedValue(120_000);
    await createCaller(authedContext('venue')).venues.requestBillingPortal();
    expect(mockSendManage).toHaveBeenCalledTimes(1);
  });

  it('PRECONDITION_FAILEDs an account with no email', async () => {
    prime({ account: { email: null, name: null } });
    await expectCode(
      createCaller(authedContext('venue')).venues.requestBillingPortal(),
      'PRECONDITION_FAILED'
    );
    expect(mockCreatePortal).not.toHaveBeenCalled();
  });
});

describe('venues.requestBillingPortal — the email', () => {
  it('mints a fresh session for the venue customer and emails it', async () => {
    prime();
    await createCaller(authedContext('venue')).venues.requestBillingPortal();

    expect(mockCreatePortal).toHaveBeenCalledWith('cus_1', 'https://api.ceolx.com/r?to=/profile');
    expect(mockSendManage).toHaveBeenCalledWith({
      to: 'venue@example.com',
      venueName: 'The Cobblestone',
      userName: 'Sean',
      portalUrl: PORTAL_URL,
    });
  });

  it('never returns the Portal URL to the caller (D-16)', async () => {
    // The URL is a bearer credential for a billing account, and no billing URL may
    // reach the app on either store.
    prime();
    const res = await createCaller(authedContext('venue')).venues.requestBillingPortal();

    expect(res).toEqual({ sentTo: 'venue@example.com' });
    expect(JSON.stringify(res)).not.toContain('billing.stripe.com');
  });

  it('stamps the cooldown BEFORE minting the Stripe session', async () => {
    // Reversed deliberately. Stamping last meant any failure below threw with the
    // throttle un-armed, so a client retrying on error minted an unbounded number of
    // real Stripe Portal sessions — the exact spend the cooldown exists to cap.
    prime();
    const order: string[] = [];
    mockRecordPortal.mockImplementation(() => {
      order.push('stamp');
      return Promise.resolve();
    });
    mockCreatePortal.mockImplementation(() => {
      order.push('mint');
      return Promise.resolve('https://billing.stripe.com/session/abc');
    });
    mockSendManage.mockImplementation(() => {
      order.push('send');
      return Promise.resolve();
    });

    await createCaller(authedContext('venue')).venues.requestBillingPortal();
    expect(order).toEqual(['stamp', 'mint', 'send']);
  });

  it('still stamps the cooldown when the send fails, capping Stripe session spend', async () => {
    // The venue loses one cooldown window to a Postmark blip and waits before
    // retrying. That is the correct direction to fail: one delayed email beats
    // uncapped session creation. The error still propagates — the email IS the
    // deliverable, so the caller must know it did not arrive.
    prime();
    mockSendManage.mockRejectedValue(new Error('postmark down'));

    await expect(
      createCaller(authedContext('venue')).venues.requestBillingPortal()
    ).rejects.toThrow('postmark down');
    expect(mockRecordPortal).toHaveBeenCalledTimes(1);
  });

  it('does not mint a Stripe session when the venue is inside the cooldown', async () => {
    // The cap only works if the throttle short-circuits before the billable call.
    prime();
    mockMillisSincePortal.mockResolvedValue(5_000);

    await expect(
      createCaller(authedContext('venue')).venues.requestBillingPortal()
    ).rejects.toThrow();
    expect(mockCreatePortal).not.toHaveBeenCalled();
  });
});
