import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

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
    if (offset === 0) {
      if (
        accumulatedEvents.length !== newEvents.length ||
        (newEvents.length > 0 && accumulatedEvents[0]?.id !== newEvents[0]?.id)
      ) {
        setAccumulatedEvents(newEvents);
        setHasNextPage(data.hasNextPage);
        setTotalCount(data.totalCount);
      }
    } else if (accumulatedEvents.length < offset + newEvents.length) {
      setAccumulatedEvents((prev) => [...prev, ...newEvents]);
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
