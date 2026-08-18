import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The sweep does ONE predicate SELECT (select → from → innerJoin → where) and then,
// per due venue, delegates to handleSubscriptionTrialEnding and stamps the marker.
const {
  mockSelectWhere,
  mockUpdateWhere,
  mockUpdateSet,
  mockUpdate,
  mockSendTrialEnding,
  mockGetPrices,
  mockRowLimit,
  mockPublishJob,
} = vi.hoisted(() => ({
  mockSelectWhere: vi.fn(),
  mockUpdateWhere: vi.fn().mockResolvedValue(undefined),
  mockUpdateSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockSendTrialEnding: vi.fn().mockResolvedValue(undefined),
  mockGetPrices: vi.fn(),
  mockRowLimit: vi.fn(),
  mockPublishJob: vi.fn().mockResolvedValue(undefined),
}));

mockUpdateSet.mockImplementation(() => ({ where: mockUpdateWhere }));
mockUpdate.mockImplementation(() => ({ set: mockUpdateSet }));

// select() serves two shapes: the sweep's joined predicate query and the
// single-venue handler's row/account lookups (which end in .limit). Inlined in the
// factory — vi.mock is hoisted above any top-level const it would otherwise close over.
vi.mock('@CeolX/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        // The sweep awaits .where() directly; the single-venue handler chains .limit(1)
        // onto it. Drizzle builders are thenable, so mirror that: return the promise
        // with .limit attached rather than picking one shape and breaking the other.
        innerJoin: () => ({
          where: (...a: unknown[]) =>
            Object.assign(mockSelectWhere(...a) as Promise<unknown>, { limit: mockRowLimit }),
        }),
        where: () => ({ limit: mockRowLimit }),
      }),
    }),
    update: mockUpdate,
  },
}));
vi.mock('@CeolX/db/schema/subscriptions', () => ({
  venueSubscriptions: {
    venueId: 'venue_id',
    trialEndsAt: 'trial_ends_at',
    trialEndingSentAt: 'trial_ending_sent_at',
    cancelAtPeriodEnd: 'cancel_at_period_end',
    billingBlocked: 'billing_blocked',
    plan: 'plan',
  },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  venueProfiles: {
    id: 'id',
    userId: 'user_id',
    venueName: 'venue_name',
    subscriptionStatus: 'subscription_status',
  },
}));
vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', email: 'email', name: 'name' } }));
vi.mock('@CeolX/email', () => ({
  sendTrialEndingEmail: mockSendTrialEnding,
  sendActivationReminderEmail: vi.fn(),
}));
vi.mock('@CeolX/api/services/stripe', () => ({ getPriceSummaries: mockGetPrices }));
vi.mock('@CeolX/api/services/activation-links', () => ({ buildActivationLinks: vi.fn() }));
vi.mock('../../jobs/publish.js', () => ({ publishJob: mockPublishJob, publishCron: vi.fn() }));

import { handleSubscriptionTrialEndingSweep } from '../../jobs/handlers/subscription.js';

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSet.mockImplementation(() => ({ where: mockUpdateWhere }));
  mockUpdate.mockImplementation(() => ({ set: mockUpdateSet }));
  mockSelectWhere.mockResolvedValue([]);
  mockGetPrices.mockResolvedValue({
    monthly: { formatted: '€19.99' },
    annual: { formatted: '€199.00' },
  });
  // Row the single-venue handler reads, then the account lookup.
  mockRowLimit
    .mockResolvedValueOnce([
      {
        venueName: 'The Cobblestone',
        userId: 'u1',
        subscriptionStatus: 'trialing',
        trialEndsAt: inDays(7),
        cancelAtPeriodEnd: false,
        plan: 'annual',
      },
    ])
    .mockResolvedValueOnce([{ email: 'venue@example.com', name: 'Aoife' }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trial-ending sweep replaces the delayed job', () => {
  it('sends the warning and stamps the marker for a due venue', async () => {
    mockSelectWhere.mockResolvedValue([{ venueId: 'v1' }]);

    await handleSubscriptionTrialEndingSweep({});

    expect(mockSendTrialEnding).toHaveBeenCalledTimes(1);
    // Amount comes from Stripe at send time, and must match the venue's real plan.
    expect(mockSendTrialEnding).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '€199.00', interval: 'annual' })
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ trialEndingSentAt: expect.any(Date) as unknown })
    );
  });

  it('does nothing when no venue is due', async () => {
    mockSelectWhere.mockResolvedValue([]);
    await handleSubscriptionTrialEndingSweep({});

    expect(mockSendTrialEnding).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('never stamps the marker when the send fails, so tomorrow retries', async () => {
    // The whole point of stamping only on success: a Postmark outage must not
    // consume the one warning this venue gets before a €199 charge.
    mockSelectWhere.mockResolvedValue([{ venueId: 'v1' }]);
    mockSendTrialEnding.mockRejectedValue(new Error('postmark down'));

    await expect(handleSubscriptionTrialEndingSweep({})).resolves.toBeUndefined();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('one venue failing does not strand the rest of the batch', async () => {
    mockSelectWhere.mockResolvedValue([{ venueId: 'v1' }, { venueId: 'v2' }]);
    mockRowLimit.mockReset();
    // v1 blows up on its row read; v2 proceeds normally.
    mockRowLimit
      .mockRejectedValueOnce(new Error('db blip'))
      .mockResolvedValueOnce([
        {
          venueName: 'Whelans',
          userId: 'u2',
          subscriptionStatus: 'trialing',
          trialEndsAt: inDays(6),
          cancelAtPeriodEnd: false,
          plan: 'monthly',
        },
      ])
      .mockResolvedValueOnce([{ email: 'two@example.com', name: 'Niamh' }]);

    await handleSubscriptionTrialEndingSweep({});

    expect(mockSendTrialEnding).toHaveBeenCalledTimes(1);
    expect(mockSendTrialEnding).toHaveBeenCalledWith(expect.objectContaining({ amount: '€19.99' }));
  });

  it('sends inline and queues nothing — no delay to exceed the QStash cap', async () => {
    // The regression guard. The old path queued a job delayed until 7 days before the
    // charge, which for a 183-day trial is ~176 days; a 30-day delay already exceeded
    // the plan cap here and failed silently (Asana 1215276188230541). If anyone
    // reintroduces a delayed publish, this fails.
    mockSelectWhere.mockResolvedValue([{ venueId: 'v1' }]);

    await handleSubscriptionTrialEndingSweep({});

    expect(mockSendTrialEnding).toHaveBeenCalledTimes(1);
    expect(mockPublishJob).not.toHaveBeenCalled();
  });
});
