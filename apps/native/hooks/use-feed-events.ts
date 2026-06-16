import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { EventCategory, FeedEvent } from '@CeolX/shared';
import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

import { mergePaginatedEvents } from './merge-paginated-events';

import { trpc } from '@/utils/trpc';

const FEED_PAGE_SIZE = 20;

/**
 * Resolve a device-local YYYY-MM-DD day to its absolute [start, end) window in
 * Unix seconds. Computed on-device so the boundaries reflect the user's own
 * timezone — the server then filters by these instants directly and never has to
 * guess a timezone (it runs in UTC). End is the start of the next day.
 */
function localDayWindowSeconds(ymd: string): { dayStart: number; dayEnd: number } {
  const [year, month, day] = ymd.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return {
    dayStart: Math.floor(start.getTime() / 1000),
    dayEnd: Math.floor(end.getTime() / 1000),
  };
}

export type UseFeedEventsOpts = {
  lat: number;
  lng: number;
  enabled?: boolean;
};

export function useFeedEvents({ lat, lng, enabled = true }: UseFeedEventsOpts) {
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<EventCategory | undefined>();
  // A specific calendar day (YYYY-MM-DD, device-local) picked from the header's
  // calendar button. Kept as a string for the UI (chip + picker); converted to
  // an absolute window before it's sent to the server.
  const [date, setDate] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState<FeedEvent[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dayWindow = date ? localDayWindowSeconds(date) : undefined;
  const queryInput = {
    lat,
    lng,
    limit: FEED_PAGE_SIZE,
    offset,
    category,
    dayStart: dayWindow?.dayStart,
    dayEnd: dayWindow?.dayEnd,
    query: searchQuery.trim() || undefined,
  };

  const queryOptions = trpc.events.getFeed.queryOptions(queryInput);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled,
    placeholderData: keepPreviousData,
  });

  // Sync data into accumulated events when data arrives.
  // Must be in useEffect — calling setState in the render body causes infinite re-renders.
  useEffect(() => {
    if (!data || isFetching) return;
    const newEvents = data.events as FeedEvent[];
    // First page always reflects the freshest data (so an edited event's cover
    // image / title updates after the cache is invalidated); later pages append
    // once. See mergePaginatedEvents — the old shape-only guard left stale
    // content on screen until an app restart.
    const merged = mergePaginatedEvents({ offset, prev: accumulatedEvents, incoming: newEvents });
    if (merged) {
      setAccumulatedEvents(merged);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.totalCount);
    }
  }, [data, isFetching]);

  // Reset pagination whenever the feed's location changes — the user picked a new
  // point in the location sheet, or GPS/IP resolved after the Ireland default.
  // Without this, a location change would append new events onto the previous
  // location's accumulated list. Mirrors the reset in onSearch/onCategory/onDate.
  useEffect(() => {
    setOffset(0);
    setAccumulatedEvents([]);
    setHasNextPage(true);
  }, [lat, lng]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      setOffset((prev) => prev + FEED_PAGE_SIZE);
    }
  }, [hasNextPage, isFetching]);

  const refresh = useCallback(async () => {
    setOffset(0);
    setAccumulatedEvents([]);
    setHasNextPage(true);
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    await refetch();
  }, [queryClient, queryOptions.queryKey, refetch]);

  const onSearch = useCallback((text: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(text);
      setOffset(0);
      setAccumulatedEvents([]);
    }, MAP_DEBOUNCE_MS);
  }, []);

  const onCategoryChange = useCallback((cat: EventCategory | undefined) => {
    setCategory(cat);
    setOffset(0);
    setAccumulatedEvents([]);
  }, []);

  const onDateChange = useCallback((next: string | undefined) => {
    setDate(next);
    setOffset(0);
    setAccumulatedEvents([]);
  }, []);

  return {
    events: accumulatedEvents,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    isError,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
    category,
    setCategory: onCategoryChange,
    date,
    setDate: onDateChange,
    searchQuery,
    onSearch,
  };
}
