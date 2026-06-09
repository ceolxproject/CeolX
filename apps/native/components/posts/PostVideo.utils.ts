// Pure helpers for <PostVideo>. Kept free of React / expo-video imports so the
// state machine can be unit-tested in isolation (mirrors the pollMuxStatus split
// in use-video-upload.ts).

// Mux serves a JPEG poster frame and the HLS manifest for any *public* playback
// id — no signing needed in V1 (playback_policy: 'public').
export const streamUrl = (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`;
export const posterUrl = (playbackId: string) =>
  `https://image.mux.com/${playbackId}/thumbnail.jpg`;

/**
 * What the card should actually render. `mediaUrl` from the row is preferred as
 * the stream source; `muxPlaybackId` is the fallback used to (re)build both the
 * stream and the poster.
 */
export type VideoState =
  | { kind: 'processing' } // still transcoding — show a placeholder
  | { kind: 'error' } // Mux failed — show an error state
  | { kind: 'ready'; streamUri: string; poster: string | null }; // playable

/**
 * Map the raw Mux columns to a single render state. Pure (no hooks / side
 * effects) so it can be unit-tested the same way pollMuxStatus is.
 *
 * Source of truth is `muxStatus`; `mediaUrl` and `muxPlaybackId` only decide
 * *how* a ready video is sourced. The product rules:
 *
 *   - 'errored'                       → error
 *   - 'ready' + a usable stream URL   → ready (prefer mediaUrl, else build from
 *                                       playbackId; poster from playbackId if present)
 *   - 'pending' / null / anything     → processing
 *
 * Edge cases (per the discussion):
 *   - 'ready' but no mediaUrl AND no playbackId → nothing to play, so we treat it
 *     as still processing rather than mounting a player against an empty URL. This
 *     is a "shouldn't happen" race, and processing is the safe, self-healing state
 *     (the next refetch will carry the real URL).
 *   - null status with a mediaUrl already set → don't trust it. Mux always writes
 *     a status, so a null-status video row is mid-pipeline (or a non-Mux artifact);
 *     showing the processing placeholder is safer than streaming a half-baked URL.
 */
export function deriveVideoState(
  mediaUrl: string | null,
  muxStatus: string | null,
  muxPlaybackId: string | null
): VideoState {
  if (muxStatus === 'errored') return { kind: 'error' };

  if (muxStatus === 'ready') {
    const streamUri = mediaUrl ?? (muxPlaybackId ? streamUrl(muxPlaybackId) : null);
    if (!streamUri) return { kind: 'processing' };
    return {
      kind: 'ready',
      streamUri,
      poster: muxPlaybackId ? posterUrl(muxPlaybackId) : null,
    };
  }

  // 'pending', null, or any unexpected value — keep the user on the placeholder.
  return { kind: 'processing' };
}
