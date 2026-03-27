import { z } from 'zod';

import { protectedProcedure, router } from '../index';

export const bookingsRouter = router({
  // TODO M5-T1 (venue-initiated) / M5-T2 (artist-initiated)
  create: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        artistId: z.string().min(1),
        direction: z.enum(['venue_to_artist', 'artist_to_venue']),
        message: z.string().optional(),
      })
    )
    .mutation(() => {
      return { message: 'not implemented' };
    }),

  // TODO M5-T3: accept / reject / cancel a booking (role-aware state machine)
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['accepted', 'rejected', 'cancelled']),
      })
    )
    .mutation(() => {
      return { message: 'not implemented' };
    }),

  // TODO M5-T1 / M5-T2: list bookings for the current user's active persona
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['pending', 'accepted', 'rejected', 'cancelled']).optional(),
          direction: z.enum(['venue_to_artist', 'artist_to_venue']).optional(),
        })
        .optional()
    )
    .query(() => {
      return { bookings: [] };
    }),
});
