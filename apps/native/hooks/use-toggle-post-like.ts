import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

/** Minimal shape we patch inside any cached posts query. */
type LikeablePost = { id: string; likedByMe?: boolean; likeCount?: number | null };

/**
 * Walk whatever a `['posts']` query holds and apply `patch` to the post that
 * matches `postId`. Handles both cache shapes:
 *   - list queries (`feed`, `byUser`): `{ posts: LikeablePost[], … }`
 *   - single-post query (`byId`): a bare `LikeablePost`
 * Anything else is returned untouched.
 */
function patchPostInCache(
  data: unknown,
  postId: string,
  patch: (post: LikeablePost) => LikeablePost
): unknown {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray((data as { posts?: unknown }).posts)) {
    const d = data as { posts: LikeablePost[] };
    return {
      ...d,
      posts: d.posts.map((p) => (p.id === postId ? patch(p) : p)),
    };
  }

  if ((data as LikeablePost).id === postId) {
    return patch(data as LikeablePost);
  }

  return data;
}

/**
 * Toggle a post's like with an optimistic cache update.
 *
 * `onMutate` flips `likedByMe` and adjusts `likeCount` across every cached
 * posts query synchronously, so the heart updates the instant the user taps —
 * no flicker, and the change is consistent across feed / profile / detail.
 * `onError` rolls back to the snapshot; `onSuccess` reconciles to the server's
 * exact count; `onSettled` invalidates as a final safety net.
 */
export function useTogglePostLike() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.toggleLike.mutationOptions();
  const postsFilter = { queryKey: [['posts']] } as const;

  return useMutation({
    ...mutationOptions,
    onMutate: async ({ postId }) => {
      // Stop in-flight fetches from clobbering our optimistic write.
      await queryClient.cancelQueries(postsFilter);
      const previous = queryClient.getQueriesData(postsFilter);

      queryClient.setQueriesData(postsFilter, (data) =>
        patchPostInCache(data, postId, (p) => {
          const nextLiked = !p.likedByMe;
          const base = p.likeCount ?? 0;
          return {
            ...p,
            likedByMe: nextLiked,
            likeCount: Math.max(0, base + (nextLiked ? 1 : -1)),
          };
        })
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (result, { postId }) => {
      // Reconcile to the authoritative count the server returned.
      queryClient.setQueriesData(postsFilter, (data) =>
        patchPostInCache(data, postId, (p) => ({
          ...p,
          likedByMe: result.liked,
          likeCount: result.likeCount,
        }))
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries(postsFilter);
    },
  });
}
