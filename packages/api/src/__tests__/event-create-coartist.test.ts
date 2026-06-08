import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// We need a richer db mock than the bare collaborators test because we must
// capture: (1) booking inserts, (2) eventCollaborators inserts, (3) dispatches,
// and stub both findFirst (creator profile) and select().from().where() (invited
// profiles). Follow the pattern from bookings.test.ts / event-venue-approval.test.ts.

const {
  mockDb,
  mockInsertValues,
  mockInsertReturning,
  mockArtistsFindFirst,
  mockSelectWhere,
  mockSyncEventToTypesense,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn((_values?: unknown) => ({ returning: mockInsertReturning }));
  const mockArtistsFindFirst = vi.fn();
  const mockSelectWhere = vi.fn();

  const mockSyncEventToTypesense = vi.fn(async () => {});

  const mockDb: Record<string, unknown> = {};

  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: vi.fn() },
      artistProfiles: { findFirst: mockArtistsFindFirst },
      eventCollaborators: { findMany: vi.fn(() => Promise.resolve([])) },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  });

  return {
    mockDb,
    mockInsertValues,
    mockInsertReturning,
    mockArtistsFindFirst,
    mockSelectWhere,
    mockSyncEventToTypesense,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', image: 'image' } }));
vi.mock('@CeolX/db/schema/bookings', () => ({
  bookings: {
    id: 'id',
    artistId: 'artist_id',
    venueId: 'venue_id',
    inviterArtistId: 'inviter_artist_id',
    eventId: 'event_id',
    status: 'status',
    direction: 'direction',
  },
}));
vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', title: 'title', createdBy: 'created_by', status: 'status' },
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
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
  removeEventFromTypesense: vi.fn(async () => {}),
}));

