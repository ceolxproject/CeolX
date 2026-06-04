import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { NotificationDto } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

// True when a freshly fetched page differs from what we already hold for it —
// either the set/order of items changed, or a field flipped in place. A plain
// id/length check misses in-place updates (mark-as-read flipping `isRead`),
// which left the inbox showing stale "unread" rows until a manual refresh.
function pageContentChanged(prev: NotificationDto[], next: NotificationDto[]) {
  if (prev.length !== next.length) return true;
  return next.some((n, i) => prev[i]?.id !== n.id || prev[i]?.isRead !== n.isRead);
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<NotificationDto[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [total, setTotal] = useState(0);

  const queryInput = { page, limit: PAGE_SIZE };
  const queryOptions = trpc.notifications.list.queryOptions(queryInput);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...queryOptions,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    const incoming = data.notifications;
    const start = (page - 1) * PAGE_SIZE;

    // This page hasn't been loaded into the list yet — append it.
    if (accumulated.length <= start) {
      if (incoming.length > 0) {
        setAccumulated((prev) => [...prev, ...incoming]);
        setHasNextPage(data.hasMore);
        setTotal(data.total);
      }
      return;
    }

    // On page 1, a new notification arriving at the top resets the feed to the
    // fresh first page (older scrolled pages are now stale and dropped).
    if (page === 1 && accumulated[0]?.id !== incoming[0]?.id) {
      setAccumulated(incoming);
      setHasNextPage(data.hasMore);
      setTotal(data.total);
      return;
    }

    // The page is already in the list — reconcile its slice so in-place changes
    // (e.g. mark-as-read flipping `isRead`) show without a manual refresh.
    const slice = accumulated.slice(start, start + incoming.length);
    if (pageContentChanged(slice, incoming)) {
      setAccumulated((prev) => [
        ...prev.slice(0, start),
        ...incoming,
        ...prev.slice(start + incoming.length),
      ]);
      setHasNextPage(data.hasMore);
      setTotal(data.total);
    }
  }, [data, isFetching, page]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) {
      setPage((prev) => prev + 1);
    }
  }, [hasNextPage, isFetching]);

  const refresh = useCallback(async () => {
    setPage(1);
    setAccumulated([]);
    setHasNextPage(true);
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    await refetch();
  }, [queryClient, queryOptions.queryKey, refetch]);

  return {
    notifications: accumulated,
    isLoading: isLoading && page === 1,
    isFetchingNextPage: isFetching && page > 1,
    isError,
    hasNextPage,
    total,
    loadMore,
    refresh,
  };
}
