import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// Asana 1215189395180422 — an artist adding a registered venue must create a
// PENDING request the venue approves; the event holds at pending_review (off
// map/feed) until the venue accepts, then goes active.

// ─── Hoisted mocks — a richer db than the per-router test files, so create,
// update (edit), and the booking accept-flip can all be exercised here. ───────

const {
  mockDb,
  mockInsertValues,
  mockInsertReturning,
  mockUpdateSetValues,
  mockUpdateReturning,
  mockVenuesFindFirst,
  mockArtistsFindFirst,
  mockEventsFindFirst,
  mockBookingsFindFirst,
  mockEventCollabsFindMany,
  mockSyncEventToTypesense,
  mockRemoveEventFromTypesense,
  mockResolveCoords,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn((_values?: unknown) => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateSetValues = vi.fn();
  const mockDeleteWhere = vi.fn(() => Promise.resolve());
  const mockVenuesFindFirst = vi.fn();
  const mockArtistsFindFirst = vi.fn();
  const mockEventsFindFirst = vi.fn();
  const mockBookingsFindFirst = vi.fn();
  const mockEventCollabsFindMany = vi.fn(() => Promise.resolve([] as unknown[]));
  const mockSyncEventToTypesense = vi.fn(() => Promise.resolve());
  const mockRemoveEventFromTypesense = vi.fn(() => Promise.resolve());
  const mockResolveCoords = vi.fn(() => Promise.resolve({ lat: '53.3498', lng: '-6.2603' }));

  const mockDb: Record<string, unknown> = {};
  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: mockVenuesFindFirst },
      artistProfiles: { findFirst: mockArtistsFindFirst },
      events: { findFirst: mockEventsFindFirst },
      bookings: { findFirst: mockBookingsFindFirst },
      eventCollaborators: { findMany: mockEventCollabsFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: vi.fn((v: unknown) => {
        mockUpdateSetValues(v);
        return { where: vi.fn(() => ({ returning: mockUpdateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) })) })),
    })),
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  });

  return {
    mockDb,
    mockInsertValues,
    mockInsertReturning,
    mockUpdateSetValues,
    mockUpdateReturning,
    mockVenuesFindFirst,
    mockArtistsFindFirst,
    mockEventsFindFirst,
    mockBookingsFindFirst,
    mockEventCollabsFindMany,
    mockSyncEventToTypesense,
    mockRemoveEventFromTypesense,
    mockResolveCoords,
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
    direction: 'direction',
  },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    title: 'title',
    createdBy: 'created_by',
    status: 'status',
    venueId: 'venue_id',
  },
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    venueProfileId: 'venue_profile_id',
    bookingId: 'booking_id',
  },
  savedEvents: { id: 'id', eventId: 'event_id', userId: 'user_id' },
}));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { id: 'id', userId: 'user_id', stageName: 'stage_name' },
  venueProfiles: { id: 'id', userId: 'user_id', venueName: 'venue_name', lat: 'lat', lng: 'lng' },
}));
vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: mockSyncEventToTypesense,
  removeEventFromTypesense: mockRemoveEventFromTypesense,
}));
vi.mock('../routers/events/helpers', () => ({
  resolveEventCoordinates: mockResolveCoords,
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { bookingsRouter } from '../routers/bookings';
import { create, update } from '../routers/events/crud';

const testRouter = router({
  events: router({ create, update }),
  bookings: bookingsRouter,
});
const createCaller = t.createCallerFactory(testRouter);
const mockDispatchNotification = vi.fn(async () => {});

const ARTIST_USER_ID = 'artist-user-456';
const VENUE_USER_ID = 'venue-user-123';
const ARTIST_PROFILE_ID = 'a1111111-1111-4111-a111-111111111111';
const VENUE_PROFILE_ID = 'b2222222-2222-4222-a222-222222222222';
const EVENT_ID = 'c3333333-3333-4333-a333-333333333333';
const BOOKING_ID = 'd4444444-4444-4444-a444-444444444444';

function ctx(role: UserRole, userId: string): Context {
  return {
    userId,
    currentRole: role,
    session: { user: { id: userId, currentRole: role, email: 'x@y.z', emailVerified: true } },
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

const artistEventInput = {
  title: 'Friday Night Trad Session',
  description: 'A great traditional Irish music session at the pub.',
  dateStart: new Date('2026-07-01T20:00:00Z').toISOString(),
  lat: 53.3498,
  lng: -6.2603,
  category: 'Traditional' as const,
};

const insertedEvent = {
  id: EVENT_ID,
  title: artistEventInput.title,
  createdBy: ARTIST_USER_ID,
  dateStart: new Date(artistEventInput.dateStart),
};

const venueProfile = { id: VENUE_PROFILE_ID, userId: VENUE_USER_ID, venueName: 'The Temple Bar' };
const artistProfile = {
  id: ARTIST_PROFILE_ID,
  userId: ARTIST_USER_ID,
  stageName: 'Celtic Thunder',
};

/** Find the values passed to the events insert (the call carrying `title`). */
const eventInsertValues = () =>
  mockInsertValues.mock.calls
    .map((c) => c[0])
    .find((v) => v && typeof v === 'object' && 'title' in v) as Record<string, unknown> | undefined;
/** Find the values passed to the bookings insert (the call carrying `direction`). */
const bookingInsertValues = () =>
  mockInsertValues.mock.calls
    .map((c) => c[0])
    .find((v) => v && typeof v === 'object' && 'direction' in v) as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveCoords.mockResolvedValue({ lat: '53.3498', lng: '-6.2603' });
  mockEventCollabsFindMany.mockResolvedValue([]);
});

// ─── events.create ────────────────────────────────────────────────────────────

describe('events.create — artist adds a registered venue', () => {
  it('holds the event at pending_review with a PENDING request, no map sync', async () => {
    mockVenuesFindFirst.mockResolvedValue(venueProfile);
    mockArtistsFindFirst.mockResolvedValue(artistProfile);
    mockInsertReturning
      .mockResolvedValueOnce([{ ...insertedEvent, status: 'pending_review' }]) // event
      .mockResolvedValueOnce([{ id: BOOKING_ID }]); // booking

    const caller = createCaller(ctx('artist', ARTIST_USER_ID));
    await caller.events.create({ ...artistEventInput, venueId: VENUE_PROFILE_ID });

    expect(eventInsertValues()?.status).toBe('pending_review');
    expect(bookingInsertValues()).toMatchObject({
      status: 'pending',
      direction: 'artist_to_venue',
    });
    expect(mockSyncEventToTypesense).not.toHaveBeenCalled();
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'booking_request_to_venue',
        recipientUserId: VENUE_USER_ID,
      })
    );
  });
});

