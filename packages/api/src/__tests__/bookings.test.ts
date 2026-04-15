import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks (separate fns per query namespace) ────���──────────────────

const {
  mockVenuesFindFirst,
  mockArtistsFindFirst,
  mockBookingsFindFirst,
  mockBookingsFindMany,
  mockEventsFindFirst,
  mockCollabsFindFirst,
  mockUserFindFirst,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteWhere,
  mockSelectLimit,
  mockSelectWhere,
  mockTransaction,
  mockDb,
} = vi.hoisted(() => {
  const mockVenuesFindFirst = vi.fn();
  const mockArtistsFindFirst = vi.fn();
  const mockBookingsFindFirst = vi.fn();
  const mockBookingsFindMany = vi.fn();
  const mockEventsFindFirst = vi.fn();
  const mockCollabsFindFirst = vi.fn();
  const mockUserFindFirst = vi.fn();
  const mockInsertReturning = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockDeleteWhere = vi.fn();
  const mockSelectLimit = vi.fn();
  const mockSelectWhere = vi.fn();

  const mockDb: Record<string, unknown> = {};
  const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

  const mockInsertValues = vi.fn(() => ({
    returning: mockInsertReturning,
    onConflictDoNothing: vi.fn(() => Promise.resolve()),
  }));

  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: mockVenuesFindFirst },
      artistProfiles: { findFirst: mockArtistsFindFirst },
      bookings: { findFirst: mockBookingsFindFirst, findMany: mockBookingsFindMany },
      events: { findFirst: mockEventsFindFirst },
      eventCollaborators: { findFirst: mockCollabsFindFirst },
      user: { findFirst: mockUserFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: mockUpdateReturning,
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: mockDeleteWhere.mockReturnValue(Promise.resolve()),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere.mockReturnValue({
          limit: mockSelectLimit.mockResolvedValue([]),
          then: vi.fn((cb: (v: unknown[]) => void) => cb([])),
        }),
      })),
    })),
    transaction: mockTransaction,
  });

  return {
    mockVenuesFindFirst,
    mockArtistsFindFirst,
    mockBookingsFindFirst,
    mockBookingsFindMany,
    mockEventsFindFirst,
    mockCollabsFindFirst,
    mockUserFindFirst,
    mockInsertReturning,
    mockUpdateReturning,
    mockDeleteWhere,
    mockSelectLimit,
    mockSelectWhere,
    mockTransaction,
    mockDb,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', image: 'image' },
}));

vi.mock('@CeolX/db/schema/bookings', () => ({
  bookings: {
    id: 'id',
    artistId: 'artist_id',
    venueId: 'venue_id',
    eventId: 'event_id',
    status: 'status',
    direction: 'direction',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    title: 'title',
    createdBy: 'created_by',
    status: 'status',
  },
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    bookingId: 'booking_id',
    invitedName: 'invited_name',
    invitedEmail: 'invited_email',
  },
}));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: { id: 'id', userId: 'user_id', type: 'type', payload: 'payload' },
}));

vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: {
    id: 'id',
    userId: 'user_id',
    stageName: 'stage_name',
    isActive: 'is_active',
    genre: 'genre',
  },
  venueProfiles: {
    id: 'id',
    userId: 'user_id',
    venueName: 'venue_name',
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { bookingsRouter } from '../routers/bookings';

const testRouter = router({ bookings: bookingsRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ─────────────────────────────────────────────────────────

function authedContext(role: UserRole, userId = 'test-user-id'): Context {
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
  } as unknown as Context;
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

const VENUE_USER_ID = 'venue-user-123';
const ARTIST_USER_ID = 'artist-user-456';
const ARTIST_PROFILE_ID = 'a1111111-1111-4111-a111-111111111111';
const VENUE_PROFILE_ID = 'b2222222-2222-4222-a222-222222222222';
const EVENT_ID = 'c3333333-3333-4333-a333-333333333333';
const BOOKING_ID = 'd4444444-4444-4444-a444-444444444444';

const mockVenueProfile = {
  id: VENUE_PROFILE_ID,
  userId: VENUE_USER_ID,
  venueName: 'The Temple Bar',
};

const mockArtistProfile = {
  id: ARTIST_PROFILE_ID,
  userId: ARTIST_USER_ID,
  stageName: 'Celtic Thunder',
  isActive: true,
  genre: 'traditional',
};

const mockEvent = {
  id: EVENT_ID,
  title: 'Friday Night Trad Session',
  createdBy: VENUE_USER_ID,
  status: 'active',
  dateStart: new Date('2026-05-01T20:00:00Z'),
  dateEnd: null,
  category: 'traditional',
  coverImage: null,
  venueAddress: 'Temple Bar, Dublin',
};

const mockBooking = {
  id: BOOKING_ID,
  artistId: ARTIST_PROFILE_ID,
  venueId: VENUE_PROFILE_ID,
  eventId: EVENT_ID,
  status: 'pending',
  direction: 'venue_to_artist',
  createdAt: new Date('2026-04-12T10:00:00Z'),
  updatedAt: new Date('2026-04-12T10:00:00Z'),
  artist: mockArtistProfile,
  venue: mockVenueProfile,
  event: mockEvent,
};

beforeEach(() => {
  mockVenuesFindFirst.mockReset();
  mockArtistsFindFirst.mockReset();
  mockBookingsFindFirst.mockReset();
  mockBookingsFindMany.mockReset();
  mockEventsFindFirst.mockReset();
  mockCollabsFindFirst.mockReset();
  mockUserFindFirst.mockReset();
  mockInsertReturning.mockReset();
  mockUpdateReturning.mockReset();
  mockDeleteWhere.mockReset();
  mockSelectLimit.mockReset().mockResolvedValue([]);
  mockSelectWhere.mockReset().mockReturnValue({
    limit: mockSelectLimit,
    then: vi.fn((cb: (v: unknown[]) => void) => cb([])),
  });
  mockTransaction
    .mockReset()
    .mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
});

// ─── bookings.create ─────────────────────────────────────────────────────────

describe('bookings.create', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'UNAUTHORIZED'
    );
  });

  it('throws FORBIDDEN for non-venue role', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'FORBIDDEN'
    );
  });

  it('throws NOT_FOUND when venue profile does not exist', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'NOT_FOUND'
    );
  });

  it('throws NOT_FOUND when artist is inactive', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockArtistsFindFirst.mockResolvedValueOnce({ ...mockArtistProfile, isActive: false });

    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'NOT_FOUND'
    );
  });

  it('throws FORBIDDEN when event is not owned by caller', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce({ ...mockEvent, createdBy: 'other-user-id' });

    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'FORBIDDEN'
    );
  });

  it('throws CONFLICT when active booking already exists', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockBookingsFindFirst.mockResolvedValueOnce({ id: 'existing-booking' });

    await expectTRPCError(
      caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID }),
      'CONFLICT'
    );
  });

  it('creates booking + collaborator in transaction on success', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));

    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockBookingsFindFirst.mockResolvedValueOnce(null); // no dedup match

    // Transaction: insert booking
    mockInsertReturning.mockResolvedValueOnce([mockBooking]);

    // Post-transaction notification + user image lookups
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist-img.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue-img.jpg' });

    const result = await caller.bookings.create({
      artistId: ARTIST_PROFILE_ID,
      eventId: EVENT_ID,
    });

    expect(result).toMatchObject({
      id: BOOKING_ID,
      status: 'pending',
      direction: 'venue_to_artist',
    });
    expect(mockTransaction).toHaveBeenCalled();
  });
});

// ─── bookings.update ─────────────────────────────────────────────────────────

