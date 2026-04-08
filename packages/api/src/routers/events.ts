import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { creatorProcedure, protectedProcedure, publicProcedure, router } from '../index';
import { typesenseClient } from '../lib/typesense';

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

const CreateEventInput = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(5000).optional(),
  coverImage: z.url().optional(),
  dateStart: z.iso.datetime(),
  dateEnd: z.iso.datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  venueId: z.string().optional(),
  venueAddress: z.string().max(255).optional(),
  category: z.string().min(1),
  collaborators: z.array(z.string()).max(10).optional(),
  ticketLink: z.url().optional(),
  isGigOpportunity: z.boolean().default(false),
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

  // TODO M4-T1: create event (sets status = pending_review)
  create: creatorProcedure.input(CreateEventInput).mutation(() => {
    return { message: 'not implemented' };
  }),

  // TODO M4-T2: fetch single event by id (visibility rules apply)
  byId: publicProcedure.input(z.object({ id: z.string() })).query(() => {
    return { message: 'not implemented' };
  }),

  // TODO M4-T1: update event fields (creator only; blocked if status = active/archived)
  update: protectedProcedure
    .input(z.object({ id: z.string(), data: CreateEventInput.partial() }))
    .mutation(() => {
      return { message: 'not implemented' };
    }),

  // TODO M4-T2: save event to current user's saved list
  save: protectedProcedure.input(z.object({ id: z.string() })).mutation(() => {
    return { message: 'not implemented' };
  }),

  // TODO M4-T2: remove event from current user's saved list
  unsave: protectedProcedure.input(z.object({ id: z.string() })).mutation(() => {
    return { message: 'not implemented' };
  }),

  // TODO M4-T1 / M10-T1: generate presigned S3 URL for cover image direct upload
  getPresignedUrl: protectedProcedure
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .query(() => {
      return { message: 'not implemented' };
    }),
});
