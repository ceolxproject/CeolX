import { randomUUID } from 'node:crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TRPCError } from '@trpc/server';

import { env } from '@CeolX/env/server';
import { AUDIO_MIME_TYPES, IMAGE_MIME_TYPES, type UploadType } from '@CeolX/shared/validators';

// Frontend uploads / deletes flow directly against S3 via presigned URLs —
// the api server never reads or writes object bytes. We just sign the
// requests, scoped to the caller's userId via key prefix.

const PUT_EXPIRES_SECONDS = 300; // 5 min — matches M10-T1 spec
const DELETE_EXPIRES_SECONDS = 300;

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
};

type UploadConfig = {
  prefix: string;
  allowedMimes: readonly string[];
};

const UPLOAD_CONFIG: Record<UploadType, UploadConfig> = {
  profile_image: { prefix: 'profiles', allowedMimes: IMAGE_MIME_TYPES },
  cover_image: { prefix: 'covers', allowedMimes: IMAGE_MIME_TYPES },
  post_image: { prefix: 'posts', allowedMimes: IMAGE_MIME_TYPES },
  event_cover: { prefix: 'events', allowedMimes: IMAGE_MIME_TYPES },
  post_audio: { prefix: 'audio', allowedMimes: AUDIO_MIME_TYPES },
};

const ALLOWED_PREFIXES = new Set(Object.values(UPLOAD_CONFIG).map((c) => c.prefix));

let cachedClient: S3Client | null = null;

function getClient(region: string): S3Client {
  if (!cachedClient) cachedClient = new S3Client({ region });
  return cachedClient;
}

function requireS3Env(): { region: string; bucket: string; cdnDomain: string } {
  const { AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_DOMAIN } = env;
  if (!AWS_REGION || !S3_BUCKET_NAME || !CLOUDFRONT_DOMAIN) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'S3 upload is not configured. Set AWS_REGION, S3_BUCKET_NAME, and CLOUDFRONT_DOMAIN.',
    });
  }
  return { region: AWS_REGION, bucket: S3_BUCKET_NAME, cdnDomain: CLOUDFRONT_DOMAIN };
}

export type PresignedUpload = {
  uploadUrl: string;
  cdnUrl: string;
  key: string;
  expiresIn: number;
};

/**
 * Generate a presigned PUT URL the client uses to upload media bytes
 * directly to S3. Returns the public CloudFront URL the client persists
 * (in posts.mediaUrl, events.coverImage, profile image fields, etc.).
 */
export async function presignUpload(params: {
  type: UploadType;
  contentType: string;
  userId: string;
}): Promise<PresignedUpload> {
  const config = UPLOAD_CONFIG[params.type];
  if (!config.allowedMimes.includes(params.contentType)) {
    // Defense-in-depth: the shared validator already gates this on the wire.
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `contentType ${params.contentType} not allowed for ${params.type}`,
    });
  }
  const { region, bucket, cdnDomain } = requireS3Env();

  const ext = EXT_BY_CONTENT_TYPE[params.contentType] ?? 'bin';
  const key = `${config.prefix}/${params.userId}/${randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    getClient(region),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: params.contentType,
    }),
    { expiresIn: PUT_EXPIRES_SECONDS }
  );

  return {
    uploadUrl,
    cdnUrl: `https://${cdnDomain}/${key}`,
    key,
    expiresIn: PUT_EXPIRES_SECONDS,
  };
}

export type PresignedDelete = {
  deleteUrl: string;
  expiresIn: number;
};

/**
 * Generate a presigned DELETE URL the client uses to remove media from S3
 * directly when the parent record (post / event / profile image) is deleted
 * or replaced. The key MUST start with `<knownPrefix>/<userId>/...` —
 * otherwise the request is rejected before any URL is signed. This is the
 * sole authorisation guard, so it must remain in this function.
 */
export async function presignDelete(params: {
  key: string;
  userId: string;
}): Promise<PresignedDelete> {
  const { region, bucket } = requireS3Env();

  const segments = params.key.split('/');
  const [prefix, ownerId] = segments;
  if (!prefix || !ALLOWED_PREFIXES.has(prefix)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Key does not match a known upload prefix',
    });
  }
  if (!ownerId || ownerId !== params.userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Key is not owned by the authenticated user',
    });
  }

  const deleteUrl = await getSignedUrl(
    getClient(region),
    new DeleteObjectCommand({ Bucket: bucket, Key: params.key }),
    { expiresIn: DELETE_EXPIRES_SECONDS }
  );

  return { deleteUrl, expiresIn: DELETE_EXPIRES_SECONDS };
}

/**
 * Derive an S3 key from a stored CloudFront URL. Used by clients/server when
 * they have the URL but need the key for a DELETE call. Returns null when
 * the URL is malformed or doesn't belong to the given CloudFront domain.
 */
export function keyFromCdnUrl(url: string | null | undefined, cdnDomain: string): string | null {
  if (!url) return null;
  const expectedPrefix = `https://${cdnDomain}/`;
  if (!url.startsWith(expectedPrefix)) return null;
  const key = url.slice(expectedPrefix.length);
  return key.length > 0 ? key : null;
}

/**
 * @deprecated Replaced by `presignUpload({ type: 'post_image', ... })`.
 * Kept temporarily so `routers/posts/upload.ts` keeps compiling — both go
 * away together when the uploads tRPC router lands.
 */
export type PresignedPostImage = PresignedUpload;
export async function presignPostImageUpload(params: {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  userId: string;
}): Promise<PresignedPostImage> {
  return presignUpload({ type: 'post_image', ...params });
}
