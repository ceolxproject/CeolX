import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import type { BoundingBox } from '@CeolX/shared';
import {
  IRELAND_CENTER_LAT,
  IRELAND_CENTER_LNG,
  MAP_DEBOUNCE_MS,
  MAP_EXPAND_RADIUS_KM,
  MAP_MAX_PINS_PER_FETCH,
  MAP_VIEWPORT_PAD_FACTOR,
  getBoundingBox,
} from '@CeolX/shared';

import { AnalyticsEvent, track } from '@/lib/analytics';
import { trpc } from '@/utils/trpc';

export type MapFilters = {
  category?: string;
  county?: string;
};

// Ireland-wide bbox as initial/fallback (covers all of Ireland)
const IRELAND_BBOX: BoundingBox & { limit: number } = {
  swLat: 51.3,
  swLng: -10.7,
  neLat: 55.5,
  neLng: -5.9,
  limit: MAP_MAX_PINS_PER_FETCH,
};

export function regionToBoundingBox(region: Region, padFactor = 1): BoundingBox {
  const latPad = (region.latitudeDelta * padFactor) / 2;
  const lngPad = (region.longitudeDelta * padFactor) / 2;
  // A far zoom-out could push a padded corner past ±90/±180; clamp so we never
  // send an out-of-range geo query.
  const clampLat = (v: number) => Math.max(-90, Math.min(90, v));
  const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
  return {
    swLat: clampLat(region.latitude - latPad),
    swLng: clampLng(region.longitude - lngPad),
    neLat: clampLat(region.latitude + latPad),
    neLng: clampLng(region.longitude + lngPad),
  };
}

type MapEventResult = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  dateStart: string;
  dateEnd?: string;
  venueAddress?: string;
  coverImageUrl?: string;
  distanceMeters?: number;
};

/**
 * Silent auto-expand: when the primary query returns 0 events, sequentially
 * try expanding the search radius using MAP_EXPAND_RADIUS_KM [5, 25, 100].
 * Returns events from the first radius that has results, or sets exhausted flag.
 *
 * Exported for direct testing.
 */
export async function expandSearch(
  centerLat: number,
  centerLng: number,
  fetchFn: (
    bbox: BoundingBox & { limit: number }
  ) => Promise<{ events: MapEventResult[]; totalCount: number }>,
  abortRef: { current: boolean }
): Promise<{ events: MapEventResult[]; exhausted: boolean }> {
  for (const radiusKm of MAP_EXPAND_RADIUS_KM) {
    if (abortRef.current) return { events: [], exhausted: false };

    const bbox = getBoundingBox(centerLat, centerLng, radiusKm);
    const result = await fetchFn({ ...bbox, limit: MAP_MAX_PINS_PER_FETCH });

    if (result.events.length > 0) {
      return { events: result.events, exhausted: false };
    }
  }

  return { events: [], exhausted: true };
}

