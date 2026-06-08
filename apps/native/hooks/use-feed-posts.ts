import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

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

type Opts = { enabled?: boolean };

/** Discover feed — all non-deleted posts, newest first. */
export function useFeedPosts({ enabled = true }: Opts = {}) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<HydratedPost[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryOptions = trpc.posts.feed.queryOptions({
    limit: PAGE_SIZE,
    offset,
    query: searchQuery.trim() || undefined,
  });
  const { data, isLoading, isFetching, refetch } = useQuery({
    ...queryOptions,
    enabled,
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

  // Debounced so we don't refetch on every keystroke. Resetting offset +
  // accumulated forces the list back to page one for the new term.
  const onSearch = useCallback((text: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(text);
      setOffset(0);
      setAccumulated([]);
    }, MAP_DEBOUNCE_MS);
  }, []);

  return {
    posts: accumulated,
    isLoading: isLoading && offset === 0,
    isFetchingNextPage: isFetching && offset > 0,
    hasNextPage,
    totalCount,
    loadMore,
    refresh,
    searchQuery,
    onSearch,
  };
}
