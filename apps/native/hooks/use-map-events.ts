import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import type { BoundingBox } from '@CeolX/shared';
import { MAP_DEBOUNCE_MS, MAP_MAX_PINS_PER_FETCH } from '@CeolX/shared';

import { trpc } from '@/utils/trpc';

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryOptions = trpc.events.getMap.queryOptions(viewport);
  const { data, isLoading, isError } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData, // keep previous data while fetching (no flicker)
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setViewport({ ...regionToBoundingBox(region), limit: MAP_MAX_PINS_PER_FETCH });
    }, MAP_DEBOUNCE_MS);
  }, []);

  return {
    events: data?.events ?? [],
    totalCount: data?.totalCount ?? 0,
    isLoading,
    isError,
    onRegionChangeComplete,
  };
}
