import {
  and,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { events } from '@CeolX/db/schema/events';
import { postLikes, posts } from '@CeolX/db/schema/social';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { postFeedQuerySchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';
import { promoVisible } from '../../services/promo-post';

import { hydrateAuthors } from './hydrate';

/**
 * Build the optional caption/author search predicate for the feed.
 *
 * Posts have no music/event entity to search, so a query matches the post
 * caption OR the author's display name. Author names live in three tables, so we
 * first resolve the set of matching author ids (artist stage name → venue name →
 * user name, the same precedence `hydrateAuthors` uses), then OR that against a
 * caption match. Returns `undefined` when there is no query, leaving the feed
 * unfiltered.
 */
async function buildSearchFilter(query: string | undefined): Promise<SQL | undefined> {
  if (!query) return undefined;
  const term = `%${query}%`;

  const [artistRows, venueRows, userRows] = await Promise.all([
    db
      .select({ id: artistProfiles.userId })
      .from(artistProfiles)
      .where(ilike(artistProfiles.stageName, term)),
    db
      .select({ id: venueProfiles.userId })
      .from(venueProfiles)
      .where(ilike(venueProfiles.venueName, term)),
    db.select({ id: user.id }).from(user).where(ilike(user.name, term)),
  ]);

  const authorIds = Array.from(
    new Set([...artistRows, ...venueRows, ...userRows].map((r) => r.id))
  );

  const captionMatch = ilike(posts.caption, term);
  return authorIds.length > 0
    ? or(captionMatch, inArray(posts.createdBy, authorIds))
    : captionMatch;
}

export const feed = publicProcedure.input(postFeedQuerySchema).query(async ({ input, ctx }) => {
  const { limit, offset, query } = input;
  // Posts are public: guests ("Skip sign-in") browse the feed with no session.
  // A null viewer skips the per-viewer follow/like lookups and leaves
  // isFollowedByMe / likedByMe false. (Asana 1216227543475896)
  const viewerId = ctx.session?.user?.id ?? null;

  const searchFilter = await buildSearchFilter(query);
  // Hide promo posts whose event isn't live/upcoming — read-time backstop to the
  // deleted_at toggle, plus expiry, via the events join. Non-promo posts are
  // unaffected. `and` drops undefined, so no-query still filters correctly.
  const where = and(isNull(posts.deletedAt), promoVisible(), searchFilter);

  const [rows, countRow] = await Promise.all([
    db
      .select(getTableColumns(posts))
      .from(posts)
      .leftJoin(events, eq(events.id, posts.eventId))
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .leftJoin(events, eq(events.id, posts.eventId))
      .where(where),
  ]);

  const totalCount = countRow[0]?.count ?? 0;
  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;

  const [authors, likedRows] = await Promise.all([
    hydrateAuthors(
      page.map((p) => p.createdBy),
      viewerId
    ),
    viewerId && page.length > 0
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
        isFollowedByMe: false,
      },
      likedByMe: likedSet.has(p.id),
    })),
    totalCount,
    hasNextPage,
  };
});
