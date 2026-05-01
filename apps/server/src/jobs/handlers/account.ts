import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { session, user } from '@CeolX/db/schema/auth';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';

import type { JobPayload } from '../types.js';

/**
 * GDPR Right-to-Erasure (M11-T1).
 *
 * Fired by QStash 30 days after a user requests account deletion. Idempotent:
 * if the user logged back in (clearing `deletionScheduledFor`) or the row is
 * already anonymised, the handler is a no-op. This means we never need to
 * cancel the QStash message itself when a user re-activates their account.
 *
 * Anonymisation strategy:
 *   - `user`, `artist_profiles`, `venue_profiles` — PII overwritten in place
 *     so historical references (events, bookings, comments) keep referential
 *     integrity. The row is kept; `isAnonymized = true` blocks future logins.
 *   - `profile_social_links`, `device_tokens`, `session` — hard-deleted
 *     (purely external/auth state, no historical value).
 *
 * S3 media: profile image URLs are nulled here; orphaned objects are caught
 * by the bucket's lifecycle rule (out of scope for this PR).
 */
export async function handleAccountAnonymize(
  payload: JobPayload<'account.anonymize'>
): Promise<void> {
  const { userId } = payload;

  const [row] = await db
    .select({
      isAnonymized: user.isAnonymized,
      deletionScheduledFor: user.deletionScheduledFor,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row || row.isAnonymized || !row.deletionScheduledFor) {
    return;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: 'Deleted User',
        email: `${userId}@deleted.ceolx.ie`,
        emailVerified: false,
        image: null,
        currentRole: 'spectator',
        consentAt: null,
        marketingConsent: false,
        lastLoginAt: null,
        flaggedInactive: false,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: null,
        isAnonymized: true,
        anonymizedAt: now,
      })
      .where(eq(user.id, userId));

    await tx
      .update(artistProfiles)
      .set({
        stageName: 'Deleted Artist',
        bio: null,
        profileImageUrl: null,
        coverImageUrl: null,
        contactEmail: null,
        genre: null,
        genres: [],
        location: null,
        isActive: false,
      })
      .where(eq(artistProfiles.userId, userId));

    await tx
      .update(venueProfiles)
      .set({
        venueName: 'Deleted Venue',
        address: '',
        county: null,
        bio: null,
        contactEmail: null,
        lat: null,
        lng: null,
        profileImageUrl: null,
        coverImageUrl: null,
        websiteUrl: null,
        phone: null,
        isActive: false,
      })
      .where(eq(venueProfiles.userId, userId));

    await tx.delete(profileSocialLinks).where(eq(profileSocialLinks.userId, userId));
    await tx.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
    await tx.delete(session).where(eq(session.userId, userId));
  });
}

/**
 * Retained as a no-op for backwards-compatibility with in-flight queue messages.
 * V1 does not publish this job — anonymisation handles all cleanup inline.
 */
export async function handleAccountCleanup(_payload: JobPayload<'account.cleanup'>): Promise<void> {
  // intentional no-op
}
