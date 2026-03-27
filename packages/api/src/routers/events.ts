import { z } from 'zod';

import { protectedProcedure, publicProcedure, router } from '../index';

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
  // TODO M3-T1: bounding-box query against events table (GIST index)
  getMap: publicProcedure.input(MapQueryInput).query(() => {
    return { events: [], totalCount: 0 };
  }),

  // TODO M4-T1: create event (sets status = pending_review)
  create: protectedProcedure.input(CreateEventInput).mutation(() => {
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
