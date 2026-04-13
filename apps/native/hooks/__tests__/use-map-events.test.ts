import { describe, expect, it, vi } from 'vitest';

// Mock React and hook dependencies so we can test pure functions
// without needing a full React Native / tRPC environment.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock('@/utils/trpc', () => ({
  trpc: {
    events: {
      getMap: {
        queryOptions: vi.fn(() => ({})),
      },
    },
  },
}));
vi.mock('react-native-maps', () => ({}));
vi.mock('@CeolX/shared', () => ({
  MAP_DEBOUNCE_MS: 400,
  MAP_MAX_PINS_PER_FETCH: 50,
  MAP_EXPAND_RADIUS_KM: [5, 25, 100],
  getBoundingBox: (lat: number, lng: number, radiusKm: number) => {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    return {
      swLat: lat - latDelta,
      swLng: lng - lngDelta,
      neLat: lat + latDelta,
      neLng: lng + lngDelta,
    };
  },
}));

import { expandSearch, regionToBoundingBox } from '../use-map-events';

// ---------------------------------------------------------------------------
// regionToBoundingBox tests (existing)
// ---------------------------------------------------------------------------

describe('regionToBoundingBox', () => {
  it('converts a region to a bounding box correctly', () => {
    const region = { latitude: 53.27, longitude: -9.05, latitudeDelta: 1.0, longitudeDelta: 1.5 };
    const box = regionToBoundingBox(region);
    expect(box.swLat).toBeCloseTo(52.77);
    expect(box.neLat).toBeCloseTo(53.77);
    expect(box.swLng).toBeCloseTo(-9.8);
    expect(box.neLng).toBeCloseTo(-8.3);
  });

  it('handles Ireland center region', () => {
    const region = { latitude: 53.1424, longitude: -7.6921, latitudeDelta: 4, longitudeDelta: 5 };
    const box = regionToBoundingBox(region);
    expect(box.swLat).toBeCloseTo(51.1424);
    expect(box.neLat).toBeCloseTo(55.1424);
    expect(box.swLng).toBeCloseTo(-10.1921);
    expect(box.neLng).toBeCloseTo(-5.1921);
  });
});

// ---------------------------------------------------------------------------
// expandSearch tests
// ---------------------------------------------------------------------------

describe('expandSearch', () => {
  const CENTER_LAT = 53.35;
  const CENTER_LNG = -6.26;

  it('returns events from first radius that has results', async () => {
    const mockEvent = { id: '1', title: 'Session' };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ events: [], totalCount: 0 }) // 5km — empty
      .mockResolvedValueOnce({ events: [mockEvent], totalCount: 1 }); // 25km — found

    const result = await expandSearch(CENTER_LAT, CENTER_LNG, fetchFn, { current: false });

    expect(result.events).toEqual([mockEvent]);
    expect(result.exhausted).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2); // stopped at 25km, didn't try 100km
  });

  it('sets exhausted when all radii return 0 events', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ events: [], totalCount: 0 });

    const result = await expandSearch(CENTER_LAT, CENTER_LNG, fetchFn, { current: false });

    expect(result.events).toEqual([]);
    expect(result.exhausted).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3); // tried all 3 radii
  });

  it('returns immediately from first radius if events found', async () => {
    const mockEvent = { id: '2', title: 'Gig' };
    const fetchFn = vi.fn().mockResolvedValueOnce({ events: [mockEvent], totalCount: 1 });

    const result = await expandSearch(CENTER_LAT, CENTER_LNG, fetchFn, { current: false });

    expect(result.events).toEqual([mockEvent]);
    expect(fetchFn).toHaveBeenCalledTimes(1); // only tried 5km
  });

  it('aborts when abortRef is set to true', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ events: [], totalCount: 0 });
    const abortRef = { current: true }; // already aborted

    const result = await expandSearch(CENTER_LAT, CENTER_LNG, fetchFn, abortRef);

    expect(result.events).toEqual([]);
    expect(result.exhausted).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('passes correct bounding box with limit to fetchFn', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ events: [{ id: '1' }], totalCount: 1 });

    await expandSearch(CENTER_LAT, CENTER_LNG, fetchFn, { current: false });

    const calledBbox = fetchFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(calledBbox).toHaveProperty('swLat');
    expect(calledBbox).toHaveProperty('swLng');
    expect(calledBbox).toHaveProperty('neLat');
    expect(calledBbox).toHaveProperty('neLng');
    expect(calledBbox['limit']).toBe(50);
  });
});
