import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { postLikes, posts } from '@CeolX/db/schema/social';
import { postFeedQuerySchema } from '@CeolX/shared/validators';

import { protectedProcedure } from '../../index';

import { hydrateAuthors } from './hydrate';

export const feed = protectedProcedure.input(postFeedQuerySchema).query(async ({ input, ctx }) => {
  const { limit, offset } = input;
  const viewerId = ctx.userId;

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(isNull(posts.deletedAt))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(isNull(posts.deletedAt)),
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const [authors, likedRows] = await Promise.all([
    hydrateAuthors(page.map((p) => p.createdBy)),
    page.length > 0
      ? db
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
          )
      : Promise.resolve<{ postId: string }[]>([]),
  ]);

  const likedSet = new Set(likedRows.map((r) => r.postId));

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
