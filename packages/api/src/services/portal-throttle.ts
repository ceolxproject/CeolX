import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';

// Cooldown bookkeeping for Customer Portal link emails (M8-T0 D-45).
//
// A DB timestamp rather than the Redis limiter, for the same reason as the
// activation cooldown: Upstash is unconfigured locally and the limiter is disabled
// outright under NODE_ENV=test, so a Redis-based guard could not be verified
// anywhere we can actually run it. This behaves identically in local, test and
// production.

/** Age of the last Portal link emailed for this user, or null if never. */
export async function millisSinceNewestPortalRequest(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ lastPortalRequestAt: venueSubscriptions.lastPortalRequestAt })
    .from(venueSubscriptions)
    .innerJoin(venueProfiles, eq(venueProfiles.id, venueSubscriptions.venueId))
    .where(eq(venueProfiles.userId, userId))
    .limit(1);

  if (!row?.lastPortalRequestAt) return null;
  return Date.now() - row.lastPortalRequestAt.getTime();
}

/**
 * Stamp the cooldown, after the email has actually gone out.
 *
 * Deliberately after the send rather than before: stamping first would lock the
 * venue out of retrying for a minute if the email then failed, which is the same
 * mistake the activation flow avoids by revoking its token on failure.
 */
export async function recordPortalRequest(userId: string, at: Date = new Date()): Promise<void> {
  const [profile] = await db
    .select({ id: venueProfiles.id })
    .from(venueProfiles)
    .where(eq(venueProfiles.userId, userId))
    .limit(1);

  if (!profile) return;

  await db
    .update(venueSubscriptions)
    .set({ lastPortalRequestAt: at })
    .where(eq(venueSubscriptions.venueId, profile.id));
}
