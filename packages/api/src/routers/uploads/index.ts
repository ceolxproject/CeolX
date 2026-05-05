import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { posts } from '@CeolX/db/schema/social';
import {
  createMuxUploadSchema,
  deleteMuxAssetSchema,
  muxUploadStatusSchema,
  presignDeleteSchema,
  presignUploadSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../../index';
import { createDirectUpload, deleteAsset, retrieveUploadStatus } from '../../services/mux';
import { presignDelete, presignUpload } from '../../services/s3-presigner';

// All five procedures are protectedProcedure — any signed-in user can
// presign their own uploads and deletes. Ownership is enforced inside
// each procedure / underlying service:
//   - presignDelete refuses keys outside <prefix>/<userId>/...
//   - deleteMuxAsset checks the assetId belongs to a post created by ctx.userId

export const uploadsRouter = router({
  /** Mint a presigned PUT URL for direct frontend → S3 upload. */
  presignUpload: protectedProcedure
    .input(presignUploadSchema)
    .mutation(({ input, ctx }) => presignUpload({ ...input, userId: ctx.userId })),

  /** Mint a presigned DELETE URL for direct frontend → S3 cleanup. */
  presignDelete: protectedProcedure
    .input(presignDeleteSchema)
    .mutation(({ input, ctx }) => presignDelete({ key: input.key, userId: ctx.userId })),

  /** Create a Mux Direct Upload URL — client uploads video bytes straight to Mux. */
  createMuxUpload: protectedProcedure
    .input(createMuxUploadSchema)
    .mutation(() => createDirectUpload()),

  /**
   * Backend-proxied delete: Mux's assets.delete requires MUX_TOKEN_SECRET
   * which can never live on the client. We verify the caller owns a post
   * referencing this assetId, then call Mux. DB cleanup of the muxAssetId
   * column is the post-delete handler's responsibility.
   */
  deleteMuxAsset: protectedProcedure
    .input(deleteMuxAssetSchema)
    .mutation(async ({ input, ctx }) => {
      const owned = await db.query.posts.findFirst({
        where: and(eq(posts.muxAssetId, input.assetId), eq(posts.createdBy, ctx.userId)),
      });
      if (!owned) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This asset does not belong to a post you created',
        });
      }
      await deleteAsset(input.assetId);
      return { deleted: true as const };
    }),

  /**
   * Read-side companion to createMuxUpload. The mobile client polls this
   * after starting an upload until status === 'ready'. We hit Mux directly
   * here — the webhook is a backup / authoritative DB writer, not the
   * sole source of truth (the client may need a status before the webhook
   * fires, especially when the post row hasn't been created yet).
   */
  getMuxUploadStatus: protectedProcedure
    .input(muxUploadStatusSchema)
    .query(({ input }) => retrieveUploadStatus(input.uploadId)),
});
