import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { EventStatus } from '@CeolX/shared/enums';

import { mergePaginatedEvents } from './merge-paginated-events';

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
  status: EventStatus;
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
    // Always reflect the freshest first page so in-place edits (a replaced
    // cover image, an edited title) appear once the events cache is
    // invalidated, rather than staying stale until an app restart.
    const merged = mergePaginatedEvents({ offset, prev: accumulatedEvents, incoming: newEvents });
    if (merged) {
      setAccumulatedEvents(merged);
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
