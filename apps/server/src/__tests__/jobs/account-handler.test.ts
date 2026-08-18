// Hoisted Drizzle mocks — vi.mock is lifted above imports.

const mockSendAccountDeleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@CeolX/email', () => ({ sendAccountDeletedEmail: mockSendAccountDeleted }));

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn(() => ({ limit: mockSelectLimit })));
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

const mockTxUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockTxUpdateSet = vi.hoisted(() =>
  vi.fn((_args: Record<string, unknown>) => ({ where: mockTxUpdateWhere }))
);
const mockTxUpdate = vi.hoisted(() => vi.fn((_table: unknown) => ({ set: mockTxUpdateSet })));
const mockTxDeleteWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockTxDelete = vi.hoisted(() => vi.fn((_table: unknown) => ({ where: mockTxDeleteWhere })));

const mockTransaction = vi.hoisted(() =>
  vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ update: mockTxUpdate, delete: mockTxDelete });
  })
);

vi.mock('@CeolX/db', () => ({
  db: { select: mockSelect, transaction: mockTransaction },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', email: 'email', name: 'name' },
  session: { userId: 'user_id' },
}));

vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { userId: 'user_id' },
  venueProfiles: { userId: 'user_id' },
  profileSocialLinks: { userId: 'user_id' },
}));

vi.mock('@CeolX/db/schema/notifications', () => ({
  deviceTokens: { userId: 'user_id' },
}));

// Billing cancellation is a separate concern with its own coverage in
// packages/api/src/__tests__/subscription-sync.test.ts. Stubbed here so these
// tests stay about erasure — but asserted below, because D-47 requires it to
// happen BEFORE the account is erased.
const mockCancelSubscription = vi.hoisted(() => vi.fn());
vi.mock('@CeolX/api/services/subscription-sync', () => ({
  cancelSubscriptionForUser: mockCancelSubscription,
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  // No-op stub, required only because the handler now reaches
  // @CeolX/api/services/subscription-sync (to cancel billing before erasure,
  // M8-T0 D-47), which imports schema files that declare relations.
  relations: () => ({}),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAccountAnonymize } from '../../jobs/handlers/account.js';

const PAYLOAD = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  requestedAt: '2026-04-28T00:00:00.000Z',
};

beforeEach(() => {
  mockCancelSubscription.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleAccountAnonymize — idempotency guards', () => {
  it('is a no-op when the user row does not exist', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('is a no-op when the user is already anonymised', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: true, deletionScheduledFor: new Date() },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('is a no-op when the user logged back in (deletionScheduledFor cleared)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ isAnonymized: false, deletionScheduledFor: null }]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('handleAccountAnonymize — anonymisation path', () => {
  it('cancels billing BEFORE erasing, so a deleted account cannot keep being charged (D-47)', async () => {
    const order: string[] = [];
    mockCancelSubscription.mockImplementation(() => {
      order.push('cancel');
      return Promise.resolve(true);
    });
    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<void>) => {
      order.push('erase');
      await cb({ update: mockTxUpdate, delete: mockTxDelete });
    });
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockCancelSubscription).toHaveBeenCalledWith(PAYLOAD.userId);
    expect(order).toEqual(['cancel', 'erase']);
  });

  it('does NOT erase when the Stripe cancellation fails — the job must retry', async () => {
    // Erasure has a 30-day statutory window, so a delayed retry is acceptable. An
    // uncancellable live subscription against an erased account is not: there would
    // be nobody left to refund and no record to reason about.
    mockCancelSubscription.mockRejectedValue(new Error('stripe unreachable'));
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await expect(handleAccountAnonymize(PAYLOAD)).rejects.toThrow('stripe unreachable');
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('runs all writes inside a single transaction', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('overwrites the user row with anonymous identifiers and stamps anonymizedAt', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    // First update is the user row
    const userSet = mockTxUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(userSet.name).toBe('Deleted User');
    expect(userSet.email).toBe(`${PAYLOAD.userId}@deleted.ceolx.com`);
    expect(userSet.image).toBeNull();
    expect(userSet.consentAt).toBeNull();
    expect(userSet.marketingConsent).toBe(false);
    expect(userSet.lastLoginAt).toBeNull();
    expect(userSet.isAnonymized).toBe(true);
    expect(userSet.anonymizedAt).toBeInstanceOf(Date);
  });

  it('anonymises artist + venue profile rows alongside the user', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    const sets = mockTxUpdateSet.mock.calls.map((c) => c[0]);
    const artistSet = sets.find((s) => s.stageName === 'Deleted Artist');
    const venueSet = sets.find((s) => s.venueName === 'Deleted Venue');
    expect(artistSet).toBeDefined();
    expect(artistSet?.bio).toBeNull();
    expect(artistSet?.profileImageUrl).toBeNull();
    expect(artistSet?.isActive).toBe(false);
    expect(venueSet).toBeDefined();
    expect(venueSet?.bio).toBeNull();
    expect(venueSet?.lat).toBeNull();
    // venue_profiles.is_active was dropped in M8-T1 (D-14). An anonymised venue is
    // now hidden by moving its subscription status to `cancelled` — leaving the
    // status untouched would keep a deleted venue publicly visible if it happened
    // to be mid-trial. The artist assertion above is a DIFFERENT column meaning
    // "persona switched away" and is deliberately unchanged.
    expect(venueSet?.subscriptionStatus).toBe('cancelled');
    expect(venueSet).not.toHaveProperty('isActive');
  });

  it('hard-deletes profile social links, device tokens, and active sessions', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    // Three deletes: profile_social_links, device_tokens, session
    expect(mockTxDelete).toHaveBeenCalledTimes(3);
  });
});

describe('handleAccountAnonymize — deletion confirmation email', () => {
  it('emails the original address after anonymising', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockSendAccountDeleted).toHaveBeenCalledWith({
      to: 'real@example.com',
      userName: 'Aoife',
    });
  });

  it('does not email when the row is a no-op (already anonymised)', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: true, deletionScheduledFor: new Date(), email: 'x@example.com', name: 'X' },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockSendAccountDeleted).not.toHaveBeenCalled();
  });

  it('still completes erasure when the email send fails', async () => {
    mockSendAccountDeleted.mockRejectedValueOnce(new Error('postmark down'));
    mockSelectLimit.mockResolvedValueOnce([
      {
        isAnonymized: false,
        deletionScheduledFor: new Date('2026-05-28'),
        email: 'real@example.com',
        name: 'Aoife',
      },
    ]);

    await expect(handleAccountAnonymize(PAYLOAD)).resolves.toBeUndefined();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
