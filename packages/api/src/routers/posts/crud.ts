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

import { hydrateAuthors } from './hydrate';

export const create = creatorProcedure.input(createPostSchema).mutation(async ({ input, ctx }) => {
  const [inserted] = await db
    .insert(posts)
    .values({
      createdBy: ctx.userId,
      caption: input.caption,
      mediaType: input.mediaType,
      mediaUrl: input.mediaUrl ?? null,
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
  const authors = await hydrateAuthors([post.createdBy]);

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

  const authors = await hydrateAuthors(page.map((p) => p.createdBy));

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
      },
      likedByMe: likedSet.has(p.id),
    })),
    totalCount,
    hasNextPage,
  };
});
