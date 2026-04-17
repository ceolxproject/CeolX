import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { UserRole } from '@CeolX/shared';

import { protectedProcedure, router } from '../index';

import { getFollowerCounts, getSocialLinksRecord } from './_profile-helpers';

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
    let venueAddress: string | null = null;
    let venueProfileId: string | null = null;

    // Artist profile data — for the self-profile screen (M6-T1)
    let artistProfile: {
      id: string;
      stageName: string;
      bio: string | null;
      genres: string[] | null;
      genre: string | null;
      location: string | null;
      profileImageUrl: string | null;
      coverImageUrl: string | null;
      contactEmail: string | null;
      followerCount: number;
      followingCount: number;
      socialLinks: Record<string, string>;
    } | null = null;

    // Venue profile data — for the self-profile screen (M6-T2)
    let venueProfile: {
      id: string;
      venueName: string;
      bio: string | null;
      address: string;
      county: string | null;
      websiteUrl: string | null;
      phone: string | null;
      profileImageUrl: string | null;
      coverImageUrl: string | null;
      contactEmail: string | null;
      subscriptionStatus: string;
      followerCount: number;
      followingCount: number;
      socialLinks: Record<string, string>;
    } | null = null;

    if (row.currentRole === UserRole.ARTIST) {
      const [profile] = await db
        .select({
          id: artistProfiles.id,
          stageName: artistProfiles.stageName,
          bio: artistProfiles.bio,
          genres: artistProfiles.genres,
          genre: artistProfiles.genre,
          location: artistProfiles.location,
          profileImageUrl: artistProfiles.profileImageUrl,
          coverImageUrl: artistProfiles.coverImageUrl,
          contactEmail: artistProfiles.contactEmail,
        })
        .from(artistProfiles)
        .where(eq(artistProfiles.userId, userId))
        .limit(1);
      onboardingComplete = !!profile;

      if (profile) {
        const { followerCount, followingCount } = await getFollowerCounts(userId);
        const socialLinksRecord = await getSocialLinksRecord(userId);

        artistProfile = {
          ...profile,
          genres: profile.genres ?? (profile.genre ? [profile.genre] : []),
          followerCount,
          followingCount,
          socialLinks: socialLinksRecord,
        };
      }
    } else if (row.currentRole === UserRole.VENUE) {
      const [profile] = await db
        .select({
          id: venueProfiles.id,
          venueName: venueProfiles.venueName,
          bio: venueProfiles.bio,
          address: venueProfiles.address,
          county: venueProfiles.county,
          websiteUrl: venueProfiles.websiteUrl,
          phone: venueProfiles.phone,
          profileImageUrl: venueProfiles.profileImageUrl,
          coverImageUrl: venueProfiles.coverImageUrl,
          contactEmail: venueProfiles.contactEmail,
          subscriptionStatus: venueProfiles.subscriptionStatus,
        })
        .from(venueProfiles)
        .where(eq(venueProfiles.userId, userId))
        .limit(1);
      onboardingComplete = !!profile;
      venueAddress = profile?.address ?? null;
      venueProfileId = profile?.id ?? null;

      if (profile) {
        const { followerCount, followingCount } = await getFollowerCounts(userId);
        const socialLinksRecord = await getSocialLinksRecord(userId);

        venueProfile = {
          ...profile,
          followerCount,
          followingCount,
          socialLinks: socialLinksRecord,
        };
      }
    }

    return {
      ...row,
      onboardingComplete,
      venueAddress,
      venueProfileId,
      artistProfile,
      venueProfile,
    };
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
