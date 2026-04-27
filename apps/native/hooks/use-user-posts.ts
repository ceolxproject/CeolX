import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

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
  };
  likedByMe: boolean;
};

/** Posts authored by a specific user — for viewing someone else's profile. */
export function useUserPosts(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<HydratedPost[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const queryOptions = trpc.posts.byUser.queryOptions({
    userId: userId ?? '',
    limit: PAGE_SIZE,
    offset,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!data || isFetching) return;
    const newPosts = data.posts as HydratedPost[];
    if (offset === 0) {
      if (
        accumulated.length !== newPosts.length ||
        (newPosts.length > 0 && accumulated[0]?.id !== newPosts[0]?.id)
      ) {
        setAccumulated(newPosts);
        setHasNextPage(data.hasNextPage);
        setTotalCount(data.totalCount);
      }
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

  return {
    posts: accumulated,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
  };
}
