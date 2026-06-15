import type { LocationSource } from '@/hooks/use-gps-region';

export type FeedLocation = { lat: number; lng: number; label: string };

/** Human-readable fallback label when reverse-geocoding produced nothing. */
function sourceLabel(source: LocationSource): string {
  switch (source) {
    case 'gps':
      return 'Current Location';
    case 'ip':
      return 'Approximate Location';
    case 'venue-profile':
      return 'Your venue';
    case 'default':
    case 'pending':
      return 'Ireland';
    case 'saved':
      return 'Saved location';
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
}

/**
 * Resolve the feed's effective location. A manual override (set from the
 * location sheet) always wins; otherwise we use the GPS/IP/venue region plus the
 * best available label (reverse-geocoded place name, then a source-based label).
 */
export function resolveFeedLocation(
  override: FeedLocation | null,
  region: { latitude: number; longitude: number },
  placeLabel: string | null,
  locationSource: LocationSource
): FeedLocation {
  if (override) return override;
  return {
    lat: region.latitude,
    lng: region.longitude,
    label: placeLabel ?? sourceLabel(locationSource),
  };
}
