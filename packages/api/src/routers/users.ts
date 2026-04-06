import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';

import { protectedProcedure, router } from '../index';

const completeRegistrationInput = z.object({
  currentRole: z.enum(['spectator', 'artist', 'venue']),
  marketingConsent: z.boolean(),
});

export const usersRouter = router({
  /**
   * Returns the authenticated user row (includes domain fields set at registration).
   * Falls back to null if consentAt is not yet set (registration not complete).
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        currentRole: user.currentRole,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) return null;

    // Determine whether onboarding is complete based on current role
    let onboardingComplete = true;
    if (row.currentRole === 'artist') {
      const [profile] = await db
        .select({ id: artistProfiles.id })
        .from(artistProfiles)
        .where(eq(artistProfiles.userId, userId))
        .limit(1);
      onboardingComplete = !!profile;
    } else if (row.currentRole === 'venue') {
      const [profile] = await db
        .select({ id: venueProfiles.id })
        .from(venueProfiles)
        .where(eq(venueProfiles.userId, userId))
        .limit(1);
      onboardingComplete = !!profile;
    }

    return { ...row, onboardingComplete };
  }),

  /**
   * Sets domain fields on the BetterAuth user row after a successful sign-up.
   * Idempotent: safe to retry — always overwrites with the latest values.
   */
  completeRegistration: protectedProcedure
    .input(completeRegistrationInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .update(user)
        .set({
          currentRole: input.currentRole,
          marketingConsent: input.marketingConsent,
          consentAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));

      return { ok: true };
    }),
});
