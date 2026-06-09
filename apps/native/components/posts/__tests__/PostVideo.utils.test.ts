import { describe, expect, it } from 'vitest';

import { deriveVideoState, posterUrl, streamUrl } from '../PostVideo.utils';

const PLAYBACK_ID = 'abc123';
const HLS_URL = 'https://stream.mux.com/abc123.m3u8';

describe('deriveVideoState', () => {
  it("returns error when Mux reports 'errored'", () => {
    // errored wins even if a URL somehow exists — the asset is unusable.
    expect(deriveVideoState(HLS_URL, 'errored', PLAYBACK_ID)).toEqual({ kind: 'error' });
  });

  it("plays a ready video, preferring the row's mediaUrl as the source", () => {
    expect(deriveVideoState(HLS_URL, 'ready', PLAYBACK_ID)).toEqual({
      kind: 'ready',
      streamUri: HLS_URL,
      poster: posterUrl(PLAYBACK_ID),
    });
  });

  it('builds the stream URL from the playback id when mediaUrl is missing', () => {
    expect(deriveVideoState(null, 'ready', PLAYBACK_ID)).toEqual({
      kind: 'ready',
      streamUri: streamUrl(PLAYBACK_ID),
      poster: posterUrl(PLAYBACK_ID),
    });
  });

  it('has no poster when ready with a mediaUrl but no playback id', () => {
    expect(deriveVideoState(HLS_URL, 'ready', null)).toEqual({
      kind: 'ready',
      streamUri: HLS_URL,
      poster: null,
    });
  });

  it("treats 'pending' as processing", () => {
    expect(deriveVideoState(null, 'pending', null)).toEqual({ kind: 'processing' });
  });

  // Edge case: 'ready' but nothing to actually play — degrade to the spinner
  // rather than mounting a player against an empty URL. Self-heals on refetch.
  it("falls back to processing when 'ready' but both mediaUrl and playback id are missing", () => {
    expect(deriveVideoState(null, 'ready', null)).toEqual({ kind: 'processing' });
  });

  // Edge case: null status is mid-pipeline — don't trust a stray mediaUrl.
  it('treats a null status as processing even if mediaUrl is already set', () => {
    expect(deriveVideoState(HLS_URL, null, PLAYBACK_ID)).toEqual({ kind: 'processing' });
  });

  it('treats an unexpected status string as processing', () => {
    expect(deriveVideoState(HLS_URL, 'waiting', PLAYBACK_ID)).toEqual({ kind: 'processing' });
  });
});
