import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';

import { MAX_VIDEO_BYTES, mediaTooLargeMessage } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';
import { toProgressFraction } from '@/utils/upload-progress';

type VideoAsset = {
  uri: string;
  fileSize?: number | null;
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Upload-time size guard, extracted as a pure function so it's unit-testable
 * and shared with the pick-time guard in MediaPickerField. Throws the same
 * friendly copy the picker shows — the cap lives in @CeolX/shared so the UI
 * text, this guard, and the picker never drift apart (the drift is exactly
 * what surfaced a cryptic "Network request failed" — Asana 1216260009179370).
 * A missing fileSize (the picker occasionally omits it) skips the check; the
 * streaming upload below no longer buffers the file into memory, so an
 * unmeasured oversized video can't OOM the JS thread either way.
 */
export function assertVideoWithinLimit(fileSize?: number | null): void {
  if (fileSize && fileSize > MAX_VIDEO_BYTES) {
    throw new Error(mediaTooLargeMessage('video', MAX_VIDEO_BYTES));
  }
}

export type MuxUploadResult = {
  uploadId: string;
  status: 'pending' | 'ready' | 'errored';
  playbackId: string | null;
  assetId: string | null;
};

/**
 * PUT a video file to a Mux Direct Upload endpoint with progress reporting.
 *
 * Streams the file straight from disk via expo-file-system's upload task
 * (BINARY_CONTENT) rather than `fetch(uri).blob()` + XHR. The old blob path
 * loaded the entire video into JS memory, which reliably failed on Android
 * for large files with a bare "Network request failed" — the root cause of
 * the post-with-video publish failures (Asana 1216260009179370). Mux accepts
 * a single binary PUT against the upload URL.
 */
async function putToMux(
  url: string,
  fileUri: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const task = FileSystem.createUploadTask(
    url,
    fileUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
    (data) => {
      if (onProgress && data.totalBytesExpectedToSend > 0) {
        onProgress(toProgressFraction(data.totalBytesSent, data.totalBytesExpectedToSend));
      }
    }
  );

  const result = await task.uploadAsync();
  // uploadAsync resolves undefined only if the task was cancelled; treat that
  // and any non-2xx the same way the XHR path did — as a failed upload.
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`Mux upload failed (${result?.status ?? 'no response'})`);
  }
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
      assertVideoWithinLimit(asset.fileSize);
      setIsUploading(true);
      setProgress(0);
      try {
        const { uploadUrl, uploadId } = await createUpload.mutateAsync({});

        await putToMux(uploadUrl, asset.uri, setProgress);

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
