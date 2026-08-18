import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { mergePaginatedEvents } from './merge-paginated-events';

import { trpc, type RouterOutputs } from '@/utils/trpc';

const PAGE_SIZE = 20;

/**
 * Inferred from the router, not hand-maintained.
 *
 * The previous version was a hand-written structural SUBSET, so a server-side rename
 * kept compiling and every on-hold saved event silently reverted to a normal tappable
 * card — the exact regression its own comment warned about, with no compiler help.
 */
type SavedEvent = RouterOutputs['events']['getSavedEvents']['events'][number];

export function useSavedEvents(includeArchived = false) {
  const queryClient = useQueryClient();

  const [offset, setOffset] = useState(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState<SavedEvent[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const queryInput = { limit: PAGE_SIZE, offset, includeArchived };
  const queryOptions = trpc.events.getSavedEvents.queryOptions(queryInput);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    // No cast needed now that SavedEvent is inferred from the router output.
    const newEvents = data.events;
    // Always reflect the freshest first page so in-place edits (a replaced
    // cover image, an edited title) appear once the events cache is
    // invalidated, rather than staying stale until an app restart.
    const merged = mergePaginatedEvents({ offset, prev: accumulatedEvents, incoming: newEvents });
    if (merged) {
      setAccumulatedEvents(merged);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.totalCount);
    }
  }, [data, isFetching]);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    const upcoming: SavedEvent[] = [];
    const past: SavedEvent[] = [];
    for (const event of accumulatedEvents) {
      const eventDate = new Date(event.dateEnd ?? event.dateStart);
      if (eventDate >= now) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    }
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [accumulatedEvents]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [hasNextPage, isFetching]);

  const refresh = useCallback(async () => {
    setOffset(0);
    setAccumulatedEvents([]);
    setHasNextPage(true);
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    await refetch();
  }, [queryClient, queryOptions.queryKey, refetch]);

  return {
    events: accumulatedEvents,
    upcomingEvents,
    pastEvents,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    isError,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
  };
}
