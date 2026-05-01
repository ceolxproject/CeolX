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
//   db.select().from(events).where().limit(1)            (lookup)
//   db.update(events).set().where().returning()          (update)

const { mockListOffset, mockCountThen, mockLookupLimit, mockUpdateReturning, mockDb } = vi.hoisted(
  () => {
    const mockListOffset = vi.fn();
    const mockCountThen = vi.fn();
    const mockLookupLimit = vi.fn();
    const mockUpdateReturning = vi.fn();

    const selectChain = vi.fn(() => ({
      from: vi.fn(() => ({
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

    return { mockListOffset, mockCountThen, mockLookupLimit, mockUpdateReturning, mockDb };
  }
);

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
    status: 'status',
    removalReason: 'removal_reason',
    createdBy: 'created_by',
    createdAt: 'created_at',
  },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: {
    id: 'id',
    name: 'name',
    currentRole: 'current_role',
  },
}));

const mockRemoveFromTypesense = vi.fn(async () => {});
vi.mock('../services/event-sync', () => ({
  removeEventFromTypesense: (id: string) => mockRemoveFromTypesense(id),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { adminRouter } from '../routers/admin';

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
    status: 'active' as const,
    removalReason: null,
    createdBy: 'creator-1',
    createdAt: new Date('2026-07-01T10:00:00Z'),
    creatorName: 'Sean Murphy',
    creatorPersona: 'artist' as UserRole,
  };

  it('returns events mapped to admin list shape with creator info', async () => {
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
    mockRemoveFromTypesense.mockRejectedValueOnce(new Error('typesense down'));

    const caller = createCaller(authedContext('admin'));
    const result = await caller.admin.removeEvent({ id: validId, removalReason: validReason });

    expect(result.status).toBe(EventStatus.REMOVED);
  });
});
