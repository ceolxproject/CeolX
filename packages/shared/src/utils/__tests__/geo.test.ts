import { describe, it, expect } from 'vitest';

import {
  isWithinIreland,
  distanceBetween,
  formatDistance,
  getBoundingBox,
  clampToIreland,
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
