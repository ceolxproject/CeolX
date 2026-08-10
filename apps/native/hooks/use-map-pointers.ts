import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Region } from 'react-native-maps';

import {
  MAP_POINTER_BEARING_BUCKET_DEG,
  MAP_POINTER_MAX_COUNT,
  MAP_POINTER_MAX_KM,
  bearingBetween,
  distanceBetween,
} from '@CeolX/shared';

import type { MapEvent } from '@/components/MapEventMarker';
import type { LocationSource } from '@/hooks/use-gps-region';
import { AnalyticsEvent, track } from '@/lib/analytics';

/**
 * Where "X km away" is measured from. Only a live GPS fix or a location the user
 * set themselves is precise enough to quote a distance against — an IP or
 * Ireland-default centre is not, so those resolve to null and pointers show
 * direction without a number they can't stand behind.
 */
export type PointerAnchor = { lat: number; lng: number } | null;

export type MapPointer = {
  id: string;
  /** Degrees clockwise from north, for rotating the on-screen arrow. */
  bearingDeg: number;
  /** Spoken form of bearingDeg, e.g. "north-east" — for screen readers. */
  compass: string;
  /** How many off-screen events share this direction. */
  count: number;
  /** Kilometres from the anchor, or null when there is no trustworthy anchor. */
  distanceKm: number | null;
  /** Closest event in this direction — the one tapping the pointer flies to. */
  nearestEvent: MapEvent;
};

const COMPASS_POINTS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

// ── Pure helpers ─────────────────────────────────────────────────────────

export function bearingToCompass(bearingDeg: number): string {
  return COMPASS_POINTS[Math.round(bearingDeg / 45) % 8] ?? 'north';
}

export function resolvePointerAnchor(source: LocationSource, home: Region): PointerAnchor {
  if (source !== 'gps' && source !== 'saved') return null;
  return { lat: home.latitude, lng: home.longitude };
}

/**
 * Whether an event falls outside what the user can actually see.
 *
 * Measured against the visible region, not the padded box the events were
 * fetched with (MAP_VIEWPORT_PAD_FACTOR). Events in that padding ring are
 * exactly the ones worth pointing at — loaded, but invisible.
 */
export function isOutsideRegion(event: { lat: number; lng: number }, region: Region): boolean {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return (
    event.lat > region.latitude + halfLat ||
    event.lat < region.latitude - halfLat ||
    event.lng > region.longitude + halfLng ||
    event.lng < region.longitude - halfLng
  );
}

export function hasVisibleEvent(events: MapEvent[], region: Region): boolean {
  return events.some((event) => !isOutsideRegion(event, region));
}

/**
 * Groups off-screen events into at most MAP_POINTER_MAX_COUNT edge arrows.
 *
 * Pure and synchronous by design: pointers must never trigger a fetch. Panning
 * changes nothing on its own — the user taps an arrow to travel, and only then
 * does a new viewport query fire.
 */
