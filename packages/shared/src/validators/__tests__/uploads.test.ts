import { describe, expect, it } from 'vitest';

import {
  AUDIO_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_BYTES_BY_TYPE,
  UPLOAD_TYPES,
  createMuxUploadSchema,
  deleteMuxAssetSchema,
  muxUploadStatusSchema,
  presignDeleteSchema,
  presignUploadSchema,
} from '../uploads.js';

describe('UPLOAD_TYPES', () => {
  it('exposes the five types from the spec', () => {
    expect([...UPLOAD_TYPES].sort()).toEqual(
      ['cover_image', 'event_cover', 'post_audio', 'post_image', 'profile_image'].sort()
    );
  });
});

describe('MAX_BYTES_BY_TYPE', () => {
  it('matches the spec caps', () => {
    expect(MAX_BYTES_BY_TYPE.profile_image).toBe(5 * 1024 * 1024);
    expect(MAX_BYTES_BY_TYPE.cover_image).toBe(10 * 1024 * 1024);
    expect(MAX_BYTES_BY_TYPE.post_image).toBe(10 * 1024 * 1024);
    expect(MAX_BYTES_BY_TYPE.event_cover).toBe(10 * 1024 * 1024);
    expect(MAX_BYTES_BY_TYPE.post_audio).toBe(50 * 1024 * 1024);
  });
});

describe('presignUploadSchema', () => {
  it('accepts a valid image upload request', () => {
    const result = presignUploadSchema.safeParse({
      type: 'profile_image',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(true);
  });

  it.each(IMAGE_MIME_TYPES)('accepts %s for image upload types', (mime) => {
    const result = presignUploadSchema.safeParse({ type: 'post_image', contentType: mime });
    expect(result.success).toBe(true);
  });

  it.each(AUDIO_MIME_TYPES)('accepts %s for post_audio', (mime) => {
    const result = presignUploadSchema.safeParse({ type: 'post_audio', contentType: mime });
    expect(result.success).toBe(true);
  });

  it('rejects audio MIME for an image upload type', () => {
    const result = presignUploadSchema.safeParse({
      type: 'profile_image',
      contentType: 'audio/mpeg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects image MIME for post_audio', () => {
    const result = presignUploadSchema.safeParse({
      type: 'post_audio',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown MIME type', () => {
    const result = presignUploadSchema.safeParse({
      type: 'post_image',
      contentType: 'application/pdf',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown upload type', () => {
    const result = presignUploadSchema.safeParse({
      type: 'banner_image',
      contentType: 'image/jpeg',
    });
    expect(result.success).toBe(false);
  });
});

describe('presignDeleteSchema', () => {
  it('accepts a non-empty key', () => {
    const result = presignDeleteSchema.safeParse({ key: 'profiles/abc123/photo.jpg' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty key', () => {
    const result = presignDeleteSchema.safeParse({ key: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing key', () => {
    const result = presignDeleteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('createMuxUploadSchema', () => {
  it('accepts an empty object', () => {
    const result = createMuxUploadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects extra fields (strict)', () => {
    const result = createMuxUploadSchema.safeParse({ fileName: 'video.mp4' });
    expect(result.success).toBe(false);
  });
});

describe('deleteMuxAssetSchema', () => {
  it('accepts a non-empty assetId', () => {
    const result = deleteMuxAssetSchema.safeParse({ assetId: 'asset_abc123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty assetId', () => {
    const result = deleteMuxAssetSchema.safeParse({ assetId: '' });
    expect(result.success).toBe(false);
  });
});

describe('muxUploadStatusSchema', () => {
  it('accepts a non-empty uploadId', () => {
    const result = muxUploadStatusSchema.safeParse({ uploadId: 'upload_abc123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty uploadId', () => {
    const result = muxUploadStatusSchema.safeParse({ uploadId: '' });
    expect(result.success).toBe(false);
  });
});
