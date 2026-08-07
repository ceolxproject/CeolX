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
  // Required on create; updateEventSchema wraps eventBaseShape in .partial(),
  // so existing events without one can still be edited without re-uploading.
  coverImage: z.string().url(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // Nullable for the same reason as ticketLink below: switching an event from a
  // registered venue to a free-text address must be able to clear the link. An
  // undefined is dropped over the wire and read as "leave unchanged", which left
  // the event held at pending_review for a venue the creator had backed out of.
  venueId: z.string().uuid().optional().nullable(),
  venueAddress: z.string().max(255).optional(),
  category: z.enum(EVENT_CATEGORIES),
  // `null` is the explicit "clear this field" signal sent on edit — it must
  // survive validation so the server can write NULL. `.optional()` alone would
  // strip an undefined and reject a null, silently dropping the clear.
  ticketLink: z.string().url().optional().nullable(),
  ticketPrice: z.number().int().min(0).optional().nullable(),
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
  adTitle: z.string().max(AD_TITLE_MAX).optional().nullable(),
  adDescription: z.string().max(AD_DESCRIPTION_MAX).optional().nullable(),
} as const;

export const createEventSchema = z
  .object({
    ...eventBaseShape,
    // Opt-in (default on): also publish a promo post to the social feed. Create-only
    // — deliberately not in eventBaseShape so it never leaks into updateEventSchema.
    shareToFeed: z.boolean().default(true),
  })
  // Map and feed are coordinate-driven (Typesense geopoint), so every event
  // needs a real pin. Either the client supplies valid lat/lng directly, or it
  // picks a registered venue (venueId) whose stored coordinates the server
  // inherits. A free-text venueAddress alone is only a display label — it
  // cannot place an event on the map, so it does not satisfy this requirement.
  // isValidCoordinate rejects null-island (0,0) — the value a failed geocode
  // used to leave behind, which produced saved-but-invisible events.
  // venueId is nullable now, and an explicit null means "no registered venue" —
  // it must not satisfy the location requirement the way a real venue does.
  .refine(
    (data) =>
      isValidCoordinate(data.lat, data.lng) ||
      (data.venueId !== undefined && data.venueId !== null),
    {
      message: 'A location pin or a registered venue is required',
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

// yyyy-mm-dd AND a real calendar date (rejects 2026-13-45 etc.). Avoids relying
// on z.string().date() so it works across Zod versions.
const yyyyMmDd = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), {
    message: 'Date must be a valid yyyy-mm-dd',
  });

export const adminEventListQuerySchema = z.object({
  // Omit to list every moderation status (the "All" tab); otherwise narrows to one.
  status: z.enum(['active', 'removed', 'archived', 'resubmitted']).optional(),
  persona: z.enum(['artist', 'venue']).optional(),
  // Free-text search — matched server-side against title OR creator name OR
  // free-text venue address, so the moderator can find an event by what it's
  // called, who posted it, or where it's held.
  q: z.string().max(100).optional(),
  // Sweep one or more content types at once. Uses the finalised shared enum.
  category: z.array(z.enum(EVENT_CATEGORIES)).max(EVENT_CATEGORIES.length).optional(),
  // Submitted-date window (yyyy-mm-dd) — the "review since I last looked" filter.
  createdFrom: yyyyMmDd.optional(),
  createdTo: yyyyMmDd.optional(),
  sortBy: z.enum(['createdAt', 'dateStart', 'title']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
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
