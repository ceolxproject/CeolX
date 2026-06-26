import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { posts, postLikes } from '@CeolX/db/schema/social';
import {
  createPostSchema,
  deletePostSchema,
  postByIdSchema,
  updatePostSchema,
  userPostsQuerySchema,
} from '@CeolX/shared/validators';

import { creatorProcedure, protectedProcedure, publicProcedure } from '../../index';
import { retrieveUploadStatus } from '../../services/mux';

import { hydrateAuthors } from './hydrate';

type MuxColumns = {
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  muxStatus: 'pending' | 'ready' | 'errored' | null;
  mediaUrl: string | null;
};

/**
 * Resolve the Mux columns for a new post.
 *
 * The mobile client polls Mux until the asset is *ready* BEFORE it calls
 * createPost, which means video.asset.ready almost always fires before this
 * row exists — so the webhook's `UPDATE ... WHERE mux_upload_id = $1` matches
 * zero rows and (since Mux got a 200) never re-fires, stranding the post at
 * 'pending' forever. To close that race we resolve the asset state here at
 * creation time. The webhook stays as the backstop for the slower case where
 * the asset is still transcoding when the post is created.
 *
 * If the Mux lookup fails we fall back to 'pending' and let the webhook (or a
 * later poll) backfill — post creation must not hard-fail on a Mux hiccup.
 */
async function resolveMuxColumns(input: {
  mediaType: string;
  mediaUrl?: string;
  muxUploadId?: string;
}): Promise<MuxColumns> {
  const base: MuxColumns = {
    muxUploadId: input.muxUploadId ?? null,
    muxAssetId: null,
    muxPlaybackId: null,
    muxStatus: input.muxUploadId ? 'pending' : null,
    mediaUrl: input.mediaUrl ?? null,
  };

  if (input.mediaType !== 'video' || !input.muxUploadId) return base;

  try {
    const status = await retrieveUploadStatus(input.muxUploadId);
    if (status.status === 'ready' && status.playbackId) {
      return {
        muxUploadId: input.muxUploadId,
        muxAssetId: status.assetId,
        muxPlaybackId: status.playbackId,
        muxStatus: 'ready',
        mediaUrl: `https://stream.mux.com/${status.playbackId}.m3u8`,
      };
    }
    if (status.status === 'errored') {
      return { ...base, muxAssetId: status.assetId, muxStatus: 'errored' };
    }
  } catch (err) {
    console.warn('[posts.create] mux status lookup failed; leaving pending', err);
  }
  return base;
}

export const create = creatorProcedure.input(createPostSchema).mutation(async ({ input, ctx }) => {
  const muxColumns = await resolveMuxColumns(input);

  const [inserted] = await db
    .insert(posts)
    .values({
      createdBy: ctx.userId,
      caption: input.caption,
      mediaType: input.mediaType,
      ...muxColumns,
    })
    .returning();

  if (!inserted) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create post' });
  }

  const authors = await hydrateAuthors([inserted.createdBy]);
  const author = authors.get(inserted.createdBy) ?? {
    id: inserted.createdBy,
    displayName: 'Unknown',
    profileImageUrl: null,
    profileType: 'user' as const,
    isFollowedByMe: false,
  };

  return {
    ...inserted,
    author,
    likedByMe: false,
  };
});

export const update = protectedProcedure
  .input(updatePostSchema)
  .mutation(async ({ input, ctx }) => {
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, input.id) });
    if (!existing || existing.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
    }
    if (existing.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own posts' });
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.caption !== undefined) set.caption = input.caption;
    if (input.mediaType !== undefined) set.mediaType = input.mediaType;
    if (input.mediaUrl !== undefined) set.mediaUrl = input.mediaUrl;

    const [updated] = await db.update(posts).set(set).where(eq(posts.id, input.id)).returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update post' });
    }

    const authors = await hydrateAuthors([updated.createdBy]);
    return {
      ...updated,
      author: authors.get(updated.createdBy) ?? {
        id: updated.createdBy,
        displayName: 'Unknown',
        profileImageUrl: null,
        profileType: 'user' as const,
        isFollowedByMe: false,
      },
    };
  });

export const remove = protectedProcedure
  .input(deletePostSchema)
  .mutation(async ({ input, ctx }) => {
    const existing = await db.query.posts.findFirst({ where: eq(posts.id, input.id) });
    if (!existing || existing.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
    }
    if (existing.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own posts' });
    }

    await db
      .update(posts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, input.id));

    // Surface the underlying media identifiers so the client can clean up
    // S3 / Mux directly. Image / audio: media_url is a CDN URL; the client
    // strips the CloudFront domain to get the s3 key. Video: mux_asset_id
    // routes through uploads.deleteMuxAsset. Either may be null.
    return {
      success: true as const,
      mediaUrl: existing.mediaUrl ?? null,
      muxAssetId: existing.muxAssetId ?? null,
    };
  });

export const byId = publicProcedure.input(postByIdSchema).query(async ({ input, ctx }) => {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, input.id) });
  if (!post || post.deletedAt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
  }

  const viewerId = ctx.session?.user?.id ?? null;
  const authors = await hydrateAuthors([post.createdBy], viewerId);

  let likedByMe = false;
  if (viewerId) {
    const liked = await db.query.postLikes.findFirst({
      where: and(eq(postLikes.postId, post.id), eq(postLikes.userId, viewerId)),
    });
    likedByMe = !!liked;
  }

  return {
    ...post,
    author: authors.get(post.createdBy) ?? {
      id: post.createdBy,
      displayName: 'Unknown',
      profileImageUrl: null,
      profileType: 'user' as const,
      isFollowedByMe: false,
    },
    likedByMe,
  };
});

export const byUser = publicProcedure.input(userPostsQuerySchema).query(async ({ input, ctx }) => {
  const { userId, limit, offset } = input;
  const viewerId = ctx.session?.user?.id ?? null;

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(and(eq(posts.createdBy, userId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.createdBy, userId), isNull(posts.deletedAt))),
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const authors = await hydrateAuthors(
    page.map((p) => p.createdBy),
    viewerId
  );

  let likedSet = new Set<string>();
  if (viewerId && page.length > 0) {
    const likedRows = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(
        and(
          eq(postLikes.userId, viewerId),
          inArray(
            postLikes.postId,
            page.map((p) => p.id)
          )
        )
      );
    likedSet = new Set(likedRows.map((r) => r.postId));
  }

  return {
    posts: page.map((p) => ({
      ...p,
      author: authors.get(p.createdBy) ?? {
        id: p.createdBy,
        displayName: 'Unknown',
        profileImageUrl: null,
        profileType: 'user' as const,
        isFollowedByMe: false,
      },
      likedByMe: likedSet.has(p.id),
    })),
    totalCount,
    hasNextPage,
  };
});
