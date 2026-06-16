import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { NotificationTrigger } from '@CeolX/shared';
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

vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: vi.fn(async () => {}),
  removeEventFromTypesense: vi.fn(async () => {}),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { bookingsRouter } from '../routers/bookings';

const testRouter = router({ bookings: bookingsRouter });
const createCaller = t.createCallerFactory(testRouter);

// ─── Context helpers ─────────────────────────────────────────────────────────

// Reset between tests so assertions don't bleed across cases.
const mockDispatchNotification = vi.fn(async () => {});

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
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

function anonContext(): Context {
  return { session: null, dispatchNotification: mockDispatchNotification } as unknown as Context;
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

// ─── artist↔artist (co-artist) fixtures ──────────────────────────────────────
// Inviter = the artist who created the event and sent the invite.
// Invited (mockArtistProfile) = the co-artist receiving it. No venue.
const INVITER_USER_ID = 'inviter-user-789';
const INVITER_PROFILE_ID = 'e5555555-5555-4555-a555-555555555555';

const mockInviterArtistProfile = {
  id: INVITER_PROFILE_ID,
  userId: INVITER_USER_ID,
  stageName: 'Tune Bomb',
  isActive: true,
  genre: 'traditional',
};

const mockA2ABooking = {
  ...mockBooking,
  venueId: null,
  inviterArtistId: INVITER_PROFILE_ID,
  direction: 'artist_to_artist',
  artist: mockArtistProfile, // invited co-artist (recipient)
  inviterArtist: mockInviterArtistProfile, // inviter (sender)
  venue: null,
  event: { ...mockEvent, createdBy: INVITER_USER_ID },
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
  mockDispatchNotification.mockReset().mockResolvedValue(undefined);
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
    expect(result.bookings[0]?.artistUserId).toBe(ARTIST_USER_ID);
    expect(result.bookings[0]?.venueUserId).toBe(VENUE_USER_ID);
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
    // Account ids power the "Contact" deep link to the counterparty profile.
    expect(result.artistUserId).toBe(ARTIST_USER_ID);
    expect(result.venueUserId).toBe(VENUE_USER_ID);
  });
});

// ─── bookings artist_to_artist (co-artist) ───────────────────────────────────

describe('bookings.update — artist_to_artist', () => {
  it('allows the invited co-artist to accept and notifies the inviter', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockA2ABooking, status: 'accepted' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });
    expect(result.status).toBe('accepted');
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER,
        recipientUserId: INVITER_USER_ID,
        vars: expect.objectContaining({ coArtistName: 'Celtic Thunder' }),
      })
    );
  });

  it('forbids the inviter from accepting their own co-artist invite', async () => {
    const caller = createCaller(authedContext('artist', INVITER_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'FORBIDDEN'
    );
  });

  it('allows the inviter to withdraw a pending invite and notifies the invitee', async () => {
    const caller = createCaller(authedContext('artist', INVITER_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockA2ABooking, status: 'cancelled' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE,
        recipientUserId: ARTIST_USER_ID,
        vars: expect.objectContaining({ coArtistName: 'Tune Bomb' }),
      })
    );
  });

  it('forbids a non-party artist from updating a co-artist booking', async () => {
    const caller = createCaller(authedContext('artist', 'some-other-artist'));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'FORBIDDEN'
    );
  });
});

describe('bookings.list — artist_to_artist tabs', () => {
  it('maps a received co-artist row with inviter fields and viewerIsSender false', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce({ id: ARTIST_PROFILE_ID });

    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) => cb([{ count: 1 }]),
    });
    mockBookingsFindMany.mockResolvedValueOnce([mockA2ABooking]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: 'invited.jpg' },
          { id: INVITER_USER_ID, image: 'inviter.jpg' },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'received' });
    expect(result.bookings).toHaveLength(1);
    const row = result.bookings[0]!;
    expect(row.direction).toBe('artist_to_artist');
    expect(row.inviterArtistName).toBe('Tune Bomb');
    expect(row.inviterArtistId).toBe(INVITER_PROFILE_ID);
    // The inviter's *user* id is what the /artist/[userId] route needs to open
    // their public profile from the accepted-invite "CONTACT ARTIST" button.
    expect(row.inviterArtistUserId).toBe(INVITER_USER_ID);
    // The viewer is the invited artist, not the sender.
    expect(row.viewerIsSender).toBe(false);
    // Null venue must not throw and must serialize to empty strings.
    expect(row.venueName).toBe('');
    expect(row.venueId).toBe('');
  });

  it('marks viewerIsSender true for the inviter on the sent tab', async () => {
    const caller = createCaller(authedContext('artist', INVITER_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce({ id: INVITER_PROFILE_ID });

    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) => cb([{ count: 1 }]),
    });
    mockBookingsFindMany.mockResolvedValueOnce([mockA2ABooking]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: 'invited.jpg' },
          { id: INVITER_USER_ID, image: 'inviter.jpg' },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });
    const row = result.bookings[0]!;
    expect(row.viewerIsSender).toBe(true);
  });
});

describe('bookings.byId — artist_to_artist', () => {
  it('allows the inviter artist (previously forbidden) and maps inviter fields', async () => {
    const caller = createCaller(authedContext('artist', INVITER_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'invited.jpg' }); // artist
    mockUserFindFirst.mockResolvedValueOnce({ image: 'inviter.jpg' }); // inviterArtist

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.inviterArtistName).toBe('Tune Bomb');
    expect(result.inviterArtistUserId).toBe(INVITER_USER_ID);
    expect(result.viewerIsSender).toBe(true);
    expect(result.venueName).toBe('');
  });
});

