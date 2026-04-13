import { z } from 'zod';

import { db } from '@CeolX/db';
import { venueProfiles } from '@CeolX/db/schema/users';

import { publicProcedure, router, venueProcedure } from '../index';

export const venuesRouter = router({
  /** List registered venues — used by artists when picking a performance venue.
   *  Returns all venues that have a name and address set, regardless of
   *  subscription status (subscription controls *profile visibility*, not
   *  whether a venue can be referenced in an event). */
  list: publicProcedure.query(async () => {
    const rows = await db
      .select({
        id: venueProfiles.id,
        name: venueProfiles.venueName,
        address: venueProfiles.address,
      })
      .from(venueProfiles)
      .orderBy(venueProfiles.venueName);
    return rows;
  }),

  // TODO M6-T2: subscription-gated — returns 404 if subscription_status != 'active'
  // (exception: venue owner viewing their own profile always sees it)
  byId: publicProcedure.input(z.object({ id: z.string() })).query(() => {
    return { message: 'not implemented' };
  }),

  // TODO M6-T2: update authenticated venue's own profile (venue role only)
  updateMe: venueProcedure
    .input(
      z.object({
        name: z.string().min(1).max(150).optional(),
        description: z.string().max(2000).optional(),
        address: z.string().max(255).optional(),
        county: z.string().optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        profileImageUrl: z.url().optional(),
        coverImageUrl: z.url().optional(),
        websiteUrl: z.url().optional(),
        phone: z.string().optional(),
        socialLinks: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(() => {
      return { message: 'not implemented' };
    }),
});
