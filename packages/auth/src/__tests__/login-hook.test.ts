// Hoisted Drizzle mocks — vi.mock() is lifted by Vitest before any imports.

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn(() => ({ limit: mockSelectLimit })));
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

// `update().set().where()` is awaited directly (lastLoginAt update) AND has a
// `.returning()` for the welcome claim. So `where` returns a thenable that also
// exposes `.returning`. The welcome claim's result is driven by mockWelcomeClaim.
const mockWelcomeClaim = vi.hoisted(() =>
  vi.fn(() => [] as Array<{ email: string; name: string }>)
);
const mockUpdateWhere = vi.hoisted(() =>
  vi.fn(() => ({
    returning: () => mockWelcomeClaim(),
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  }))
);
const mockUpdateSet = vi.hoisted(() =>
  vi.fn((_args: Record<string, unknown>) => ({ where: mockUpdateWhere }))
);
const mockUpdate = vi.hoisted(() => vi.fn((_table: unknown) => ({ set: mockUpdateSet })));

// `insert().values()` is awaited directly (notification_users) AND has a
// `.returning()` (notifications). Same thenable+returning shape.
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({
    returning: () => [{ id: 'notif_1' }],
    then: (resolve: (v: unknown) => void) => resolve(undefined),
  }))
);
const mockInsert = vi.hoisted(() => vi.fn(() => ({ values: mockInsertValues })));

const mockSendWelcomeEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@CeolX/db', () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', email: 'email', name: 'name', welcomeSentAt: 'welcome_sent_at' },
}));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: { id: 'id' },
  notificationUsers: {},
}));

vi.mock('@CeolX/email', () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

vi.mock('@CeolX/env/server', () => ({
  env: { BETTER_AUTH_URL: 'https://api.ceolx.test' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
  and: (...clauses: unknown[]) => ({ and: clauses }),
  isNull: (col: unknown) => ({ isNull: col }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { onSessionCreated } from '../login-hook.js';

afterEach(() => {
  vi.clearAllMocks();
  mockWelcomeClaim.mockReturnValue([]);
  mockSendWelcomeEmail.mockResolvedValue(undefined);
});

const SESSION = { userId: 'user_abc' };

describe('onSessionCreated — happy path (no pending deletion)', () => {
  it('updates lastLoginAt only', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: false }]);

    await onSessionCreated(SESSION);

    // First update is the lastLoginAt stamp.
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
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(onSessionCreated(SESSION)).resolves.toBeUndefined();
    // lastLoginAt update + the welcome-claim update both run.
    expect(mockUpdate).toHaveBeenCalled();
  });
});

// ─── ONB-01 welcome ───────────────────────────────────────────────────────────

describe('onSessionCreated — welcome on first session', () => {
  it('claims welcomeSentAt, writes the inbox row, and sends the welcome email', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: false }]);
    mockWelcomeClaim.mockReturnValueOnce([{ email: 'new@ceolx.ie', name: 'Aoife' }]);

    await onSessionCreated(SESSION);

    // The second update is the atomic welcomeSentAt claim.
    const welcomeSet = mockUpdateSet.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(welcomeSet.welcomeSentAt).toBeInstanceOf(Date);

    // Inbox row (notifications) + per-user delivery row (notification_users).
    expect(mockInsert).toHaveBeenCalledTimes(2);
    const inboxValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inboxValues).toMatchObject({ type: 'welcome', persona: 'spectator' });
    expect(mockInsertValues.mock.calls[1]?.[0]).toMatchObject({
      notificationId: 'notif_1',
      userId: 'user_abc',
    });

    // Email with the HTTPS redirect-bridge CTA to the Discover feed.
    expect(mockSendWelcomeEmail).toHaveBeenCalledTimes(1);
    const call = mockSendWelcomeEmail.mock.calls[0] as [string, string, string] | undefined;
    expect(call?.[0]).toBe('new@ceolx.ie');
    expect(call?.[2]).toBe('Aoife');
    expect(call?.[1]).toContain('https://api.ceolx.test/r?to=');
    expect(call?.[1]).toContain(encodeURIComponent('/(app)/(tabs)/discover'));
  });

  it('is a no-op when the account was already welcomed (claim returns nothing)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: false }]);
    mockWelcomeClaim.mockReturnValueOnce([]);

    await onSessionCreated(SESSION);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('never lets a welcome failure bubble out and fail the login', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null, isAnonymized: false }]);
    mockWelcomeClaim.mockReturnValueOnce([{ email: 'new@ceolx.ie', name: 'Aoife' }]);
    mockSendWelcomeEmail.mockRejectedValueOnce(new Error('postmark down'));

    await expect(onSessionCreated(SESSION)).resolves.toBeUndefined();
  });
});
