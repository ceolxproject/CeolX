import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { savedEvents } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { feedQuerySchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';
import { rankFeedEvents, type RawFeedEvent } from '../../lib/feed-ranking';
import { typesenseClient } from '../../lib/typesense';

import { buildDateFilter } from './helpers';

export const getFeed = publicProcedure.input(feedQuerySchema).query(async ({ input, ctx }) => {
  const { lat, lng, limit, offset, category, query, dateRange } = input;
  const userId = ctx.session?.user?.id ?? null;
  const isArtist = ctx.session?.user?.currentRole === 'artist';
  const nowUnix = Math.floor(Date.now() / 1000);

  const gigFilter = isArtist ? '' : ' && is_gig_opportunity:=false';
  const categoryFilter = category ? ` && category:=${category}` : '';
  const searchQuery = query?.trim() || '*';
  const dateFilter = buildDateFilter(dateRange, nowUnix);

  try {
    const [typesenseResult, followedIds, savedEventIds] = await Promise.all([
      typesenseClient
        .collections('events')
        .documents()
        .search({
          q: searchQuery,
          query_by: 'title,category,venue_address',
          // 100 km radius matches MAX_DISTANCE_KM in feed-ranking.ts
          filter_by:
            `location:(${lat},${lng},100 km)` +
            ` && status:=active` +
            dateFilter +
            gigFilter +
            categoryFilter,
          sort_by:
            searchQuery === '*'
              ? `location(${lat},${lng}):asc`
              : `_text_match:desc,location(${lat},${lng}):asc`,
          // Fetch a large batch so the in-memory ranker has enough signal.
          // 250 is Typesense's per_page ceiling.
          per_page: 250,
        }),
      userId
        ? db
            .select({ followeeId: follows.followeeId })
            .from(follows)
            .where(eq(follows.followerId, userId))
            .then((rows) => new Set(rows.map((r) => r.followeeId)))
        : Promise.resolve(new Set<string>()),
      userId
        ? db
            .select({ eventId: savedEvents.eventId })
            .from(savedEvents)
            .where(eq(savedEvents.userId, userId))
            .then((rows) => new Set(rows.map((r) => r.eventId)))
        : Promise.resolve(new Set<string>()),
    ]);

    const rawEvents: RawFeedEvent[] = (typesenseResult.hits ?? []).map((hit) => {
      const doc = hit.document as Record<string, unknown>;
      const loc = doc['location'];
      return {
        id: doc['id'] as string,
        title: doc['title'] as string,
        lat: Array.isArray(loc) ? (loc[0] as number) : 0,
        lng: Array.isArray(loc) ? (loc[1] as number) : 0,
        category: doc['category'] as string,
        dateStart: new Date((doc['date_start'] as number) * 1000).toISOString(),
        dateEnd: doc['date_end']
          ? new Date((doc['date_end'] as number) * 1000).toISOString()
          : undefined,
        venueAddress: (doc['venue_address'] as string) || null,
        coverImageUrl: (doc['cover_image'] as string) || null,
        isGigOpportunity: (doc['is_gig_opportunity'] as boolean) ?? false,
        createdAt: new Date((doc['created_at'] as number) * 1000).toISOString(),
        creatorId: doc['creator_id'] as string,
        creatorName: (doc['creator_name'] as string) || 'Unknown',
        joinedCount: (doc['joined_count'] as number) ?? 0,
      };
    });

    const ranked = rankFeedEvents(rawEvents, lat, lng, followedIds);
    const paginated = ranked.slice(offset, offset + limit);

    return {
      events: paginated.map((e) => ({
        ...e,
        venueAddress: e.venueAddress ?? undefined,
        coverImageUrl: e.coverImageUrl ?? undefined,
        dateEnd: e.dateEnd ?? undefined,
        isSaved: savedEventIds.has(e.id),
      })),
      hasNextPage: offset + limit < ranked.length,
      totalCount: ranked.length,
    };
  } catch (err) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch feed',
      cause: err,
    });
  }
});
