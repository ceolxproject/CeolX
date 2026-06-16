import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { BookingSummary } from '@CeolX/shared';

import { trpcClient } from '@/utils/trpc';

const PAGE_SIZE = 20;

export type UseBookingsOpts = {
  tab: 'sent' | 'received';
  enabled?: boolean;
};

// Structural minimum — pagination only depends on counts, not booking fields.
type PageCounts = { bookings: readonly unknown[]; total: number };

/**
 * Offset for the next page, or `undefined` when every booking is already loaded.
 *
 * Pure + exported so the pagination boundary is unit-testable without a render.
 * The offset is the running total of bookings fetched so far; we stop once that
 * reaches the server-reported `total`.
 */
export function getNextBookingsOffset(
  lastPage: PageCounts,
  allPages: PageCounts[]
): number | undefined {
  const loaded = allPages.reduce((sum, page) => sum + page.bookings.length, 0);
  return loaded < lastPage.total ? loaded : undefined;
}

export function useBookings({ tab, enabled = true }: UseBookingsOpts) {
  // Keep this query key prefix in sync with the invalidation in use-update-booking.ts
  // (`[['bookings', 'list']]`) so accept/reject/withdraw refetch this list.
  const query = useInfiniteQuery({
    queryKey: [['bookings', 'list'], { tab }],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      trpcClient.bookings.list.query({ tab, limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: getNextBookingsOffset,
  });

  const bookings = (query.data?.pages.flatMap((page) => page.bookings) ?? []) as BookingSummary[];
  const total = query.data?.pages[0]?.total ?? 0;

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    bookings,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    hasNextPage: query.hasNextPage ?? false,
    total,
    loadMore,
    refresh,
  };
}
