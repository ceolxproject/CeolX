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
const LIKERS_SHEET_KEY = ['likersSheetTarget'] as const;

/**
 * The post whose likers are on screen. `likeCount` is carried along because the
 * sheet's height is derived from it: waiting for the request to land would open
 * the sheet one row tall and then jump it to full size. The card already knows
 * the count, so it hands it over.
 */
export type LikersSheetTarget = { postId: string; likeCount: number };

/**
 * Subscribe to the open target. Only the sheet itself should call this —
 * a PostCard that subscribed would re-render every card in the feed each time
 * any sheet opened or closed.
 */
export function useLikersSheetTarget(): LikersSheetTarget | null {
  const { data } = useQuery<LikersSheetTarget | null>({
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
    (postId: string, likeCount: number) =>
      queryClient.setQueryData<LikersSheetTarget | null>(LIKERS_SHEET_KEY, {
        postId,
        likeCount,
      }),
    [queryClient]
  );
  const close = useCallback(
    () => queryClient.setQueryData<LikersSheetTarget | null>(LIKERS_SHEET_KEY, null),
    [queryClient]
  );

  return { open, close };
}
