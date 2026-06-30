import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { notifications, notificationUsers } from '@CeolX/db/schema/notifications';
import { sendWelcomeEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';
import {
  buildAppRedirectUrl,
  buildNotification,
  NotificationSurface,
  NotificationTrigger,
} from '@CeolX/shared';

interface SessionLike {
  userId: string;
}

/**
 * One-shot onboarding welcome (ONB-01): the persistent surfaces (in-app inbox
 * row + welcome email) for a brand-new account, fired the first time it reaches
 * an authenticated session — which, with `requireEmailVerification`, is right
 * after email verification, and for social sign-ups is the first sign-in. The
 * welcome PUSH is handled separately at first device-token registration, since
 * no FCM token exists yet at this point (device-tokens router).
 *
 * Idempotent via an atomic claim on `welcomeSentAt`: only the login that flips
 * it from NULL does the work, so repeat logins and concurrent sessions are
 * no-ops. If the post-claim work (inbox insert / email) throws, we release the
 * claim (reset `welcomeSentAt` to NULL) and rethrow, so the next login retries
 * rather than leaving the user permanently un-welcomed — Postmark can fail
 * transiently and we don't want a single blip to suppress the welcome forever.
 * A rare mid-flight failure may therefore re-insert one inbox row on retry,
 * which is an acceptable trade against losing the welcome outright.
 *
 * Best-effort — wrapped by the caller so a mail/DB hiccup never blocks the
 * login. The push lives in apps/server (QStash + firebase); this layer only
 * touches the DB + email sender it already depends on.
 */
async function sendWelcomeOnFirstSession(userId: string): Promise<void> {
  const [claimed] = await db
    .update(user)
    .set({ welcomeSentAt: new Date() })
    .where(and(eq(user.id, userId), isNull(user.welcomeSentAt)))
    .returning({ email: user.email, name: user.name });

  // Already welcomed (or backfilled pre-launch account) — nothing to do.
  if (!claimed) return;

  try {
    const inApp = buildNotification(
      NotificationTrigger.USER_WELCOME,
      NotificationSurface.IN_APP,
      {}
    );

    const [row] = await db
      .insert(notifications)
      .values({
        type: inApp.type,
        title: inApp.title,
        body: inApp.body,
        route: inApp.route,
        persona: inApp.persona,
      })
      .returning({ id: notifications.id });

    if (row) {
      await db.insert(notificationUsers).values({ notificationId: row.id, userId });
    }

    await sendWelcomeEmail(
      claimed.email,
      buildAppRedirectUrl(env.BETTER_AUTH_URL, inApp.route),
      claimed.name ?? ''
    );
  } catch (err) {
    // Release the claim so a later login can retry the welcome. Rethrow so the
    // caller's best-effort catch logs it (and still never fails the login).
    await db.update(user).set({ welcomeSentAt: null }).where(eq(user.id, userId));
    throw err;
  }
}

/**
 * Wired into `databaseHooks.session.create.after` in the Better Auth config.
 *
 * Three responsibilities:
 *   1. Stamp `lastLoginAt` on every successful sign-in (drives the M11-T1 R6
 *      inactivity cron).
 *   2. Cancel a pending GDPR account deletion: clearing `deletionScheduledFor`
 *      converts the still-queued QStash `account.anonymize` job into a no-op
 *      (handler short-circuits when the field is null), so we never need to
 *      cancel the message itself. `deletionCancelledAt` is a one-shot signal
 *      consumed by the next `users.me` query to fire the in-app toast.
 *   3. Fire the one-shot onboarding welcome (in-app inbox row + email) on the
 *      first authenticated session. Best-effort — failures are logged, never
 *      thrown, so they can't block the login.
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

  // Best-effort: the welcome is a nice-to-have, never a reason to fail a login.
  try {
    await sendWelcomeOnFirstSession(userId);
  } catch (err) {
    // Log the full error (stack included) so a persistent bug is distinguishable
    // from a transient Postmark/DB blip when this scrolls past in the logs.
    console.error('[onSessionCreated] welcome dispatch failed for user', userId, err);
  }
}
