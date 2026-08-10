import { describe, it, expect } from 'vitest';

import {
  isWithinIreland,
  bearingBetween,
  distanceBetween,
  formatDistance,
  getBoundingBox,
  clampToIreland,
  isValidCoordinate,
  filterValidMapEvents,
} from '../geo.js';

describe('isWithinIreland', () => {
  it('returns true for Dublin coordinates', () => {
    expect(isWithinIreland(53.3498, -6.2603)).toBe(true);
  });

  it('returns true for Galway coordinates', () => {
    expect(isWithinIreland(53.2707, -9.0568)).toBe(true);
  });

  it('returns false for London coordinates', () => {
    expect(isWithinIreland(51.5074, -0.1278)).toBe(false);
  });

  it('returns false for New York coordinates', () => {
    expect(isWithinIreland(40.7128, -74.006)).toBe(false);
  });
});

describe('distanceBetween', () => {
  it('calculates Dublin to Cork straight-line distance (~220km)', () => {
    // Haversine (straight line) distance, not road distance
    const dublinLat = 53.3498;
    const dublinLng = -6.2603;
    const corkLat = 51.8985;
    const corkLng = -8.4756;
    const distance = distanceBetween(dublinLat, dublinLng, corkLat, corkLng);
    // Allow ±10km tolerance around the straight-line distance
    expect(distance).toBeGreaterThan(210);
    expect(distance).toBeLessThan(230);
  });

  it('returns 0 for same coordinates', () => {
    expect(distanceBetween(53.3498, -6.2603, 53.3498, -6.2603)).toBe(0);
  });
});

describe('bearingBetween', () => {
  it('reports Dublin to Belfast as roughly north', () => {
    const bearing = bearingBetween(53.3498, -6.2603, 54.5973, -5.9301);
    expect(bearing).toBeGreaterThan(0);
    expect(bearing).toBeLessThan(20);
  });

  it('reports Dublin to Galway as roughly west', () => {
    const bearing = bearingBetween(53.3498, -6.2603, 53.2707, -9.0568);
    expect(bearing).toBeGreaterThan(255);
    expect(bearing).toBeLessThan(285);
  });

  it('reports Dublin to Cork as roughly south-west', () => {
    const bearing = bearingBetween(53.3498, -6.2603, 51.8985, -8.4756);
    expect(bearing).toBeGreaterThan(200);
    expect(bearing).toBeLessThan(240);
  });

  it('always returns a value in [0, 360)', () => {
    expect(bearingBetween(53.3498, -6.2603, 53.4, -6.2603)).toBeGreaterThanOrEqual(0);
    expect(bearingBetween(53.3498, -6.2603, 53.3, -6.3)).toBeLessThan(360);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometre in metres', () => {
    expect(formatDistance(0.3)).toBe('300m');
  });

  it('formats kilometres with one decimal', () => {
    expect(formatDistance(2.4)).toBe('2.4km');
  });

  it('formats exactly 1km as 1.0km', () => {
    expect(formatDistance(1.0)).toBe('1.0km');
  });
});

describe('getBoundingBox', () => {
  it('returns correct SW/NE corners for 25km radius around Dublin', () => {
    const box = getBoundingBox(53.3498, -6.2603, 25);
    // swLat < lat < neLat
    expect(box.swLat).toBeLessThan(53.3498);
    expect(box.neLat).toBeGreaterThan(53.3498);
    expect(box.swLng).toBeLessThan(-6.2603);
    expect(box.neLng).toBeGreaterThan(-6.2603);
    // Rough check: 25km ≈ 0.225 degrees latitude
    expect(box.neLat - box.swLat).toBeCloseTo(0.45, 1);
  });
});

describe('clampToIreland', () => {
  it('passes through coordinates within Ireland', () => {
    const result = clampToIreland(53.3498, -6.2603);
    expect(result.lat).toBe(53.3498);
    expect(result.lng).toBe(-6.2603);
  });

  it('clamps latitude below minimum', () => {
    const result = clampToIreland(50.0, -6.2603);
    expect(result.lat).toBe(51.3);
  });

  it('clamps longitude above maximum', () => {
    const result = clampToIreland(53.3498, -5.0);
    expect(result.lng).toBe(-5.9);
  });
});

describe('isValidCoordinate', () => {
  it('accepts valid Dublin coordinates', () => {
    expect(isValidCoordinate(53.3498, -6.2603)).toBe(true);
  });

  it('accepts boundary values (-90, -180)', () => {
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
  });

  it('rejects null values', () => {
    expect(isValidCoordinate(null, -6.26)).toBe(false);
    expect(isValidCoordinate(53.35, null)).toBe(false);
  });

  it('rejects undefined values', () => {
    expect(isValidCoordinate(undefined, -6.26)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidCoordinate(NaN, -6.26)).toBe(false);
    expect(isValidCoordinate(53.35, NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidCoordinate(Infinity, -6.26)).toBe(false);
    expect(isValidCoordinate(53.35, -Infinity)).toBe(false);
  });

  it('rejects strings', () => {
    expect(isValidCoordinate('53.35', '-6.26')).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    expect(isValidCoordinate(91, -6.26)).toBe(false);
    expect(isValidCoordinate(-91, -6.26)).toBe(false);
  });

  it('rejects out-of-range longitude', () => {
    expect(isValidCoordinate(53.35, 181)).toBe(false);
    expect(isValidCoordinate(53.35, -181)).toBe(false);
  });

  it('rejects null-island (0, 0) — the unset-coordinate sentinel', () => {
    // 0,0 is in the Atlantic off Africa; it's never a real location and is the
    // value events ended up with when geocoding silently failed (they then
    // vanished from the map/feed). Treat it as invalid, not "just in range".
    expect(isValidCoordinate(0, 0)).toBe(false);
  });
});

describe('filterValidMapEvents', () => {
  const validEvent = { id: '1', lat: 53.35, lng: -6.26 };
  const validEvent2 = { id: '5', lat: 51.9, lng: -8.47 };
  const nullLatEvent = { id: '2', lat: null as unknown as number, lng: -6.26 };
  const nanLngEvent = { id: '3', lat: 53.35, lng: NaN };
  const missingCoordsEvent = { id: '4' } as { id: string; lat: number; lng: number };

  it('splits events into valid and invalid', () => {
    const { valid, invalid } = filterValidMapEvents([validEvent, nullLatEvent, nanLngEvent]);
    expect(valid).toEqual([validEvent]);
    expect(invalid).toEqual([nullLatEvent, nanLngEvent]);
  });

  it('returns all invalid when no events are valid', () => {
    const { valid, invalid } = filterValidMapEvents([nullLatEvent, nanLngEvent]);
    expect(valid).toEqual([]);
    expect(invalid).toEqual([nullLatEvent, nanLngEvent]);
  });

  it('returns all valid when every event has good coordinates', () => {
    const { valid, invalid } = filterValidMapEvents([validEvent, validEvent2]);
    expect(valid).toEqual([validEvent, validEvent2]);
    expect(invalid).toEqual([]);
  });

  it('collects all invalid events including missing coords', () => {
    const { invalid } = filterValidMapEvents([
      validEvent,
      nullLatEvent,
      nanLngEvent,
      missingCoordsEvent,
    ]);
    expect(invalid).toHaveLength(3);
    expect(invalid).toContain(nullLatEvent);
    expect(invalid).toContain(nanLngEvent);
    expect(invalid).toContain(missingCoordsEvent);
  });

  it('handles empty array', () => {
    const { valid, invalid } = filterValidMapEvents([]);
    expect(valid).toEqual([]);
    expect(invalid).toEqual([]);
  });
});
