import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { sendCollaboratorInviteEmail } from '@CeolX/email';
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
    inviteToken: 'invite_token',
    inviteTokenExpiresAt: 'invite_token_expires_at',
  },
}));

vi.mock('@CeolX/email', () => ({ sendCollaboratorInviteEmail: vi.fn() }));

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
  // Pin the clock (Date only — leave setTimeout real so awaited promises don't
  // hang) to just before mockEvent.dateStart (2026-05-01) so the default fixture
  // event is deterministically *upcoming*. Without this the fixture reads as a
  // past event on the real wall-clock, which would trip the new "can't accept a
  // past event" guard and flap every existing accept test. (Asana 1216289752400014)
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-04-20T00:00:00Z'));
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

afterEach(() => {
  vi.useRealTimers();
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

  it('throws BAD_REQUEST when accepting an invitation for a past event', async () => {
    // Event date is before the pinned "now" (2026-04-20) → already happened.
    // Past events keep status='active', so the deleted/removed guard misses them;
    // this is the dedicated past-event backstop. (Asana 1216289752400014)
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({
      ...mockBooking,
      event: { ...mockEvent, dateStart: new Date('2026-03-01T20:00:00Z') },
    });

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'BAD_REQUEST'
    );
    expect(mockUpdateReturning).not.toHaveBeenCalled();
  });

  it('still allows rejecting a past-event invitation so stale rows can be cleared', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({
      ...mockBooking,
      event: { ...mockEvent, dateStart: new Date('2026-03-01T20:00:00Z') },
    });
    mockUpdateReturning.mockResolvedValueOnce([{ ...mockBooking, status: 'rejected' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'rejected' });
    expect(result.status).toBe('rejected');
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

// ─── deleted event accessibility (Asana 1215700058852004) ───────────────────
// When a venue deletes (archives) an event, its bookings stay reachable through
// the collaboration/request cards. The list/byId reads must still surface them
// (disabled, not removed) with the event status, and `update` must reject any
// action against an event that's no longer active.

describe('bookings — deleted/removed event', () => {
  const archivedBooking = { ...mockBooking, event: { ...mockEvent, status: 'archived' } };
  const removedBooking = { ...mockBooking, event: { ...mockEvent, status: 'removed' } };

  it('blocks artist accepting a booking on an archived event', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(archivedBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'accepted' }),
      'BAD_REQUEST'
    );
  });

  it('blocks venue withdrawing a booking on an archived event', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(archivedBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'cancelled' }),
      'BAD_REQUEST'
    );
  });

  it('blocks actions on an admin-removed event', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(removedBooking);

    await expectTRPCError(
      caller.bookings.update({ id: BOOKING_ID, status: 'rejected' }),
      'BAD_REQUEST'
    );
  });

  it('still allows venue to accept a pending_review artist_to_venue booking (allow-list regression)', async () => {
    const pendingReviewBooking = {
      ...mockBooking,
      direction: 'artist_to_venue',
      event: { ...mockEvent, status: 'pending_review' },
    };
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(pendingReviewBooking);
    mockUpdateReturning.mockResolvedValueOnce([{ ...pendingReviewBooking, status: 'accepted' }]);

    const result = await caller.bookings.update({ id: BOOKING_ID, status: 'accepted' });
    expect(result.status).toBe('accepted');
  });

  it('list keeps an archived-event booking and surfaces eventStatus', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce({ id: VENUE_PROFILE_ID });
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) => cb([{ count: 1 }]),
    });
    mockBookingsFindMany.mockResolvedValueOnce([archivedBooking]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: 'artist.jpg' },
          { id: VENUE_USER_ID, image: 'venue.jpg' },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]?.eventStatus).toBe('archived');
  });

  it('byId returns eventStatus and does not 404 for an archived event', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(archivedBooking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'artist.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'venue.jpg' });

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.id).toBe(BOOKING_ID);
    expect(result.eventStatus).toBe('archived');
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

  it('excludes pending requests whose event has already passed', async () => {
    // Pinned now = 2026-04-20; this event is 2026-03-01 → expired. A pending
    // request for a past event is moot and must drop off the Collaboration list
    // rather than sit there with dead action buttons.
    // (Asana 1216347906046740, 1216347905932214)
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce({ id: VENUE_PROFILE_ID });
    mockBookingsFindMany.mockResolvedValueOnce([
      { ...mockBooking, event: { ...mockEvent, dateStart: new Date('2026-03-01T20:00:00Z') } },
    ]);

    const result = await caller.bookings.list({ tab: 'sent' });
    expect(result.bookings).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('keeps non-pending rows for past events as history', async () => {
    // An accepted booking for a past event is history and renders no action
    // buttons, so it stays visible — only PENDING past-event rows are filtered.
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce({ id: VENUE_PROFILE_ID });
    mockBookingsFindMany.mockResolvedValueOnce([
      {
        ...mockBooking,
        status: 'accepted',
        event: { ...mockEvent, dateStart: new Date('2026-03-01T20:00:00Z') },
      },
    ]);
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
    expect(result.bookings[0]?.status).toBe('accepted');
  });
});

// ─── bookings.list — collapse repeat attempts (Asana 1215700058851996, Issue 1) ─
// Withdrawing then re-requesting leaves the old (cancelled) row behind and
// inserts a fresh pending row. The Collaboration tab must show ONE card per
// (event, direction, artist, counterparty) — the latest attempt's status — with
// a requestCount + lastRequestedAt for the "Requested N times" note. Distinct
// events between the same parties must stay as separate cards.

describe('bookings.list — collapse repeat attempts', () => {
  const olderCancelled = {
    ...mockBooking,
    id: 'booking-attempt-1',
    direction: 'artist_to_venue',
    status: 'cancelled',
    createdAt: new Date('2026-04-12T10:00:00Z'),
    updatedAt: new Date('2026-04-13T10:00:00Z'),
  };
  const newerPending = {
    ...mockBooking,
    id: 'booking-attempt-2',
    direction: 'artist_to_venue',
    status: 'pending',
    createdAt: new Date('2026-04-15T10:00:00Z'),
    updatedAt: new Date('2026-04-15T10:00:00Z'),
  };

  it('collapses repeat attempts at the same event into one card with the latest status', async () => {
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce({ id: ARTIST_PROFILE_ID });
    // findMany returns newest-first (desc createdAt).
    mockBookingsFindMany.mockResolvedValueOnce([newerPending, olderCancelled]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: null },
          { id: VENUE_USER_ID, image: null },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });

    expect(result.total).toBe(1);
    expect(result.bookings).toHaveLength(1);
    const card = result.bookings[0];
    if (!card) throw new Error('expected a collapsed card');
    // Representative is the most recent attempt → latest status + id.
    expect(card.id).toBe('booking-attempt-2');
    expect(card.status).toBe('pending');
    expect(card.requestCount).toBe(2);
    expect(card.lastRequestedAt).toBe(new Date('2026-04-15T10:00:00Z').toISOString());
  });

  it('keeps distinct events between the same parties as separate cards', async () => {
    const eventA = {
      ...newerPending,
      id: 'booking-event-a',
      eventId: 'event-a',
      event: { ...mockEvent, id: 'event-a' },
      createdAt: new Date('2026-04-15T10:00:00Z'),
    };
    const eventB = {
      ...newerPending,
      id: 'booking-event-b',
      eventId: 'event-b',
      event: { ...mockEvent, id: 'event-b' },
      createdAt: new Date('2026-04-14T10:00:00Z'),
    };
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce({ id: ARTIST_PROFILE_ID });
    mockBookingsFindMany.mockResolvedValueOnce([eventA, eventB]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: null },
          { id: VENUE_USER_ID, image: null },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });

    expect(result.total).toBe(2);
    expect(result.bookings).toHaveLength(2);
    expect(result.bookings.map((b) => b.requestCount)).toEqual([1, 1]);
    // Newest-first ordering preserved.
    expect(result.bookings[0]?.eventId).toBe('event-a');
    expect(result.bookings[1]?.eventId).toBe('event-b');
  });

  it('paginates over groups, not raw rows', async () => {
    const groupForEvent = (suffix: string, day: string) => ({
      ...newerPending,
      id: `booking-${suffix}`,
      eventId: `event-${suffix}`,
      event: { ...mockEvent, id: `event-${suffix}` },
      createdAt: new Date(`2026-04-${day}T10:00:00Z`),
    });
    // Three distinct event groups; page size 2 → first page has 2, total 3.
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce({ id: ARTIST_PROFILE_ID });
    mockBookingsFindMany.mockResolvedValueOnce([
      groupForEvent('a', '15'),
      groupForEvent('b', '14'),
      groupForEvent('c', '13'),
    ]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: null },
          { id: VENUE_USER_ID, image: null },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent', limit: 2, offset: 0 });

    expect(result.total).toBe(3);
    expect(result.bookings).toHaveLength(2);
    expect(result.bookings.map((b) => b.eventId)).toEqual(['event-a', 'event-b']);
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

// ─── profile-image precedence (Asana 1215700058851990, bug #1) ───────────────
// Uploaded avatars live in artist_profiles / venue_profiles (`profileImageUrl`);
// the BetterAuth `user.image` column is only populated for Google/Apple logins.
// A venue that uploaded a photo but signed up with email has user.image = null,
// so the collaboration request was showing no picture. The profile image must
// win, falling back to user.image only for social-login accounts without one.

describe('bookings — profile image precedence', () => {
  const VENUE_UPLOADED = 'https://cdn.ceolx.com/venue-upload.jpg';
  const ARTIST_UPLOADED = 'https://cdn.ceolx.com/artist-upload.jpg';

  it('byId surfaces the venue profileImageUrl when user.image is null', async () => {
    const booking = {
      ...mockBooking,
      venue: { ...mockVenueProfile, profileImageUrl: VENUE_UPLOADED },
      artist: { ...mockArtistProfile, profileImageUrl: ARTIST_UPLOADED },
    };
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(booking);
    mockUserFindFirst.mockResolvedValueOnce({ image: null }); // artist user (email signup)
    mockUserFindFirst.mockResolvedValueOnce({ image: null }); // venue user (email signup)

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.venueImage).toBe(VENUE_UPLOADED);
    expect(result.artistImage).toBe(ARTIST_UPLOADED);
  });

  it('byId prefers the uploaded profile image over the social-login user.image', async () => {
    const booking = {
      ...mockBooking,
      venue: { ...mockVenueProfile, profileImageUrl: VENUE_UPLOADED },
    };
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce(booking);
    mockUserFindFirst.mockResolvedValueOnce({ image: 'oauth-artist.jpg' });
    mockUserFindFirst.mockResolvedValueOnce({ image: 'oauth-venue.jpg' });

    const result = await caller.bookings.byId({ id: BOOKING_ID });
    expect(result.venueImage).toBe(VENUE_UPLOADED);
  });

  it('list surfaces the venue profileImageUrl when user.image is null', async () => {
    const booking = {
      ...mockBooking,
      venue: { ...mockVenueProfile, profileImageUrl: VENUE_UPLOADED },
      artist: { ...mockArtistProfile, profileImageUrl: ARTIST_UPLOADED },
    };
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockVenuesFindFirst.mockResolvedValueOnce({ id: VENUE_PROFILE_ID });

    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) => cb([{ count: 1 }]),
    });
    mockBookingsFindMany.mockResolvedValueOnce([booking]);
    mockSelectWhere.mockReturnValueOnce({
      then: (cb: (v: unknown[]) => void) =>
        cb([
          { id: ARTIST_USER_ID, image: null },
          { id: VENUE_USER_ID, image: null },
        ]),
    });

    const result = await caller.bookings.list({ tab: 'sent' });
    expect(result.bookings[0]?.venueImage).toBe(VENUE_UPLOADED);
    expect(result.bookings[0]?.artistImage).toBe(ARTIST_UPLOADED);
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
        vars: expect.objectContaining({ coArtistName: 'Celtic Thunder' }) as unknown,
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
        vars: expect.objectContaining({ coArtistName: 'Tune Bomb' }) as unknown,
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
    const row = result.bookings[0];
    if (!row) throw new Error('expected a booking row');
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
    const row = result.bookings[0];
    if (!row) throw new Error('expected a booking row');
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

  it('throws BAD_REQUEST when resending an invite for a past event', async () => {
    // Resending is pointless once the event has happened — the recipient can no
    // longer accept it. (Asana 1216289483780968)
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockBookingsFindFirst.mockResolvedValueOnce({
      ...mockBooking,
      event: { ...mockEvent, dateStart: new Date('2026-03-01T20:00:00Z') },
    });
    await expectTRPCError(caller.bookings.resend({ id: BOOKING_ID }), 'BAD_REQUEST');
    expect(mockDispatchNotification).not.toHaveBeenCalled();
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
        vars: expect.objectContaining({ coArtistName: 'Tune Bomb' }) as unknown,
      })
    );
  });

  // ─── resend cooldown (Asana 1215700058851990, bug #2) ──────────────────────
  // A pending row's updatedAt is its "last sent at" (create or resend). Resending
  // inside the 24h window is rejected as spam; the bump keeps the window rolling.

  it('throws TOO_MANY_REQUESTS when resent inside the cooldown window', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    // updatedAt = now → well inside the 24h cooldown.
    mockBookingsFindFirst.mockResolvedValueOnce({ ...mockBooking, updatedAt: new Date() });

    await expectTRPCError(caller.bookings.resend({ id: BOOKING_ID }), 'TOO_MANY_REQUESTS');
    expect(mockDispatchNotification).not.toHaveBeenCalled();
  });

  it('allows resend once the cooldown has elapsed and bumps the last-sent timestamp', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    // mockBooking.updatedAt is 2026-04-12 — far outside the window.
    mockBookingsFindFirst.mockResolvedValueOnce(mockBooking);
    const updateSpy = mockDb.update as ReturnType<typeof vi.fn>;
    updateSpy.mockClear();

    const result = await caller.bookings.resend({ id: BOOKING_ID });

    expect(result).toEqual({ id: BOOKING_ID, success: true });
    expect(mockDispatchNotification).toHaveBeenCalled();
    // The row's updatedAt is rewritten so the next resend is gated 24h from now.
    expect(updateSpy).toHaveBeenCalled();
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

  it('throws BAD_REQUEST when requesting to perform at a past event', async () => {
    // The event already happened — an artist can't apply to perform at it.
    // Venue + dedup are mocked as valid so the ONLY thing that can stop the
    // request is the past-event guard (otherwise it would proceed to insert).
    // (Asana 1216289483780968)
    const caller = createCaller(authedContext('artist', ARTIST_USER_ID));
    mockArtistsFindFirst.mockResolvedValueOnce(mockArtistProfile);
    mockEventsFindFirst.mockResolvedValueOnce({
      ...mockEvent,
      dateStart: new Date('2026-03-01T20:00:00Z'),
    });
    mockVenuesFindFirst.mockResolvedValueOnce(mockVenueProfile);
    mockBookingsFindFirst.mockResolvedValueOnce(null); // no dedup match
    mockCollabsFindFirst.mockResolvedValueOnce(null); // not already a collaborator

    await expectTRPCError(caller.bookings.requestToPerform({ eventId: EVENT_ID }), 'BAD_REQUEST');
    expect(mockInsertReturning).not.toHaveBeenCalled();
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

  it('creates external collaborator without booking and sends the invite email', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockCollabsFindFirst.mockResolvedValueOnce(null);
    mockVenuesFindFirst.mockResolvedValueOnce({ venueName: 'The Temple Bar' });

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
      email: 'John@Example.com',
    });

    expect(result.invitedName).toBe('John Doe');
    expect(result.invitedEmail).toBe('john@example.com');

    // Email sent to the lowercased address, with the inviter + a /invite/<token> link.
    const call = vi.mocked(sendCollaboratorInviteEmail).mock.calls[0]?.[0];
    expect(call?.to).toBe('john@example.com');
    expect(call?.inviterName).toBe('The Temple Bar');
    expect(call?.eventTitle).toBe('Friday Night Trad Session');
    expect(call?.inviteUrl).toMatch(/^https:\/\/ceolx\.com\/invite\/.+/);
  });

  it('still succeeds if the invite email fails to send (R8.5)', async () => {
    const caller = createCaller(authedContext('venue', VENUE_USER_ID));
    mockEventsFindFirst.mockResolvedValueOnce(mockEvent);
    mockCollabsFindFirst.mockResolvedValueOnce(null);
    mockVenuesFindFirst.mockResolvedValueOnce({ venueName: 'The Temple Bar' });
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: 'new-collab-id',
        eventId: EVENT_ID,
        invitedName: 'John Doe',
        invitedEmail: 'john@example.com',
      },
    ]);
    vi.mocked(sendCollaboratorInviteEmail).mockRejectedValueOnce(new Error('postmark down'));

    const result = await caller.bookings.inviteExternal({
      eventId: EVENT_ID,
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(result.id).toBe('new-collab-id');
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
