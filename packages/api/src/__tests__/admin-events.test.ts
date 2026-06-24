import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';
import { EventStatus, NotificationTrigger, UserRole as UserRoleEnum } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// admin.listEvents chains:
//   db.select(fields).from(events).leftJoin(user).where().orderBy().limit().offset()
//   db.select({ total }).from(events).leftJoin(user).where()
//
// admin.removeEvent chains:
//   db.select().from(events).leftJoin(user).where().limit(1)             (lookup)
//   db.update(events).set().where().returning()                          (update)
//   db.select({ userId }).from(savedEvents).where()                      (savers)
//
// admin.restoreEvent chains:
//   db.select().from(events).where().limit(1)                            (lookup)
//   db.update(events).set().where().returning()                          (update)

const {
  mockListOffset,
  mockCountThen,
  mockLookupLimit,
  mockUpdateReturning,
  mockSaversThen,
  mockRestoreLookupLimit,
  mockDb,
} = vi.hoisted(() => {
  const mockListOffset = vi.fn();
  const mockCountThen = vi.fn();
  const mockLookupLimit = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockSaversThen = vi.fn();
  const mockRestoreLookupLimit = vi.fn();

  // The fluent builder is recursive enough that we let each .from() decide
  // whether the next step is leftJoin (events lookup/list) or where (savers).
  const selectChain = vi.fn(() => ({
    from: vi.fn(() => ({
      // events / events-with-user paths go through leftJoin
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          // listEvents pages: from().leftJoin().where().orderBy().limit().offset()
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: mockListOffset,
            })),
          })),
          // removeEvent lookup: from().leftJoin().where().limit(1)
          limit: mockLookupLimit,
          // count: from().leftJoin().where() — drizzle builders are thenable
          then: mockCountThen,
        })),
      })),
      // savedEvents path: from(savedEvents).where()
      // restoreEvent lookup: from(events).where().limit(1)
      where: vi.fn(() => ({
        limit: mockRestoreLookupLimit,
        then: mockSaversThen,
      })),
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
    select: vi.fn(() => selectChain()),
    update: updateChain,
  };

  return {
    mockListOffset,
    mockCountThen,
    mockLookupLimit,
    mockUpdateReturning,
    mockSaversThen,
    mockRestoreLookupLimit,
    mockDb,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    title: 'title',
    description: 'description',
    coverImage: 'cover_image',
    dateStart: 'date_start',
    lat: 'lat',
    lng: 'lng',
    venueAddress: 'venue_address',
    category: 'category',
    status: 'status',
    removalReason: 'removal_reason',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  savedEvents: {
    id: 'id',
    userId: 'user_id',
    eventId: 'event_id',
  },
  // listEvents now counts performers per event via a correlated subquery.
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
  },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    name: 'name',
    currentRole: 'current_role',
  },
  // usersRouter (pulled in via admin/index.ts) builds a module-level RICH_SELECT
  // that references account at import time, so the mock must export it.
  account: {
    id: 'id',
    userId: 'user_id',
    providerId: 'provider_id',
    password: 'password',
  },
}));

const mockRemoveFromTypesense = vi.fn(async () => {});
const mockSyncToTypesense = vi.fn(async () => {});
const mockBulkSync = vi.fn(() => Promise.resolve({ synced: 0 }));
vi.mock('../services/event-sync', () => ({
  removeEventFromTypesense: (id: string) => mockRemoveFromTypesense(id),
  syncEventToTypesense: (event: unknown) => mockSyncToTypesense(event),
  bulkSyncEventsToTypesense: () => mockBulkSync(),
}));
// admin.resyncEvents pulls typesense-collections into the router import graph;
// mock it so the real module (which validates Typesense env at load) stays out.
vi.mock('../lib/typesense-collections', () => ({
  ensureEventsCollection: vi.fn(async () => {}),
}));

// Mock the audit helper so tests assert "audit was attempted" without
// reaching into db.insert. The action / target type constants stay real.
const mockLogAdminAction = vi.fn(async () => {});
vi.mock('../services/admin-audit', async () => {
  const actual = await vi.importActual<typeof AdminAuditModule>('../services/admin-audit');
  return {
    ...actual,
    logAdminAction: (...args: unknown[]) => mockLogAdminAction(...(args as [unknown, unknown])),
  };
});

