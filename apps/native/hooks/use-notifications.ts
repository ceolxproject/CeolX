import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import type { NotificationDto } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

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
    if (page === 1) {
      // First page — replace and reset state
      const headChanged =
        accumulated.length !== incoming.length ||
        (incoming.length > 0 && accumulated[0]?.id !== incoming[0]?.id);
      if (headChanged) {
        setAccumulated(incoming);
        setHasNextPage(data.hasMore);
        setTotal(data.total);
      }
    } else if (accumulated.length < (page - 1) * PAGE_SIZE + incoming.length) {
      // Append next page
      setAccumulated((prev) => [...prev, ...incoming]);
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
