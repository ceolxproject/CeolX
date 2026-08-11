import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Which post's likers sheet is open, or null when it's closed.
 *
 * A single <PostLikersSheet /> is mounted at the app root rather than one per
 * PostCard — the feed renders dozens of cards, and a BottomSheetModal inside
 * each would mount dozens of modals to show at most one. Cards only need to
 * name a post id; the root sheet does the rest.
 *
 * The id lives in the query cache (not React context) for the same reason
 * `use-deleted-posts` keeps its tombstone set there: writing it re-renders only
 * the components that subscribed, with no provider to thread through.
 */
const LIKERS_SHEET_KEY = ['likersSheetPostId'] as const;

/**
 * Subscribe to the open post id. Only the sheet itself should call this —
 * a PostCard that subscribed would re-render every card in the feed each time
 * any sheet opened or closed.
 */
export function useLikersSheetPostId(): string | null {
  const { data } = useQuery<string | null>({
    queryKey: LIKERS_SHEET_KEY,
    queryFn: () => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

/** Open/close controls. Writes only — no subscription, so callers don't re-render. */
export function useLikersSheetControls() {
  const queryClient = useQueryClient();

  const open = useCallback(
    (postId: string) => queryClient.setQueryData(LIKERS_SHEET_KEY, postId),
    [queryClient]
  );
  const close = useCallback(() => queryClient.setQueryData(LIKERS_SHEET_KEY, null), [queryClient]);

  return { open, close };
}