export function useMapEvents() {
  const queryClient = useQueryClient();

  // Initialize with Ireland bbox so the query fires immediately on mount
  const [viewport, setViewport] = useState<BoundingBox & { limit: number }>(IRELAND_BBOX);
  // Kept alongside the bbox rather than derived from it. regionToBoundingBox
  // clamps corners to ±90/±180, so at a far zoom-out the box goes lopsided and
  // its midpoint stops being the map centre — from Dublin at a 80° latitude
  // delta the midpoint lands near 31°N, off North Africa. The region's own
  // centre is never clamped, so it is the honest value to sweep around.
  const [viewportCenter, setViewportCenter] = useState({
    lat: IRELAND_CENTER_LAT,
    lng: IRELAND_CENTER_LNG,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MapFilters>({});
  const [expandedEvents, setExpandedEvents] = useState<MapEventResult[] | null>(null);
  const [expandExhausted, setExpandExhausted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared by the viewport query and the radius sweep. The sweep used to send
  // the bbox alone, so an expanded result — and the edge pointers built from it
  // — surfaced events the user had filtered out.
  const queryFilters = useMemo(
    () => ({
      ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.county ? { county: filters.county } : {}),
    }),
    [searchQuery, filters.category, filters.county]
  );

  const queryInput = { ...viewport, ...queryFilters };

  const queryOptions = trpc.events.getMap.queryOptions(queryInput);
  const { data, isLoading, isError } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData,
  });

  const primaryEvents = (data?.events ?? []) as MapEventResult[];

  // Expand around whatever the user is currently looking at. Anchoring this to
  // the resolved GPS/override centre instead meant panning Dublin → an empty
  // Cork viewport re-searched Dublin and dropped Dublin pins off-screen.
  const { lat: viewportCenterLat, lng: viewportCenterLng } = viewportCenter;
  // IRELAND_BBOX seeds `viewport` before the map's first settle; its midpoint
  // (53.4, -8.3) sits ~50km from IRELAND_CENTER, which is what viewportCenter
  // starts at. They converge on the first onRegionChangeComplete.

  // Silent auto-expand when primary query returns 0 events
  useEffect(() => {
    if (isLoading || primaryEvents.length > 0) {
      // Reset expansion state when primary query has results or is loading
      if (primaryEvents.length > 0) {
        setExpandedEvents(null);
        setExpandExhausted(false);
      }
      return;
    }

    // Per-run token, not a shared ref. A single shared boolean was reset to
    // false by the next effect run before the previous sweep's awaits resolved,
    // so an aborted sweep came back to life and wrote its stale results.
    const abort = { current: false };

    void expandSearch(
      viewportCenterLat,
      viewportCenterLng,
      async (bbox) => {
        const expandQueryOptions = trpc.events.getMap.queryOptions({ ...bbox, ...queryFilters });
        return queryClient.fetchQuery(expandQueryOptions);
      },
      abort
    )
      .then((result) => {
        if (!abort.current) {
          // Always supersede, even with nothing found. Only overwriting on a hit
          // left events from a previous location driving pins and pointers after
          // panning somewhere genuinely empty.
          setExpandedEvents(result.events.length > 0 ? result.events : null);
          setExpandExhausted(result.exhausted);
          if (result.exhausted) {
            // Exhausted means the whole 5 → 25 → 100km chain came back empty.
            // The radius is deliberately never shown to the user, but knowing how
            // often the widest sweep finds nothing is the clearest signal of
            // whether the launch coverage is thin.
            track(AnalyticsEvent.MAP_EMPTY_STATE_SHOWN, {
              final_radius_km: MAP_EXPAND_RADIUS_KM[MAP_EXPAND_RADIUS_KM.length - 1],
            });
          }
        }
      })
      .catch((err: unknown) => {
        if (!abort.current) {
          console.error('[useMapEvents] expandSearch failed:', err);
          // Don't set expandExhausted — a network error is not "no events exist".
          // The primary query's isError state will drive the error UI instead.
        }
      });

    return () => {
      abort.current = true;
    };
  }, [
    isLoading,
    primaryEvents.length,
    viewportCenterLat,
    viewportCenterLng,
    queryFilters,
    queryClient,
  ]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setViewport({
        ...regionToBoundingBox(region, MAP_VIEWPORT_PAD_FACTOR),
        limit: MAP_MAX_PINS_PER_FETCH,
      });
      setViewportCenter({ lat: region.latitude, lng: region.longitude });
      // Deliberately NOT clearing expandedEvents/expandExhausted here. This
      // callback fires on any gesture — a plain tap included — so clearing made
      // the off-screen pointers vanish and pop back on every touch while the
      // 5 → 25 → 100km sweep re-ran. The effect below supersedes them as soon as
      // fresh results land, which is the only point they are actually stale.
    }, MAP_DEBOUNCE_MS);
  }, []);

  const onSearch = useCallback((text: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(text);
    }, MAP_DEBOUNCE_MS);
  }, []);

  const activeFilterCount = (filters.category ? 1 : 0) + (filters.county ? 1 : 0);

  // Use expanded events if primary is empty and expansion found results
  const events = primaryEvents.length > 0 ? primaryEvents : (expandedEvents ?? primaryEvents);

  return {
    events,
    totalCount: data?.totalCount ?? 0,
    isLoading,
    isError,
    expandExhausted,
    searchQuery,
    filters,
    setFilters,
    activeFilterCount,
    onSearch,
    onRegionChangeComplete,
  };
}
