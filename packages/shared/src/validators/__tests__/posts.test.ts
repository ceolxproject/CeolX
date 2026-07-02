import { describe, expect, it } from 'vitest';

import { POST_MEDIA_TYPES, createPostSchema, updatePostSchema } from '../posts.js';

describe('POST_MEDIA_TYPES', () => {
  it('exposes image, video, audio, text', () => {
    expect([...POST_MEDIA_TYPES].sort()).toEqual(['audio', 'image', 'text', 'video']);
  });
});

describe('createPostSchema', () => {
  it('accepts a text post with neither mediaUrl nor muxUploadId', () => {
    const result = createPostSchema.safeParse({ caption: 'hello', mediaType: 'text' });
    expect(result.success).toBe(true);
  });

  it('rejects a text post that carries a mediaUrl', () => {
    const result = createPostSchema.safeParse({
      caption: 'hello',
      mediaType: 'text',
      mediaUrl: 'https://cdn.ceolx.com/posts/u/x.jpg',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an image post with mediaUrl', () => {
    const result = createPostSchema.safeParse({
      caption: 'sunset',
      mediaType: 'image',
      mediaUrl: 'https://cdn.ceolx.com/posts/u/x.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an image post without mediaUrl', () => {
    const result = createPostSchema.safeParse({ caption: 'sunset', mediaType: 'image' });
    expect(result.success).toBe(false);
  });

  it('rejects an image post that also carries muxUploadId', () => {
    const result = createPostSchema.safeParse({
      caption: 'sunset',
      mediaType: 'image',
      mediaUrl: 'https://cdn.ceolx.com/posts/u/x.jpg',
      muxUploadId: 'upl_123',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an audio post with mediaUrl', () => {
    const result = createPostSchema.safeParse({
      caption: 'live take',
      mediaType: 'audio',
      mediaUrl: 'https://cdn.ceolx.com/posts/u/x.mp3',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a video post with muxUploadId only', () => {
    const result = createPostSchema.safeParse({
      caption: 'gig clip',
      mediaType: 'video',
      muxUploadId: 'upl_abc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a video post without muxUploadId', () => {
    const result = createPostSchema.safeParse({ caption: 'gig clip', mediaType: 'video' });
    expect(result.success).toBe(false);
  });

  it('rejects a video post that carries mediaUrl on create', () => {
    const result = createPostSchema.safeParse({
      caption: 'gig clip',
      mediaType: 'video',
      muxUploadId: 'upl_abc',
      mediaUrl: 'https://stream.mux.com/abc.m3u8',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePostSchema', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts a caption-only update', () => {
    const result = updatePostSchema.safeParse({ id, caption: 'new caption' });
    expect(result.success).toBe(true);
  });

  it('accepts updating an audio post mediaUrl', () => {
    const result = updatePostSchema.safeParse({
      id,
      mediaType: 'audio',
      mediaUrl: 'https://cdn.ceolx.com/posts/u/x.mp3',
    });
    expect(result.success).toBe(true);
  });

  it('rejects updating an audio post without mediaUrl', () => {
    const result = updatePostSchema.safeParse({ id, mediaType: 'audio' });
    expect(result.success).toBe(false);
  });

  it('lets video updates pass through (mediaUrl is server-managed)', () => {
    const result = updatePostSchema.safeParse({ id, mediaType: 'video' });
    expect(result.success).toBe(true);
  });
});
