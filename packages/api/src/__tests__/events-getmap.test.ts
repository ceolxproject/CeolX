import { describe, it, expect, vi, beforeEach } from 'vitest';

import { t, router } from '../index';
import { eventsRouter } from '../routers/events';

// ─── Mock database modules (events router imports @CeolX/db + schema) ───────

vi.mock('@CeolX/db/schema/events', () => ({
  events: {
    id: 'id',
    title: 'title',
    status: 'status',
    dateStart: 'date_start',
    category: 'category',
    lat: 'lat',
    lng: 'lng',
    venueAddress: 'venue_address',
    coverImage: 'cover_image',
    createdAt: 'created_at',
    createdBy: 'created_by',
    dateEnd: 'date_end',
  },
  savedEvents: { userId: 'user_id', eventId: 'event_id', id: 'id' },
}));

vi.mock('@CeolX/db/schema/social', () => ({
  follows: { followerId: 'follower_id', followeeId: 'followee_id' },
}));

vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: { userId: 'user_id', stageName: 'stage_name' },
  venueProfiles: { userId: 'user_id', venueName: 'venue_name' },
}));

vi.mock('@CeolX/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ then: vi.fn((cb: (v: unknown[]) => void) => cb([])) })),
        leftJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// ─── Mock typesense module ────────────────────────────────────────────────────

const mockSearch = vi.fn();

vi.mock('../lib/typesense', () => ({
  typesenseClient: {
    collections: () => ({
      documents: () => ({
        search: mockSearch,
      }),
    }),
  },
}));

// ─── Minimal test router (avoids importing db/auth chains) ───────────────────

const testRouter = router({ events: eventsRouter });
const createCaller = t.createCallerFactory(testRouter);

function anonCaller() {
  return createCaller({ session: null, dispatchNotification: vi.fn(async () => {}) });
}

function artistCaller() {
  return createCaller({
    session: {
      user: {
        id: 'user-1',
        currentRole: 'artist',
        name: 'Test Artist',
        email: 'artist@test.com',
        emailVerified: true,
        marketingConsent: false,
        flaggedInactive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'session-1',
        userId: 'user-1',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    dispatchNotification: vi.fn(async () => {}),
  });
}

function spectatorCaller() {
  return createCaller({
    session: {
      user: {
        id: 'user-2',
        currentRole: 'spectator',
        name: 'Test Spectator',
        email: 'spectator@test.com',
        emailVerified: true,
        marketingConsent: false,
        flaggedInactive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      session: {
        id: 'session-2',
        userId: 'user-2',
        token: 'test-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    dispatchNotification: vi.fn(async () => {}),
  });
}

const DEFAULT_INPUT = {
  swLat: 53.2,
  swLng: -9.1,
  neLat: 53.4,
  neLng: -8.9,
  limit: 50,
} as const;

const MOCK_HIT = {
  document: {
    id: 'event-1',
    title: 'Trad Session Galway',
    category: 'Traditional',
    location: [53.27, -9.05],
    date_start: 1750000000,
    venue_address: 'The Crane Bar, Galway',
    cover_image: null,
  },
  geo_distance_meters: { location: 1200 },
};

type SearchCallArg = Record<string, unknown>;

function getFirstCallArg(): SearchCallArg {
  const calls = mockSearch.mock.calls as SearchCallArg[][];
  const call = calls[0] as SearchCallArg[];
  return call[0] as SearchCallArg;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('events.getMap', () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it('returns events within bounding box', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [MOCK_HIT], found: 1 });

    const caller = anonCaller();
    const result = await caller.events.getMap(DEFAULT_INPUT);

    expect(result.events).toHaveLength(1);
    const [ev] = result.events;
    expect(ev).toBeDefined();
    if (!ev) return;
    expect(ev.id).toBe('event-1');
    expect(ev.title).toBe('Trad Session Galway');
    expect(typeof ev.lat).toBe('number');
    expect(typeof ev.lng).toBe('number');
    expect(ev.category).toBe('Traditional');
    expect(typeof ev.dateStart).toBe('string');
    // basic ISO string check
    expect(() => new Date(ev.dateStart)).not.toThrow();
  });

  it('returns empty array when no hits', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = anonCaller();
    const result = await caller.events.getMap(DEFAULT_INPUT);

    expect(result).toEqual({ events: [], totalCount: 0 });
  });

  it('passes correct polygon filter to Typesense', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = anonCaller();
    await caller.events.getMap(DEFAULT_INPUT);

    const searchArgs = getFirstCallArg();
    const filterBy = searchArgs['filter_by'] as string;
    const { swLat, swLng, neLat, neLng } = DEFAULT_INPUT;

    expect(filterBy).toContain(
      `location:(${swLat},${swLng},${swLat},${neLng},${neLat},${neLng},${neLat},${swLng})`
    );
  });

  it('passes date filter with a unix timestamp', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const before = Math.floor(Date.now() / 1000);
    const caller = anonCaller();
    await caller.events.getMap(DEFAULT_INPUT);
    const after = Math.floor(Date.now() / 1000);

    const searchArgs = getFirstCallArg();
    const filterBy = searchArgs['filter_by'] as string;

    // filter_by should contain date_start:>= followed by a unix timestamp
    const match = filterBy.match(/date_start:>=(\d+)/);
    expect(match).not.toBeNull();
    const ts = Number((match as RegExpMatchArray)[1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('respects limit — passes per_page to Typesense', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = anonCaller();
    await caller.events.getMap({ ...DEFAULT_INPUT, limit: 10 });

    const searchArgs = getFirstCallArg();
    expect(searchArgs['per_page']).toBe(10);
  });

  it('maps geopoint back to lat/lng numbers', async () => {
    const hit = {
      ...MOCK_HIT,
      document: { ...MOCK_HIT.document, location: [53.27, -9.05] },
    };
    mockSearch.mockResolvedValueOnce({ hits: [hit], found: 1 });

    const caller = anonCaller();
    const result = await caller.events.getMap(DEFAULT_INPUT);

    const [ev] = result.events;
    expect(ev).toBeDefined();
    if (!ev) return;
    expect(ev.lat).toBe(53.27);
    expect(ev.lng).toBe(-9.05);
  });

  it('returns totalCount from found', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 42 });

    const caller = anonCaller();
    const result = await caller.events.getMap(DEFAULT_INPUT);

    expect(result.totalCount).toBe(42);
  });

  it('filters to active events only', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = anonCaller();
    await caller.events.getMap(DEFAULT_INPUT);

    const filterBy = getFirstCallArg()['filter_by'] as string;
    expect(filterBy).toContain('status:=active');
  });

  it('does not filter by is_gig_opportunity for anonymous callers (deprecated)', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = anonCaller();
    await caller.events.getMap(DEFAULT_INPUT);

    const filterBy = getFirstCallArg()['filter_by'] as string;
    expect(filterBy).not.toContain('is_gig_opportunity');
  });

  it('does not filter by is_gig_opportunity for artist callers (deprecated)', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = artistCaller();
    await caller.events.getMap(DEFAULT_INPUT);

    const filterBy = getFirstCallArg()['filter_by'] as string;
    expect(filterBy).not.toContain('is_gig_opportunity');
  });

  it('does not filter by is_gig_opportunity for spectator callers (deprecated)', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [], found: 0 });

    const caller = spectatorCaller();
    await caller.events.getMap(DEFAULT_INPUT);

    const filterBy = getFirstCallArg()['filter_by'] as string;
    expect(filterBy).not.toContain('is_gig_opportunity');
  });
});
