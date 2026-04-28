// Hoisted Drizzle mocks — vi.mock is lifted above imports.

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
  user: { id: 'id' },
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

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleAccountAnonymize } from '../../jobs/handlers/account.js';

const PAYLOAD = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  requestedAt: '2026-04-28T00:00:00.000Z',
};

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
  it('runs all writes inside a single transaction', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: false, deletionScheduledFor: new Date('2026-05-28') },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('overwrites the user row with anonymous identifiers and stamps anonymizedAt', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: false, deletionScheduledFor: new Date('2026-05-28') },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    // First update is the user row
    const userSet = mockTxUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(userSet.name).toBe('Deleted User');
    expect(userSet.email).toBe(`${PAYLOAD.userId}@deleted.ceolx.ie`);
    expect(userSet.image).toBeNull();
    expect(userSet.consentAt).toBeNull();
    expect(userSet.marketingConsent).toBe(false);
    expect(userSet.lastLoginAt).toBeNull();
    expect(userSet.isAnonymized).toBe(true);
    expect(userSet.anonymizedAt).toBeInstanceOf(Date);
  });

  it('anonymises artist + venue profile rows alongside the user', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: false, deletionScheduledFor: new Date('2026-05-28') },
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
    expect(venueSet?.isActive).toBe(false);
  });

  it('hard-deletes profile social links, device tokens, and active sessions', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      { isAnonymized: false, deletionScheduledFor: new Date('2026-05-28') },
    ]);

    await handleAccountAnonymize(PAYLOAD);

    // Three deletes: profile_social_links, device_tokens, session
    expect(mockTxDelete).toHaveBeenCalledTimes(3);
  });
});