describe('bookings.update', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'UNAUTHORIZED'
    );
  });

  it('throws NOT_FOUND for non-existent booking', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'NOT_FOUND'
    );
  });

  it('throws FORBIDDEN when caller is not a party', async () => {
    const caller = createCaller(authedContext('artist', 'random-user-id'));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'FORBIDDEN'
    );
  });

  it('allows artist to accept a pending booking', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'accepted' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });
    expect(result.status).toBe('accepted');
  });

  it('allows artist to reject and removes collaborator', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'rejected' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });
    expect(result.status).toBe('rejected');
  });

  it('throws FORBIDDEN when venue tries to accept', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'FORBIDDEN'
    );
  });

  it('allows venue to withdraw (cancel) a pending booking', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'cancelled' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('throws FORBIDDEN when artist tries to withdraw pending', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' }),
      'FORBIDDEN'
    );
  });

  it('allows either party to cancel an accepted booking', async () => {
    const acceptedBooking = { ...mockBooking, status: 'accepted' };
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(acceptedBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...acceptedBooking, status: 'cancelled' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('rejects invalid transition (rejected to accepted)', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({ ...mockBooking, status: 'rejected' });

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'BAD_REQUEST'
    );
  });

  it('rejects invalid transition (cancelled to accepted)', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({ ...mockBooking, status: 'cancelled' });

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'BAD_REQUEST'
    );
  });

  // ─── artist_to_venue direction (direction-aware state machine) ───────────

  const mockArtistToVenueBooking = {
    ...mockBooking,
    direction: 'artist_to_venue',
  };

  it('allows venue to accept an artist_to_venue booking', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockArtistToVenueBooking);
    mockUpdateReturning.mockResolvedValueOnce([
      { ...mockArtistToVenueBooking, status: 'accepted' },
    ]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });
    expect(result.status).toBe('accepted');
  });

  it('allows venue to reject an artist_to_venue booking', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockArtistToVenueBooking);
    mockUpdateReturning.mockResolvedValueOnce([
      { ...mockArtistToVenueBooking, status: 'rejected' },
    ]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });
    expect(result.status).toBe('rejected');
  });

  it('throws FORBIDDEN when artist tries to accept own artist_to_venue booking', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockArtistToVenueBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'FORBIDDEN'
    );
  });

  it('allows artist to withdraw (cancel) own pending artist_to_venue booking', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockArtistToVenueBooking);
    mockUpdateReturning.mockResolvedValueOnce([
      { ...mockArtistToVenueBooking, status: 'cancelled' },
    ]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('throws FORBIDDEN when venue tries to withdraw a pending artist_to_venue booking', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockArtistToVenueBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' }),
      'FORBIDDEN'
    );
  });

  it('allows either party to cancel an accepted artist_to_venue booking', async () => {
    const acceptedA2V = { ...mockArtistToVenueBooking, status: 'accepted' };
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(acceptedA2V);
    mockUpdateReturning.mockResolvedValueOnce([{ ...acceptedA2V, status: 'cancelled' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });
});

// ─── bookings.list ───────────────────────────────────────────────────────────

describe('bookings.list', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.bookings.list({ tab: 'sent' }), 'UNAUTHORIZED');
  });

  it('returns empty for spectator (no profile)', async () => {
    const caller = createCaller(authedContext('spectator'));
    const result = await caller.bookings.list({ tab: 'sent' });
    expect(result).toEqual({ bookings: [], total: 0 });
  });

  it('returns bookings for venue sent tab', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce({ id: VENUE_PROFILE_ID });

    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) => cb([{ count: 1 }]),
    });
    mockBookingsFindMany.mockResolvedValueOnce([mockBooking]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: 'artist.jpg' },
          { id: VENUE_USER_ID, image: 'venue.jpg' },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });
    expect(result.bookings).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

// ─── bookings.byId ───────────────────────────────────────────────────────────

describe('bookings.byId', () => {
  it('throws NOT_FOUND for non-existent booking', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(caller.bookings.byId({ id: BOOKING_ID }), 'NOT_FOUND');
  });

  it('throws FORBIDDEN when caller is not a party', async () => {
    const caller = createCaller(authedContext('artist', 'random-user'));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);

    await expectTRPCError(caller.bookings.byId({ id: BOOKING_ID }), 'FORBIDDEN');
  });

  it('returns booking details for authorized party', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue.jpg' });

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.id).toBe(BOOKING_ID);
    expect(result.artistName).toBe('Celtic Thunder');
    expect(result.venueName).toBe('The Temple Bar');
  });
});

// ─── bookings.searchArtists ──────────────────────────────────────────────────

describe('bookings.searchArtists', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.bookings.searchArtists({ q: 'celtic' }), 'UNAUTHORIZED');
  });

  it('returns matching artists', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));

    // First select().from().where().limit() — artist search
    mockSelectLimit.mockResolvedValueOnce([
      {
        id: ARTIST_PROFILE_ID,
        stageName: 'Celtic Thunder',
        genre: 'traditional',
        userId: ARTIST_USER_ID,
      },
    ]);

    // Override where() for artist search (with limit) and user images (with then)
    mockSelectWhere
      .mockReturnValueOnce({
        limit: mockSelectLimit,
        then: vi.fn((cb: (v: unknown[]) => void) => cb([])),
      })
      .mockReturnValueOnce({
        limit: mockSelectLimit,
        then: (cb: (v: unknown[]) => void) => cb([{ id: ARTIST_USER_ID, image: 'artist.jpg' }]),
      });

    const result = await caller.bookings.searchArtists({ q: 'celtic' });
    expect(result.artists).toHaveLength(1);
    expect(result.artists[0]).toMatchObject({ stageName: 'Celtic Thunder' });
  });
});

// ─── bookings.requestToPerform ───────────────────────────────────────────────

