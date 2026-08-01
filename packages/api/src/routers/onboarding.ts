import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { eventCollaborators } from '@CeolX/db/schema/events';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';
// TEMP (Asana 1215188774672224): subscriptions are not enabled yet, so the
// venue/artist activation ("subscribe") email is disabled. Re-enable this
// import together with the dispatch in createVenueProfile when Stripe goes live.
// import { sendVenueActivationEmail } from '@CeolX/email';
import { SubscriptionStatus, UserRole } from '@CeolX/shared';
import {
  createArtistOnboardingSchema,
  createVenueOnboardingSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

// Always points to the admin app's Stripe checkout page (R4.3 — the URL
// lives in email only, never inside the mobile app, per Apple Rule 3.1.1).
// TEMP (Asana 1215188774672224): unused while the activation email is disabled.
// const VENUE_ACTIVATION_URL = 'https://ceolx.com/subscribe';

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

      if (!userRow || userRow.currentRole !== UserRole.ARTIST) {
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
            // Never store the account email as a public booking address — the
            // artist profile is public and the onboarding form gave no opt-out.
            // Ignored rather than rejected so already-shipped app builds, which
            // still send it, keep working. The column stays for a future
            // opt-in booking email wired through the update schemas.
            contactEmail: null,
            profileImageUrl: input.profileImageUrl ?? null,
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

          // Claim any outside-platform collaborator invites (matrix A-14) sent
          // to this user's verified email: link the pending row to the new
          // artist profile and consume its token. Email-match (not the link
          // token) so it survives the App Store install gap. The NOT EXISTS
          // guard avoids the (event_id, artist_profile_id) unique-index clash
          // when the user is already a collaborator on that event.
          await tx
            .update(eventCollaborators)
            .set({ artistProfileId: userId, inviteToken: null, inviteTokenExpiresAt: null })
            .where(
              and(
                sql`lower(${eventCollaborators.invitedEmail}) = ${userRow.email.toLowerCase()}`,
                isNull(eventCollaborators.artistProfileId),
                sql`NOT EXISTS (SELECT 1 FROM event_collaborators ec2 WHERE ec2.event_id = ${eventCollaborators.eventId} AND ec2.artist_profile_id = ${userId})`
              )
            );
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

      if (!userRow || userRow.currentRole !== UserRole.VENUE) {
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
            // numeric columns are written as strings (matches venues.ts update path)
            lat: String(input.lat),
            lng: String(input.lng),
            bio: input.bio ?? null,
            // Same as the artist path — the account email is never published.
            contactEmail: null,
            profileImageUrl: input.profileImageUrl ?? null,
            subscriptionStatus: SubscriptionStatus.INACTIVE,
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
      //
      // TEMP (Asana 1215188774672224): subscriptions are not enabled yet, so we
      // do NOT send the activation ("subscribe") email — venues/artists should
      // not receive subscription-related mail until Stripe goes live. Re-enable
      // this block (and the @CeolX/email import above) when subscriptions ship.
      // try {
      //   await sendVenueActivationEmail({
      //     to: ctx.session.user.email,
      //     userName: ctx.session.user.name ?? '',
      //     venueName: input.venueName,
      //     activationUrl: VENUE_ACTIVATION_URL,
      //   });
      // } catch (emailErr) {
      //   console.error('[onboarding.createVenueProfile] venue activation email failed', emailErr);
      // }

      return { ok: true };
    }),
});
