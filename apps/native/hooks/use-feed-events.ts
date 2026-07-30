import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { EventCategory, FeedEvent } from '@CeolX/shared';
import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

import { mergePaginatedEvents } from './merge-paginated-events';

import { AnalyticsEvent, track } from '@/lib/analytics';
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

/**
 * Whether a settled search result should emit `search_performed`.
 *
 * Exported for test: `offset` is part of the feed query key, so every page of an
 * infinite scroll hands the effect a fresh result with the term unchanged. Without
 * the first-page and already-reported guards, scrolling five pages emits five
 * events — and page 2+ always has results, which biases the one thing the event
 * measures ("are people searching for things CeolX does not have?") toward success.
 */
export function shouldReportSearch(args: {
  settledQuery: string;
  isFetching: boolean;
  hasData: boolean;
  offset: number;
  searchKey: string;
  lastReported: string | null;
}): boolean {
  if (!args.settledQuery || args.isFetching || !args.hasData) return false;
  if (args.offset !== 0) return false;
  return args.lastReported !== args.searchKey;
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
  // Mirrors searchQuery for the debounced onSearch closure (empty deps), so it
  // can tell whether a new search actually changes the query.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
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

  // Search is live-as-you-type, so the only sane place to record it is once a
  // settled query has come back — keyed on the trimmed term, not on keystrokes,
  // which would emit an event per character. The term itself is never sent (it is
  // user-typed free text); only whether it found anything, which is the actual
  // question: are people searching for things CeolX does not have?
  const settledQuery = searchQuery.trim();
  // Keyed on term + filters so changing a filter still counts as a new search, but
  // paginating the same one does not. See shouldReportSearch above for why.
  const searchKey = `${settledQuery}|${category ?? ''}|${date ?? ''}`;
  const reportedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    const report = shouldReportSearch({
      settledQuery,
      isFetching,
      hasData: !!data,
      offset,
      searchKey,
      lastReported: reportedSearchRef.current,
    });
    if (!report || !data) return;
    reportedSearchRef.current = searchKey;
    track(AnalyticsEvent.SEARCH_PERFORMED, {
      has_results: data.totalCount > 0,
      filter_type: category ? 'category' : date ? 'date' : 'none',
    });
  }, [settledQuery, isFetching, data, category, date, offset, searchKey]);

  // Sync data into accumulated events when data arrives. Must be an effect —
  // calling setState in the render body causes infinite re-renders — but a
  // *layout* effect specifically, so this commits in the same frame as
  // isLoading flipping to false. A plain useEffect fires after paint, leaving
  // one painted frame where isLoading is false but accumulatedEvents hasn't
  // caught up — flashing the empty state before events render. (Asana 1216227495516054)
  useLayoutEffect(() => {
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
      // Re-selecting the query already loaded (e.g. tapping the same suggestion
      // that's still in the box) must be a no-op. Otherwise we clear
      // accumulatedEvents while React Query — seeing an unchanged query key —
      // serves cached data without refetching, so the data-sync effect (keyed
      // on [data, isFetching]) never fires to refill the list. The feed would
      // sit empty until a manual refresh. (Asana 1215700058851899)
      if (text === searchQueryRef.current) return;
      setSearchQuery(text);
      setOffset(0);
      setAccumulatedEvents([]);
    }, MAP_DEBOUNCE_MS);
  }, []);

  // Same no-op guard as onSearch: re-selecting the current category/date (e.g.
  // tapping "All" when nothing is filtered, then Apply) leaves the query key
  // unchanged, so React Query serves cached data without refetching and the
  // data-sync effect never re-fires. Clearing accumulatedEvents anyway would
  // leave the feed empty until a manual refresh. (Asana 1215700058851899)
  const onCategoryChange = useCallback(
    (cat: EventCategory | undefined) => {
      if (cat === category) return;
      setCategory(cat);
      setOffset(0);
      setAccumulatedEvents([]);
    },
    [category]
  );

  const onDateChange = useCallback(
    (next: string | undefined) => {
      if (next === date) return;
      setDate(next);
      setOffset(0);
      setAccumulatedEvents([]);
    },
    [date]
  );

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
