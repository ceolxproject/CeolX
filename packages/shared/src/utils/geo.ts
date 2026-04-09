import type { BoundingBox, LatLng } from '../types.js';

const IRELAND_BOUNDS = { minLat: 51.3, maxLat: 55.5, minLng: -10.7, maxLng: -5.9 };

export function isWithinBoundingBox(point: LatLng, box: BoundingBox): boolean {
  return (
    point.lat >= box.swLat &&
    point.lat <= box.neLat &&
    point.lng >= box.swLng &&
    point.lng <= box.neLng
  );
}

export function isWithinIreland(lat: number, lng: number): boolean {
  return (
    lat >= IRELAND_BOUNDS.minLat &&
    lat <= IRELAND_BOUNDS.maxLat &&
    lng >= IRELAND_BOUNDS.minLng &&
    lng <= IRELAND_BOUNDS.maxLng
  );
}

export function distanceBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** @deprecated Use distanceBetween instead */
export function distanceKm(a: LatLng, b: LatLng): number {
  return distanceBetween(a.lat, a.lng, b.lat, b.lng);
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export function getBoundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - latDelta,
    swLng: lng - lngDelta,
    neLat: lat + latDelta,
    neLng: lng + lngDelta,
  };
}

/**
 * Returns true if lat/lng are finite numbers within valid geographic bounds.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Splits map events into valid and invalid based on coordinate validation.
 * Callers decide how to log/report the invalid set (e.g. one batched Sentry call).
 */
export function filterValidMapEvents<T extends { id?: string; lat: unknown; lng: unknown }>(
  events: T[]
): { valid: T[]; invalid: T[] } {
  const valid: T[] = [];
  const invalid: T[] = [];

  for (const event of events) {
    if (isValidCoordinate(event.lat, event.lng)) {
      valid.push(event);
    } else {
      invalid.push(event);
    }
  }

  return { valid, invalid };
}

export function clampToIreland(lat: number, lng: number): LatLng {
  return {
    lat: Math.max(IRELAND_BOUNDS.minLat, Math.min(IRELAND_BOUNDS.maxLat, lat)),
    lng: Math.max(IRELAND_BOUNDS.minLng, Math.min(IRELAND_BOUNDS.maxLng, lng)),
  };
}
