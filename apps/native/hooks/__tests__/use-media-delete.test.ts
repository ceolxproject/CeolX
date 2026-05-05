import { describe, expect, it, vi } from 'vitest';

vi.mock('@CeolX/env/native', () => ({
  env: { EXPO_PUBLIC_CLOUDFRONT_DOMAIN: 'cdn.test.ceolx.ie' },
}));

vi.mock('@/utils/trpc', () => ({
  trpc: {
    uploads: {
      presignDelete: { mutationOptions: () => ({}) },
      deleteMuxAsset: { mutationOptions: () => ({}) },
    },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('react', () => ({
  useCallback: <T>(fn: T) => fn,
}));

import { keyFromCdnUrl } from '../use-media-delete';

describe('keyFromCdnUrl', () => {
  it('strips the configured CloudFront origin', () => {
    expect(keyFromCdnUrl('https://cdn.test.ceolx.ie/posts/u/x.jpg')).toBe('posts/u/x.jpg');
  });

  it('returns null for null/undefined/empty input', () => {
    expect(keyFromCdnUrl(null)).toBeNull();
    expect(keyFromCdnUrl(undefined)).toBeNull();
    expect(keyFromCdnUrl('')).toBeNull();
  });

  it('returns null for a URL on a different host', () => {
    expect(keyFromCdnUrl('https://other.example/posts/u/x.jpg')).toBeNull();
  });

  it('returns null when the URL is just the origin with a trailing slash', () => {
    expect(keyFromCdnUrl('https://cdn.test.ceolx.ie/')).toBeNull();
  });
});
