import { z } from 'zod';

import { artistProcedure, publicProcedure, router } from '../index';

export const artistsRouter = router({
  // TODO M3-T3: full-text search across artist profiles
  search: publicProcedure.input(z.object({ q: z.string().min(1) })).query(() => {
    return { artists: [] };
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
