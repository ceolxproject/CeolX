import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { collections, events, savedEvents } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { feedQuerySchema } from '@CeolX/shared/validators';

import { publicProcedure } from '../../index';
import { rankFeedEvents, type RawFeedEvent } from '../../lib/feed-ranking';
import { typesenseClient } from '../../lib/typesense';

import { buildDateFilter } from './helpers';

export const getFeed = publicProcedure.input(feedQuerySchema).query(async ({ input, ctx }) => {
  const { lat, lng, limit, offset, category, query, dayStart, dayEnd } = input;
  const userId = ctx.session?.user?.id ?? null;
  const nowUnix = Math.floor(Date.now() / 1000);

  const categoryFilter = category ? ` && category:=${category}` : '';
  const searchQuery = query?.trim() || '*';
  // A picked calendar day arrives as an absolute [start, end) window from the
  // client; only treat it as set when both bounds are present.
  const day =
    dayStart !== undefined && dayEnd !== undefined ? { start: dayStart, end: dayEnd } : undefined;
  const dateFilter = buildDateFilter(nowUnix, day);

  try {
    const [typesenseResult, followedIds, savedEventIds] = await Promise.all([
      typesenseClient
        .collections('events')
        .documents()
        .search({
          q: searchQuery,
          // creator_name is included so tapping an artist/venue name suggestion
          // (discovery.suggest) surfaces that creator's events, not just title hits.
          query_by: 'title,category,venue_address,venue_name,creator_name',
          // 100 km radius matches MAX_DISTANCE_KM in feed-ranking.ts
          filter_by:
            `location:(${lat},${lng},100 km)` + ` && status:=active` + dateFilter + categoryFilter,
          sort_by:
            searchQuery === '*'
              ? `location(${lat},${lng}):asc`
              : `_text_match:desc,location(${lat},${lng}):asc`,
          // Fetch a large batch so the in-memory ranker has enough signal.
          // 250 is Typesense's per_page ceiling.
          per_page: 250,
        })
        // Typesense Cloud outages (ENOTFOUND, connection refused, timeout) used to
        // fail the entire feed with a 500. Degrade to an empty result set instead
        // so the rest of the app keeps working; the warning surfaces the cause in
        // Vercel logs for ops to fix the cluster / env var.
        .catch((err: unknown) => {
          console.warn(
            '[events.getFeed] typesense unreachable, returning empty feed:',
            err instanceof Error ? `${err.name}: ${err.message}` : err
          );
          return { hits: [] };
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
        createdAt: new Date((doc['created_at'] as number) * 1000).toISOString(),
        creatorId: doc['creator_id'] as string,
        creatorName: (doc['creator_name'] as string) || 'Unknown',
        joinedCount: (doc['joined_count'] as number) ?? 0,
      };
    });

    const ranked = rankFeedEvents(rawEvents, lat, lng, followedIds);
    const paginated = ranked.slice(offset, offset + limit);

    // Fetch collection names for paginated events in a single query
    const eventIds = paginated.map((e) => e.id);
    const collectionNameMap =
      eventIds.length > 0
        ? await db
            .select({ eventId: events.id, collectionName: collections.name })
            .from(events)
            .innerJoin(collections, eq(events.collectionId, collections.id))
            .where(inArray(events.id, eventIds))
            .then((rows) => new Map(rows.map((r) => [r.eventId, r.collectionName])))
        : new Map<string, string>();

    return {
      events: paginated.map((e) => ({
        ...e,
        venueAddress: e.venueAddress ?? undefined,
        coverImageUrl: e.coverImageUrl ?? undefined,
        dateEnd: e.dateEnd ?? undefined,
        isSaved: savedEventIds.has(e.id),
        collectionName: collectionNameMap.get(e.id),
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
