import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { UserRole } from '@CeolX/shared';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// Mirrors event-create-coartist.test.ts. We capture every insert().values() call
// so we can assert the promo-post insert (the new behaviour). The promo insert is
// fire-and-forget (no .returning()), so it does NOT consume the mockInsertReturning
// queue — only the events/bookings inserts do.

const {
  mockDb,
  mockInsertValues,
  mockInsertReturning,
  mockVenueFindFirst,
  mockArtistFindFirst,
  mockSelectWhere,
  mockSyncEventToTypesense,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn((_values?: unknown) => ({ returning: mockInsertReturning }));
  const mockVenueFindFirst = vi.fn();
  const mockArtistFindFirst = vi.fn();
  const mockSelectWhere = vi.fn();
  const mockSyncEventToTypesense = vi.fn(async () => {});

  const mockDb: Record<string, unknown> = {};
  Object.assign(mockDb, {
    query: {
      venueProfiles: { findFirst: mockVenueFindFirst },
      artistProfiles: { findFirst: mockArtistFindFirst },
      eventCollaborators: { findMany: vi.fn(() => Promise.resolve([])) },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
    transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb)),
  });

  return {
    mockDb,
    mockInsertValues,
    mockInsertReturning,
    mockVenueFindFirst,
    mockArtistFindFirst,
    mockSelectWhere,
    mockSyncEventToTypesense,
  };
});

