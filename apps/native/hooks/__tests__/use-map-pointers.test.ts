import { describe, expect, it, vi } from 'vitest';

// Only the pure helpers are under test; stub React so importing the module
// doesn't drag in a full React Native environment.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
  useMemo: (fn: () => unknown) => fn(),
  useRef: () => ({ current: null }),
}));
// The hook emits pointer analytics. The real module pulls in
// @sentry/react-native, which re-exports react-native, whose index.js uses
// Flow's `import typeof` syntax that vite cannot parse.
vi.mock('@/lib/analytics', () => ({
  AnalyticsEvent: {
    MAP_POINTERS_SHOWN: 'map_pointers_shown',
    MAP_POINTER_TAPPED: 'map_pointer_tapped',
  },
  track: vi.fn(),
}));
// @CeolX/shared is deliberately NOT mocked — bearingBetween, distanceBetween and
// the pointer constants are exactly what these tests exercise.

import {
  bearingToCompass,
  computePointers,
  isOutsideRegion,
  resolvePointerAnchor,
} from '../use-map-pointers';

import type { MapEvent } from '@/components/MapEventMarker';

// Viewport centred on Dublin, roughly 11km tall and 7km wide.
const DUBLIN_REGION = {
  latitude: 53.3498,
  longitude: -6.2603,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const DUBLIN_ANCHOR = { lat: 53.3498, lng: -6.2603, isUserLocation: true };

function event(id: string, lat: number, lng: number): MapEvent {
  return {
    id,
    title: `Event ${id}`,
    lat,
    lng,
    category: 'Gigs',
    dateStart: '2026-09-01T20:00:00.000Z',
  };
}

describe('isOutsideRegion', () => {
  it('returns false for an event at the centre', () => {
    expect(isOutsideRegion({ lat: 53.3498, lng: -6.2603 }, DUBLIN_REGION)).toBe(false);
  });

  it('returns false for an event exactly on the edge', () => {
    // Exactly on the boundary is still visible — it must not become a pointer.
    expect(isOutsideRegion({ lat: 53.3998, lng: -6.2603 }, DUBLIN_REGION)).toBe(false);
    expect(isOutsideRegion({ lat: 53.3498, lng: -6.2103 }, DUBLIN_REGION)).toBe(false);
  });

  it('returns true past each edge', () => {
    expect(isOutsideRegion({ lat: 53.5, lng: -6.2603 }, DUBLIN_REGION)).toBe(true);
    expect(isOutsideRegion({ lat: 53.1, lng: -6.2603 }, DUBLIN_REGION)).toBe(true);
    expect(isOutsideRegion({ lat: 53.3498, lng: -6.0 }, DUBLIN_REGION)).toBe(true);
    expect(isOutsideRegion({ lat: 53.3498, lng: -6.5 }, DUBLIN_REGION)).toBe(true);
  });
});

describe('bearingToCompass', () => {
  it('names the eight points', () => {
    expect(bearingToCompass(0)).toBe('north');
    expect(bearingToCompass(45)).toBe('north-east');
    expect(bearingToCompass(90)).toBe('east');
    expect(bearingToCompass(180)).toBe('south');
    expect(bearingToCompass(270)).toBe('west');
  });

  it('wraps back to north near 360', () => {
    expect(bearingToCompass(359)).toBe('north');
  });
});

describe('resolvePointerAnchor', () => {
  const home = { latitude: 23.0225, longitude: 72.5714, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  it('prefers an explicit pick over a live GPS fix', () => {
    // Phone in Ahmedabad, user searched Limerick. They named their reference
    // point, so the gig is 45km away — not 7421km.
    const anchor = resolvePointerAnchor({ lat: 52.6638, lng: -8.6267 }, 'gps', home);
    // A searched place is the reference but is NOT the user, so its distance
    // must never be labelled "from you".
    expect(anchor).toEqual({ lat: 52.6638, lng: -8.6267, isUserLocation: false });
  });

  it('falls back to the location chain when nothing was picked', () => {
    const expected = { lat: 23.0225, lng: 72.5714, isUserLocation: true };
    expect(resolvePointerAnchor(null, 'gps', home)).toEqual(expected);
    expect(resolvePointerAnchor(null, 'saved', home)).toEqual(expected);
    expect(resolvePointerAnchor(null, 'venue-profile', home)).toEqual(expected);
  });

  it('refuses to quote a distance from an approximate location', () => {
    // IP and the Ireland default are city-level guesses at best; a distance
    // measured from one would read precise while being tens of km out.
    expect(resolvePointerAnchor(null, 'ip', home)).toBeNull();
    expect(resolvePointerAnchor(null, 'default', home)).toBeNull();
    expect(resolvePointerAnchor(null, 'pending', home)).toBeNull();
  });
});

describe('computePointers', () => {
  it('ignores events inside the viewport', () => {
    const pointers = computePointers([event('a', 53.35, -6.26)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(pointers).toEqual([]);
  });

  it('points at an off-screen event with distance from the anchor', () => {
    // Drogheda — about 45km north of Dublin.
    const pointers = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, DUBLIN_ANCHOR);

    expect(pointers).toHaveLength(1);
    expect(pointers[0]?.count).toBe(1);
    expect(pointers[0]?.compass).toBe('north');
    expect(pointers[0]?.distanceKm).toBeGreaterThan(35);
    expect(pointers[0]?.distanceKm).toBeLessThan(50);
    expect(pointers[0]?.nearestEvent.id).toBe('a');
  });

  it('collapses events sharing a direction into one pointer with a count', () => {
    const pointers = computePointers(
      [event('a', 53.7179, -6.3561), event('b', 53.75, -6.36), event('c', 53.78, -6.35)],
      DUBLIN_REGION,
      DUBLIN_ANCHOR
    );

    expect(pointers).toHaveLength(1);
    expect(pointers[0]?.count).toBe(3);
    // The label event is the closest of the three, not whichever came first.
    expect(pointers[0]?.nearestEvent.id).toBe('a');
  });

  it('snaps every pointer to a sector centre so two arrows cannot overlap', () => {
    // Regression: found on-device. From Limerick these two real staging events
    // bear 341.6° and 332° — different sectors, but only ~9° apart, so the pills
    // rendered on top of each other at the viewport edge. Grouping alone does
    // not separate them; snapping to the sector centre does.
    const limerick = {
      latitude: 52.6638,
      longitude: -8.6267,
      latitudeDelta: 0.15,
      longitudeDelta: 0.15,
    };
    const pointers = computePointers(
      [event('gort', 53.0453703, -8.8368878), event('galway', 53.3761, -9.2474)],
      limerick,
      { lat: 52.6638, lng: -8.6267, isUserLocation: true }
    );

    expect(pointers.length).toBeGreaterThan(1);
    for (const p of pointers) {
      expect(p.bearingDeg % 45).toBe(0);
    }
    // Any two arrows are at least one full sector apart on screen.
    const bearings = pointers.map((p) => p.bearingDeg).sort((a, b) => a - b);
    for (let i = 1; i < bearings.length; i += 1) {
      expect(bearings[i] - bearings[i - 1]).toBeGreaterThanOrEqual(45);
    }
  });

  it('only claims a distance is "from you" when it really is', () => {
    const fromUser = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(fromUser[0]?.distanceFromUser).toBe(true);

    // Same numbers, but the anchor is a place the user searched. The distance is
    // from Dublin-the-place, not from the person, so the label must not say so.
    const fromSearch = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, {
      lat: 53.3498,
      lng: -6.2603,
      isUserLocation: false,
    });
    expect(fromSearch[0]?.distanceKm).toBeGreaterThan(0);
    expect(fromSearch[0]?.distanceFromUser).toBe(false);
  });

  it('drops events beyond the 150km cap', () => {
    // Paris — far outside Ireland, and useless as a direction to pan in.
    const pointers = computePointers([event('a', 48.8566, 2.3522)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(pointers).toEqual([]);
  });

  // The Paris case above passes for any cap between roughly 50 and 700km, so on its own
  // it does not pin the number. These two bracket it: MAP_POINTER_MAX_KM was briefly
  // lowered to 100 on the false premise that nothing beyond 100km is ever loaded, and
  // nothing in the suite noticed. Distances are from the region CENTRE, which is what
  // computePointers measures (53.3498 plus 130km and 175km due north).
  it('keeps an event inside the cap but well past the empty-map sweep', () => {
    const pointers = computePointers([event('a', 54.51892, -6.2603)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(pointers).toHaveLength(1);
  });

  it('drops an event just outside the cap', () => {
    const pointers = computePointers([event('a', 54.92361, -6.2603)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(pointers).toEqual([]);
  });

  it('keeps the nearest directions when more than three exist', () => {
    const pointers = computePointers(
      [
        event('north', 53.75, -6.26),
        event('east', 53.3498, -5.7),
        event('south', 52.95, -6.26),
        event('west', 53.3498, -6.85),
      ],
      DUBLIN_REGION,
      DUBLIN_ANCHOR
    );

    expect(pointers).toHaveLength(3);
    // Nearest first — each of the four is a distinct bearing bucket.
    const distances = pointers.map((p) => p.distanceKm ?? 0);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('omits the distance but still applies the cap when there is no anchor', () => {
    // Drogheda is ~41km from the viewport, so it survives the cap; with no
    // trustworthy anchor there is simply no honest distance to quote.
    const near = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, null);
    expect(near).toHaveLength(1);
    expect(near[0]?.distanceKm).toBeNull();
    expect(near[0]?.compass).toBe('north');

    // Paris is far outside the cap. The abroad/IP case is exactly the one the
    // cap exists for, so a missing anchor must not be a way to bypass it.
    const far = computePointers([event('b', 48.8566, 2.3522)], DUBLIN_REGION, null);
    expect(far).toEqual([]);
  });

  it('keeps events near the viewport even when they are far from the anchor', () => {
    // Looking at Galway with home still set to Dublin. The Galway event is ~198km
    // from home but only ~17km off-screen. Capping on the anchor filtered every
    // one of them out and the feature silently did nothing.
    const galwayRegion = {
      latitude: 53.2707,
      longitude: -9.0568,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
    const pointers = computePointers(
      [event('galway', 53.3761, -9.2474)],
      galwayRegion,
      DUBLIN_ANCHOR
    );

    expect(pointers).toHaveLength(1);
    // Dublin to Galway is ~186km: past the 150km arrow cap but well inside
    // Ireland, so the distance from home is still the number that helps the
    // user decide whether to go.
    expect(pointers[0]?.distanceKm).toBeGreaterThan(150);
  });

  it('quotes a distance across Ireland but not from another continent', () => {
    const nearHome = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, DUBLIN_ANCHOR);
    expect(nearHome[0]?.distanceKm).toBeGreaterThan(0);

    // Cork to a Dublin-area event is ~220km — past the arrow cap, but the kind
    // of cross-country trip a user genuinely weighs up, so the number stays.
    const acrossIreland = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, {
      lat: 51.8985,
      lng: -8.4756,
      isUserLocation: true,
    });
    expect(acrossIreland[0]?.distanceKm).toBeGreaterThan(150);

    // Same viewport and event, but the user is in Ahmedabad. "7421km away" is
    // honest and useless, so it is withheld rather than shown.
    const farFromHome = computePointers([event('a', 53.7179, -6.3561)], DUBLIN_REGION, {
      lat: 23.0225,
      lng: 72.5714,
      isUserLocation: true,
    });
    expect(farFromHome).toHaveLength(1);
    expect(farFromHome[0]?.distanceKm).toBeNull();
  });
});
