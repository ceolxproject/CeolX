import { z } from 'zod';

import { BOOKING_DIRECTIONS, BOOKING_STATUSES } from '../enums.js';

// --- Booking creation (venue adds collaborator → booking auto-created) ---

export const createBookingSchema = z.object({
  artistId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// --- Booking status update (accept / reject / withdraw / cancel) ---

export const updateBookingSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['accepted', 'rejected', 'cancelled'] as const),
});

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

// --- Booking list query ---

export const listBookingsSchema = z.object({
  tab: z.enum(['sent', 'received']),
  status: z.enum(BOOKING_STATUSES).optional(),
  direction: z.enum(BOOKING_DIRECTIONS).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListBookingsInput = z.infer<typeof listBookingsSchema>;

// --- Artist search (used in collaborator field) ---

export const searchArtistsSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(20).default(10),
});

export type SearchArtistsInput = z.infer<typeof searchArtistsSchema>;

// --- Invite non-platform artist ---

export const inviteExternalArtistSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1).max(150).trim(),
  email: z.string().email(),
});

export type InviteExternalArtistInput = z.infer<typeof inviteExternalArtistSchema>;
