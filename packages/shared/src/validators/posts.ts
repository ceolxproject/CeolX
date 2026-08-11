import { z } from 'zod';

export const POST_CAPTION_MAX = 500;
// M10-T1 widened the media universe — image and audio land on S3, video on Mux,
// text has neither URL nor upload id.
export const POST_MEDIA_TYPES = ['image', 'video', 'audio', 'text'] as const;
export const PRESIGN_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const createPostSchema = z
  .object({
    caption: z.string().min(1, 'Caption is required').max(POST_CAPTION_MAX).trim(),
    mediaType: z.enum(POST_MEDIA_TYPES),
    mediaUrl: z.string().url().optional(),
    // Mux Direct Upload id — set only for video posts. mediaUrl gets filled in
    // by the mux webhook once transcoding completes (HLS playback URL).
    muxUploadId: z.string().min(1).optional(),
  })
  .refine(
    (d) => {
      if (d.mediaType === 'text') return !d.mediaUrl && !d.muxUploadId;
      if (d.mediaType === 'video') return !d.mediaUrl && !!d.muxUploadId;
      // image | audio
      return !!d.mediaUrl && !d.muxUploadId;
    },
    {
      message:
        'Inconsistent media: text→neither, video→muxUploadId only, image|audio→mediaUrl only',
      path: ['mediaType'],
    }
  );

export const updatePostSchema = z
  .object({
    id: z.string().uuid(),
    caption: z.string().min(1).max(POST_CAPTION_MAX).trim().optional(),
    mediaType: z.enum(POST_MEDIA_TYPES).optional(),
    mediaUrl: z.string().url().nullable().optional(),
  })
  .refine((d) => d.caption !== undefined || d.mediaType !== undefined || d.mediaUrl !== undefined, {
    message: 'Nothing to update',
  })
  .refine(
    (d) => {
      if (d.mediaType === 'text') return d.mediaUrl === null || d.mediaUrl === undefined;
      if (d.mediaType === 'image' || d.mediaType === 'audio') {
        return typeof d.mediaUrl === 'string';
      }
      // video: mediaUrl is server-managed (webhook) — clients shouldn't update it
      return true;
    },
    { message: 'mediaType and mediaUrl must be consistent', path: ['mediaUrl'] }
  );

export const deletePostSchema = z.object({
  id: z.string().uuid(),
});

export const postByIdSchema = z.object({
  id: z.string().uuid(),
});

export const postFeedQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  // Free-text search. Matches a post's caption OR its author's display name
  // (artist stage name / venue name / user name). Omitted/empty → unfiltered feed.
  query: z.string().trim().min(1).max(100).optional(),
  // Viewer location for proximity ranking of the browse feed. Optional — without
  // coords the feed still ranks on recency + followed authors (distance neutral).
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const userPostsQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const togglePostLikeSchema = z.object({
  postId: z.string().uuid(),
});

export const postLikersQuerySchema = z.object({
  postId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

// presignPostImageSchema was retired in M10-T1 — clients call the generic
// presignUploadSchema with `{ type: 'post_image', contentType }`.

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type DeletePostInput = z.infer<typeof deletePostSchema>;
export type PostByIdInput = z.infer<typeof postByIdSchema>;
export type PostFeedQueryInput = z.infer<typeof postFeedQuerySchema>;
export type UserPostsQueryInput = z.infer<typeof userPostsQuerySchema>;
export type TogglePostLikeInput = z.infer<typeof togglePostLikeSchema>;
export type PostLikersQueryInput = z.infer<typeof postLikersQuerySchema>;
