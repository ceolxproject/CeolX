import { z } from 'zod';

import { creatorProcedure, protectedProcedure, publicProcedure, router } from '../index';
import { typesenseClient } from '../lib/typesense';

const MapQueryInput = z.object({
  swLat: z.number(),
  swLng: z.number(),
  neLat: z.number(),
  neLng: z.number(),
  limit: z.number().int().min(1).max(50).default(50),
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
  getMap: publicProcedure.input(MapQueryInput).query(async ({ input }) => {
    const { swLat, swLng, neLat, neLng, limit } = input;
    const centerLat = (swLat + neLat) / 2;
    const centerLng = (swLng + neLng) / 2;
    const nowUnix = Math.floor(Date.now() / 1000);

    const result = await typesenseClient
      .collections('events')
      .documents()
      .search({
        q: '*',
        query_by: 'title',
        filter_by:
          `location:(${swLat},${swLng}, ${swLat},${neLng}, ${neLat},${neLng}, ${neLat},${swLng})` +
          ` && date_start:>=${nowUnix}`,
        sort_by: `location(${centerLat},${centerLng}):asc`,
        per_page: limit,
      });

    const events = (result.hits ?? []).map((hit) => {
      const doc = hit.document as Record<string, unknown>;
      return {
        id: doc['id'] as string,
        title: doc['title'] as string,
        lat: (doc['location'] as number[])[0],
        lng: (doc['location'] as number[])[1],
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
