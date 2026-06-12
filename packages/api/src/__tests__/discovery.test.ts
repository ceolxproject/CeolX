import { describe, expect, it, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
// `db.select().from(table).where().limit()` routes its result by table identity,
// so one mock serves both the artist and venue queries.

const { mockDb, artistProfilesToken, venueProfilesToken, setArtistRows, setVenueRows, mockSearch } =
  vi.hoisted(() => {
    const artistProfilesToken = {
      stageName: 'stage_name',
      genres: 'genres',
      isActive: 'is_active',
      userId: 'user_id',
    };
    const venueProfilesToken = {
      venueName: 'venue_name',
      subscriptionStatus: 'subscription_status',
      userId: 'user_id',
    };

    let artistRows: unknown[] = [];
    let venueRows: unknown[] = [];

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => ({
          where: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve(
                table === artistProfilesToken
                  ? artistRows
                  : table === venueProfilesToken
                    ? venueRows
                    : []
              )
            ),
          })),
        })),
      })),
    };

    return {
      mockDb,
      artistProfilesToken,
      venueProfilesToken,
      setArtistRows: (r: unknown[]) => {
        artistRows = r;
      },
      setVenueRows: (r: unknown[]) => {
        venueRows = r;
      },
      mockSearch: vi.fn(),
    };
  });

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/db/schema/users', () => ({
  artistProfiles: artistProfilesToken,
  venueProfiles: venueProfilesToken,
}));
vi.mock('../lib/typesense', () => ({
  typesenseClient: {
    collections: () => ({ documents: () => ({ search: mockSearch }) }),
  },
}));

import type { Context } from '../context';
import { t, router } from '../index';
import { discoveryRouter } from '../routers/discovery';

const testRouter = router({ discovery: discoveryRouter });
const createCaller = t.createCallerFactory(testRouter);

function authedContext(): Context {
  return {
    session: {
      user: { id: 'u1', currentRole: 'spectator' },
      session: { id: 's1', userId: 'u1' },
    },
    dispatchNotification: vi.fn(async () => {}),
  } as unknown as Context;
}

function eventHit(title: string, venueAddress?: string) {
  return { document: { title, venue_address: venueAddress } };
}

beforeEach(() => {
  mockSearch.mockReset();
  setArtistRows([]);
  setVenueRows([]);
});

describe('discovery.suggest', () => {
  it('groups artists, venues and events for the events scope', async () => {
    setArtistRows([{ stageName: 'Tune Bomb', genres: ['Trad'] }]);
    setVenueRows([{ venueName: 'The Cobblestone' }]);
    mockSearch.mockResolvedValueOnce({ hits: [eventHit('Trad Night', 'Smithfield, Dublin')] });

    const caller = createCaller(authedContext());
    const result = await caller.discovery.suggest({ q: 't', scope: 'events' });

    expect(result.artists).toEqual([{ label: 'Tune Bomb', sublabel: 'Trad' }]);
    expect(result.venues).toEqual([{ label: 'The Cobblestone' }]);
    expect(result.events).toEqual([{ label: 'Trad Night', sublabel: 'Smithfield, Dublin' }]);
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('omits events and skips Typesense entirely for the posts scope', async () => {
    setArtistRows([{ stageName: 'Tune Bomb', genres: [] }]);
    setVenueRows([{ venueName: 'The Cobblestone' }]);

    const caller = createCaller(authedContext());
    const result = await caller.discovery.suggest({ q: 't', scope: 'posts' });

    expect(result.events).toEqual([]);
    expect(result.artists).toHaveLength(1);
    expect(result.venues).toHaveLength(1);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('de-duplicates event titles and caps the events group at 5', async () => {
    mockSearch.mockResolvedValueOnce({
      hits: [
        eventHit('Gig'),
        eventHit('Gig'),
        eventHit('A'),
        eventHit('B'),
        eventHit('C'),
        eventHit('D'),
        eventHit('E'),
      ],
    });

    const caller = createCaller(authedContext());
    const result = await caller.discovery.suggest({ q: 'g', scope: 'events' });

    const labels = result.events.map((e) => e.label);
    expect(labels).toEqual(['Gig', 'A', 'B', 'C', 'D']);
  });

  it('degrades to an empty events group when Typesense is unreachable', async () => {
    setArtistRows([{ stageName: 'Tune Bomb', genres: [] }]);
    mockSearch.mockRejectedValueOnce(new Error('ENOTFOUND'));

    const caller = createCaller(authedContext());
    const result = await caller.discovery.suggest({ q: 't', scope: 'events' });

    expect(result.events).toEqual([]);
    expect(result.artists).toHaveLength(1);
  });

  it('returns empty groups when nothing matches', async () => {
    mockSearch.mockResolvedValueOnce({ hits: [] });

    const caller = createCaller(authedContext());
    const result = await caller.discovery.suggest({ q: 'zzz', scope: 'events' });

    expect(result).toEqual({ artists: [], venues: [], events: [] });
  });
});
