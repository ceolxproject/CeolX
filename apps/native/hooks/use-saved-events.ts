import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { mergePaginatedEvents } from './merge-paginated-events';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

/**
 * Hand-maintained mirror of the `events.getSavedEvents` row shape.
 *
 * ⚠️ It is a structural SUBSET, so TypeScript will not warn if the server drops a
 * field this omits — the compiler only checks what is declared here. Keep it in
 * step with packages/api/src/routers/events/saved.ts by hand, or better, infer it
 * from the router's output type.
 */
type SavedEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd: string | null;
  category: string;
  status: string;
  venueAddress: string | null;
  savedAt: string;
  creatorName: string;
  collectionName: string | null;
  /**
   * The event's venue is on hold, so its detail is withheld (M8-T0 V-03). The
   * screen renders the "TBC by venue" card instead of dropping the row — the user
   * saved this deliberately and a silent disappearance reads as our bug.
   */
  venueOnHold: boolean;
};

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
    const newEvents = data.events as SavedEvent[];
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
