import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { postLikes, posts } from '@CeolX/db/schema/social';
import { EventStatus } from '@CeolX/shared';
import { postLikersQuerySchema, togglePostLikeSchema } from '@CeolX/shared/validators';

import { protectedProcedure } from '../../index';
import { isPromoEventExpired } from '../../services/promo-post';

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
        // Re-read rather than echoing the pre-transaction `post`: the request
        // that won the race has already decremented, so the row we loaded before
        // the transaction is one too high.
        if (deleted.length === 0) {
          const [current] = await tx
            .select({ likeCount: posts.likeCount })
            .from(posts)
            .where(eq(posts.id, postId));
          return { liked: false, likeCount: current?.likeCount ?? 0 };
        }
        const [updated] = await tx
          .update(posts)
          .set({ likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount });
        return { liked: false, likeCount: updated?.likeCount ?? 0 };
      }

      // Mirror of the unlike race: two concurrent likes both miss `existing`,
      // and the loser would hit post_likes_post_user_idx and 500. Skip the row
      // it lost, and skip the increment the winner already made.
      const inserted = await tx
        .insert(postLikes)
        .values({ postId, userId })
        .onConflictDoNothing()
        .returning({ id: postLikes.id });
      if (inserted.length === 0) {
        const [current] = await tx
          .select({ likeCount: posts.likeCount })
          .from(posts)
          .where(eq(posts.id, postId));
        return { liked: true, likeCount: current?.likeCount ?? 0 };
      }
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
 * Protected, NOT public. This is the only read that resolves display names for
 * arbitrary users rather than post creators, and Spectators have no public
 * profile by product rule — serving their name and avatar to unauthenticated
 * callers would expose identities the rest of the app never does. `getFollowers`
 * is protected for the same reason.
 *
 * `post_likes_post_user_idx` serves the `post_id =` filter, but NOT the
 * `created_at DESC, id DESC` sort — Postgres scans the post's like rows and
 * sorts them on every page. Fine while posts have hundreds of likes; a post in
 * the tens of thousands wants a `(post_id, created_at DESC, id DESC)` index,
 * which is also the point at which offset paging should become a keyset cursor.
 * The feed query is untouched either way.
 *
 * `totalCount` is a real COUNT rather than `posts.like_count`: it's the number
 * backing *this* list, so a drifted counter can't render "5 likes" above six
 * rows. It's null past the first page — the client only ever displays page
 * zero's, so re-counting per page is pure work. The don't-COUNT-post_likes rule
 * on the schema is about the feed, which fans out across many posts; one post is
 * a plain index scan.
 */
export const likers = protectedProcedure
  .input(postLikersQuerySchema)
  .query(async ({ input, ctx }) => {
    const { postId, limit, offset } = input;

    const [likeRows, countRows, postRows] = await Promise.all([
      db
        .select({ userId: postLikes.userId })
        .from(postLikes)
        .where(eq(postLikes.postId, postId))
        // id breaks ties: bulk likes can share a created_at to the microsecond,
        // and an unstable sort makes OFFSET paging skip rows between pages.
        .orderBy(desc(postLikes.createdAt), desc(postLikes.id))
        .limit(limit + 1)
        .offset(offset),
      offset === 0
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(postLikes)
            .where(eq(postLikes.postId, postId))
        : Promise.resolve(null),
      db
        .select({
          createdBy: posts.createdBy,
          eventId: posts.eventId,
          eventStatus: events.status,
          eventDateStart: events.dateStart,
          eventDateEnd: events.dateEnd,
        })
        .from(posts)
        .leftJoin(events, eq(events.id, posts.eventId))
        .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
        .limit(1),
    ]);

    // Promo-post visibility, evaluated the way `byUser` does rather than `byId`:
    // expiry is waived for the creator, because their own ended promo posts stay
    // on their profile (crud.ts `promoVisible(isOwner)`). A non-ACTIVE event is
    // hidden from everyone, owner included.
    const post = postRows[0];
    if (!post) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
    }
    if (post.eventId) {
      const isOwner = post.createdBy === ctx.userId;
      const expired =
        post.eventDateStart !== null &&
        isPromoEventExpired({ dateStart: post.eventDateStart, dateEnd: post.eventDateEnd });
      if (post.eventStatus !== EventStatus.ACTIVE || (expired && !isOwner)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }
    }

    const hasNextPage = likeRows.length > limit;
    const page = hasNextPage ? likeRows.slice(0, limit) : likeRows;

    // Same batched author resolution the feed uses (artist → venue → user), so a
    // page of likers costs a fixed number of queries regardless of page size.
    // No viewerId: the sheet renders no follow CTA, and passing one buys an extra
    // `follows` query per page. `isFollowedByMe` is dropped rather than returned
    // as a hardcoded false nobody can distinguish from a real answer.
    const authors = await hydrateAuthors(page.map((r) => r.userId));

    return {
      likers: page.map((r) => {
        const author = authors.get(r.userId);
        return {
          id: r.userId,
          displayName: author?.displayName ?? 'Unknown',
          profileImageUrl: author?.profileImageUrl ?? null,
          profileType: author?.profileType ?? ('user' as const),
        };
      }),
      totalCount: countRows ? (countRows[0]?.count ?? 0) : null,
      hasNextPage,
    };
  });
