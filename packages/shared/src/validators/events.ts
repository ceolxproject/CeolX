import { z } from 'zod';

import { EVENT_CATEGORIES } from '../enums.js';
import { isValidCoordinate } from '../utils/geo.js';

// Field length limits (characters). Exported so the mobile UI caps inputs with
// the exact same numbers used for validation — a TextInput's `maxLength` must
// equal the matching constant so the schema and the UI can never drift.
export const EVENT_TITLE_MAX = 150;
export const EVENT_DESCRIPTION_MAX = 2000;
export const AD_TITLE_MAX = 100;
export const AD_DESCRIPTION_MAX = 50;
// Off-platform (unregistered) invitee name cap, surfaced in the Invite Artist form.
export const UNREGISTERED_COLLABORATOR_NAME_MAX = 100;

// Base shape — used for both create and update schemas
const eventBaseShape = {
  title: z.string().min(3, 'Title must be at least 3 characters').max(EVENT_TITLE_MAX).trim(),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(EVENT_DESCRIPTION_MAX)
    .trim(),
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
  // Confirmed collaborators are no longer set at create/edit time. A venue
  // performer becomes confirmed only by accepting a pending invite (see
  // platformInvites) through the booking flow — there is no direct collaborator.
  platformInvites: z.array(z.string().min(1)).max(10).optional(),
  unregisteredCollaborators: z
    .array(
      z.object({
        name: z.string().min(1).max(UNREGISTERED_COLLABORATOR_NAME_MAX).trim(),
        email: z.string().email(),
        // Optional avatar for off-platform invitees, uploaded by the event
        // creator (CDN url). Falls back to the placeholder image when absent.
        imageUrl: z.string().url().optional(),
      })
    )
    .max(10)
    .optional(),
  adTitle: z.string().max(AD_TITLE_MAX).optional(),
  adDescription: z.string().max(AD_DESCRIPTION_MAX).optional(),
} as const;

export const createEventSchema = z
  .object(eventBaseShape)
  // Map and feed are coordinate-driven (Typesense geopoint), so every event
  // needs a real pin. Either the client supplies valid lat/lng directly, or it
  // picks a registered venue (venueId) whose stored coordinates the server
  // inherits. A free-text venueAddress alone is only a display label — it
  // cannot place an event on the map, so it does not satisfy this requirement.
  // isValidCoordinate rejects null-island (0,0) — the value a failed geocode
  // used to leave behind, which produced saved-but-invisible events.
  .refine((data) => isValidCoordinate(data.lat, data.lng) || data.venueId !== undefined, {
    message: 'A location pin or a registered venue is required',
    path: ['lat'],
  })
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
  createdBy: z.string().optional(),
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
  // A specific calendar day picked from the feed's calendar button, sent as an
  // absolute [dayStart, dayEnd) window in Unix seconds. The client derives these
  // from the *device-local* day, so filtering matches the day the user actually
  // tapped regardless of the server's timezone (the server runs in UTC). Both
  // bounds are sent together or not at all.
  dayStart: z.number().int().optional(),
  dayEnd: z.number().int().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type RemoveEventInput = z.infer<typeof removeEventSchema>;
export type AdminEventListQueryInput = z.infer<typeof adminEventListQuerySchema>;
export type AdminRemoveEventInput = z.infer<typeof adminRemoveEventSchema>;
export type AdminRestoreEventInput = z.infer<typeof adminRestoreEventSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
