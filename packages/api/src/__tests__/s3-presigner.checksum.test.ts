import { beforeAll, describe, expect, it, vi } from 'vitest';

// Unlike s3-presigner.test.ts, this file does NOT mock getSignedUrl — it
// real-signs so it can assert the *shape* of the presigned URL.
//
// Regression guard for the 403-on-upload bug: AWS SDK >= 3.729 defaults
// requestChecksumCalculation to 'WHEN_SUPPORTED', which bakes an empty-body
// x-amz-checksum-crc32 (AAAAAA==) into presigned PUT URLs. Raw client PUTs
// (RN XHR / browser fetch) send the real body, whose checksum never matches
// the signed empty-body value, so S3 rejects every upload with 403. The
// presigner pins the client to 'WHEN_REQUIRED' to prevent this.

vi.mock('@CeolX/env/server', () => ({
  env: {
    AWS_REGION: 'eu-west-1',
    S3_BUCKET_NAME: 'ceolx-media-test',
    CLOUDFRONT_DOMAIN: 'cdn.test.ceolx.com',
  },
}));

beforeAll(() => {
  // The S3Client resolves credentials from the default provider chain; give it
  // dummy static creds so signing succeeds offline. Values are never used to
  // call AWS — getSignedUrl only computes a signature locally.
  process.env.AWS_ACCESS_KEY_ID ||= 'AKIATESTTESTTESTTEST0';
  process.env.AWS_SECRET_ACCESS_KEY ||= 'testsecrettestsecrettestsecrettestsecret';
});

const hasChecksumParam = (url: string): boolean =>
  [...new URL(url).searchParams.keys()].some((k) => k.toLowerCase().includes('checksum'));

describe('presignUpload — checksum-free presigned URL', () => {
  it('does not bake any x-amz-checksum* parameter into the upload URL', async () => {
    const { presignUpload } = await import('../services/s3-presigner.js');
    const { uploadUrl } = await presignUpload({
      type: 'profile_image',
      contentType: 'image/jpeg',
      userId: 'user_abc123',
    });
    expect(hasChecksumParam(uploadUrl)).toBe(false);
  });
});
