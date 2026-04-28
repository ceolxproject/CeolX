import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

interface SessionLike {
  userId: string;
}

/**
 * Wired into `databaseHooks.session.create.after` in the Better Auth config.
 *
 * Two responsibilities:
 *   1. Stamp `lastLoginAt` on every successful sign-in (drives the M11-T1 R6
 *      inactivity cron).
 *   2. Cancel a pending GDPR account deletion: clearing `deletionScheduledFor`
 *      converts the still-queued QStash `account.anonymize` job into a no-op
 *      (handler short-circuits when the field is null), so we never need to
 *      cancel the message itself. `deletionCancelledAt` is a one-shot signal
 *      consumed by the next `users.me` query to fire the in-app toast.
 *
 * Defence in depth: if the row is somehow already anonymised, refuse the login.
 */
export async function onSessionCreated(session: SessionLike): Promise<void> {
  const { userId } = session;

  const [row] = await db
    .select({
      deletionScheduledFor: user.deletionScheduledFor,
      isAnonymized: user.isAnonymized,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (row?.isAnonymized) {
    throw new Error('Account deleted');
  }

  const now = new Date();
  const deletionWasPending = Boolean(row?.deletionScheduledFor);
  const cancellationFields = deletionWasPending
    ? {
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: now,
      }
    : {};

  await db
    .update(user)
    .set({ lastLoginAt: now, ...cancellationFields })
    .where(eq(user.id, userId));
}
