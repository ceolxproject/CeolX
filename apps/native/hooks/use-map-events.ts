import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import type { BoundingBox } from '@CeolX/shared';
import {
  MAP_DEBOUNCE_MS,
  MAP_EXPAND_RADIUS_KM,
  MAP_MAX_PINS_PER_FETCH,
  getBoundingBox,
} from '@CeolX/shared';

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

export function regionToBoundingBox(region: Region): BoundingBox {
  return {
    swLat: region.latitude - region.latitudeDelta / 2,
    swLng: region.longitude - region.longitudeDelta / 2,
    neLat: region.latitude + region.latitudeDelta / 2,
    neLng: region.longitude + region.longitudeDelta / 2,
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

type UseMapEventsOpts = {
  centerLat?: number;
  centerLng?: number;
};

export function useMapEvents(opts?: UseMapEventsOpts) {
  const queryClient = useQueryClient();

  // Initialize with Ireland bbox so the query fires immediately on mount
  const [viewport, setViewport] = useState<BoundingBox & { limit: number }>(IRELAND_BBOX);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MapFilters>({});
  const [expandedEvents, setExpandedEvents] = useState<MapEventResult[] | null>(null);
  const [expandExhausted, setExpandExhausted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandAbortRef = useRef(false);

  const queryInput = {
    ...viewport,
    ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.county ? { county: filters.county } : {}),
  };

  const queryOptions = trpc.events.getMap.queryOptions(queryInput);
  const { data, isLoading, isError } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData,
  });

  const primaryEvents = (data?.events ?? []) as MapEventResult[];

  // Silent auto-expand when primary query returns 0 events
  useEffect(() => {
    if (
      isLoading ||
      primaryEvents.length > 0 ||
      opts?.centerLat === undefined ||
      opts?.centerLng === undefined
    ) {
      // Reset expansion state when primary query has results or is loading
      if (primaryEvents.length > 0) {
        setExpandedEvents(null);
        setExpandExhausted(false);
      }
      return;
    }

    expandAbortRef.current = false;

    void expandSearch(
      opts.centerLat,
      opts.centerLng,
      async (bbox) => {
        const expandQueryOptions = trpc.events.getMap.queryOptions(bbox);
        return queryClient.fetchQuery(expandQueryOptions);
      },
      expandAbortRef
    )
      .then((result) => {
        if (!expandAbortRef.current) {
          if (result.events.length > 0) {
            setExpandedEvents(result.events);
          }
          setExpandExhausted(result.exhausted);
        }
      })
      .catch((err: unknown) => {
        if (!expandAbortRef.current) {
          console.error('[useMapEvents] expandSearch failed:', err);
          // Don't set expandExhausted — a network error is not "no events exist".
          // The primary query's isError state will drive the error UI instead.
        }
      });

    return () => {
      expandAbortRef.current = true;
    };
  }, [isLoading, primaryEvents.length, opts?.centerLat, opts?.centerLng, queryClient]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setViewport({ ...regionToBoundingBox(region), limit: MAP_MAX_PINS_PER_FETCH });
      // Reset expansion on manual pan
      setExpandedEvents(null);
      setExpandExhausted(false);
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
