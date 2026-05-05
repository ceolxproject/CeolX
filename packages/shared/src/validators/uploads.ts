import { z } from 'zod';

// Single source of truth for the M10-T1 upload pipeline. Both the api server
// (uploads tRPC router) and apps/native (mobile hooks) import from here.

export const UPLOAD_TYPES = [
  'profile_image',
  'cover_image',
  'post_image',
  'event_cover',
  'post_audio',
] as const;

export type UploadType = (typeof UPLOAD_TYPES)[number];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac'] as const;
// Mux Direct Upload accepts a wide set of formats; we still gate the picker
// to MP4 / MOV per the spec — see VIDEO_MIME_TYPES.
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number];

const ALLOWED_MIMES_BY_TYPE: Record<UploadType, readonly string[]> = {
  profile_image: IMAGE_MIME_TYPES,
  cover_image: IMAGE_MIME_TYPES,
  post_image: IMAGE_MIME_TYPES,
  event_cover: IMAGE_MIME_TYPES,
  post_audio: AUDIO_MIME_TYPES,
};

// Spec caps. Client validates locally for UX; server re-validates via S3
// presigned-PUT ContentLength condition (set in the presigner service).
export const MAX_BYTES_BY_TYPE: Record<UploadType, number> = {
  profile_image: 5 * 1024 * 1024,
  cover_image: 10 * 1024 * 1024,
  post_image: 10 * 1024 * 1024,
  event_cover: 10 * 1024 * 1024,
  post_audio: 50 * 1024 * 1024,
};

export const presignUploadSchema = z
  .object({
    type: z.enum(UPLOAD_TYPES),
    contentType: z.string().min(1),
  })
  .refine((d) => ALLOWED_MIMES_BY_TYPE[d.type].includes(d.contentType), {
    message: 'contentType not allowed for this upload type',
    path: ['contentType'],
  });

export const presignDeleteSchema = z.object({
  key: z.string().min(1),
});

export const createMuxUploadSchema = z.object({}).strict();

export const deleteMuxAssetSchema = z.object({
  assetId: z.string().min(1),
});

export const muxUploadStatusSchema = z.object({
  uploadId: z.string().min(1),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type PresignDeleteInput = z.infer<typeof presignDeleteSchema>;
export type CreateMuxUploadInput = z.infer<typeof createMuxUploadSchema>;
export type DeleteMuxAssetInput = z.infer<typeof deleteMuxAssetSchema>;
export type MuxUploadStatusInput = z.infer<typeof muxUploadStatusSchema>;
