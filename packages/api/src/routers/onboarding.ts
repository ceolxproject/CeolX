import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';
import { sendVenueActivationEmail } from '@CeolX/email';
import {
  createArtistOnboardingSchema,
  createVenueOnboardingSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

// Always points to the admin app's Stripe checkout page (R4.3 — the URL
// lives in email only, never inside the mobile app, per Apple Rule 3.1.1).
const VENUE_ACTIVATION_URL = 'https://ceolx.ie/subscribe';

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

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

      try {
        await db.transaction(async (tx) => {
          const [existing] = await tx
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

          await tx.insert(artistProfiles).values({
            userId,
            stageName: input.stageName,
            bio: input.bio ?? null,
            contactEmail: input.contactEmail ?? null,
            genre: null,
            isActive: true,
          });

          const linkRows = Object.entries(input.socialLinks ?? {})
            .filter((entry): entry is [string, string] => !!entry[1])
            .map(([platform, url]) => ({
              userId,
              platform: platform as 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'YOUTUBE',
              url,
            }));

          if (linkRows.length > 0) {
            await tx.insert(profileSocialLinks).values(linkRows);
          }
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        if (isUniqueConstraintError(err)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Artist profile already exists for this user',
          });
        }
        console.error('[onboarding.createArtistProfile] cause:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create artist profile',
          cause: err,
        });
      }

      return { ok: true };
    }),

  /**
   * Creates a venue profile after the user selects the venue persona.
   * Called once from the venue-onboarding screen after email verification.
   * The profile starts with subscription_status = 'inactive' and is_active = false.
   * Activation happens after the Stripe webhook confirms payment (M8-T2).
   */
  createVenueProfile: protectedProcedure
    .input(createVenueOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [userRow] = await db.select().from(user).where(eq(user.id, userId)).limit(1);

      if (!userRow || userRow.currentRole !== 'venue') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only users with the venue role can create a venue profile',
        });
      }

      try {
        await db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ id: venueProfiles.id })
            .from(venueProfiles)
            .where(eq(venueProfiles.userId, userId))
            .limit(1);

          if (existing) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Venue profile already exists for this user',
            });
          }

          await tx.insert(venueProfiles).values({
            userId,
            venueName: input.venueName,
            address: input.address,
            bio: input.bio ?? null,
            contactEmail: input.contactEmail ?? null,
            subscriptionStatus: 'inactive',
            isActive: false,
          });

          const linkRows = Object.entries(input.venueLinks ?? {})
            .filter((entry): entry is [string, string] => !!entry[1])
            .map(([platform, url]) => ({
              userId,
              platform: platform as 'WEBSITE' | 'INSTAGRAM' | 'FACEBOOK' | 'TWITTER',
              url,
            }));

          if (linkRows.length > 0) {
            await tx.insert(profileSocialLinks).values(linkRows);
          }
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        if (isUniqueConstraintError(err)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Venue profile already exists for this user',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create venue profile',
          cause: err,
        });
      }

      // R4.* + R8.5 — dispatch venue activation email. Failure must NOT
      // roll back profile creation, so we log and continue.
      try {
        await sendVenueActivationEmail({
          to: ctx.session.user.email,
          userName: ctx.session.user.name ?? '',
          venueName: input.venueName,
          activationUrl: VENUE_ACTIVATION_URL,
        });
      } catch (emailErr) {
        console.error('[onboarding.createVenueProfile] venue activation email failed', emailErr);
      }

      return { ok: true };
    }),
});
