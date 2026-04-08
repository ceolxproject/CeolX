import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import type { BoundingBox, DateRangeOption } from '@CeolX/shared';
import { MAP_DEBOUNCE_MS, MAP_MAX_PINS_PER_FETCH } from '@CeolX/shared';

import { trpc } from '@/utils/trpc';

export type MapFilters = {
  category?: string;
  county?: string;
  dateRange?: DateRangeOption;
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

export function useMapEvents() {
  // Initialize with Ireland bbox so the query fires immediately on mount
  const [viewport, setViewport] = useState<BoundingBox & { limit: number }>(IRELAND_BBOX);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MapFilters>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryInput = {
    ...viewport,
    ...(searchQuery.trim() ? { query: searchQuery.trim() } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.county ? { county: filters.county } : {}),
    ...(filters.dateRange ? { dateRange: filters.dateRange } : {}),
  };

  const queryOptions = trpc.events.getMap.queryOptions(queryInput);
  const { data, isLoading, isError } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData, // keep previous data while fetching (no flicker)
  });

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
    }, MAP_DEBOUNCE_MS);
  }, []);

  const onSearch = useCallback((text: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(text);
    }, MAP_DEBOUNCE_MS);
  }, []);

  const activeFilterCount =
    (filters.category ? 1 : 0) + (filters.county ? 1 : 0) + (filters.dateRange ? 1 : 0);

  return {
    events: data?.events ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    isError,
    searchQuery,
    filters,
    setFilters,
    activeFilterCount,
    onSearch,
    onRegionChangeComplete,
  };
}
