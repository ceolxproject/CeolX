import { eq } from 'drizzle-orm';

import type { DispatchNotificationFn } from '@CeolX/api/context';
import { db as defaultDb } from '@CeolX/db';
import { deviceTokens, notifications, notificationUsers } from '@CeolX/db/schema/notifications';
import { buildNotification, NotificationSurface } from '@CeolX/shared';

import { publishJob as defaultPublishJob } from '../jobs/publish.js';
import type { JobPayload, JobType } from '../jobs/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// notifications-dispatcher — single fan-out point for in-app + push.
//
// Called from packages/api routers via `ctx.dispatchNotification(...)` (the
// function is injected when the tRPC context is built — see apps/server/src/
// index.ts). Lives in apps/server because it depends on QStash + (transitively)
// firebase-admin, both server-only.
//
// Per call:
//   1. Resolve trigger → in-app copy via @CeolX/shared/notifications.
//   2. INSERT one row into the `notifications` inbox (read by M7-T2 inbox UI)
//      using the in-app copy variant.
//   3. Resolve trigger → push copy (separate variant per matrix).
//   4. SELECT every active fcm_token for the recipient.
//   5. For each token, publishJob('notification.push', { ...push copy, deviceToken }).
//
// QStash retries handle transient FCM failures (R7.3). The handler swallows
// UNREGISTERED token errors so they don't burn retries.
//
// Rate limiting (M7-T1 R7.2 — max 5/user/min): TODO. No infra in repo today
// and matrix doesn't mandate it. Add when notification volume warrants.
// ─────────────────────────────────────────────────────────────────────────────

type Db = typeof defaultDb;
type PublishJobFn = <T extends JobType>(type: T, payload: JobPayload<T>) => Promise<void>;

export interface MakeDispatchNotificationDeps {
  db: Db;
  publishJob: PublishJobFn;
}

export function makeDispatchNotification(
  deps: MakeDispatchNotificationDeps
): DispatchNotificationFn {
  return async (input) => {
    const inApp = buildNotification(input.trigger, NotificationSurface.IN_APP, input.vars);

    // 1. Content row (notifications). The same row can fan out to many users
    //    when M4-T5 saved-event reminders land — we write it once.
    const inserted = (await deps.db
      .insert(notifications)
      .values({
        type: inApp.type,
        title: inApp.title,
        body: inApp.body,
        route: inApp.route,
        persona: inApp.persona,
      })
      .returning({ id: notifications.id })) as Array<{ id: string }>;

    const notificationId = inserted[0]?.id;
    if (!notificationId) {
      throw new Error('[dispatchNotification] notifications insert returned no id');
    }

    // 2. Per-user delivery row (notification_users). Mark-read /
    //    mark-all-read / archive operations target this row.
    await deps.db.insert(notificationUsers).values({
      notificationId,
      userId: input.recipientUserId,
    });

    // 3. Token fan-out — push variant of the same trigger.
    const tokens = (await deps.db
      .select({ fcmToken: deviceTokens.fcmToken })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, input.recipientUserId))) as Array<{ fcmToken: string }>;

    if (tokens.length === 0) return;

    const push = buildNotification(input.trigger, NotificationSurface.PUSH, input.vars);

    await Promise.all(
      tokens.map((t) =>
        deps.publishJob('notification.push', {
          deviceToken: t.fcmToken,
          title: push.title,
          body: push.body,
          persona: push.persona,
          route: push.route,
        })
      )
    );
  };
}

// Default-wired dispatcher used by the production server. Tests pass their
// own `db` + `publishJob` to `makeDispatchNotification` directly.
export const dispatchNotification: DispatchNotificationFn = makeDispatchNotification({
  db: defaultDb,
  publishJob: defaultPublishJob,
});
