import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { postLikes, posts } from '@CeolX/db/schema/social';
import { togglePostLikeSchema } from '@CeolX/shared/validators';

import { protectedProcedure } from '../../index';

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
        await tx.delete(postLikes).where(eq(postLikes.id, existing.id));
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
