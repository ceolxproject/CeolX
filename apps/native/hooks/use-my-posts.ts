import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { excludeDeletedPosts, useDeletedPostIds } from '@/hooks/use-deleted-posts';
import { useMe } from '@/hooks/use-me';
import { trpc } from '@/utils/trpc';

const PAGE_SIZE = 20;

type HydratedPost = {
  id: string;
  createdBy: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  likeCount: number | null;
  createdAt: string | Date;
  author: {
    id: string;
    displayName: string;
    profileImageUrl: string | null;
    profileType: 'artist' | 'venue' | 'user';
    isFollowedByMe: boolean;
  };
  likedByMe: boolean;
};

/** Posts by the authenticated user — used on the profile Posts tab. */
export function useMyPosts() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const userId = me?.id ?? '';

  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<HydratedPost[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const queryOptions = trpc.posts.byUser.queryOptions({ userId, limit: PAGE_SIZE, offset });

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    const newPosts = data.posts as HydratedPost[];
    if (offset === 0) {
      // Always re-sync page 0 to the latest query data. `newPosts` is a stable
      // reference until the cache changes (e.g. an optimistic like patch), so
      // React bails on no-op sets — but field-level updates like a flipped
      // `likedByMe` / `likeCount` now reach the list instead of being dropped.
      setAccumulated(newPosts);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.totalCount);
    } else if (accumulated.length < offset + newPosts.length) {
      setAccumulated((prev) => [...prev, ...newPosts]);
      setHasNextPage(data.hasNextPage);
      setTotalCount(data.totalCount);
    }
  }, [data, isFetching]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) setOffset((o) => o + PAGE_SIZE);
  }, [hasNextPage, isFetching]);

  const refresh = useCallback(async () => {
    setOffset(0);
    setAccumulated([]);
    setHasNextPage(true);
    await queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    await refetch();
  }, [queryClient, queryOptions.queryKey, refetch]);

  // Drop posts the current session has deleted — the accumulated array can still
  // hold a just-deleted row that the append-only merge can't remove on its own.
  const deletedIds = useDeletedPostIds();
  const posts = excludeDeletedPosts(accumulated, deletedIds);

  return {
    posts,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
  };
}
