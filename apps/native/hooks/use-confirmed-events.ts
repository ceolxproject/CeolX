import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

type ConfirmedEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: string;
  dateEnd: string | null;
  category: string;
  venueAddress: string | null;
  status: string;
  bookingId: string | null;
};

export function useConfirmedEvents() {
  const queryClient = useQueryClient();

  const [offset, setOffset] = useState(0);
  const [accumulatedEvents, setAccumulatedEvents] = useState<ConfirmedEvent[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const queryInput = { limit: PAGE_SIZE, offset };
  const queryOptions = trpc.bookings.confirmedEvents.queryOptions(queryInput);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    const newEvents = data.events as ConfirmedEvent[];
    if (offset === 0) {
      if (
        accumulatedEvents.length !== newEvents.length ||
        (newEvents.length > 0 && accumulatedEvents[0]?.id !== newEvents[0]?.id)
      ) {
        setAccumulatedEvents(newEvents);
        setHasNextPage(data.hasNextPage);
        setTotalCount(data.total);
      }
    } else if (accumulatedEvents.length < offset + newEvents.length) {
      setAccumulatedEvents((prev) => [...prev, ...newEvents]);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.total);
    }
  }, [data, isFetching]);

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
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    isError,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
  };
}
