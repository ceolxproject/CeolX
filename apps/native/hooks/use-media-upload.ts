import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';

import {
  AUDIO_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_BYTES_BY_TYPE,
  type UploadType,
} from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';
import { toProgressFraction } from '@/utils/upload-progress';

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
 * PUT a file to a presigned S3 url with progress reporting.
 *
 * Streams the file from disk via expo-file-system (BINARY_CONTENT) instead of
 * `fetch(uri).blob()` + XHR. Buffering the whole file into a Blob failed on
 * Android for large assets with a bare "Network request failed"; streaming
 * keeps memory flat (same root cause as the Mux path — Asana 1216260009179370).
 * The presigner signs the request with this exact Content-Type, so the header
 * must match or S3 rejects the PUT.
 */
async function putWithProgress(
  url: string,
  fileUri: string,
  contentType: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const task = FileSystem.createUploadTask(
    url,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    },
    (data) => {
      if (onProgress && data.totalBytesExpectedToSend > 0) {
        onProgress(toProgressFraction(data.totalBytesSent, data.totalBytesExpectedToSend));
      }
    }
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`S3 upload failed (${result?.status ?? 'no response'})`);
  }
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

        await putWithProgress(uploadUrl, asset.uri, contentType, setProgress);

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
