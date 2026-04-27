import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { trpc } from '@/utils/trpc';

type ImagePickerAsset = {
  uri: string;
  mimeType?: string | null;
};

type UploadResult = {
  cdnUrl: string;
};

function resolveContentType(asset: ImagePickerAsset): 'image/jpeg' | 'image/png' | 'image/webp' {
  const mime = asset.mimeType?.toLowerCase();
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/webp') return 'image/webp';
  // expo-image-picker reports image/jpeg for most camera/library photos
  return 'image/jpeg';
}

/**
 * Upload a locally-picked image to S3 via a presigned PUT URL.
 *
 * Two-step flow (both steps surface through the returned `uploadImage` fn):
 *   1. Request a presigned URL from the API (scoped to userId, 15-min expiry).
 *   2. PUT the asset bytes directly to S3, bypassing our backend.
 *
 * Returns the CloudFront CDN URL the caller can persist as `posts.mediaUrl`.
 */
export function usePostImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const presignMutation = useMutation(trpc.posts.presignImage.mutationOptions());

  const uploadImage = useCallback(
    async (asset: ImagePickerAsset): Promise<UploadResult> => {
      setIsUploading(true);
      try {
        const contentType = resolveContentType(asset);
        const { uploadUrl, cdnUrl } = await presignMutation.mutateAsync({ contentType });

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const putResp = await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': contentType },
        });

        if (!putResp.ok) {
          throw new Error(`S3 upload failed (${putResp.status})`);
        }

        return { cdnUrl };
      } finally {
        setIsUploading(false);
      }
    },
    [presignMutation]
  );

  return { uploadImage, isUploading };
}
