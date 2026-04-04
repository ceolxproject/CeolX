import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles } from '@CeolX/db/schema/users';
import { createArtistOnboardingSchema } from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

export const onboardingRouter = router({
  /**
   * Creates an artist profile after the user selects the artist persona.
   * Called once from the artist-onboarding screen after email verification.
   * Idempotent guard: throws CONFLICT if a profile already exists.
   */
  createArtistProfile: protectedProcedure
    .input(createArtistOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [userRow] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

      if (!userRow || userRow.currentRole !== 'artist') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only users with the artist role can create an artist profile',
        });
      }

      const [existing] = await db
        .select({ id: artistProfiles.id })
        .from(artistProfiles)
        .where(eq(artistProfiles.userId, userId))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Artist profile already exists for this user',
        });
      }

      // Strip empty strings from social links before storing
      const rawLinks = input.socialLinks ?? {};
      const cleanedLinks = Object.fromEntries(
        Object.entries(rawLinks).filter(([, v]) => v && v.length > 0)
      ) as Record<string, string>;

      await db.insert(artistProfiles).values({
        userId,
        stageName: input.stageName,
        bio: input.bio ?? null,
        contactEmail: input.contactEmail ?? null,
        genre: null,
        links: Object.keys(cleanedLinks).length > 0 ? cleanedLinks : null,
        isActive: true,
      });

      return { ok: true };
    }),
});
