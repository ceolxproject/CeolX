// Hoisted Drizzle mocks — vi.mock() is lifted by Vitest before any imports.

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn(() => ({ limit: mockSelectLimit })));
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUpdateSet = vi.hoisted(() => vi.fn(() => ({ where: mockUpdateWhere })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockUpdateSet })));

vi.mock('@CeolX/db', () => ({
  db: { select: mockSelect, update: mockUpdate },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { onSessionCreated } from '../login-hook.js';

afterEach(() => {
  vi.clearAllMocks();
});

const SESSION = { userId: 'user_abc' };

describe('onSessionCreated — happy path (no pending deletion)', () => {
  it('updates lastLoginAt only', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: false }]);

    await onSessionCreated(SESSION);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const setCall = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall).toHaveProperty('lastLoginAt');
    expect(setCall.lastLoginAt).toBeInstanceOf(Date);
    // No deletion fields touched on the happy path
    expect(setCall).not.toHaveProperty('deletionScheduledFor');
    expect(setCall).not.toHaveProperty('deletionRequestedAt');
    expect(setCall).not.toHaveProperty('deletionCancelledAt');
  });
});

describe('onSessionCreated — cancels pending deletion on re-login', () => {
  it('clears deletion fields and stamps deletionCancelledAt when a deletion was scheduled', async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        deletionScheduledFor: new Date('2026-05-28T00:00:00Z'),
        isAnonymized: false,
      },
    ]);

    await onSessionCreated(SESSION);

    const setCall = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setCall.lastLoginAt).toBeInstanceOf(Date);
    expect(setCall.deletionRequestedAt).toBeNull();
    expect(setCall.deletionScheduledFor).toBeNull();
    expect(setCall.deletionCancelledAt).toBeInstanceOf(Date);
  });
});

describe('onSessionCreated — refuses to log in an anonymised user', () => {
  it('throws and does not update the row', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: true }]);

    await expect(onSessionCreated(SESSION)).rejects.toThrow(/deleted/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('onSessionCreated — defensive: row not found', () => {
  it('still updates lastLoginAt (BetterAuth created the session, so the row exists by FK)', async () => {
    // Edge case: race or test fixture — row missing. We still touch lastLoginAt
    // so subsequent reads have a value; if the FK is broken the UPDATE no-ops.
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(onSessionCreated(SESSION)).resolves.toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
