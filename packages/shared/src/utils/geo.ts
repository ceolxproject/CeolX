import type { BoundingBox, LatLng } from '../types.js';

export function isWithinBoundingBox(point: LatLng, box: BoundingBox): boolean {
  return (
    point.lat >= box.swLat &&
    point.lat <= box.neLat &&
    point.lng >= box.swLng &&
    point.lng <= box.neLng
  );
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const x =
    sin1 * sin1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin2 * sin2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
