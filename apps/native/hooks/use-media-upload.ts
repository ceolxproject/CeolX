import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import {
  AUDIO_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_BYTES_BY_TYPE,
  type UploadType,
} from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

type Asset = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

type UploadResult = {
  cdnUrl: string;
  key: string;
};

const DEFAULT_IMAGE_MIME = 'image/jpeg';
const DEFAULT_AUDIO_MIME = 'audio/mpeg';

function resolveContentType(asset: Asset, type: UploadType): string {
  const mime = asset.mimeType?.toLowerCase();
  if (type === 'post_audio') {
    if (mime && (AUDIO_MIME_TYPES as readonly string[]).includes(mime)) return mime;
    return DEFAULT_AUDIO_MIME;
  }
  if (mime && (IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return mime;
  return DEFAULT_IMAGE_MIME;
}

/**
 * PUT a Blob to a presigned S3 url with progress reporting. fetch() in RN
 * doesn't expose upload progress, so we drop down to XHR for this hop only.
 */
function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`S3 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during S3 upload'));
    xhr.send(blob);
  });
}

/**
 * Generic media upload hook for the M10-T1 pipeline. Two-step flow:
 *   1. ask the api server for a presigned PUT url scoped to ctx.userId
 *   2. PUT the asset bytes directly to S3 with progress reporting
 *
 * Returns the public CloudFront URL the caller persists in the relevant
 * column (posts.mediaUrl, profileImageUrl, coverImage, ...). For video
 * uploads, see use-video-upload.ts — those go to Mux, not S3.
 */
export function useMediaUpload(type: UploadType) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const presignMutation = useMutation(trpc.uploads.presignUpload.mutationOptions());

  const uploadMedia = useCallback(
    async (asset: Asset): Promise<UploadResult> => {
      const max = MAX_BYTES_BY_TYPE[type];
      if (asset.fileSize && asset.fileSize > max) {
        throw new Error(`File exceeds the ${Math.round(max / 1024 / 1024)}MB limit`);
      }
      setIsUploading(true);
      setProgress(0);
      try {
        const contentType = resolveContentType(asset, type);
        const { uploadUrl, cdnUrl, key } = await presignMutation.mutateAsync({
          type,
          contentType,
        });

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await putWithProgress(uploadUrl, blob, contentType, setProgress);

        return { cdnUrl, key };
      } finally {
        setIsUploading(false);
      }
    },
    [presignMutation, type]
  );

  return { uploadMedia, isUploading, progress };
}

// Exported for unit testing — not part of the public hook API.
export const __test = { resolveContentType, putWithProgress };
