import { z } from 'zod';

import { EVENT_CATEGORIES } from '../enums.js';

export const createEventSchema = z
  .object({
    title: z.string().min(3).max(120).trim(),
    description: z.string().min(10).max(2000).trim(),
    coverImage: z.string().url().optional(),
    dateStart: z.string().datetime(),
    dateEnd: z.string().datetime().optional(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    venueId: z.string().uuid().optional(),
    venueAddress: z.string().max(200).optional(),
    category: z.enum(EVENT_CATEGORIES),
    ticketLink: z.string().url().optional(),
    isGigOpportunity: z.boolean().default(false),
  })
  .refine((data) => data.venueId !== undefined || data.venueAddress !== undefined, {
    message: 'Either venueId or venueAddress is required',
    path: ['venueId'],
  });

export const updateEventSchema = z.object({
  title: z.string().min(3).max(120).trim().optional(),
  description: z.string().min(10).max(2000).trim().optional(),
  coverImage: z.string().url().optional(),
  dateStart: z.string().datetime().optional(),
  dateEnd: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  venueId: z.string().uuid().optional(),
  venueAddress: z.string().max(200).optional(),
  category: z.enum(EVENT_CATEGORIES).optional(),
  ticketLink: z.string().url().optional(),
});

export const rejectEventSchema = z.object({
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500),
});

export const feedQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  category: z.enum(EVENT_CATEGORIES).optional(),
  query: z.string().max(100).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RejectEventInput = z.infer<typeof rejectEventSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
