import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';

import { env } from '@CeolX/env/native';

import { trpc } from '@/utils/trpc';

/**
 * Strip the configured CloudFront origin off a stored URL to recover the
 * S3 key. Returns null when the URL doesn't belong to our CDN — calling
 * code should swallow that case rather than try to delete a foreign URL.
 */
export function keyFromCdnUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const cdn = env.EXPO_PUBLIC_CLOUDFRONT_DOMAIN;
  if (!cdn) return null;
  const expectedPrefix = `https://${cdn}/`;
  if (!url.startsWith(expectedPrefix)) return null;
  const key = url.slice(expectedPrefix.length);
  return key.length > 0 ? key : null;
}

/**
 * Frontend-driven media cleanup. S3 deletes go straight to S3 via a
 * presigned DELETE URL — the api server never touches object bytes.
 * Mux deletes route through the api server because Mux's assets.delete
 * requires MUX_TOKEN_SECRET.
 *
 * Both paths are idempotent and best-effort. If the network fails after
 * the parent record has already been removed, the file becomes
 * orphaned — S3 lifecycle (90-day expiry) is the safety net for images.
 */
export function useMediaDelete() {
  const presignDeleteMutation = useMutation(trpc.uploads.presignDelete.mutationOptions());
  const deleteMuxAssetMutation = useMutation(trpc.uploads.deleteMuxAsset.mutationOptions());

  const deleteS3Object = useCallback(
    async (key: string): Promise<void> => {
      const { deleteUrl } = await presignDeleteMutation.mutateAsync({ key });
      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`S3 delete failed (${res.status})`);
      }
    },
    [presignDeleteMutation]
  );

  const deleteMuxAsset = useCallback(
    async (assetId: string): Promise<void> => {
      await deleteMuxAssetMutation.mutateAsync({ assetId });
    },
    [deleteMuxAssetMutation]
  );

  /**
   * High-level: pass whichever identifier(s) you have stored, the hook
   * calls the right path. No-op when both are null.
   */
  const cleanupAfterDelete = useCallback(
    async (input: { key?: string | null; muxAssetId?: string | null }): Promise<void> => {
      if (input.key) await deleteS3Object(input.key);
      if (input.muxAssetId) await deleteMuxAsset(input.muxAssetId);
    },
    [deleteMuxAsset, deleteS3Object]
  );

  return { deleteS3Object, deleteMuxAsset, cleanupAfterDelete };
}
