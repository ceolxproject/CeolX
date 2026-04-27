import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

/**
 * Toggle a post's like. The server returns `{ liked, likeCount }`.
 *
 * Learning spot (Priya): The `onMutate` handler below is the optimistic-update
 * strategy. Right now it simply invalidates cached queries on settle — that's
 * safe but causes a visible flicker on slow networks because the heart icon
 * only flips once the server responds. A better UX is to patch every cached
 * feed / by-user / by-id query *synchronously* when the user taps, then roll
 * back in `onError` if the server call fails.
 *
 * You'll want to:
 *  1. In `onMutate`: use `queryClient.setQueriesData({ queryKey: [['posts']] }, (old) => …)`
 *     to flip `likedByMe` and adjust `likeCount` across every cached post shape.
 *  2. Snapshot the previous data so `onError` can roll it back.
 *  3. Keep the `onSettled` invalidation as a safety net — it reconciles with
 *     the server count after the mutation finishes.
 *
 * Trade-off: atomic local flip (snappy UI, risk of temporary inconsistency if
 * the server errors) vs. wait-for-server (accurate but sluggish).
 *
 * TODO(priya): implement the optimistic `onMutate` + `onError` rollback.
 */
export function useTogglePostLike() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.toggleLike.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}