// Stub resolveEventCoordinates so the test doesn't need a real venueProfiles select chain.
vi.mock('../routers/events/helpers', () => ({
  resolveEventCoordinates: vi.fn(() => Promise.resolve({ lat: '53.3498', lng: '-6.2603' })),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { create } from '../routers/events/crud';

const testRouter = router({ events: router({ create }) });
const createCaller = t.createCallerFactory(testRouter);

const mockDispatchNotification = vi.fn(async () => {});

// ─── IDs ──────────────────────────────────────────────────────────────────────

const CREATOR_USER_ID = 'creator-user-id';
const CREATOR_PROFILE_ID = 'creator-profile-uuid-1111';
const CREATOR_STAGE_NAME = 'Tune Bomb';

const INVITED_USER_ID = 'invited-user-id';
const INVITED_PROFILE_ID = 'invited-profile-uuid-2222';
const INVITED_STAGE_NAME = 'Celtic Thunder';

const EVENT_ID = 'event-uuid-3333';
const BOOKING_ID = 'booking-uuid-4444';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const insertedEvent = {
  id: EVENT_ID,
  title: 'Saturday Trad Night',
  createdBy: CREATOR_USER_ID,
  status: 'active',
  dateStart: new Date('2026-07-05T20:00:00Z'),
};

const creatorProfile = {
  id: CREATOR_PROFILE_ID,
  stageName: CREATOR_STAGE_NAME,
};

const invitedProfile = {
  id: INVITED_PROFILE_ID,
  userId: INVITED_USER_ID,
  stageName: INVITED_STAGE_NAME,
};

const newBooking = {
  id: BOOKING_ID,
  artistId: INVITED_PROFILE_ID,
  inviterArtistId: CREATOR_PROFILE_ID,
  venueId: null,
  eventId: EVENT_ID,
  status: 'pending',
  direction: 'artist_to_artist',
};

// ─── Context helper ───────────────────────────────────────────────────────────

function artistContext(userId = CREATOR_USER_ID): Context {
  return {
    session: {
      user: {
        id: userId,
        name: 'Tune Bomb',
        email: 'tune@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: 'artist' as UserRole,
        consentAt: new Date(),
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
      },
      session: {
        id: 'session-id',
        token: 'token',
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

const validEventInput = {
  title: 'Saturday Trad Night',
  description: 'An evening of traditional Irish music.',
  dateStart: new Date('2026-07-05T20:00:00Z').toISOString(),
  // Provide explicit lat/lng so resolveEventCoordinates mock is not blocked by
  // the missing venueProfiles select chain.
  lat: 53.3498,
  lng: -6.2603,
  category: 'Traditional' as const,
  // Creator + an invited artist in the platformInvites list.
  platformInvites: [INVITED_USER_ID, CREATOR_USER_ID],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('events.create — artist-to-artist co-artist invites', () => {
  beforeEach(() => {
    // Reset only the leaf mocks that carry queued return values.
    // Do NOT use vi.clearAllMocks() — it wipes the implementations set in the
    // hoisted block (insert chain, transaction, select chain) which are NOT
    // automatically restored, causing subsequent tests to fail.
    mockInsertReturning.mockReset();
    mockArtistsFindFirst.mockReset();
    mockSelectWhere.mockReset();
    mockDispatchNotification.mockReset().mockResolvedValue(undefined);

    // Re-wire select chain after reset (mockSelectWhere lost its implementation).
    mockSelectWhere.mockResolvedValue([]);

    // Re-wire the insert().values() implementation so returning() still chains.
    mockInsertValues
      .mockReset()
      .mockImplementation((_values?: unknown) => ({ returning: mockInsertReturning }));

    // Re-wire insert() on mockDb to return the values chain.
    (mockDb.insert as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementation(() => ({ values: mockInsertValues }));

    // Re-wire select() on mockDb.
    (mockDb.select as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    }));

    // Re-wire transaction (it's a vi.fn on the mockDb object).
    (mockDb.transaction as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

    // First insert() call → the event row itself.
    // Second insert() call → bookings row (returns newBooking).
    // Third insert() call → eventCollaborators row.
    mockInsertReturning
      .mockResolvedValueOnce([insertedEvent]) // events insert
      .mockResolvedValueOnce([newBooking]) // bookings insert
      .mockResolvedValueOnce([]); // eventCollaborators insert

    // tx.query.artistProfiles.findFirst → creator's own profile.
    mockArtistsFindFirst.mockResolvedValueOnce(creatorProfile);

    // tx.select().from().where() → invited artist profiles.
    // The resolver calls inArray(artistProfiles.userId, inviteUserIds) where
    // inviteUserIds has already had the creator filtered out (self-invite guard),
    // so only INVITED_USER_ID is in the list.
    mockSelectWhere.mockResolvedValueOnce([invitedProfile]);
  });

  it('inserts a booking with direction artist_to_artist and correct ids', async () => {
    const caller = createCaller(artistContext());
    await caller.events.create(validEventInput);

    // The second insert().values() call should be the booking.
    // mockInsertValues is called once per insert() call; capture all calls.
    const allInsertValueCalls = mockInsertValues.mock.calls;

    // Find the call that looks like a booking (has direction field).
    const bookingCall = allInsertValueCalls.find(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        'direction' in (args[0] as Record<string, unknown>)
    );

    expect(bookingCall).toBeDefined();
    const bookingValues = (bookingCall?.[0] ?? {}) as Record<string, unknown>;
    expect(bookingValues.direction).toBe('artist_to_artist');
    expect(bookingValues.inviterArtistId).toBe(CREATOR_PROFILE_ID);
    expect(bookingValues.venueId).toBeNull();
    expect(bookingValues.artistId).toBe(INVITED_PROFILE_ID);
    expect(bookingValues.status).toBe('pending');
  });

  it('inserts an eventCollaborators row with the invited user id and booking id', async () => {
    const caller = createCaller(artistContext());
    await caller.events.create(validEventInput);

    const allInsertValueCalls = mockInsertValues.mock.calls;

    // Find the call that looks like an eventCollaborators row (has artistProfileId and bookingId).
    const collabCall = allInsertValueCalls.find(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        'artistProfileId' in (args[0] as Record<string, unknown>) &&
        'bookingId' in (args[0] as Record<string, unknown>)
    );

    expect(collabCall).toBeDefined();
    const collabValues = (collabCall?.[0] ?? {}) as Record<string, unknown>;
    expect(collabValues.artistProfileId).toBe(INVITED_USER_ID);
    expect(collabValues.bookingId).toBe(BOOKING_ID);
  });

  it('dispatches BOOKING_INVITE_TO_COARTIST to the invited artist', async () => {
    const caller = createCaller(artistContext());
    await caller.events.create(validEventInput);

    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'booking_invite_to_coartist',
        recipientUserId: INVITED_USER_ID,
        vars: expect.objectContaining({
          bookingId: BOOKING_ID,
          coArtistName: CREATOR_STAGE_NAME,
          eventTitle: insertedEvent.title,
        }) as unknown,
      })
    );
  });

  it('excludes the creator from invites — only one booking created (not for creator)', async () => {
    const caller = createCaller(artistContext());
    await caller.events.create(validEventInput);

    // The select() call for invited profiles must have been called with a list
    // that does NOT include the creator (self-invite guard). We verify indirectly:
    // only ONE booking insert should have direction 'artist_to_artist'.
    const allInsertValueCalls = mockInsertValues.mock.calls;
    const a2aBookings = allInsertValueCalls.filter(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        (args[0] as Record<string, unknown>).direction === 'artist_to_artist'
    );
    expect(a2aBookings).toHaveLength(1);

    // And the single booking's artistId is for the invited artist, not the creator.
    const bookingValues = (a2aBookings[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(bookingValues.artistId).toBe(INVITED_PROFILE_ID);
    expect(bookingValues.artistId).not.toBe(CREATOR_PROFILE_ID);
  });
});
