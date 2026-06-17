import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { trpc } from '@/utils/trpc';
import { toProgressFraction } from '@/utils/upload-progress';

type VideoAsset = {
  uri: string;
  fileSize?: number | null;
};

const MUX_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export type MuxUploadResult = {
  uploadId: string;
  status: 'pending' | 'ready' | 'errored';
  playbackId: string | null;
  assetId: string | null;
};

/**
 * POST a video file to a Mux Direct Upload endpoint with progress reporting.
 * Mux accepts a single multipart-or-binary PUT against the upload URL —
 * the SDK explicitly documents PUT with the file body.
 */
function putToMux(url: string, blob: Blob, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(toProgressFraction(e.loaded, e.total));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Mux upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during Mux upload'));
    xhr.send(blob);
  });
}

/**
 * Pure helper extracted for testing — drives the polling loop until the
 * status leaves 'pending' or the deadline passes. The caller injects the
 * fetch + sleep so we can run it deterministically in unit tests.
 */
export async function pollMuxStatus(deps: {
  uploadId: string;
  fetchStatus: (uploadId: string) => Promise<MuxUploadResult>;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
}): Promise<MuxUploadResult> {
  const {
    uploadId,
    fetchStatus,
    sleep,
    intervalMs = POLL_INTERVAL_MS,
    timeoutMs = POLL_TIMEOUT_MS,
    now = () => Date.now(),
  } = deps;
  const deadline = now() + timeoutMs;
  // First fetch is eager so callers see "ready" without waiting an interval
  // when Mux already finished (common in tests, occasional in prod).
  let result = await fetchStatus(uploadId);
  while (result.status === 'pending') {
    if (now() >= deadline) {
      // Bubble the last-known status up — caller decides what to render.
      return result;
    }
    await sleep(intervalMs);
    result = await fetchStatus(uploadId);
  }
  return result;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Mobile video upload hook. Three steps:
 *   1. Ask the api server to mint a Mux Direct Upload URL.
 *   2. PUT the video bytes directly to Mux.
 *   3. Poll uploads.getMuxUploadStatus until the asset is 'ready' (or
 *      'errored', or the timeout hits).
 *
 * The returned uploadId is what the caller persists alongside the post
 * (mediaType: 'video', muxUploadId). Once the webhook fires, the post
 * row gets its playback_id and the HLS mediaUrl. Mobile clients should
 * also handle a 'pending' state at render time — videos can still be
 * transcoding when the user first sees them.
 */
export function useVideoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const createUpload = useMutation(trpc.uploads.createMuxUpload.mutationOptions());

  const uploadVideo = useCallback(
    async (asset: VideoAsset): Promise<MuxUploadResult> => {
      if (asset.fileSize && asset.fileSize > MUX_VIDEO_MAX_BYTES) {
        throw new Error(`Video exceeds the ${MUX_VIDEO_MAX_BYTES / 1024 / 1024}MB limit`);
      }
      setIsUploading(true);
      setProgress(0);
      try {
        const { uploadUrl, uploadId } = await createUpload.mutateAsync({});

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        await putToMux(uploadUrl, blob, setProgress);

        const result = await pollMuxStatus({
          uploadId,
          fetchStatus: (id) =>
            queryClient
              .fetchQuery(trpc.uploads.getMuxUploadStatus.queryOptions({ uploadId: id }))
              .then((r) => ({ uploadId: id, ...r })),
          sleep,
        });
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    [createUpload, queryClient]
  );

  return { uploadVideo, isUploading, progress };
}
