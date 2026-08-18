import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { UserRole } from '@CeolX/shared';
import { updateAccountSchema } from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

import { getFollowerCounts, getSocialLinksRecord } from './_profile-helpers';

const completeRegistrationInput = z.object({
  currentRole: z.enum(['spectator', 'artist', 'venue']),
  marketingConsent: z.boolean(),
});

// M11-T1: 30-day GDPR cooling-off — `deletionScheduledFor = requestedAt + this`.
// Kept in sync with the QStash delay literal in apps/server/src/index.ts.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
        username: user.username,
        deletionCancelledAt: user.deletionCancelledAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) return null;

    // M11-T1: one-shot signal for the "deletion cancelled" toast.
    // Mobile is expected to call users.acknowledgeDeletionNotice after showing it.
    const deletionCancelledNotice = row.deletionCancelledAt !== null;

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
      lat: number | null;
      lng: number | null;
      county: string | null;
      websiteUrl: string | null;
      phone: string | null;
      profileImageUrl: string | null;
      coverImageUrl: string | null;
      contactEmail: string | null;
      subscriptionStatus: string;
      trialEndsAt: string | null;
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
          lat: venueProfiles.lat,
          lng: venueProfiles.lng,
          county: venueProfiles.county,
          websiteUrl: venueProfiles.websiteUrl,
          phone: venueProfiles.phone,
          profileImageUrl: venueProfiles.profileImageUrl,
          coverImageUrl: venueProfiles.coverImageUrl,
          contactEmail: venueProfiles.contactEmail,
          subscriptionStatus: venueProfiles.subscriptionStatus,
          // Surfaced so the venue can see when the first charge lands. The trial
          // runs six months, so without this the date exists only in an email.
          trialEndsAt: venueSubscriptions.trialEndsAt,
        })
        .from(venueProfiles)
        .leftJoin(venueSubscriptions, eq(venueSubscriptions.venueId, venueProfiles.id))
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
          // numeric columns come back as strings — expose as numbers for the map
          lat: profile.lat ? Number(profile.lat) : null,
          lng: profile.lng ? Number(profile.lng) : null,
          // Serialised for the wire — the declared type is a string.
          trialEndsAt: profile.trialEndsAt?.toISOString() ?? null,
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
      deletionCancelledNotice,
    };
  }),

  /**
   * Updates the authenticated user's account-level name and avatar on the
   * BetterAuth `user` row. Backs the spectator "Update Profile" screen — a
   * spectator has no artist/venue profile table, so name + image live here.
   *
   * `image` is tri-state: omit to leave the avatar unchanged, `null` to clear
   * it, or a CDN url to set a freshly-uploaded picture (uploaded client-side
   * via the shared presigned-PUT flow before this call). Email is never
   * editable here — it stays immutable.
   */
  updateMe: protectedProcedure.input(updateAccountSchema).mutation(async ({ ctx, input }) => {
    await db
      .update(user)
      .set({
        name: input.name,
        // Only touch `image` when the client sent a value (set or clear);
        // an absent key leaves the existing avatar in place.
        ...(input.image !== undefined ? { image: input.image } : {}),
      })
      .where(eq(user.id, ctx.session.user.id));

    return { ok: true };
  }),

  /**
   * Sets domain fields on the BetterAuth user row after a successful sign-up.
   * One-shot: no-op once consentAt has been written, so a returning OAuth user
   * who re-enters the signup flow can't overwrite their existing role.
   */
  completeRegistration: protectedProcedure
    .input(completeRegistrationInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const [existing] = await db
        .select({ consentAt: user.consentAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!existing || existing.consentAt) {
        return { ok: true };
      }

      await db
        .update(user)
        .set({
          currentRole: input.currentRole,
          marketingConsent: input.marketingConsent,
          consentAt: new Date(),
        })
        .where(eq(user.id, userId));

      return { ok: true };
    }),

  /**
   * M11-T1 — request GDPR account deletion (30-day cooling-off).
   *
   * Stamps deletion_requested_at + deletion_scheduled_for only. Erasure is
   * driven by the daily `account.anonymize-sweep` QStash cron, which anonymises
   * every row whose `deletion_scheduled_for` has elapsed. Mobile is expected to
   * sign the user out immediately after this returns; the next login (if any)
   * silently cancels the deletion via the Better Auth `session.create.after`
   * hook (clears the scheduled timestamp, so the sweep skips the row).
   *
   * Deliberately does NO external call on the request path: a previous version
   * enqueued a 30-day-delayed `account.anonymize` job here, but a 30-day delay
   * exceeds QStash's free-plan cap, so the publish threw *after* the DB write —
   * the request failed on the first attempt and only "succeeded" on the second
   * via the idempotent guard below (which silently skipped scheduling any job).
   * Moving erasure to the cron makes deletion succeed on the first attempt
   * regardless of QStash availability (Asana 1215276188230541).
   *
   * Idempotent: a second call while a deletion is already pending returns the
   * existing scheduled date and does NOT re-stamp.
   */
  requestAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [current] = await db
      .select({ deletionScheduledFor: user.deletionScheduledFor })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (current?.deletionScheduledFor) {
      return { scheduledFor: current.deletionScheduledFor };
    }

    const requestedAt = new Date();
    const scheduledFor = new Date(requestedAt.getTime() + THIRTY_DAYS_MS);

    await db
      .update(user)
      .set({
        deletionRequestedAt: requestedAt,
        deletionScheduledFor: scheduledFor,
        deletionCancelledAt: null,
      })
      .where(eq(user.id, userId));

    return { scheduledFor };
  }),

  /**
   * M11-T1 — cancel a pending deletion explicitly (admin rescue / future UI).
   *
   * V1 mobile does not call this — login itself cancels via the Better Auth
   * hook. Exposed for symmetry and so the mutation is testable and ready to
   * wire to a future "Undo" admin tool.
   */
  cancelAccountDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(user)
      .set({
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: new Date(),
      })
      .where(eq(user.id, ctx.session.user.id));
    return { ok: true };
  }),

  /**
   * M11-T1 — clears the deletion_cancelled_at flag after the mobile client
   * has shown its "deletion cancelled" toast. Without this the toast would
   * re-fire on every subsequent `users.me` query.
   */
  acknowledgeDeletionNotice: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(user)
      .set({ deletionCancelledAt: null })
      .where(eq(user.id, ctx.session.user.id));
    return { ok: true };
  }),
});
