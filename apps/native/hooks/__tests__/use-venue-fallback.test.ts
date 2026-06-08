import { describe, expect, it, vi } from 'vitest';

// UserRole is a pure const map — provide it directly.
vi.mock('@CeolX/shared/enums', () => ({
  UserRole: { SPECTATOR: 'spectator', ARTIST: 'artist', VENUE: 'venue', ADMIN: 'admin' },
}));

// Real coordinate validation (mirrors packages/shared/src/utils/geo.ts):
// rejects non-numbers, out-of-bounds, and null-island (0,0).
vi.mock('@CeolX/shared', () => ({
  isValidCoordinate: (lat: unknown, lng: unknown) =>
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0),
}));

// Hook depends on useMe — not exercised by the pure-selector tests, but the
// module imports it, so stub it to keep the import graph clean.
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));

import { selectVenueFallback } from '../use-venue-fallback';

describe('selectVenueFallback', () => {
  it('returns null for a spectator', () => {
    expect(selectVenueFallback({ currentRole: 'spectator' })).toBeNull();
  });

  it('returns null for an artist (even with coords on some other profile)', () => {
    expect(selectVenueFallback({ currentRole: 'artist' })).toBeNull();
  });

  it('returns null for undefined/loading me', () => {
    expect(selectVenueFallback(undefined)).toBeNull();
    expect(selectVenueFallback(null)).toBeNull();
  });

  it('returns null for a venue with no venueProfile coords', () => {
    expect(selectVenueFallback({ currentRole: 'venue', venueProfile: null })).toBeNull();
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: null, lng: null } })
    ).toBeNull();
  });

  it('returns null for a venue at null-island (0,0)', () => {
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: 0, lng: 0 } })
    ).toBeNull();
  });

  it('returns the pin for a venue with valid coords', () => {
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: 53.27, lng: -9.05 } })
    ).toEqual({ latitude: 53.27, longitude: -9.05 });
  });
});
