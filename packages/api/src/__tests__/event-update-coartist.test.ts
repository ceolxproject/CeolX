import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// Mirrors event-create-coartist.test.ts but for the update (edit) resolver,
// which fetches the existing event, runs db.update(events) inside a transaction,
// then creates pending bookings for newly invited artists.

const {
  mockDb,
  mockInsertValues,
  mockInsertReturning,
  mockUpdateReturning,
  mockEventsFindFirst,
  mockCollabsFindMany,
  mockArtistsFindFirst,
  mockSelectWhere,
  mockPendingInvitesWhere,
  mockDeleteWhere,
  mockSyncEventToTypesense,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn((_values?: unknown) => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockEventsFindFirst = vi.fn();
  const mockCollabsFindMany = vi.fn(() => Promise.resolve([]));
  const mockArtistsFindFirst = vi.fn();
  // Plain `select().from().where()` → invited artist profiles to add.
  const mockSelectWhere = vi.fn();
  // `select().from().innerJoin().where()` → the event's existing pending invites
  // (the removable set). Defaults to none. (Asana 1215912673233456)
  const mockPendingInvitesWhere = vi.fn(() => Promise.resolve([]));
  const mockDeleteWhere = vi.fn();

  const mockSyncEventToTypesense = vi.fn(async () => {});

  const mockDb: Record<string, unknown> = {};

  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: vi.fn() },
      artistProfiles: { findFirst: mockArtistsFindFirst },
      events: { findFirst: mockEventsFindFirst },
      eventCollaborators: { findMany: mockCollabsFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: mockUpdateReturning })),
      })),
    })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
        innerJoin: vi.fn(() => ({ where: mockPendingInvitesWhere })),
      })),
    })),
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  });

  return {
    mockDb,
    mockInsertValues,
    mockInsertReturning,
    mockUpdateReturning,
    mockEventsFindFirst,
    mockCollabsFindMany,
    mockArtistsFindFirst,
    mockSelectWhere,
    mockPendingInvitesWhere,
    mockDeleteWhere,
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

const mockAssertVenueMayPublish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../routers/_venue-publish-guard', () => ({
  assertVenueMayPublish: mockAssertVenueMayPublish,
}));

