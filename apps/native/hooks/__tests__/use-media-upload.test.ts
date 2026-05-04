import { describe, expect, it, vi } from 'vitest';

vi.mock('@CeolX/shared/validators', () => ({
  IMAGE_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  AUDIO_MIME_TYPES: ['audio/mpeg', 'audio/mp4', 'audio/aac'],
  MAX_BYTES_BY_TYPE: {
    profile_image: 5 * 1024 * 1024,
    cover_image: 10 * 1024 * 1024,
    post_image: 10 * 1024 * 1024,
    event_cover: 10 * 1024 * 1024,
    post_audio: 50 * 1024 * 1024,
  },
}));

vi.mock('@/utils/trpc', () => ({
  trpc: { uploads: { presignUpload: { mutationOptions: () => ({}) } } },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('react', () => ({
  useState: vi.fn(() => [false, vi.fn()]),
  useCallback: <T>(fn: T) => fn,
}));

import { __test } from '../use-media-upload';

describe('resolveContentType', () => {
  it('returns the asset mime when allowed for the upload type', () => {
    expect(__test.resolveContentType({ uri: 'x', mimeType: 'image/png' }, 'profile_image')).toBe(
      'image/png'
    );
    expect(__test.resolveContentType({ uri: 'x', mimeType: 'audio/aac' }, 'post_audio')).toBe(
      'audio/aac'
    );
  });

  it('falls back to image/jpeg for image-typed uploads with unknown mime', () => {
    expect(__test.resolveContentType({ uri: 'x', mimeType: undefined }, 'profile_image')).toBe(
      'image/jpeg'
    );
    expect(__test.resolveContentType({ uri: 'x', mimeType: 'image/heic' }, 'event_cover')).toBe(
      'image/jpeg'
    );
  });

  it('falls back to audio/mpeg for post_audio with unknown mime', () => {
    expect(__test.resolveContentType({ uri: 'x', mimeType: undefined }, 'post_audio')).toBe(
      'audio/mpeg'
    );
  });

  it('refuses to mix mime families across upload types', () => {
    // An audio mime supplied for an image upload type falls back rather than
    // pass through the wrong family.
    expect(__test.resolveContentType({ uri: 'x', mimeType: 'audio/aac' }, 'profile_image')).toBe(
      'image/jpeg'
    );
  });
});