describe('bookings.requestToPerform', () => {
  it('throws UNAUTHORIZED for unauthenticated request', async () => {
    const caller = createCaller(anonContext());
    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'UNAUTHORIZED');
  });

  it('throws FORBIDDEN for non-artist role', async () => {
    const caller = createCaller(authedContext('venue'));
    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'FORBIDDEN');
  });

  it('throws NOT_FOUND when artist profile does not exist', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'NOT_FOUND');
  });

  it('throws NOT_FOUND when event does not exist', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'NOT_FOUND');
  });

  it('throws BAD_REQUEST when event has no resolvable venue', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    // Event with no venueId
    mockEventsFindFirst.mockResolvedValueOnce({ ...mockEvent, venueId: null });
    // No venue profile for creator
    mockVenuesFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'BAD_REQUEST');
  });

  it('throws CONFLICT when active booking already exists', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockBookingsFindFirst.mockResolvedValueOnce({ id: 'existing-booking' });

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'CONFLICT');
  });

  it('throws CONFLICT when artist is already a collaborator', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockBookingsFindFirst.mockResolvedValueOnce(null); // no dedup
    mockCollabsFindFirst.mockResolvedValueOnce({ id: 'existing-collab' });

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'CONFLICT');
  });

  it('creates booking + collaborator on success', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockBookingsFindFirst.mockResolvedValueOnce(null); // no dedup
    mockCollabsFindFirst.mockResolvedValueOnce(null); // not a collaborator

    const newBooking = {
      ...mockBooking,
      direction: 'artist_to_venue',
      status: 'pending',
    };
    mockInsertReturning.mockResolvedValueOnce([newBooking]);

    // User image lookups
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist-img.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue-img.jpg' });

    const result = await caller.bookings.requestToPerform({ eventId: EVENT_ID });
    expect(result).toMatchObject({
      id: BOOKING_ID,
      status: 'pending',
      direction: 'artist_to_venue',
    });
    expect(mockTransaction).toHaveBeenCalled();
  });
});

// ─── bookings.inviteExternal ─────────────────────────────────────────────────

describe('bookings.inviteExternal', () => {
  it('throws FORBIDDEN for non-venue role', async () => {
    const caller = createCaller(authedContext('artist'));
    await expectTRPCError(
      caller.bookings.inviteExternal({
        eventId: EVENT_ID,
        name: 'John Doe',
        email: 'john@example.com',
      }),
      'FORBIDDEN'
    );
  });

  it('throws NOT_FOUND when event does not exist', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockEventsFindFirst.mockResolvedValueOnce(null);

    await expectTRPCError(
      caller.bookings.inviteExternal({
        eventId: EVENT_ID,
        name: 'John Doe',
        email: 'john@example.com',
      }),
      'NOT_FOUND'
    );
  });

  it('throws CONFLICT when email already invited', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockCollabsFindFirst.mockResolvedValueOnce({ id: 'existing' });

    await expectTRPCError(
      caller.bookings.inviteExternal({
        eventId: EVENT_ID,
        name: 'John Doe',
        email: 'john@example.com',
      }),
      'CONFLICT'
    );
  });

  it('creates external collaborator without booking', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockCollabsFindFirst.mockResolvedValueOnce(null);

    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'new-collab-id',
        eventId: EVENT_ID,
        invitedName: 'John Doe',
        invitedEmail: 'john@example.com',
      },
    ]);

    const result = await caller.bookings.inviteExternal({
      eventId: EVENT_ID,
      name: 'John Doe',
      email: 'john@example.com',
    });

    expect(result.invitedName).toBe('John Doe');
    expect(result.invitedEmail).toBe('john@example.com');
  });
});

// ─── bookings.byId — cancelledBy display ────────────────────────────────────

describe('bookings.byId — cancelledBy', () => {
  it('returns cancelledByName for cancelled booking', async () => {
    const cancelledBooking = {
      ...mockBooking,
      status: 'cancelled',
      cancelledBy: ARTIST_USER_ID,
      cancelledByUser: { name: 'Celtic Thunder' },
    };

    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(cancelledBooking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue.jpg' });

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.cancelledByName).toBe('Celtic Thunder');
  });

  it('returns null cancelledByName for non-cancelled booking', async () => {
    const pendingBooking = {
      ...mockBooking,
      status: 'pending',
      cancelledBy: null,
      cancelledByUser: null,
    };

    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(pendingBooking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue.jpg' });

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.cancelledByName).toBeNull();
  });
});
