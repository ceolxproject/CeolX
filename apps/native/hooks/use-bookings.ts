import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { BookingSummary } from '@CeolX/shared';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

export type UseBookingsOpts = {
  tab: 'sent' | 'received';
  enabled?: boolean;
};

export function useBookings({ tab, enabled = true }: UseBookingsOpts) {
  const queryClient = useQueryClient();

  const [offset, setOffset] = useState(0);
  const [accumulatedBookings, setAccumulatedBookings] = useState<BookingSummary[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [total, setTotal] = useState(0);

  const queryInput = { tab, limit: PAGE_SIZE, offset };
  const queryOptions = trpc.bookings.list.queryOptions(queryInput);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    const newBookings = data.bookings as BookingSummary[];
    if (offset === 0) {
      if (
        accumulatedBookings.length !== newBookings.length ||
        (newBookings.length > 0 && accumulatedBookings[0]?.id !== newBookings[0]?.id)
      ) {
        setAccumulatedBookings(newBookings);
        setHasNextPage(newBookings.length >= PAGE_SIZE);
        setTotal(data.total);
      }
    } else if (accumulatedBookings.length < offset + newBookings.length) {
      setAccumulatedBookings((prev) => [...prev, ...newBookings]);
      setHasNextPage(newBookings.length >= PAGE_SIZE);
      setTotal(data.total);
    }
  }, [data, isFetching]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [hasNextPage, isFetching]);

  const refresh = useCallback(async () => {
    setOffset(0);
    setAccumulatedBookings([]);
    setHasNextPage(true);
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    await refetch();
  }, [queryClient, queryOptions.queryKey, refetch]);

  // Reset accumulated data when tab changes
  useEffect(() => {
    setOffset(0);
    setAccumulatedBookings([]);
    setHasNextPage(true);
  }, [tab]);

  return {
    bookings: accumulatedBookings,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    isError,
    hasNextPage,
    total,
    loadMore,
    refresh,
  };
}
