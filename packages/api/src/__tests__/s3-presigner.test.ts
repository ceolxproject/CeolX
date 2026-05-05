import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
// envState is mutated per-test to simulate missing env vars.
const { envState, mockGetSignedUrl } = vi.hoisted(() => {
  const envState: Record<string, string | undefined> = {
    AWS_REGION: 'eu-west-1',
    S3_BUCKET_NAME: 'ceolx-media-test',
    CLOUDFRONT_DOMAIN: 'cdn.test.ceolx.ie',
  };
  const mockGetSignedUrl = vi.fn();
  return { envState, mockGetSignedUrl };
});

vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

// Note: we do NOT mock @aws-sdk/client-s3 — the presigner constructs a
// PutObjectCommand / DeleteObjectCommand purely client-side. getSignedUrl is
// the network seam and is mocked above.

const USER_ID = 'user_abc123';

beforeEach(() => {
  Object.assign(envState, {
    AWS_REGION: 'eu-west-1',
    S3_BUCKET_NAME: 'ceolx-media-test',
    CLOUDFRONT_DOMAIN: 'cdn.test.ceolx.ie',
  });
  mockGetSignedUrl.mockReset();
  mockGetSignedUrl.mockResolvedValue('https://signed.example/url');
});

describe('presignUpload', () => {
  it('returns uploadUrl, cdnUrl, key, expiresIn for a profile_image', async () => {
    const { presignUpload } = await import('../services/s3-presigner.js');
    const result = await presignUpload({
      type: 'profile_image',
      contentType: 'image/jpeg',
      userId: USER_ID,
    });
    expect(result.uploadUrl).toBe('https://signed.example/url');
    expect(result.cdnUrl).toMatch(
      /^https:\/\/cdn\.test\.ceolx\.ie\/profiles\/user_abc123\/.+\.jpg$/
    );
    expect(result.key).toMatch(/^profiles\/user_abc123\/.+\.jpg$/);
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it.each([
    ['cover_image', 'covers'],
    ['post_image', 'posts'],
    ['event_cover', 'events'],
    ['post_audio', 'audio'],
  ] as const)('puts %s under the %s/ prefix', async (type, prefix) => {
    const { presignUpload } = await import('../services/s3-presigner.js');
    const ct = type === 'post_audio' ? 'audio/mpeg' : 'image/png';
    const result = await presignUpload({ type, contentType: ct, userId: USER_ID });
    expect(result.key.startsWith(`${prefix}/${USER_ID}/`)).toBe(true);
  });

  it('throws PRECONDITION_FAILED when AWS_REGION is missing', async () => {
    envState.AWS_REGION = undefined;
    const { presignUpload } = await import('../services/s3-presigner.js');
    await expect(
      presignUpload({ type: 'post_image', contentType: 'image/png', userId: USER_ID })
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('throws BAD_REQUEST when contentType is not allowed for the type', async () => {
    const { presignUpload } = await import('../services/s3-presigner.js');
    await expect(
      presignUpload({ type: 'profile_image', contentType: 'audio/mpeg', userId: USER_ID })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('presignDelete', () => {
  it('returns deleteUrl + expiresIn for a key the user owns', async () => {
    const { presignDelete } = await import('../services/s3-presigner.js');
    const result = await presignDelete({
      key: `posts/${USER_ID}/abc.jpg`,
      userId: USER_ID,
    });
    expect(result.deleteUrl).toBe('https://signed.example/url');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('rejects keys with an unknown prefix', async () => {
    const { presignDelete } = await import('../services/s3-presigner.js');
    await expect(
      presignDelete({ key: `notathing/${USER_ID}/x.jpg`, userId: USER_ID })
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('rejects keys owned by another user', async () => {
    const { presignDelete } = await import('../services/s3-presigner.js');
    await expect(
      presignDelete({ key: 'posts/someone_else/x.jpg', userId: USER_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects keys without a userId segment', async () => {
    const { presignDelete } = await import('../services/s3-presigner.js');
    await expect(presignDelete({ key: 'posts/x.jpg', userId: USER_ID })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws PRECONDITION_FAILED when S3 env is missing', async () => {
    envState.S3_BUCKET_NAME = undefined;
    const { presignDelete } = await import('../services/s3-presigner.js');
    await expect(
      presignDelete({ key: `posts/${USER_ID}/x.jpg`, userId: USER_ID })
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });
});

describe('keyFromCdnUrl', () => {
  it('strips the CloudFront origin', async () => {
    const { keyFromCdnUrl } = await import('../services/s3-presigner.js');
    expect(keyFromCdnUrl('https://cdn.test.ceolx.ie/posts/u/x.jpg', 'cdn.test.ceolx.ie')).toBe(
      'posts/u/x.jpg'
    );
  });

  it('returns null for a different domain', async () => {
    const { keyFromCdnUrl } = await import('../services/s3-presigner.js');
    expect(keyFromCdnUrl('https://other.example/posts/u/x.jpg', 'cdn.test.ceolx.ie')).toBeNull();
  });

  it('returns null for non-https schemes', async () => {
    const { keyFromCdnUrl } = await import('../services/s3-presigner.js');
    expect(keyFromCdnUrl('ftp://cdn.test.ceolx.ie/x.jpg', 'cdn.test.ceolx.ie')).toBeNull();
  });

  it('returns null for null/undefined input', async () => {
    const { keyFromCdnUrl } = await import('../services/s3-presigner.js');
    expect(keyFromCdnUrl(null, 'cdn.test.ceolx.ie')).toBeNull();
    expect(keyFromCdnUrl(undefined, 'cdn.test.ceolx.ie')).toBeNull();
    expect(keyFromCdnUrl('', 'cdn.test.ceolx.ie')).toBeNull();
  });
});
