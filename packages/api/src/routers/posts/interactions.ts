import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { postLikes, posts } from '@CeolX/db/schema/social';
import { postLikersQuerySchema, togglePostLikeSchema } from '@CeolX/shared/validators';

import { protectedProcedure, publicProcedure } from '../../index';

import { hydrateAuthors } from './hydrate';

/**
 * Idempotent like toggle.
 *   - If the user hasn't liked the post yet: insert like + increment count.
 *   - If they have: delete like + decrement count (floor at 0).
 * The whole thing is wrapped in a transaction so the counter and the row
 * are always consistent.
 */
export const toggleLike = protectedProcedure
  .input(togglePostLikeSchema)
  .mutation(async ({ input, ctx }) => {
    const { postId } = input;
    const userId = ctx.userId;

    const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
    if (!post || post.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
    }

    return db.transaction(async (tx) => {
      const existing = await tx.query.postLikes.findFirst({
        where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
      });

      if (existing) {
        const deleted = await tx
          .delete(postLikes)
          .where(eq(postLikes.id, existing.id))
          .returning({ id: postLikes.id });
        // Two concurrent unlikes both read the same row; the second delete
        // removes nothing. Decrementing anyway drops like_count below the real
        // row count — visible once the likers list sits next to the number.
        if (deleted.length === 0) {
          return { liked: false, likeCount: post.likeCount ?? 0 };
        }
        const [updated] = await tx
          .update(posts)
          .set({ likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount });
        return { liked: false, likeCount: updated?.likeCount ?? 0 };
      }

      await tx.insert(postLikes).values({ postId, userId });
      const [updated] = await tx
        .update(posts)
        .set({ likeCount: sql`${posts.likeCount} + 1` })
        .where(eq(posts.id, postId))
        .returning({ likeCount: posts.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 0 };
    });
  });

/**
 * Who liked a post — newest first, paginated.
 *
 * Public, because guests ("Skip sign-in") browse the feed and can open this from
 * a post's like count. Scoped to a single post, so `post_likes_post_user_idx`
 * already covers the lookup — no new index, and the feed query is untouched.
 *
 * `totalCount` is a real COUNT rather than `posts.like_count`: it's the number
 * backing *this* list, so a drifted counter can't render "5 likes" above six
 * rows. The don't-COUNT-post_likes rule on the schema is about the feed, which
 * fans out across many posts; one post is a plain index scan.
 */
export const likers = publicProcedure.input(postLikersQuerySchema).query(async ({ input, ctx }) => {
  const { postId, limit, offset } = input;
  const viewerId = ctx.session?.user?.id ?? null;

  const [likeRows, countRows, post] = await Promise.all([
    db
      .select({ userId: postLikes.userId })
      .from(postLikes)
      .where(eq(postLikes.postId, postId))
      .orderBy(desc(postLikes.createdAt))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId)),
    db.query.posts.findFirst({ where: eq(posts.id, postId) }),
  ]);

  if (!post || post.deletedAt) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
  }

  const hasNextPage = likeRows.length > limit;
  const page = hasNextPage ? likeRows.slice(0, limit) : likeRows;

  // Same batched author resolution the feed uses (artist → venue → user), so a
  // page of likers costs a fixed number of queries regardless of page size.
  const authors = await hydrateAuthors(
    page.map((r) => r.userId),
    viewerId
  );

  return {
    likers: page.map(
      (r) =>
        authors.get(r.userId) ?? {
          id: r.userId,
          displayName: 'Unknown',
          profileImageUrl: null,
          profileType: 'user' as const,
          isFollowedByMe: false,
        }
    ),
    totalCount: countRows[0]?.count ?? 0,
    hasNextPage,
  };
});
