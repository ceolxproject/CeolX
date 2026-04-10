import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { EventCategory, FeedEvent } from '@CeolX/shared';
import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

import { trpc } from '@/utils/trpc';

const FEED_PAGE_SIZE = 20;

export type UseFeedEventsOpts = {
  lat: number;
  lng: number;
  enabled?: boolean;
};

export function useFeedEvents({ lat, lng, enabled = true }: UseFeedEventsOpts) {
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<EventCategory | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState<FeedEvent[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryInput = {
    lat,
    lng,
    limit: FEED_PAGE_SIZE,
    offset,
    category,
    query: searchQuery.trim() || undefined,
  };

  const queryOptions = trpc.events.getFeed.queryOptions(queryInput);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled,
    placeholderData: keepPreviousData,
  });

  // Sync data into accumulated events when data changes
  if (data && !isFetching) {
    const newEvents = data.events as FeedEvent[];
    if (offset === 0 && accumulatedEvents !== newEvents) {
      // First page or refresh — replace
      if (
        accumulatedEvents.length !== newEvents.length ||
        (accumulatedEvents.length > 0 && accumulatedEvents[0]?.id !== newEvents[0]?.id)
      ) {
        setAccumulatedEvents(newEvents);
        setHasNextPage(data.hasNextPage);
        setTotalCount(data.totalCount);
      }
    } else if (offset > 0 && accumulatedEvents.length < offset + newEvents.length) {
      // Subsequent page — append
      setAccumulatedEvents((prev) => [...prev, ...newEvents]);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.totalCount);
    }
  }

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
    searchQuery,
    onSearch,
  };
}