import type { Context } from '../context';
import { t, router } from '../index';
import { adminRouter } from '../routers/admin';
import type * as AdminAuditModule from '../services/admin-audit';
import { AdminAuditAction, AdminAuditTargetType } from '../services/admin-audit';

const testRouter = router({ admin: adminRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ──────────────────────────────────────────────────────────

function authedContext(
  role: UserRole = 'admin',
  dispatchNotification = vi.fn(async () => {})
): Context {
  return {
    session: {
      user: {
        id: 'admin-user-1',
        name: 'Admin',
        email: 'admin@ceolx.ie',
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
        id: 'sess-1',
        token: 'tok',
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'admin-user-1',
        ipAddress: null,
        userAgent: null,
      },
    },
    dispatchNotification,
  };
}

function anonContext(): Context {
  return { session: null, dispatchNotification: vi.fn(async () => {}) };
}

async function expectTRPCError(promise: Promise<unknown>, code: TRPCError['code']): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected TRPCError ${code} but call succeeded`);
  } catch (err) {
    if (!(err instanceof TRPCError)) throw err;
    expect(err.code).toBe(code);
  }
}

// Helper: most remove paths need savers to resolve to [] before they finish.
function mockNoSavers() {
  mockSaversThen.mockImplementationOnce((cb: (rows: { userId: string }[]) => unknown) =>
    Promise.resolve(cb([]))
  );
}

// ─── Auth gating ──────────────────────────────────────────────────────────────

describe('adminRouter — RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listEvents — unauthenticated → UNAUTHORIZED', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.admin.listEvents({}), 'UNAUTHORIZED');
  });

  it('listEvents — non-admin → FORBIDDEN', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(caller.admin.listEvents({}), 'FORBIDDEN');
  });

  it('removeEvent — non-admin → FORBIDDEN', async () => {
    const caller = createCaller(authedContext('venue'));
    await expectTRPCError(
      caller.admin.removeEvent({
        id: '550e8400-e29b-41d4-a716-446655440000',
        removalReason: 'Spam content reported.',
      }),
      'FORBIDDEN'
    );
  });

  it('restoreEvent — unauthenticated → UNAUTHORIZED', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.admin.restoreEvent({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      'UNAUTHORIZED'
    );
  });

  it('restoreEvent — non-admin → FORBIDDEN', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(
      caller.admin.restoreEvent({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      'FORBIDDEN'
    );
  });
});

// ─── admin.listEvents ─────────────────────────────────────────────────────────

describe('admin.listEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Trad Night',
    coverImage: null,
    description: 'A wonderful traditional session.',
    dateStart: new Date('2026-08-01T20:00:00Z'),
    lat: '53.3498',
    lng: '-6.2603',
    venueAddress: "O'Brien's Pub, Dublin",
    category: 'trad_session',
    status: 'active' as const,
    removalReason: null,
    createdBy: 'creator-1',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    creatorName: 'Sean Murphy',
    creatorPersona: 'artist' as UserRole,
  };

  it('returns events mapped to admin list shape with creator info and category', async () => {
    mockListOffset.mockResolvedValueOnce([sampleRow]);
    mockCountThen.mockImplementationOnce((cb: (rows: { total: number }[]) => unknown) =>
      Promise.resolve(cb([{ total: 1 }]))
    );

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.listEvents({});

    expect(result.total).toBe(1);
    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    expect(ev).toBeDefined();
    if (!ev) return;
    expect(ev.id).toBe(sampleRow.id);
    expect(ev.title).toBe('Trad Night');
    expect(ev.category).toBe('trad_session');
    expect(ev.status).toBe('active');
    expect(ev.removalReason).toBeNull();
    expect(ev.creator).toEqual({ id: 'creator-1', name: 'Sean Murphy', persona: 'artist' });
  });

  it('returns empty list when no events match', async () => {
    mockListOffset.mockResolvedValueOnce([]);
    mockCountThen.mockImplementationOnce((cb: (rows: { total: number }[]) => unknown) =>
      Promise.resolve(cb([{ total: 0 }]))
    );

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.listEvents({});

    expect(result).toEqual({ events: [], total: 0 });
  });

  it('rejects an invalid status filter via Zod', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(
      // @ts-expect-error - intentionally invalid for runtime validation test
      caller.admin.listEvents({ status: 'pending_review' })
    ).rejects.toThrow();
  });

  it('rejects limit > 50', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.admin.listEvents({ limit: 51 })).rejects.toThrow();
  });
});

// ─── admin.removeEvent ────────────────────────────────────────────────────────

describe('admin.removeEvent', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000';
  const validReason = 'Event location is outside Ireland.';

  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveFromTypesense.mockResolvedValue(undefined);
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('throws BAD_REQUEST when reason is shorter than 10 chars', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(
      caller.admin.removeEvent({ id: validId, removalReason: 'too short' })
    ).rejects.toThrow();
  });

  it('throws BAD_REQUEST when id is not a UUID', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(
      caller.admin.removeEvent({ id: 'not-a-uuid', removalReason: validReason })
    ).rejects.toThrow();
  });

  it('throws NOT_FOUND when event does not exist', async () => {
    mockLookupLimit.mockResolvedValueOnce([]);

    const caller = createCaller(authedContext('admin'));
    await expectTRPCError(
      caller.admin.removeEvent({ id: validId, removalReason: validReason }),
      'NOT_FOUND'
    );
  });

  it('throws NOT_FOUND when event is already removed (idempotency)', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        createdBy: 'creator-1',
      },
    ]);

    const caller = createCaller(authedContext('admin'));
    await expectTRPCError(
      caller.admin.removeEvent({ id: validId, removalReason: validReason }),
      'NOT_FOUND'
    );
  });

  it('sets status=REMOVED, populates removalReason, dispatches A-15 for artist creator', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockNoSavers();

    const dispatch = vi.fn(async () => {});
    const caller = createCaller(authedContext('admin', dispatch));
    const result = await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(result.status).toBe(EventStatus.REMOVED);
    expect(result.removalReason).toBe(validReason);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      trigger: NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_ARTIST,
      recipientUserId: 'creator-1',
      vars: {
        eventId: validId,
        eventTitle: 'Trad Night',
        reason: validReason,
      },
    });
    expect(mockRemoveFromTypesense).toHaveBeenCalledWith(validId);
  });

  it('dispatches V-14 for venue creator', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Pub Gig',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-2',
        creatorRole: UserRoleEnum.VENUE,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Pub Gig',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-2',
      },
    ]);
    mockNoSavers();

    const dispatch = vi.fn(async () => {});
    const caller = createCaller(authedContext('admin', dispatch));
    await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(dispatch).toHaveBeenCalledWith({
      trigger: NotificationTrigger.EVENT_REMOVED_BY_ADMIN_TO_VENUE,
      recipientUserId: 'creator-2',
      vars: {
        eventId: validId,
        eventTitle: 'Pub Gig',
        reason: validReason,
      },
    });
  });

  it('still succeeds when Typesense removal fails', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockNoSavers();
    mockRemoveFromTypesense.mockRejectedValueOnce(new Error('typesense down'));

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(result.status).toBe(EventStatus.REMOVED);
  });

  it('writes an admin_audit_log row with action=event.remove and the reason', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockNoSavers();

    const caller = createCaller(authedContext('admin'));
    await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(mockLogAdminAction).toHaveBeenCalledTimes(1);
    const args = mockLogAdminAction.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(args).toBeDefined();
    expect(args?.adminId).toBe('admin-user-1');
    expect(args?.action).toBe(AdminAuditAction.EVENT_REMOVE);
    expect(args?.targetType).toBe(AdminAuditTargetType.EVENT);
    expect(args?.targetId).toBe(validId);
    expect(args?.reason).toBe(validReason);
  });

  it('still succeeds when audit log write fails (best-effort)', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockNoSavers();
    mockLogAdminAction.mockRejectedValueOnce(new Error('db down'));

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(result.status).toBe(EventStatus.REMOVED);
  });

  it('cascades U-03 SAVED_EVENT_REMOVED_TO_SAVERS to every saver, excluding the creator', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockSaversThen.mockImplementationOnce((cb: (rows: { userId: string }[]) => unknown) =>
      Promise.resolve(cb([{ userId: 'fan-1' }, { userId: 'fan-2' }, { userId: 'creator-1' }]))
    );

    const dispatch = vi.fn(async () => {});
    const caller = createCaller(authedContext('admin', dispatch));
    await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    // Creator dispatch (1) + saver fan-out for fan-1 and fan-2 (2) — creator-1
    // is filtered out so they don't get both messages.
    expect(dispatch).toHaveBeenCalledTimes(3);

    const saverCalls = dispatch.mock.calls.filter(
      ([arg]) =>
        (arg as { trigger: string }).trigger === NotificationTrigger.SAVED_EVENT_REMOVED_TO_SAVERS
    );
    expect(saverCalls).toHaveLength(2);
    const saverRecipients = saverCalls.map(
      (c) => (c[0] as { recipientUserId: string }).recipientUserId
    );
    expect(saverRecipients).toEqual(expect.arrayContaining(['fan-1', 'fan-2']));
    expect(saverRecipients).not.toContain('creator-1');
  });

  it('does not call dispatchNotification with U-03 when no users saved the event', async () => {
    mockLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
        creatorRole: UserRoleEnum.ARTIST,
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.REMOVED,
        removalReason: validReason,
        createdBy: 'creator-1',
      },
    ]);
    mockNoSavers();

    const dispatch = vi.fn(async () => {});
    const caller = createCaller(authedContext('admin', dispatch));
    await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    // Only the creator dispatch fires.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(
      dispatch.mock.calls.some(
        ([arg]) =>
          (arg as { trigger: string }).trigger === NotificationTrigger.SAVED_EVENT_REMOVED_TO_SAVERS
      )
    ).toBe(false);
  });
});

// ─── admin.restoreEvent ───────────────────────────────────────────────────────

describe('admin.restoreEvent', () => {
  const validId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncToTypesense.mockResolvedValue(undefined);
    mockLogAdminAction.mockResolvedValue(undefined);
  });

  it('throws BAD_REQUEST when id is not a UUID', async () => {
    const caller = createCaller(authedContext('admin'));
    await expect(caller.admin.restoreEvent({ id: 'not-a-uuid' })).rejects.toThrow();
  });

  it('throws NOT_FOUND when event does not exist', async () => {
    mockRestoreLookupLimit.mockResolvedValueOnce([]);

    const caller = createCaller(authedContext('admin'));
    await expectTRPCError(caller.admin.restoreEvent({ id: validId }), 'NOT_FOUND');
  });

  it('throws NOT_FOUND when event is not currently removed', async () => {
    mockRestoreLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        status: EventStatus.ACTIVE,
        createdBy: 'creator-1',
      },
    ]);

    const caller = createCaller(authedContext('admin'));
    await expectTRPCError(caller.admin.restoreEvent({ id: validId }), 'NOT_FOUND');
  });

  it('flips status to ACTIVE, clears removalReason, writes audit row, re-syncs Typesense, no creator dispatch', async () => {
    mockRestoreLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        status: EventStatus.REMOVED,
        createdBy: 'creator-1',
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        removalReason: null,
        createdBy: 'creator-1',
      },
    ]);

    const dispatch = vi.fn(async () => {});
    const caller = createCaller(authedContext('admin', dispatch));
    const result = await caller.admin.restoreEvent({ id: validId });

    expect(result.status).toBe(EventStatus.ACTIVE);
    expect(result.removalReason).toBeNull();
    expect(mockSyncToTypesense).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();

    expect(mockLogAdminAction).toHaveBeenCalledTimes(1);
    const args = mockLogAdminAction.mock.calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(args).toBeDefined();
    expect(args?.adminId).toBe('admin-user-1');
    expect(args?.action).toBe(AdminAuditAction.EVENT_RESTORE);
    expect(args?.targetType).toBe(AdminAuditTargetType.EVENT);
    expect(args?.targetId).toBe(validId);
    expect(args?.reason).toBeNull();
  });

  it('still succeeds when Typesense re-sync fails', async () => {
    mockRestoreLookupLimit.mockResolvedValueOnce([
      {
        id: validId,
        status: EventStatus.REMOVED,
        createdBy: 'creator-1',
      },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([
      {
        id: validId,
        title: 'Trad Night',
        status: EventStatus.ACTIVE,
        removalReason: null,
        createdBy: 'creator-1',
      },
    ]);
    mockSyncToTypesense.mockRejectedValueOnce(new Error('typesense down'));

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.restoreEvent({ id: validId });

    expect(result.status).toBe(EventStatus.ACTIVE);
  });
});