// ─── bookings.resend ──────────────────────────────────────────────────────────
// Re-sends the *original* invite notification to the recipient. Only the
// sender of a still-pending booking may resend.

describe('bookings.resend', () => {
  it('throws NOT_FOUND when the booking does not exist', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(null);
    await expectTRPCError(caller.bookings.resend({ id: BOOKING_ID }), 'NOT_FOUND');
  });

  it('throws BAD_REQUEST when the booking is not pending', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({ ...mockBooking, status: 'accepted' });
    await expectTRPCError(caller.bookings.resend({ id: BOOKING_ID }), 'BAD_REQUEST');
  });

  it('forbids the recipient (non-sender) from resending', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    await expectTRPCError(caller.bookings.resend({ id: BOOKING_ID }), 'FORBIDDEN');
  });

  it('re-dispatches BOOKING_INVITE_TO_ARTIST to the artist for a venue→artist invite', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);

    const result = await caller.bookings.resend({ id: BOOKING_ID });

    expect(result).toEqual({ id: BOOKING_ID, success: true });
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
        recipientUserId: ARTIST_USER_ID,
      })
    );
  });

  it('re-dispatches BOOKING_INVITE_TO_COARTIST to the invited artist for an A2A invite', async () => {
    const caller = createCaller(authedContext('artist', INVITER_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockA2ABooking);

    const result = await caller.bookings.resend({ id: BOOKING_ID });

    expect(result).toEqual({ id: BOOKING_ID, success: true });
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
        recipientUserId: ARTIST_USER_ID,
        vars: expect.objectContaining({ coArtistName: 'Tune Bomb' }),
      })
    );
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

// ─── M7-T1 dispatcher integration (trigger + vars) ──────────────────────────
// Routers no longer carry copy — they pass a NotificationTrigger ID and the
// vars needed to interpolate it. The shared registry resolves push vs in-app
// copy at dispatch time. `mockEvent.dateStart` 2026-05-01T20:00:00Z → "Fri 1 May".

describe('bookings dispatch — trigger + vars', () => {
  const EVENT_DATE_FRI = 'Fri 1 May';

  const expectVars = (
    artistName = 'Celtic Thunder',
    venueName = 'The Temple Bar',
    eventTitle = 'Friday Night Trad Session'
  ) => ({
    bookingId: BOOKING_ID,
    artistName,
    venueName,
    eventTitle,
    date: EVENT_DATE_FRI,
  });

  it('A-09 — create dispatches BOOKING_INVITE_TO_ARTIST to the artist', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockBookingsFindFirst.mockResolvedValueOnce(null);
    mockCollabsFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'pending' }]);
    mockUserFindFirst.mockResolvedValue({ image: null });

    await caller.bookings.create({ artistId: ARTIST_PROFILE_ID, eventId: EVENT_ID });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_invite_to_artist',
      recipientUserId: ARTIST_USER_ID,
      vars: expectVars(),
    });
  });

  it('V-09 — requestToPerform dispatches BOOKING_REQUEST_TO_VENUE', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockBookingsFindFirst.mockResolvedValueOnce(null);
    mockCollabsFindFirst.mockResolvedValueOnce(null);
    mockInsertReturning.mockResolvedValueOnce([
      { ...mockBooking, direction: 'artist_to_venue', status: 'pending' },
    ]);
    mockUserFindFirst.mockResolvedValue({ image: null });

    await caller.bookings.requestToPerform({ eventId: EVENT_ID });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_request_to_venue',
      recipientUserId: VENUE_USER_ID,
      vars: expectVars(),
    });
  });

  it('A-10 / V-10 — artist accepting → BOOKING_ACCEPTED_TO_VENUE', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'accepted' }]);

    await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_accepted_to_venue',
      recipientUserId: VENUE_USER_ID,
      vars: expectVars(),
    });
  });

  it('A-11 — venue rejecting an artist application → BOOKING_REJECTED_TO_ARTIST', async () => {
    const a2v = { ...mockBooking, direction: 'artist_to_venue' };
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(a2v);
    mockUpdateReturning.mockResolvedValueOnce([{ ...a2v, status: 'rejected' }]);

    await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_rejected_to_artist',
      recipientUserId: ARTIST_USER_ID,
      vars: expectVars(),
    });
  });

  it('V-11 — artist declining a venue invite → BOOKING_REJECTED_TO_VENUE', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'rejected' }]);

    await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_rejected_to_venue',
      recipientUserId: VENUE_USER_ID,
      vars: expectVars(),
    });
  });

  it('V-13 — artist withdrawing pending application → BOOKING_WITHDRAWN_TO_VENUE', async () => {
    const a2v = { ...mockBooking, direction: 'artist_to_venue' };
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(a2v);
    mockUpdateReturning.mockResolvedValueOnce([{ ...a2v, status: 'cancelled' }]);

    await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_withdrawn_to_venue',
      recipientUserId: VENUE_USER_ID,
      vars: expectVars(),
    });
  });

  it('A-12 — venue cancelling accepted booking → BOOKING_CANCELLED_TO_ARTIST', async () => {
    const accepted = { ...mockBooking, status: 'accepted' };
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(accepted);
    mockUpdateReturning.mockResolvedValueOnce([{ ...accepted, status: 'cancelled' }]);

    await caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' });

    expect(mockDispatchNotification).toHaveBeenCalledWith({
      trigger: 'booking_cancelled_to_artist',
      recipientUserId: ARTIST_USER_ID,
      vars: expectVars(),
    });
  });
});