export function computePointers(
  events: MapEvent[],
  region: Region,
  anchor: PointerAnchor
): MapPointer[] {
  // Two different origins on purpose. Bearing comes from the viewport centre,
  // because that is where the screen has to travel from. Distance comes from the
  // user, because "45km away" has to mean 45km from the person reading it —
  // quoting it from a spot they happened to scroll to would be a lie.
  const candidates = events
    .filter((event) => isOutsideRegion(event, region))
    .map((event) => ({
      event,
      bearingDeg: bearingBetween(region.latitude, region.longitude, event.lat, event.lng),
      // Whether an event is worth an arrow is measured from what the user is
      // looking at, never from their home. Capping on the anchor meant browsing
      // Galway from a Dublin home filtered out every Galway event and the
      // feature silently did nothing. It also has to apply when there is no
      // anchor at all — that abroad/IP case is the one the cap exists for.
      viewportKm: distanceBetween(region.latitude, region.longitude, event.lat, event.lng),
      // A different question, and only ever a label: how far it is from the
      // person reading it.
      distanceKm: anchor ? distanceBetween(anchor.lat, anchor.lng, event.lat, event.lng) : null,
    }))
    .filter((c) => c.viewportKm <= MAP_POINTER_MAX_KM)
    .sort((a, b) => a.viewportKm - b.viewportKm);

  // Nearest-first insertion means each bucket keeps its closest event as the
  // label, and Map preserves insertion order so the slice keeps the nearest
  // directions rather than an arbitrary three.
  const sectors = 360 / MAP_POINTER_BEARING_BUCKET_DEG;
  const byBearing = new Map<number, MapPointer>();
  for (const { event, bearingDeg, distanceKm } of candidates) {
    // Round, don't floor: sectors are centred on the compass points, so the
    // bucket index and bearingToCompass() always name the same direction.
    const bucket = Math.round(bearingDeg / MAP_POINTER_BEARING_BUCKET_DEG) % sectors;
    const existing = byBearing.get(bucket);
    if (existing) {
      existing.count += 1;
      continue;
    }
    // Snap to the sector centre rather than keeping the exact bearing. Grouping
    // alone does not stop overlap: two events in *adjacent* sectors can sit a
    // few degrees apart (341.6° and 332° did) and land on nearly the same point
    // of the viewport edge. Snapping guarantees neighbouring arrows are a full
    // sector apart, and makes the arrow agree with its spoken label.
    const sectorDeg = bucket * MAP_POINTER_BEARING_BUCKET_DEG;
    byBearing.set(bucket, {
      // Keyed on the lead event, not the sector: panning shifts bearings, and a
      // sector-based key changed identity mid-pan, remounting the pill and
      // replaying its entry animation as a blink.
      id: event.id,
      bearingDeg: sectorDeg,
      compass: bearingToCompass(sectorDeg),
      count: 1,
      distanceKm,
      nearestEvent: event,
    });
  }

  return [...byBearing.values()].slice(0, MAP_POINTER_MAX_COUNT);
}

// ── Hook ─────────────────────────────────────────────────────────────────

type UseMapEdgePointersArgs = {
  events: MapEvent[];
  /** The region the user is actually looking at. */
  region: Region;
  /** Resolved location chain — supplies the distance anchor. */
  locationSource: LocationSource;
  home: Region;
  /** False while a sheet, the keyboard, a spinner or a card owns the screen. */
  enabled: boolean;
  /** Camera control stays with the screen, which owns the map ref. */
  onFocus: (lat: number, lng: number) => void;
};

/**
 * Owns everything the empty-map pointers need: which arrows to draw, whether
 * they should show at all, and what tapping one does. The map screen consumes
 * this as three values so the feature isn't smeared across it.
 */
export function useMapEdgePointers({
  events,
  region,
  locationSource,
  home,
  enabled,
  onFocus,
}: UseMapEdgePointersArgs) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  // Depends on primitives, not the region object: an unstable `home` identity
  // would churn the anchor and re-run the pointer computation every render.
  const anchor = useMemo(
    () => resolvePointerAnchor(locationSource, home),
    [locationSource, home.latitude, home.longitude]
  );

  const pointers = useMemo(
    () => computePointers(events, { latitude, longitude, latitudeDelta, longitudeDelta }, anchor),
    [events, latitude, longitude, latitudeDelta, longitudeDelta, anchor]
  );

  const visible =
    enabled &&
    pointers.length > 0 &&
    !hasVisibleEvent(events, { latitude, longitude, latitudeDelta, longitudeDelta });

  // Fire once per appearance rather than per render; the ref resets on hide.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      trackedRef.current = false;
      return;
    }
    if (trackedRef.current) return;
    trackedRef.current = true;
    track(AnalyticsEvent.MAP_POINTERS_SHOWN, {
      pointer_count: pointers.length,
      nearest_km: pointers[0]?.distanceKm ?? null,
    });
  }, [visible, pointers]);

  const select = useCallback(
    (pointer: MapPointer) => {
      track(AnalyticsEvent.MAP_POINTER_TAPPED, {
        distance_km: pointer.distanceKm ?? null,
        count: pointer.count,
      });
      onFocus(pointer.nearestEvent.lat, pointer.nearestEvent.lng);
    },
    [onFocus]
  );

  return { pointers, visible, select };
}
