import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markPostDeleted } from '@/hooks/use-deleted-posts';
import { keyFromCdnUrl, useMediaDelete } from '@/hooks/use-media-delete';
import { trpc } from '@/utils/trpc';

/**
 * Soft-deletes the post via posts.delete and then cleans up the underlying
 * S3 object / Mux asset using the identifiers the mutation returns. Cleanup
 * is best-effort — if the network fails after the post is already deleted,
 * the file becomes orphaned, but s3 lifecycle (90-day expiry) catches it.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.delete.mutationOptions();
  const { cleanupAfterDelete } = useMediaDelete();

  return useMutation({
    ...mutationOptions,
    onSuccess: async (data, variables) => {
      // Tombstone the post first so every mounted list drops it immediately —
      // before the (slower) media cleanup + query invalidation below. This is
      // what removes the row from the feed AND profile at the same time without
      // waiting on a refetch.
      markPostDeleted(queryClient, variables.id);

      const key = keyFromCdnUrl(data.mediaUrl);
      try {
        await cleanupAfterDelete({ key, muxAssetId: data.muxAssetId });
      } catch (err) {
        console.warn('[delete-post] media cleanup failed', err);
      }
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}