// V-14's publish guard is a separate concern with its own coverage in
// __tests__/venue-publish-guard.test.ts. Stubbed here so these tests stay about
// event creation rather than billing state.
vi.mock('../routers/_venue-publish-guard', () => ({ assertVenueMayPublish: vi.fn() }));

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
  events: { id: 'id', title: 'title', createdBy: 'created_by', status: 'status' },
  eventCollaborators: {
    id: 'id',
    eventId: 'event_id',
    artistProfileId: 'artist_profile_id',
    venueProfileId: 'venue_profile_id',
    bookingId: 'booking_id',
  },
  savedEvents: { id: 'id', eventId: 'event_id', userId: 'user_id' },
  collections: { id: 'id', createdBy: 'created_by' },
}));
vi.mock('@CeolX/db/schema/social', () => ({
  posts: {
    id: 'id',
    eventId: 'event_id',
    createdBy: 'created_by',
    caption: 'caption',
    mediaType: 'media_type',
    mediaUrl: 'media_url',
    deletedAt: 'deleted_at',
  },
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
  resolveProfileImageUrl: vi.fn(() => null),
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { create } from '../routers/events/crud';

const testRouter = router({ events: router({ create }) });
const createCaller = t.createCallerFactory(testRouter);
const mockDispatchNotification = vi.fn(async () => {});

const VENUE_USER_ID = 'venue-user-id';
const ARTIST_USER_ID = 'artist-user-id';
const EVENT_ID = 'event-uuid-promo';
const VENUE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TITLE = 'Saturday Trad Night';

function ctxFor(userId: string, role: UserRole): Context {
  return {
    session: { user: { id: userId, currentRole: role } },
    userId,
    currentRole: role,
    dispatchNotification: mockDispatchNotification,
  } as unknown as Context;
}

const baseInput = {
  title: TITLE,
  description: 'An evening of traditional Irish music.',
  dateStart: new Date('2026-08-01T20:00:00Z').toISOString(),
  coverImage: 'https://cdn.ceolx.com/events/cover.jpg',
  lat: 53.3498,
  lng: -6.2603,
  category: 'Open Trad Sessions' as const,
};

// Returns the values object of the insert().values() call that looks like a post.
function findPromoInsert() {
  const call = mockInsertValues.mock.calls.find(
    (args) =>
      args[0] !== undefined &&
      typeof args[0] === 'object' &&
      'caption' in (args[0] as Record<string, unknown>)
  );
  return call?.[0] as Record<string, unknown> | undefined;
}

function rewire() {
  mockInsertReturning.mockReset();
  mockVenueFindFirst.mockReset();
  mockArtistFindFirst.mockReset();
  mockSelectWhere.mockReset().mockResolvedValue([]);
  mockDispatchNotification.mockReset().mockResolvedValue(undefined);
  mockInsertValues
    .mockReset()
    .mockImplementation((_v?: unknown) => ({ returning: mockInsertReturning }));
  (mockDb.insert as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockImplementation(() => ({ values: mockInsertValues }));
  (mockDb.select as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockImplementation(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) }));
  (mockDb.transaction as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
}

describe('events.create — promo post', () => {
  beforeEach(rewire);

  it('creates a visible text promo post for a venue-created (active) event, default shareToFeed', async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: EVENT_ID,
        title: TITLE,
        createdBy: VENUE_USER_ID,
        coverImage: null,
        status: 'active',
        dateStart: new Date(baseInput.dateStart),
      },
    ]);

    const caller = createCaller(ctxFor(VENUE_USER_ID, 'venue' as UserRole));
    await caller.events.create(baseInput);

    const promo = findPromoInsert();
    expect(promo).toBeDefined();
    expect(promo).toMatchObject({
      eventId: EVENT_ID,
      createdBy: VENUE_USER_ID,
      caption: TITLE,
      mediaType: 'text',
      mediaUrl: null,
      deletedAt: null,
    });
  });

  it('uses mediaType image + the cover url when the event has a cover image', async () => {
    const cover = 'https://cdn.ceolx.test/cover.jpg';
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: EVENT_ID,
        title: TITLE,
        createdBy: VENUE_USER_ID,
        coverImage: cover,
        status: 'active',
        dateStart: new Date(baseInput.dateStart),
      },
    ]);

    const caller = createCaller(ctxFor(VENUE_USER_ID, 'venue' as UserRole));
    await caller.events.create({ ...baseInput, coverImage: cover });

    const promo = findPromoInsert();
    expect(promo).toMatchObject({ mediaType: 'image', mediaUrl: cover });
  });

  it('creates the promo post hidden (deletedAt set) for an approval-gated (pending_review) event', async () => {
    // Artist naming a registered venue → heldForVenueApproval → pending_review.
    mockInsertReturning
      .mockResolvedValueOnce([
        {
          id: EVENT_ID,
          title: TITLE,
          createdBy: ARTIST_USER_ID,
          coverImage: null,
          status: 'pending_review',
          dateStart: new Date(baseInput.dateStart),
        },
      ])
      .mockResolvedValueOnce([{ id: 'booking-uuid' }]); // artist→venue booking insert
    mockVenueFindFirst.mockResolvedValue({
      id: VENUE_ID,
      userId: 'venue-owner',
      venueName: 'The Cobblestone',
    });
    mockArtistFindFirst.mockResolvedValue({ id: 'artist-profile', stageName: 'Tune Bomb' });

    const caller = createCaller(ctxFor(ARTIST_USER_ID, 'artist' as UserRole));
    await caller.events.create({ ...baseInput, venueId: VENUE_ID });

    const promo = findPromoInsert();
    expect(promo).toBeDefined();
    expect(promo?.eventId).toBe(EVENT_ID);
    expect(promo?.deletedAt).toBeInstanceOf(Date);
  });

  it('does NOT create a promo post when shareToFeed is false', async () => {
    mockInsertReturning.mockResolvedValueOnce([
      {
        id: EVENT_ID,
        title: TITLE,
        createdBy: VENUE_USER_ID,
        coverImage: null,
        status: 'active',
        dateStart: new Date(baseInput.dateStart),
      },
    ]);

    const caller = createCaller(ctxFor(VENUE_USER_ID, 'venue' as UserRole));
    await caller.events.create({ ...baseInput, shareToFeed: false });

    expect(findPromoInsert()).toBeUndefined();
  });
});
