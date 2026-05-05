import { z } from 'zod';

import { EVENT_CATEGORIES } from '../enums.js';

// Base shape — used for both create and update schemas
const eventBaseShape = {
  title: z.string().min(3, 'Title must be at least 3 characters').max(150).trim(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000).trim(),
  coverImage: z.string().url().optional(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  venueId: z.string().uuid().optional(),
  venueAddress: z.string().max(255).optional(),
  category: z.enum(EVENT_CATEGORIES),
  ticketLink: z.string().url().optional(),
  ticketPrice: z.number().int().min(0).optional(),
  collectionId: z.string().uuid().optional(),
  collaborators: z.array(z.string().min(1)).max(10).optional(),
  platformInvites: z.array(z.string().min(1)).max(10).optional(),
  unregisteredCollaborators: z
    .array(
      z.object({
        name: z.string().min(1).max(100).trim(),
        email: z.string().email(),
      })
    )
    .max(10)
    .optional(),
  adTitle: z.string().max(100).optional(),
  adDescription: z.string().max(50).optional(),
} as const;

export const createEventSchema = z
  .object(eventBaseShape)
  .refine(
    (data) => (data.lat !== undefined && data.lng !== undefined) || data.venueAddress !== undefined,
    {
      message: 'Either coordinates or venue address is required',
      path: ['lat'],
    }
  )
  .refine((data) => !data.dateEnd || data.dateEnd >= data.dateStart, {
    message: 'End date must be after start date',
    path: ['dateEnd'],
  });

export const updateEventSchema = z.object({
  id: z.string().uuid(),
  data: z.object(eventBaseShape).partial(),
});

export const removeEventSchema = z.object({
  removalReason: z.string().min(10, 'Removal reason must be at least 10 characters').max(500),
});

export const adminEventListQuerySchema = z.object({
  status: z.enum(['active', 'removed', 'archived']).default('active'),
  persona: z.enum(['artist', 'venue']).optional(),
  q: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const adminRemoveEventSchema = z.object({
  id: z.string().uuid(),
  removalReason: z.string().min(10, 'Removal reason must be at least 10 characters').max(500),
});

export const adminRestoreEventSchema = z.object({
  id: z.string().uuid(),
});

export const feedQuerySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  category: z.enum(EVENT_CATEGORIES).optional(),
  query: z.string().max(100).optional(),
  dateRange: z.enum(['today', 'this_week', 'this_weekend', 'this_month']).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RemoveEventInput = z.infer<typeof removeEventSchema>;
export type AdminEventListQueryInput = z.infer<typeof adminEventListQuerySchema>;
export type AdminRemoveEventInput = z.infer<typeof adminRemoveEventSchema>;
export type AdminRestoreEventInput = z.infer<typeof adminRestoreEventSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