vi.mock('../routers/events/helpers', () => ({
  resolveEventCoordinates: vi.fn(() => Promise.resolve({ lat: '53.3498', lng: '-6.2603' })),
  lookupVenueCoords: vi.fn(() => Promise.resolve(null)),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { update } from '../routers/events/crud';

const testRouter = router({ events: router({ update }) });
const createCaller = t.createCallerFactory(testRouter);

const mockDispatchNotification = vi.fn(async () => {});

// ─── IDs ──────────────────────────────────────────────────────────────────────

const CREATOR_USER_ID = 'a1111111-1111-4111-a111-111111111111';
const CREATOR_PROFILE_ID = 'a1111111-1111-4111-a111-1111111111aa';
const CREATOR_STAGE_NAME = 'Tune Bomb';

const INVITED_USER_ID = 'b2222222-2222-4222-a222-222222222222';
const INVITED_PROFILE_ID = 'b2222222-2222-4222-a222-2222222222bb';
const INVITED_STAGE_NAME = 'Celtic Thunder';

const EVENT_ID = 'c3333333-3333-4333-a333-333333333333';
const BOOKING_ID = 'd4444444-4444-4444-a444-444444444444';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const existingEvent = {
  id: EVENT_ID,
  title: 'Saturday Trad Night',
  createdBy: CREATOR_USER_ID,
  status: 'active',
  venueId: null,
  dateStart: new Date('2026-07-05T20:00:00Z'),
};

const updatedEvent = {
  ...existingEvent,
  title: 'Saturday Trad Night (Updated)',
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

// Edit payload: just retitle + invite a new co-artist (and the creator, who must
// be filtered out by the self-invite guard). No venueId/coords → avoids the
// venue-change + coordinate-resolution branches.
const updateInput = {
  id: EVENT_ID,
  data: {
    title: 'Saturday Trad Night (Updated)',
    platformInvites: [INVITED_USER_ID, CREATOR_USER_ID],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('events.update — artist-to-artist co-artist invites', () => {
  beforeEach(() => {
    mockInsertReturning.mockReset();
    mockUpdateReturning.mockReset();
    mockEventsFindFirst.mockReset();
    mockCollabsFindMany.mockReset().mockResolvedValue([]);
    mockArtistsFindFirst.mockReset();
    mockSelectWhere.mockReset().mockResolvedValue([]);
    mockPendingInvitesWhere.mockReset().mockResolvedValue([]);
    mockDeleteWhere.mockReset().mockResolvedValue(undefined);
    mockDispatchNotification.mockReset().mockResolvedValue(undefined);

    mockInsertValues
      .mockReset()
      .mockImplementation((_values?: unknown) => ({ returning: mockInsertReturning }));

    (mockDb.insert as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementation(() => ({ values: mockInsertValues }));

    (mockDb.update as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: mockUpdateReturning })),
      })),
    }));

    (mockDb.select as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
        innerJoin: vi.fn(() => ({ where: mockPendingInvitesWhere })),
      })),
    }));

    (mockDb.delete as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementation(() => ({ where: mockDeleteWhere }));

    (mockDb.transaction as ReturnType<typeof vi.fn>)
      .mockReset()
      .mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

    // Ownership fetch → the creator's own event.
    mockEventsFindFirst.mockResolvedValueOnce(existingEvent);

    // tx.update(events)...returning() → the updated row.
    mockUpdateReturning.mockResolvedValueOnce([updatedEvent]);

    // booking insert → newBooking; eventCollaborators insert → [].
    mockInsertReturning
      .mockResolvedValueOnce([newBooking]) // bookings insert
      .mockResolvedValueOnce([]); // eventCollaborators insert

    // creator's own artist profile (artist branch).
    mockArtistsFindFirst.mockResolvedValueOnce(creatorProfile);

    // invited artist profiles (self already filtered out before this select).
    mockSelectWhere.mockResolvedValueOnce([invitedProfile]);
  });

  it('creates an artist_to_artist booking for the newly invited artist', async () => {
    const caller = createCaller(artistContext());
    await caller.events.update(updateInput);

    const bookingCall = mockInsertValues.mock.calls.find(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        'direction' in (args[0] as Record<string, unknown>)
    );

    expect(bookingCall).toBeDefined();
    const v = (bookingCall?.[0] ?? {}) as Record<string, unknown>;
    expect(v.direction).toBe('artist_to_artist');
    expect(v.inviterArtistId).toBe(CREATOR_PROFILE_ID);
    expect(v.venueId).toBeNull();
    expect(v.artistId).toBe(INVITED_PROFILE_ID);
    expect(v.status).toBe('pending');
  });

  it('dispatches BOOKING_INVITE_TO_COARTIST to the invited artist only', async () => {
    const caller = createCaller(artistContext());
    await caller.events.update(updateInput);

    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'booking_invite_to_coartist',
        recipientUserId: INVITED_USER_ID,
        vars: expect.objectContaining({
          bookingId: BOOKING_ID,
          coArtistName: CREATOR_STAGE_NAME,
          eventTitle: updatedEvent.title,
        }) as unknown,
      })
    );
    // Exactly one co-artist invite (creator excluded by self-invite guard).
    const a2aBookings = mockInsertValues.mock.calls.filter(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        (args[0] as Record<string, unknown>).direction === 'artist_to_artist'
    );
    expect(a2aBookings).toHaveLength(1);
  });

  it('skips an already-collaborating artist (no duplicate booking)', async () => {
    // Existing collaborator already includes the invited artist's user id.
    mockCollabsFindMany.mockReset().mockResolvedValueOnce([{ artistProfileId: INVITED_USER_ID }]);

    const caller = createCaller(artistContext());
    await caller.events.update(updateInput);

    const a2aBookings = mockInsertValues.mock.calls.filter(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        (args[0] as Record<string, unknown>).direction === 'artist_to_artist'
    );
    expect(a2aBookings).toHaveLength(0);
  });

  it('withdraws a pending invite the creator dropped from the field', async () => {
    // The invited artist has a still-pending co-artist invite (so they're an
    // existing collaborator AND in the removable pending set)...
    mockCollabsFindMany.mockReset().mockResolvedValueOnce([{ artistProfileId: INVITED_USER_ID }]);
    mockPendingInvitesWhere
      .mockReset()
      .mockResolvedValueOnce([{ bookingId: BOOKING_ID, inviteeUserId: INVITED_USER_ID }]);

    // ...and the edit clears the Invite Artists field. The form sends `[]` on
    // edit so the drop persists. (Asana 1215912673233456)
    const caller = createCaller(artistContext());
    await caller.events.update({ id: EVENT_ID, data: { platformInvites: [] } });

    // The pending invite's collaborator row is detached...
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    // ...and the invitee is told their invite was withdrawn.
    expect(mockDispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'booking_coartist_withdrawn_to_invitee',
        recipientUserId: INVITED_USER_ID,
        vars: expect.objectContaining({
          bookingId: BOOKING_ID,
          coArtistName: CREATOR_STAGE_NAME,
          eventTitle: updatedEvent.title,
        }) as unknown,
      })
    );
    // No new invite is created.
    const a2aBookings = mockInsertValues.mock.calls.filter(
      (args) =>
        args[0] !== undefined &&
        typeof args[0] === 'object' &&
        (args[0] as Record<string, unknown>).direction === 'artist_to_artist'
    );
    expect(a2aBookings).toHaveLength(0);
  });
});

