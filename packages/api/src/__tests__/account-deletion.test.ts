import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted Drizzle mocks ───────────────────────────────────────────────────

const { mockSelectLimit, mockUpdateSet, mockDb } = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockSelect = vi.fn(() => ({
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
  }));

  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn((_args: Record<string, unknown>) => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn((_table: unknown) => ({ set: mockUpdateSet }));

  return {
    mockSelectLimit,
    mockUpdateSet,
    mockDb: { select: mockSelect, update: mockUpdate },
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    deletionRequestedAt: 'deletion_requested_at',
    deletionScheduledFor: 'deletion_scheduled_for',
    deletionCancelledAt: 'deletion_cancelled_at',
    isAnonymized: 'is_anonymized',
  },
}));

import type { Context } from '../context';
import { router, t } from '../index';
import { usersRouter } from '../routers/users';

const testRouter = router({ users: usersRouter });
const createCaller = t.createCallerFactory(testRouter);

const USER_ID = 'user-test-1';

function buildCtx(): Context {
  return {
    session: {
      user: {
        id: USER_ID,
        name: 'Test',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: 'spectator',
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'session-1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: USER_ID,
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification: vi.fn(async () => {}),
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── requestAccountDeletion ──────────────────────────────────────────────────

describe('users.requestAccountDeletion', () => {
  it('rejects an unauthenticated call', async () => {
    const anonCaller = createCaller({
      session: null,
      dispatchNotification: vi.fn(async () => {}),
    } as unknown as Context);

    await expect(anonCaller.users.requestAccountDeletion()).rejects.toThrow(TRPCError);
  });

  it('persists the timestamps and returns scheduledFor without any external call', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: null }]);

    const caller = createCaller(buildCtx());
    const before = Date.now();
    const result = await caller.users.requestAccountDeletion();
    const after = Date.now();

    // Erasure is driven by the daily anonymize-sweep cron, NOT a per-request
    // job — the request path makes no QStash call (Asana 1215276188230541).
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const setArg = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.deletionRequestedAt).toBeInstanceOf(Date);
    expect(setArg.deletionScheduledFor).toBeInstanceOf(Date);

    // scheduledFor is roughly 30 days out
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expectedMin = before + thirtyDaysMs - 5_000;
    const expectedMax = after + thirtyDaysMs + 5_000;
    expect((setArg.deletionScheduledFor as Date).getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect((setArg.deletionScheduledFor as Date).getTime()).toBeLessThanOrEqual(expectedMax);
    expect(result.scheduledFor).toEqual(setArg.deletionScheduledFor);
  });

  it('is idempotent — returns existing schedule and does NOT re-stamp', async () => {
    const existing = new Date('2026-05-28T00:00:00Z');
    mockSelectLimit.mockResolvedValueOnce([{ deletionScheduledFor: existing }]);

    const caller = createCaller(buildCtx());
    const result = await caller.users.requestAccountDeletion();

    expect(result.scheduledFor).toEqual(existing);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});

// ─── cancelAccountDeletion ───────────────────────────────────────────────────

describe('users.cancelAccountDeletion', () => {
  it('clears the deletion timestamps and stamps cancelledAt', async () => {
    const caller = createCaller(buildCtx());
    const result = await caller.users.cancelAccountDeletion();

    expect(result).toEqual({ ok: true });
    const setArg = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.deletionRequestedAt).toBeNull();
    expect(setArg.deletionScheduledFor).toBeNull();
    expect(setArg.deletionCancelledAt).toBeInstanceOf(Date);
  });
});

// ─── acknowledgeDeletionNotice ───────────────────────────────────────────────

describe('users.acknowledgeDeletionNotice', () => {
  it('clears deletionCancelledAt so the toast does not re-fire', async () => {
    const caller = createCaller(buildCtx());
    const result = await caller.users.acknowledgeDeletionNotice();

    expect(result).toEqual({ ok: true });
    const setArg = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg.deletionCancelledAt).toBeNull();
  });
});
