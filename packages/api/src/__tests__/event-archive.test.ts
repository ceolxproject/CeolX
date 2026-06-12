import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';
import { EventStatus, NotificationTrigger } from '@CeolX/shared';

// Asana 1215489535915818 — deleting an event soft-archives it AND must notify
// the linked counterparty (the other side of any live booking). It must also
// drop out of the creator's My Events list.

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// archive chains:
//   db.query.events.findFirst()                                   (lookup)
//   db.update(events).set().where().returning()                   (archive)
//   db.select(...).from(bookings).leftJoin().leftJoin().where()   (linked, thenable)
// getMyEvents chains:
//   db.select(...).from(events).where().orderBy().limit().offset()  (rows)
//   db.select({count}).from(events).where()                         (count, thenable)

const {
  mockDb,
  mockEventsFindFirst,
  mockUpdateReturning,
  mockLinkedThen,
  mockRowsOffset,
  mockCountThen,
} = vi.hoisted(() => {
  const mockEventsFindFirst = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockLinkedThen = vi.fn(() => Promise.resolve([] as unknown[]));
  const mockRowsOffset = vi.fn(() => Promise.resolve([] as unknown[]));
  const mockCountThen = vi.fn(() => Promise.resolve([{ count: 0 }]));

  const selectImpl = () => ({
    from: () => ({
      // archive linked query
      leftJoin: () => ({
        leftJoin: () => ({
          where: () => ({
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              mockLinkedThen().then(resolve, reject),
          }),
        }),
      }),
      // getMyEvents — rows path (orderBy/limit/offset) and count path (thenable)
      where: () => ({
        orderBy: () => ({ limit: () => ({ offset: mockRowsOffset }) }),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          mockCountThen().then(resolve, reject),
      }),
    }),
  });

  const mockDb: Record<string, unknown> = {};
  Object.assign(mockDb, {
    query: { events: { findFirst: mockEventsFindFirst } },
    select: vi.fn(() => selectImpl()),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
    })),
  });

  return {
    mockDb,
    mockEventsFindFirst,
    mockUpdateReturning,
    mockLinkedThen,
    mockRowsOffset,
    mockCountThen,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', image: 'image' } }));
vi.mock('@CeolX/db/schema/bookings', () => ({
  bookings: {
    id: 'id',
    artistId: 'artist_id',
    venueId: 'venue_id',
    eventId: 'event_id',
    status: 'status',
  },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    title: 'title',
    coverImage: 'cover_image',
    dateStart: 'date_start',
    dateEnd: 'date_end',
    category: 'category',
    status: 'status',
    rejectionReason: 'rejection_reason',
    removalReason: 'removal_reason',
    venueAddress: 'venue_address',
    createdBy: 'created_by',
    createdAt: 'created_at',
  },
  eventCollaborators: { id: 'id', eventId: 'event_id', bookingId: 'booking_id' },
  savedEvents: { id: 'id', eventId: 'event_id', userId: 'user_id' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { id: 'id', userId: 'user_id', stageName: 'stage_name' },
  venueProfiles: { id: 'id', userId: 'user_id', venueName: 'venue_name' },
}));
vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: vi.fn(() => Promise.resolve()),
  removeEventFromTypesense: vi.fn(() => Promise.resolve()),
}));
vi.mock('../routers/events/helpers', () => ({
  resolveEventCoordinates: vi.fn(),
  resolveProfileImageUrl: vi.fn(),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { archive, getMyEvents } from '../routers/events/crud';

const testRouter = router({ events: router({ archive, getMyEvents }) });
const createCaller = t.createCallerFactory(testRouter);
const mockDispatchNotification = vi.fn(async () => {});

const ARTIST_USER_ID = 'artist-user-456';
const VENUE_USER_ID = 'venue-user-123';
const EVENT_ID = 'c3333333-3333-4333-a333-333333333333';

function ctx(role: UserRole, userId: string): Context {
  return {
    userId,
    currentRole: role,
    session: { user: { id: userId, currentRole: role, email: 'x@y.z', emailVerified: true } },
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLinkedThen.mockResolvedValue([]);
  mockRowsOffset.mockResolvedValue([]);
  mockCountThen.mockResolvedValue([{ count: 0 }]);
  mockUpdateReturning.mockResolvedValue([
    { id: EVENT_ID, title: 'Friday Night Trad', status: EventStatus.ARCHIVED },
  ]);
});

describe('events.archive — counterparty notifications', () => {
  it('notifies the invited artist when a venue deletes the event (not the creator)', async () => {
    mockEventsFindFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      title: 'Friday Night Trad',
      createdBy: VENUE_USER_ID,
      status: EventStatus.ACTIVE,
    });
    // One live booking links the venue (creator) and the invited artist.
    mockLinkedThen.mockResolvedValueOnce([
      { artistUserId: ARTIST_USER_ID, venueUserId: VENUE_USER_ID },
    ]);

    const caller = createCaller(ctx('venue' as UserRole, VENUE_USER_ID));
    await caller.events.archive({ id: EVENT_ID });

    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_ARTIST,
      recipientUserId: ARTIST_USER_ID,
      vars: { eventTitle: 'Friday Night Trad' },
    });
  });

  it('notifies the tagged venue when an artist deletes the event', async () => {
    mockEventsFindFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      title: 'Friday Night Trad',
      createdBy: ARTIST_USER_ID,
      status: EventStatus.ACTIVE,
    });
    mockLinkedThen.mockResolvedValueOnce([
      { artistUserId: ARTIST_USER_ID, venueUserId: VENUE_USER_ID },
    ]);

    const caller = createCaller(ctx('artist' as UserRole, ARTIST_USER_ID));
    await caller.events.archive({ id: EVENT_ID });

    expect(mockDispatchNotification).toHaveBeenCalledTimes(1);
    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: NotificationTrigger.EVENT_DELETED_BY_CREATOR_TO_VENUE,
      recipientUserId: VENUE_USER_ID,
      vars: { eventTitle: 'Friday Night Trad' },
    });
  });

  it('dispatches nothing when the event has no linked bookings', async () => {
    mockEventsFindFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      title: 'Solo Set',
      createdBy: VENUE_USER_ID,
      status: EventStatus.ACTIVE,
    });
    mockLinkedThen.mockResolvedValueOnce([]);

    const caller = createCaller(ctx('venue' as UserRole, VENUE_USER_ID));
    await caller.events.archive({ id: EVENT_ID });

    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it('rejects archiving a non-active event before any dispatch', async () => {
    mockEventsFindFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      title: 'Old Gig',
      createdBy: VENUE_USER_ID,
      status: EventStatus.ARCHIVED,
    });

    const caller = createCaller(ctx('venue' as UserRole, VENUE_USER_ID));
    await expect(caller.events.archive({ id: EVENT_ID })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });
});

describe('events.getMyEvents — excludes archived', () => {
  it('returns the non-archived rows the filtered query yields', async () => {
    mockRowsOffset.mockResolvedValueOnce([
      {
        id: EVENT_ID,
        title: 'Active Gig',
        coverImage: null,
        dateStart: new Date('2026-07-01T20:00:00Z'),
        dateEnd: null,
        category: 'Open Trad Sessions',
        status: EventStatus.ACTIVE,
        rejectionReason: null,
        removalReason: null,
        venueAddress: null,
        createdAt: new Date('2026-06-01T00:00:00Z'),
        joinedCount: 3,
      },
    ]);
    mockCountThen.mockResolvedValueOnce([{ count: 1 }]);

    const caller = createCaller(ctx('venue' as UserRole, VENUE_USER_ID));
    const result = await caller.events.getMyEvents({ limit: 20, offset: 0 });

    expect(result.totalCount).toBe(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.status).toBe(EventStatus.ACTIVE);
    expect(result.events[0]?.dateStart).toBe('2026-07-01T20:00:00.000Z');
  });
});
