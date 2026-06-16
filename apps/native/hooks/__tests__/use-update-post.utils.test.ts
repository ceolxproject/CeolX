import { describe, expect, it } from 'vitest';

import { planPostMediaUpdate } from '../use-update-post.utils';

describe('planPostMediaUpdate', () => {
  it('keeps the media untouched when an existing image is unchanged', () => {
    // Seeded media carries a cdnUrl (already uploaded), so nothing to do.
    expect(
      planPostMediaUpdate({
        originalMediaType: 'image',
        originalMediaUrl: 'https://cdn/posts/u1/old.jpg',
        currentKind: 'image',
        currentHasCdnUrl: true,
      })
    ).toEqual({ action: 'keep' });
  });

  it('uploads and cleans up the old image when the image is replaced', () => {
    // A freshly-picked image has no cdnUrl yet.
    expect(
      planPostMediaUpdate({
        originalMediaType: 'image',
        originalMediaUrl: 'https://cdn/posts/u1/old.jpg',
        currentKind: 'image',
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'upload', cleanupUrl: 'https://cdn/posts/u1/old.jpg' });
  });

  it('uploads with no cleanup when adding an image to a text post', () => {
    expect(
      planPostMediaUpdate({
        originalMediaType: 'text',
        originalMediaUrl: null,
        currentKind: 'image',
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'upload', cleanupUrl: null });
  });

  it('clears the media and cleans up when an existing image is removed', () => {
    expect(
      planPostMediaUpdate({
        originalMediaType: 'image',
        originalMediaUrl: 'https://cdn/posts/u1/old.jpg',
        currentKind: null,
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'clear', cleanupUrl: 'https://cdn/posts/u1/old.jpg' });
  });

  it('keeps a text post untouched when no media is selected', () => {
    expect(
      planPostMediaUpdate({
        originalMediaType: 'text',
        originalMediaUrl: null,
        currentKind: null,
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'keep' });
  });

  it('never swaps server-managed video media on edit', () => {
    // Untouched video edit.
    expect(
      planPostMediaUpdate({
        originalMediaType: 'video',
        originalMediaUrl: 'https://stream.mux.com/abc.m3u8',
        currentKind: null,
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'keep' });

    // Even if an image is picked, a video post is left untouched (avoids
    // orphaning the Mux asset / converting the post type).
    expect(
      planPostMediaUpdate({
        originalMediaType: 'video',
        originalMediaUrl: 'https://stream.mux.com/abc.m3u8',
        currentKind: 'image',
        currentHasCdnUrl: false,
      })
    ).toEqual({ action: 'keep' });
  });
});
