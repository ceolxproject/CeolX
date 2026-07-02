import { and, eq, isNotNull, lte } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { session, user } from '@CeolX/db/schema/auth';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import { artistProfiles, profileSocialLinks, venueProfiles } from '@CeolX/db/schema/users';
import { sendAccountDeletedEmail } from '@CeolX/email';

import type { JobPayload } from '../types.js';

/**
 * GDPR S-06 / A-18 / V-17 confirmation. Sent to the original address captured
 * before erasure. Non-blocking: a mail failure is logged and never rolls back
 * or re-throws — erasure durability comes first (R8.5). Skips the synthetic
 * post-erasure address defensively.
 */
async function sendDeletionConfirmation(
  userId: string,
  { email, name }: { email: string | null; name: string | null }
): Promise<void> {
  if (!email || email.endsWith('@deleted.ceolx.com')) return;
  try {
    await sendAccountDeletedEmail({ to: email, userName: name ?? '' });
  } catch (err) {
    console.error('[account] account-deleted email failed', userId, err);
  }
}

/**
 * Core erasure transaction for a single user. Single source of truth for "what
 * anonymisation does" — shared by the per-user handler and the daily sweep.
 *
 * Callers MUST have already confirmed the row is due (not anonymised, deletion
 * still scheduled) before invoking this.
 */
async function applyAnonymization(
  userId: string,
  contact: { email: string | null; name: string | null }
): Promise<void> {
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        name: 'Deleted User',
        email: `${userId}@deleted.ceolx.com`,
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

  await sendDeletionConfirmation(userId, contact);
}

/**
 * GDPR Right-to-Erasure (M11-T1) — single-user entry point.
 *
 * Retained for backwards-compatibility with any in-flight `account.anonymize`
 * messages. V1 no longer publishes this per-request (a 30-day QStash delay
 * exceeds the free-plan cap and made the delete request fail on first attempt
 * — Asana 1215276188230541); the daily `handleAccountAnonymizeSweep` cron now
 * drives erasure. Idempotent: a missing row, an already-anonymised row, or one
 * whose `deletionScheduledFor` was cleared (user logged back in) is a no-op.
 */
export async function handleAccountAnonymize(
  payload: JobPayload<'account.anonymize'>
): Promise<void> {
  const { userId } = payload;

  const [row] = await db
    .select({
      isAnonymized: user.isAnonymized,
      deletionScheduledFor: user.deletionScheduledFor,
      email: user.email,
      name: user.name,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!row || row.isAnonymized || !row.deletionScheduledFor) {
    return;
  }

  await applyAnonymization(userId, { email: row.email, name: row.name });
}

/**
 * GDPR Right-to-Erasure (M11-T1) — daily sweep (the V1 driver).
 *
 * Registered as a QStash cron (see setup-crons.ts). Selects every account whose
 * 30-day cooling-off has elapsed (`deletionScheduledFor <= now`) and that is not
 * already anonymised, then anonymises each. Decoupling erasure from a per-request
 * delayed job means the delete request itself does no external call — so it
 * succeeds on the first attempt and never depends on QStash being reachable or on
 * a plan that allows 30-day delays.
 *
 * Anonymisation strategy (per user, in a single transaction):
 *   - `user`, `artist_profiles`, `venue_profiles` — PII overwritten in place
 *     so historical references (events, bookings, comments) keep referential
 *     integrity. The row is kept; `isAnonymized = true` blocks future logins.
 *   - `profile_social_links`, `device_tokens`, `session` — hard-deleted
 *     (purely external/auth state, no historical value).
 *
 * S3 media: profile image URLs are nulled; orphaned objects are caught by the
 * bucket's lifecycle rule (out of scope for this PR).
 */
export async function handleAccountAnonymizeSweep(
  _payload: JobPayload<'account.anonymize-sweep'>
): Promise<void> {
  const now = new Date();

  const due = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(
      and(
        isNotNull(user.deletionScheduledFor),
        lte(user.deletionScheduledFor, now),
        eq(user.isAnonymized, false)
      )
    );

  for (const u of due) {
    await applyAnonymization(u.id, { email: u.email, name: u.name });
  }
}

/**
 * Retained as a no-op for backwards-compatibility with in-flight queue messages.
 * V1 does not publish this job — anonymisation handles all cleanup inline.
 */
export async function handleAccountCleanup(_payload: JobPayload<'account.cleanup'>): Promise<void> {
  // intentional no-op
}
