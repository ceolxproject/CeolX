import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// Covers the outside-platform ("unregistered") collaborator invite EMAIL that the
// event create/update path must send. The email engine lives in @CeolX/email
// (sendCollaboratorInviteEmail); these tests assert the event resolvers actually
// call it — create emails every invitee, update emails only newly-added ones.

const {
  mockInsertValues,
  mockInsertReturning,
  mockUpdateReturning,
  mockEventsFindFirst,
  mockVenuesFindFirst,
  mockArtistsFindFirst,
  mockCollabsFindMany,
  mockSelectWhere,
  mockPendingInvitesWhere,
  mockDeleteWhere,
  mockDb,
  mockSyncEventToTypesense,
  mockSendCollaboratorInviteEmail,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn((_values?: unknown) => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockEventsFindFirst = vi.fn();
  const mockVenuesFindFirst = vi.fn();
  const mockArtistsFindFirst = vi.fn();
  const mockCollabsFindMany = vi.fn(() => Promise.resolve([]));
  const mockSelectWhere = vi.fn(() => Promise.resolve([]));
  const mockPendingInvitesWhere = vi.fn(() => Promise.resolve([]));
  const mockDeleteWhere = vi.fn(() => Promise.resolve(undefined));
  const mockSyncEventToTypesense = vi.fn(async () => {});
  const mockSendCollaboratorInviteEmail = vi.fn(async () => {});

  const mockDb: Record<string, unknown> = {};
  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: mockVenuesFindFirst },
      artistProfiles: { findFirst: mockArtistsFindFirst },
      events: { findFirst: mockEventsFindFirst },
      eventCollaborators: { findMany: mockCollabsFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockUpdateReturning })) })),
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
    mockInsertValues,
    mockInsertReturning,
    mockUpdateReturning,
    mockEventsFindFirst,
    mockVenuesFindFirst,
    mockArtistsFindFirst,
    mockCollabsFindMany,
    mockSelectWhere,
    mockPendingInvitesWhere,
    mockDeleteWhere,
    mockDb,
    mockSyncEventToTypesense,
    mockSendCollaboratorInviteEmail,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/auth', () => ({ user: { id: 'id', image: 'image' } }));
vi.mock('@CeolX/db/schema/bookings', () => ({ bookings: { id: 'id' } }));
vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', title: 'title', createdBy: 'created_by', status: 'status' },
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    invitedEmail: 'invited_email',
    inviteToken: 'invite_token',
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

vi.mock('../routers/events/helpers', () => ({
  resolveEventCoordinates: vi.fn(() => Promise.resolve({ lat: '53.3498', lng: '-6.2603' })),
  lookupVenueCoords: vi.fn(() => Promise.resolve(null)),
  resolveProfileImageUrl: vi.fn(() => null),
}));

vi.mock('@CeolX/email', () => ({
  sendCollaboratorInviteEmail: mockSendCollaboratorInviteEmail,
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { create, update } from '../routers/events/crud';

const testRouter = router({ events: router({ create, update }) });
const createCaller = t.createCallerFactory(testRouter);

const mockDispatchNotification = vi.fn(async () => {});

const VENUE_USER_ID = 'venue-user-123';
const EVENT_ID = 'c3333333-3333-4333-a333-333333333333';

function venueContext(userId = VENUE_USER_ID): Context {
  return {
    session: {
      user: {
        id: userId,
        name: 'Test Venue',
        email: 'venue@ceolx.test',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        currentRole: 'venue' as UserRole,
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
  title: 'Friday Night Trad Session',
  description: 'A great traditional Irish music session at the pub.',
  dateStart: new Date('2026-07-01T20:00:00Z').toISOString(),
  coverImage: 'https://cdn.ceolx.com/events/cover.jpg',
  lat: 53.3498,
  lng: -6.2603,
  category: 'Open Trad Sessions' as const,
};

const insertedEvent = {
  id: EVENT_ID,
  title: validEventInput.title,
  createdBy: VENUE_USER_ID,
  status: 'active',
  dateStart: new Date(validEventInput.dateStart),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertValues.mockImplementation((_values?: unknown) => ({ returning: mockInsertReturning }));
  mockInsertReturning.mockResolvedValue([insertedEvent]);
  mockVenuesFindFirst.mockResolvedValue({ id: 'venue-profile-1', venueName: 'The Cobblestone' });
  mockArtistsFindFirst.mockResolvedValue(undefined);
  mockCollabsFindMany.mockResolvedValue([]);
  mockSelectWhere.mockResolvedValue([]);
  mockPendingInvitesWhere.mockResolvedValue([]);
  mockDeleteWhere.mockResolvedValue(undefined);
  mockSyncEventToTypesense.mockResolvedValue(undefined);
  mockSendCollaboratorInviteEmail.mockResolvedValue(undefined);
});

describe('events.create — outside-platform invite email', () => {
  it('emails each unregistered collaborator with an /invite/ link', async () => {
    const caller = createCaller(venueContext());

    await caller.events.create({
      ...validEventInput,
      unregisteredCollaborators: [{ name: 'Mary Black', email: 'Mary@Example.com' }],
    });

    expect(mockSendCollaboratorInviteEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendCollaboratorInviteEmail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.to).toBe('mary@example.com'); // canonicalised (lowercased)
    expect(arg.inviterName).toBe('The Cobblestone');
    expect(arg.eventTitle).toBe(validEventInput.title);
    expect(String(arg.inviteUrl)).toContain('/invite/');
  });

  it('sends no invite email when there are no unregistered collaborators', async () => {
    const caller = createCaller(venueContext());
    await caller.events.create(validEventInput);
    expect(mockSendCollaboratorInviteEmail).not.toHaveBeenCalled();
  });
});

describe('events.update — outside-platform invite email', () => {
  const existingEvent = {
    id: EVENT_ID,
    title: 'Saturday Trad Night',
    createdBy: VENUE_USER_ID,
    status: 'active',
    venueId: null,
    dateStart: new Date('2026-07-05T20:00:00Z'),
  };

  beforeEach(() => {
    mockEventsFindFirst.mockResolvedValue(existingEvent);
    mockUpdateReturning.mockResolvedValue([existingEvent]);
    // events.update has no event insert; collaborator inserts don't need returning.
    mockInsertReturning.mockResolvedValue([]);
  });

  it('emails only the newly-added invitee, not the one already invited', async () => {
    // alice was already invited (existing invited-only row); bob is new.
    mockCollabsFindMany.mockResolvedValue([
      {
        id: 'collab-alice',
        invitedEmail: 'alice@example.com',
        inviteToken: 'existing-token-alice',
        inviteTokenExpiresAt: new Date('2026-07-19T00:00:00Z'),
      },
    ]);

    const caller = createCaller(venueContext());
    await caller.events.update({
      id: EVENT_ID,
      data: {
        unregisteredCollaborators: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      },
    });

    expect(mockSendCollaboratorInviteEmail).toHaveBeenCalledTimes(1);
    const arg = mockSendCollaboratorInviteEmail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.to).toBe('bob@example.com');
  });
});