describe('events.create — artist with free-text address only', () => {
  it('goes live (active) immediately with no booking', async () => {
    mockInsertReturning.mockResolvedValueOnce([{ ...insertedEvent, status: 'active' }]);

    const caller = createCaller(ctx('artist', ARTIST_USER_ID));
    await caller.events.create({ ...artistEventInput, venueAddress: 'Some Pub, Galway' });

    expect(eventInsertValues()?.status).toBe('active');
    expect(bookingInsertValues()).toBeUndefined();
    expect(mockSyncEventToTypesense).toHaveBeenCalledOnce();
  });
});

// ─── events.update — artist adds a registered venue on edit ────────────────────

describe('events.update — artist adds a registered venue', () => {
  it('holds the event at pending_review and creates a PENDING request', async () => {
    mockEventsFindFirst.mockResolvedValue({
      id: EVENT_ID,
      title: 'X',
      createdBy: ARTIST_USER_ID,
      status: 'active',
      venueId: null,
      dateStart: new Date('2026-07-01T20:00:00Z'),
    });
    mockVenuesFindFirst.mockResolvedValue(venueProfile);
    mockArtistsFindFirst.mockResolvedValue(artistProfile);
    mockBookingsFindFirst.mockResolvedValue(null); // no existing pending venue booking
    mockUpdateReturning.mockResolvedValue([
      {
        id: EVENT_ID,
        title: 'X',
        status: 'pending_review',
        dateStart: new Date('2026-07-01T20:00:00Z'),
      },
    ]);
    mockInsertReturning.mockResolvedValueOnce([{ id: BOOKING_ID }]);

    const caller = createCaller(ctx('artist', ARTIST_USER_ID));
    await caller.events.update({ id: EVENT_ID, data: { venueId: VENUE_PROFILE_ID } });

    expect(mockUpdateSetValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review' })
    );
    expect(bookingInsertValues()).toMatchObject({
      status: 'pending',
      direction: 'artist_to_venue',
    });
    expect(mockRemoveEventFromTypesense).toHaveBeenCalled();
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'booking_request_to_venue',
        recipientUserId: VENUE_USER_ID,
      })
    );
  });
});

// ─── bookings.update — venue accepts/rejects the artist's request ──────────────

const heldBooking = {
  id: BOOKING_ID,
  artistId: ARTIST_PROFILE_ID,
  venueId: VENUE_PROFILE_ID,
  eventId: EVENT_ID,
  status: 'pending',
  direction: 'artist_to_venue',
  artist: artistProfile,
  venue: venueProfile,
  event: {
    id: EVENT_ID,
    title: 'Friday Night Trad Session',
    status: 'pending_review',
    dateStart: new Date('2026-07-01T20:00:00Z'),
  },
};

describe('bookings.update — venue accepts an artist→venue request', () => {
  it('flips a pending_review event to active and syncs it to the map', async () => {
    mockBookingsFindFirst.mockResolvedValue(heldBooking);
    mockUpdateReturning.mockResolvedValue([{ ...heldBooking, status: 'accepted' }]);

    const caller = createCaller(ctx('venue', VENUE_USER_ID));
    await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });

    expect(mockUpdateSetValues).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(mockSyncEventToTypesense).toHaveBeenCalled();
  });

  it('does NOT touch an already-active event (requestToPerform case)', async () => {
    const activeEventBooking = {
      ...heldBooking,
      event: { ...heldBooking.event, status: 'active' },
    };
    mockBookingsFindFirst.mockResolvedValue(activeEventBooking);
    mockUpdateReturning.mockResolvedValue([{ ...activeEventBooking, status: 'accepted' }]);

    const caller = createCaller(ctx('venue', VENUE_USER_ID));
    await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });

    expect(mockUpdateSetValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
    expect(mockSyncEventToTypesense).not.toHaveBeenCalled();
  });
});

describe('bookings.update — venue rejects an artist→venue request', () => {
  it('leaves the event held (does not activate, does not sync)', async () => {
    mockBookingsFindFirst.mockResolvedValue(heldBooking);
    mockUpdateReturning.mockResolvedValue([{ ...heldBooking, status: 'rejected' }]);

    const caller = createCaller(ctx('venue', VENUE_USER_ID));
    await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });

    expect(mockUpdateSetValues).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' })
    );
    expect(mockSyncEventToTypesense).not.toHaveBeenCalled();
  });
});
