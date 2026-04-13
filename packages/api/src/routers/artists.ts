import { eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles } from '@CeolX/db/schema/users';

import { artistProcedure, publicProcedure, router } from '../index';

export const artistsRouter = router({
  // Search active artist profiles by stage name — used by CollaboratorPicker / InviteArtistPicker
  search: publicProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const results = await db
        .select({
          id: artistProfiles.userId,
          stageName: artistProfiles.stageName,
          genre: artistProfiles.genre,
          image: user.image,
        })
        .from(artistProfiles)
        .innerJoin(user, eq(artistProfiles.userId, user.id))
        .where(ilike(artistProfiles.stageName, `%${input.q}%`))
        .limit(10);

      return { artists: results };
    }),

  // TODO M6-T1: fetch artist public profile by id (returns 404 if is_active = false)
  byId: publicProcedure.input(z.object({ id: z.string() })).query(() => {
    return { message: 'not implemented' };
  }),

  // TODO M6-T1: update authenticated artist's own profile (artist role only)
  updateMe: artistProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        bio: z.string().max(2000).optional(),
        genres: z.array(z.string()).optional(),
        location: z.string().optional(),
        profileImageUrl: z.url().optional(),
        coverImageUrl: z.url().optional(),
        socialLinks: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(() => {
      return { message: 'not implemented' };
    }),
});
