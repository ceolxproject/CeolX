import { randomUUID } from 'node:crypto';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TRPCError } from '@trpc/server';

import { env } from '@CeolX/env/server';

const PRESIGN_EXPIRES_SECONDS = 900; // 15 min

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

let cachedClient: S3Client | null = null;

function getClient(region: string): S3Client {
  if (!cachedClient) cachedClient = new S3Client({ region });
  return cachedClient;
}

export type PresignedPostImage = {
  uploadUrl: string;
  cdnUrl: string;
  key: string;
  expiresIn: number;
};

/**
 * Generate a short-lived presigned PUT URL for post-image upload + the public
 * CloudFront URL the mobile client should persist as `posts.mediaUrl`.
 *
 * Throws PRECONDITION_FAILED when S3 is not configured — M10-T1 ops work
 * provisions the bucket + CDN; until then, calls to this endpoint surface a
 * clear error instead of silently failing.
 */
export async function presignPostImageUpload(params: {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  userId: string;
}): Promise<PresignedPostImage> {
  const { contentType, userId } = params;
  const { AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN } = env;

  if (!AWS_REGION || !S3_BUCKET_NAME || !CLOUDFRONT_DOMAIN) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'S3 upload is not configured. Set AWS_REGION, S3_BUCKET_NAME, and CLOUDFRONT_DOMAIN.',
    });
  }

  const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin';
  const key = `posts/${userId}/${randomUUID()}.${ext}`;
  const client = getClient(AWS_REGION);

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SECONDS });
  const cdnUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

  return { uploadUrl, cdnUrl, key, expiresIn: PRESIGN_EXPIRES_SECONDS };
}