describe('events.update — the edit path cannot be used to publish (V-14)', () => {
  beforeEach(() => {
    // This file has no global mock reset, so call counts accumulate across tests
    // without an explicit clear here.
    vi.clearAllMocks();
    mockUpdateReturning.mockResolvedValue([updatedEvent]);
    mockSelectWhere.mockResolvedValue([]);
    mockCollabsFindMany.mockResolvedValue([]);
    mockPendingInvitesWhere.mockResolvedValue([]);
    mockAssertVenueMayPublish.mockResolvedValue(undefined);
  });

  /** Same session shape as artistContext, but a venue. */
  function venueContext(): Context {
    const ctx = artistContext();
    return {
      ...ctx,
      session: {
        ...ctx.session,
        user: { ...(ctx.session as { user: Record<string, unknown> }).user, currentRole: 'venue' },
      },
    } as unknown as Context;
  }

  it('runs the publish guard when a REMOVED event is resubmitted', async () => {
    // `create` was guarded; `update` was a bare protectedProcedure that could move an
    // event from REMOVED back to ACTIVE. An on-hold venue could publish by editing.
    mockEventsFindFirst.mockResolvedValue({ ...existingEvent, status: 'removed' });

    await createCaller(venueContext()).events.update({
      id: EVENT_ID,
      data: { title: 'Back on' },
    });

    expect(mockAssertVenueMayPublish).toHaveBeenCalledTimes(1);
  });

  it('does NOT run the guard for an ordinary edit of an already-active event', async () => {
    // Editing is deliberately still allowed while lapsed — a venue keeps view, edit and
    // fix-payment. Only the transition into a visible state is gated.
    mockEventsFindFirst.mockResolvedValue({ ...existingEvent, status: 'active' });

    await createCaller(venueContext()).events.update({
      id: EVENT_ID,
      data: { title: 'Typo fixed' },
    });

    expect(mockAssertVenueMayPublish).not.toHaveBeenCalled();
  });

  it('propagates the guard refusal instead of publishing anyway', async () => {
    mockEventsFindFirst.mockResolvedValue({ ...existingEvent, status: 'removed' });
    mockAssertVenueMayPublish.mockRejectedValueOnce(
      Object.assign(new Error('subscription needed'), { code: 'FORBIDDEN' })
    );

    await expect(
      createCaller(venueContext()).events.update({ id: EVENT_ID, data: { title: 'Back on' } })
    ).rejects.toThrow(/subscription needed/);
  });
});
