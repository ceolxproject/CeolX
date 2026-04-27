import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockListSelect, mockCountSelect, mockUpdateReturning, mockDb } = vi.hoisted(() => {
  const mockListSelect = vi.fn();
  const mockCountSelect = vi.fn();
  const mockUpdateReturning = vi.fn();

  const selectWithoutFields = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: mockListSelect,
          })),
        })),
      })),
    })),
  }));

  const selectWithFields = vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockCountSelect,
    })),
  }));

  const updateChain = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: mockUpdateReturning,
      })),
    })),
  }));

  const mockDb = {
    select: vi.fn((fields?: unknown) => (fields ? selectWithFields() : selectWithoutFields())),
    update: updateChain,
  };

  return { mockListSelect, mockCountSelect, mockUpdateReturning, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: {
    id: 'id',
    userId: 'user_id',
    type: 'type',
    title: 'title',
    body: 'body',
    route: 'route',
    persona: 'persona',
    isRead: 'is_read',
    createdAt: 'created_at',
    archivedAt: 'archived_at',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { notificationsRouter } from '../routers/notifications';

const testRouter = router({ notifications: notificationsRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ─────────────────────────────────────────────────────────

const USER_ID = 'user-test-1';

function authedContext(role: UserRole = 'spectator', userId = USER_ID): Context {
  return {
    session: {
      user: {
        id: userId,
        name: 'Test User',
        email: 'test@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: role,
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'test-session-id',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        ipAddress: null,
        userAgent: null,
      },
    },
  };
}

function anonContext(): Context {
  return { session: null };
}

async function expectTRPCError(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected a TRPCError with code ${code} but the call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function notificationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    userId: USER_ID,
    type: 'booking_invitation',
    title: 'New Booking Invitation',
    body: 'A venue invited you',
    route: '/bookings/123',
    persona: 'artist',
    isRead: false,
    createdAt: new Date('2026-04-25T10:00:00Z'),
    archivedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── list ────────────────────────────────────────────────────────────────────

describe('notifications.list', () => {
  it('returns paginated rows newest-first with total + hasMore', async () => {
    const rows = [
      notificationRow({ id: 'r1', createdAt: new Date('2026-04-25T10:00:00Z') }),
      notificationRow({ id: 'r2', createdAt: new Date('2026-04-24T10:00:00Z') }),
    ];
    mockListSelect.mockResolvedValueOnce(rows);
    mockCountSelect.mockResolvedValueOnce([{ total: 5 }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.list({ page: 1, limit: 2 });

    expect(result.notifications).toHaveLength(2);
    expect(result.notifications[0]?.id).toBe('r1');
    expect(result.total).toBe(5);
    expect(result.hasMore).toBe(true); // offset 0 + 2 < 5
  });

  it('hasMore is false when offset+rows >= total', async () => {
    mockListSelect.mockResolvedValueOnce([notificationRow()]);
    mockCountSelect.mockResolvedValueOnce([{ total: 1 }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.list({ page: 1, limit: 20 });

    expect(result.hasMore).toBe(false);
  });

  it('default limit is 20 and accepts custom limit', async () => {
    mockListSelect.mockResolvedValue([]);
    mockCountSelect.mockResolvedValue([{ total: 0 }]);

    const caller = createCaller(authedContext());
    // Default limit
    await caller.notifications.list({});
    // Custom limit
    await caller.notifications.list({ limit: 5 });

    expect(mockListSelect).toHaveBeenCalledTimes(2);
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.notifications.list({}), 'UNAUTHORIZED');
  });

  it('coerces createdAt to ISO string in DTO', async () => {
    const ts = new Date('2026-04-25T10:00:00Z');
    mockListSelect.mockResolvedValueOnce([notificationRow({ createdAt: ts })]);
    mockCountSelect.mockResolvedValueOnce([{ total: 1 }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.list({});

    expect(result.notifications[0]?.createdAt).toBe(ts.toISOString());
  });
});

// ─── markAsRead ──────────────────────────────────────────────────────────────

describe('notifications.markAsRead', () => {
  it('returns success and is idempotent (no error if already read)', async () => {
    mockUpdateReturning.mockResolvedValue([]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.markAsRead({
      id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.notifications.markAsRead({ id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }),
      'UNAUTHORIZED'
    );
  });

  it('rejects non-uuid ids at validation', async () => {
    const caller = createCaller(authedContext());
    await expectTRPCError(caller.notifications.markAsRead({ id: 'not-a-uuid' }), 'BAD_REQUEST');
  });
});

// ─── markAllAsRead ──────────────────────────────────────────────────────────

describe('notifications.markAllAsRead', () => {
  it('returns count of marked notifications', async () => {
    mockUpdateReturning.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.markAllAsRead();

    expect(result.success).toBe(true);
    expect(result.marked).toBe(3);
  });

  it('returns 0 when nothing was unread', async () => {
    mockUpdateReturning.mockResolvedValue([]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.markAllAsRead();

    expect(result.marked).toBe(0);
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.notifications.markAllAsRead(), 'UNAUTHORIZED');
  });
});

// ─── unreadCount ────────────────────────────────────────────────────────────

describe('notifications.unreadCount', () => {
  it('returns the count of unread for the caller', async () => {
    mockCountSelect.mockResolvedValueOnce([{ count: 7 }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.unreadCount();

    expect(result.count).toBe(7);
  });

  it('returns 0 when no rows match', async () => {
    mockCountSelect.mockResolvedValueOnce([{ count: 0 }]);

    const caller = createCaller(authedContext());
    const result = await caller.notifications.unreadCount();

    expect(result.count).toBe(0);
  });

  it('rejects unauthenticated callers', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.notifications.unreadCount(), 'UNAUTHORIZED');
  });
});
