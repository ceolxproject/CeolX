import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

import { excludeDeletedPosts, useDeletedPostIds } from '@/hooks/use-deleted-posts';
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
  // Mirrors searchQuery for the debounced onSearch closure (empty deps), so it
  // can tell whether a new search actually changes the query.
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
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

  // Debounced so we don't refetch on every keystroke. Resetting offset +
  // accumulated forces the list back to page one for the new term.
  const onSearch = useCallback((text: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      // Re-selecting the query already loaded (e.g. tapping the same suggestion
      // that's still in the box) must be a no-op. Otherwise we clear the list
      // while React Query — seeing an unchanged query key — serves cached data
      // without refetching, so the data-sync effect (keyed on [data,
      // isFetching]) never fires to refill it, leaving the feed empty until a
      // manual refresh. (Asana 1215700058851899)
      if (text === searchQueryRef.current) return;
      setSearchQuery(text);
      setOffset(0);
      setAccumulated([]);
    }, MAP_DEBOUNCE_MS);
  }, []);

  // Filter out posts the current session has deleted. The accumulated array can
  // still hold a just-deleted row (the append-only merge can't remove one when
  // scrolled past page 0); the shared tombstone set drops it from every surface.
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
    searchQuery,
    onSearch,
  };
}
