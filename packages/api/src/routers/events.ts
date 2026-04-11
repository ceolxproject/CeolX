import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { eventCollaborators, events, savedEvents } from '@CeolX/db/schema/events';
import { follows } from '@CeolX/db/schema/social';
import { createEventSchema, feedQuerySchema, updateEventSchema } from '@CeolX/shared/validators';

import { creatorProcedure, protectedProcedure, publicProcedure, router } from '../index';
import { rankFeedEvents, type RawFeedEvent } from '../lib/feed-ranking';
import { typesenseClient } from '../lib/typesense';
import { syncEventToTypesense, removeEventFromTypesense } from '../services/event-sync';

const MapQueryInput = z.object({
  swLat: z.number(),
  swLng: z.number(),
  neLat: z.number(),
  neLng: z.number(),
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(50),
  category: z.string().optional(),
  county: z.string().optional(),
  dateRange: z.enum(['today', 'this_week', 'this_weekend', 'this_month']).optional(),
});

export const eventsRouter = router({
  getMap: publicProcedure.input(MapQueryInput).query(async ({ input, ctx }) => {
    const { swLat, swLng, neLat, neLng, query, limit, category, county, dateRange } = input;
    const centerLat = (swLat + neLat) / 2;
    const centerLng = (swLng + neLng) / 2;
    const nowUnix = Math.floor(Date.now() / 1000);

    // Gig opportunity posts are visible to Artists only per PRD.
    const isArtist = ctx.session?.user?.currentRole === 'artist';
    const gigFilter = isArtist ? '' : ' && is_gig_opportunity:=false';

    // Category filter
    const categoryFilter = category ? ` && category:=${category}` : '';

    // County filter — matches against venue_address field
    const countyFilter = county ? ` && venue_address:${county}` : '';

    // Date range filter — compute unix timestamp bounds
    let dateFilter = ` && date_start:>=${nowUnix}`;
    if (dateRange) {
      const now = new Date();
      let rangeStart: Date;
      let rangeEnd: Date;

      switch (dateRange) {
        case 'today':
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'this_week': {
          const dayOfWeek = now.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
          rangeEnd = new Date(
            rangeStart.getFullYear(),
            rangeStart.getMonth(),
            rangeStart.getDate() + 7
          );
          break;
        }
        case 'this_weekend': {
          const day = now.getDay();
          const satOffset = day === 0 ? -1 : 6 - day;
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + satOffset);
          rangeEnd = new Date(
            rangeStart.getFullYear(),
            rangeStart.getMonth(),
            rangeStart.getDate() + 2
          );
          break;
        }
        case 'this_month':
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
          rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
      }

      const startUnix = Math.max(Math.floor(rangeStart.getTime() / 1000), nowUnix);
      const endUnix = Math.floor(rangeEnd.getTime() / 1000);
      dateFilter = ` && date_start:>=${startUnix} && date_start:<${endUnix}`;
    }

    const searchQuery = query?.trim() || '*';

    try {
      const result = await typesenseClient
        .collections('events')
        .documents()
        .search({
          q: searchQuery,
          query_by: 'title,category,venue_address',
          filter_by:
            `location:(${swLat},${swLng},${swLat},${neLng},${neLat},${neLng},${neLat},${swLng})` +
            dateFilter +
            ` && status:=active` +
            gigFilter +
            categoryFilter +
            countyFilter,
          sort_by:
            searchQuery === '*'
              ? `location(${centerLat},${centerLng}):asc`
              : `_text_match:desc,location(${centerLat},${centerLng}):asc`,
          per_page: limit,
        });

      const events = (result.hits ?? []).map((hit) => {
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
          venueAddress: (doc['venue_address'] as string) || undefined,
          coverImageUrl: (doc['cover_image'] as string) || undefined,
          isGigOpportunity: (doc['is_gig_opportunity'] as boolean) ?? false,
          distanceMeters: hit.geo_distance_meters?.location,
        };
      });

      return { events, totalCount: result.found ?? 0 };
    } catch (err) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to search events',
        cause: err,
      });
    }
  }),

  // Algorithmic feed: ranked by 40% recency + 40% proximity + 20% social.
  // Event data is sourced from Typesense; only user-specific social context
  // (follows, saved events) still comes from Postgres.
  getFeed: publicProcedure.input(feedQuerySchema).query(async ({ input, ctx }) => {
    const { lat, lng, limit, offset, category, query, dateRange } = input;
    const userId = ctx.session?.user?.id ?? null;
    const isArtist = ctx.session?.user?.currentRole === 'artist';
    const nowUnix = Math.floor(Date.now() / 1000);

    // Gig opportunity posts are visible to Artists only per PRD.
    const gigFilter = isArtist ? '' : ' && is_gig_opportunity:=false';
    const categoryFilter = category ? ` && category:=${category}` : '';
    const searchQuery = query?.trim() || '*';

    // Date range filter — same logic as getMap
    let dateFilter = ` && date_start:>=${nowUnix}`;
    if (dateRange) {
      const now = new Date();
      let rangeStart: Date = now;
      let rangeEnd: Date = now;
      switch (dateRange) {
        case 'today':
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'this_week': {
          const dayOfWeek = now.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
          rangeEnd = new Date(
            rangeStart.getFullYear(),
            rangeStart.getMonth(),
            rangeStart.getDate() + 7
          );
          break;
        }
        case 'this_weekend': {
          const day = now.getDay();
          const satOffset = day === 0 ? -1 : 6 - day;
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + satOffset);
          rangeEnd = new Date(
            rangeStart.getFullYear(),
            rangeStart.getMonth(),
            rangeStart.getDate() + 2
          );
          break;
        }
        case 'this_month':
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
          rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
      }
      const startUnix = Math.max(Math.floor(rangeStart.getTime() / 1000), nowUnix);
      const endUnix = Math.floor(rangeEnd.getTime() / 1000);
      dateFilter = ` && date_start:>=${startUnix} && date_start:<${endUnix}`;
    }

    try {
      // --- Fetch events from Typesense + user social context in parallel ---
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

      // --- Map Typesense hits to RawFeedEvent shape ---
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

      // --- Rank and paginate ---
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
  }),

  create: creatorProcedure.input(createEventSchema).mutation(async ({ input, ctx }) => {
    // Only venues can create gig opportunities
    if (input.isGigOpportunity && ctx.session.user.currentRole !== 'venue') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only venues can create gig opportunities',
      });
    }

    const { collaborators, ...eventData } = input;

    const event = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(events)
        .values({
          title: eventData.title,
          description: eventData.description,
          coverImage: eventData.coverImage ?? null,
          dateStart: new Date(eventData.dateStart),
          dateEnd: eventData.dateEnd ? new Date(eventData.dateEnd) : null,
          lat: eventData.lat?.toString() ?? '0',
          lng: eventData.lng?.toString() ?? '0',
          venueId: eventData.venueId ?? null,
          venueAddress: eventData.venueAddress ?? null,
          category: eventData.category,
          ticketLink: eventData.ticketLink ?? null,
          ticketPrice: eventData.ticketPrice ?? null,
          isGigOpportunity: eventData.isGigOpportunity,
          collectionId: eventData.collectionId ?? null,
          adTitle: eventData.adTitle ?? null,
          adDescription: eventData.adDescription ?? null,
          createdBy: ctx.userId,
          status: 'active',
        })
        .returning();

      const inserted = rows[0];
      if (!inserted)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });

      if (collaborators && collaborators.length > 0) {
        await tx.insert(eventCollaborators).values(
          collaborators.map((artistId) => ({
            eventId: inserted.id,
            artistProfileId: artistId,
          }))
        );
      }

      return inserted;
    });

    // Sync to Typesense so event appears on map/feed immediately
    await syncEventToTypesense(event).catch(() => {
      // Non-blocking — event is in DB, Typesense sync can be retried
    });

    return event;
  }),

  byId: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
      with: { collaborators: true },
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Archived events only visible to the creator
    if (event.status === 'archived' && event.createdBy !== ctx.session?.user?.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    return event;
  }),

  update: protectedProcedure.input(updateEventSchema).mutation(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own events' });
    }

    if (event.status === 'archived') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot edit an archived event',
      });
    }

    // Only venues can set gig opportunity flag
    if (input.data.isGigOpportunity && ctx.session.user.currentRole !== 'venue') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only venues can create gig opportunities',
      });
    }

    const { collaborators, ...updateData } = input.data;

    const updated = await db.transaction(async (tx) => {
      // Build the update object — only set provided fields
      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updateData.title !== undefined) setValues.title = updateData.title;
      if (updateData.description !== undefined) setValues.description = updateData.description;
      if (updateData.coverImage !== undefined) setValues.coverImage = updateData.coverImage;
      if (updateData.dateStart !== undefined) setValues.dateStart = new Date(updateData.dateStart);
      if (updateData.dateEnd !== undefined) setValues.dateEnd = new Date(updateData.dateEnd);
      if (updateData.lat !== undefined) setValues.lat = updateData.lat.toString();
      if (updateData.lng !== undefined) setValues.lng = updateData.lng.toString();
      if (updateData.venueId !== undefined) setValues.venueId = updateData.venueId;
      if (updateData.venueAddress !== undefined) setValues.venueAddress = updateData.venueAddress;
      if (updateData.category !== undefined) setValues.category = updateData.category;
      if (updateData.ticketLink !== undefined) setValues.ticketLink = updateData.ticketLink;
      if (updateData.ticketPrice !== undefined) setValues.ticketPrice = updateData.ticketPrice;
      if (updateData.isGigOpportunity !== undefined)
        setValues.isGigOpportunity = updateData.isGigOpportunity;
      if (updateData.collectionId !== undefined) setValues.collectionId = updateData.collectionId;
      if (updateData.adTitle !== undefined) setValues.adTitle = updateData.adTitle;
      if (updateData.adDescription !== undefined)
        setValues.adDescription = updateData.adDescription;

      // If event was removed by admin and creator is resubmitting, re-activate
      if (event.status === 'removed') {
        setValues.status = 'active';
        setValues.removalReason = null;
      }

      const rows = await tx
        .update(events)
        .set(setValues)
        .where(eq(events.id, input.id))
        .returning();

      const result = rows[0];
      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

      // Replace collaborators if provided
      if (collaborators !== undefined) {
        await tx.delete(eventCollaborators).where(eq(eventCollaborators.eventId, input.id));
        if (collaborators.length > 0) {
          await tx.insert(eventCollaborators).values(
            collaborators.map((artistId) => ({
              eventId: input.id,
              artistProfileId: artistId,
            }))
          );
        }
      }

      return result;
    });

    // Sync to Typesense if event is active
    if (updated.status === 'active') {
      await syncEventToTypesense(updated).catch(() => {});
    } else {
      await removeEventFromTypesense(updated.id).catch(() => {});
    }

    return updated;
  }),

  // Save event to current user's saved list (idempotent via ON CONFLICT DO NOTHING)
  save: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .insert(savedEvents)
        .values({ userId: ctx.userId, eventId: input.id })
        .onConflictDoNothing({ target: [savedEvents.userId, savedEvents.eventId] });
      return { saved: true };
    }),

  // Remove event from current user's saved list
  unsave: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(savedEvents)
        .where(and(eq(savedEvents.userId, ctx.userId), eq(savedEvents.eventId, input.id)));
      return { saved: false };
    }),

  // Presigned S3 URL — stub until M10-T1 wires S3 integration
  getPresignedUrl: protectedProcedure
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .query(() => {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Image upload not yet configured — complete M10-T1 first',
      });
    }),
});
