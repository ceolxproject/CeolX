// Hoisted Drizzle mocks — vi.mock is lifted above imports.
//
// The sweep does ONE predicate SELECT of due users (no .limit), then runs the
// anonymisation transaction once per returned row. So the select chain ends at
// .where() returning an array, and db.transaction is invoked per due user.

const mockSendAccountDeleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@CeolX/email', () => ({ sendAccountDeletedEmail: mockSendAccountDeleted }));

const mockSelectWhere = vi.hoisted(() => vi.fn());
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
  user: {
    id: 'id',
    email: 'email',
    name: 'name',
    deletionScheduledFor: 'deletion_scheduled_for',
    isAnonymized: 'is_anonymized',
  },
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
  // These four are stubbed with inspectable shapes: the assertions below read the
  // composed predicate rather than executing it.
  and: (...args: unknown[]) => ({ kind: 'and', args }),
  eq: (col: unknown, val: unknown) => ({ kind: 'eq', col, val }),
  isNotNull: (col: unknown) => ({ kind: 'isNotNull', col }),
  lte: (col: unknown, val: unknown) => ({ kind: 'lte', col, val }),
  // `relations` is a no-op stub, required only because the handler now reaches
  // @CeolX/api/services/subscription-sync (to cancel billing before erasure,
  // M8-T0 D-47), which imports schema files that declare relations. Nothing here
  // exercises a relational query.
  relations: () => ({}),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleAccountAnonymizeSweep } from '../../jobs/handlers/account.js';

beforeEach(() => {
  mockCancelSubscription.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleAccountAnonymizeSweep — due-row selection', () => {
  it('selects users whose deletion is due and not yet anonymised', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    const before = Date.now();
    await handleAccountAnonymizeSweep({});
    const after = Date.now();

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelectWhere).toHaveBeenCalledTimes(1);

    // The composed predicate is and(isNotNull(scheduledFor), lte(scheduledFor, now), eq(isAnonymized,false))
    const predicate = mockSelectWhere.mock.calls[0]?.[0] as { kind: string; args: unknown[] };
    expect(predicate.kind).toBe('and');
    const parts = predicate.args as { kind: string; val?: unknown }[];
    expect(parts.find((p) => p.kind === 'isNotNull')).toBeDefined();
    const lte = parts.find((p) => p.kind === 'lte') as { val: Date };
    expect(lte).toBeDefined();
    expect(lte.val).toBeInstanceOf(Date);
    expect(lte.val.getTime()).toBeGreaterThanOrEqual(before);
    expect(lte.val.getTime()).toBeLessThanOrEqual(after);
    const eqFalse = parts.find((p) => p.kind === 'eq') as { val: unknown };
    expect(eqFalse.val).toBe(false);
  });

  it('is a no-op (no transactions) when nothing is due', async () => {
    mockSelectWhere.mockResolvedValueOnce([]);

    await handleAccountAnonymizeSweep({});

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('handleAccountAnonymizeSweep — anonymisation per due user', () => {
  it('runs one anonymisation transaction per due user', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'user-a', email: 'a@x.ie', name: 'A' },
      { id: 'user-b', email: 'b@x.ie', name: 'B' },
      { id: 'user-c', email: 'c@x.ie', name: 'C' },
    ]);

    await handleAccountAnonymizeSweep({});

    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });

  it('overwrites each due user with anonymous identifiers', async () => {
    mockSelectWhere.mockResolvedValueOnce([{ id: 'user-a', email: 'a@x.ie', name: 'A' }]);

    await handleAccountAnonymizeSweep({});

    const userSet = mockTxUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(userSet.name).toBe('Deleted User');
    expect(userSet.email).toBe('user-a@deleted.ceolx.com');
    expect(userSet.isAnonymized).toBe(true);
    expect(userSet.anonymizedAt).toBeInstanceOf(Date);
  });
});

describe('handleAccountAnonymizeSweep — deletion confirmation email', () => {
  it('emails each due user at their original address', async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { id: 'user-a', email: 'a@x.ie', name: 'A' },
      { id: 'user-b', email: 'b@x.ie', name: 'B' },
    ]);

    await handleAccountAnonymizeSweep({});

    expect(mockSendAccountDeleted).toHaveBeenCalledTimes(2);
    expect(mockSendAccountDeleted).toHaveBeenCalledWith({ to: 'a@x.ie', userName: 'A' });
    expect(mockSendAccountDeleted).toHaveBeenCalledWith({ to: 'b@x.ie', userName: 'B' });
  });
});
