import type { DispatchNotificationFn } from '@CeolX/api/context';
import { db as defaultDb } from '@CeolX/db';
import { notifications, notificationUsers } from '@CeolX/db/schema/notifications';
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
//   2. INSERT one row into the `notifications` inbox (read by M7-T2 inbox UI).
//   3. INSERT one row into `notification_users` linking the inbox row to the
//      recipient. Mark-read / archive operations target this join row.
//   4. Resolve trigger → push copy (separate variant per matrix).
//   5. publishJob('notification.push', { userId, ...push copy }).
//
// Mentor pattern §3 hybrid: the dispatcher publishes ONE push job per
// dispatch (not per device token). The handler does the token lookup + a
// single messaging.sendEach call internally. This preserves QStash's retry
// resilience while gaining batched fan-out — and shrinks dispatch's DB
// footprint from 3 queries (inbox + join + select tokens) to 2.
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

    // 3. Per-user push job — handler resolves tokens + calls sendEach.
    //    Cheap when the user has no devices: handler returns early. We
    //    accept that small cost in exchange for not duplicating the token
    //    lookup here.
    const push = buildNotification(input.trigger, NotificationSurface.PUSH, input.vars);

    await deps.publishJob('notification.push', {
      userId: input.recipientUserId,
      title: push.title,
      body: push.body,
      persona: push.persona,
      route: push.route,
    });
  };
}

// Default-wired dispatcher used by the production server. Tests pass their
// own `db` + `publishJob` to `makeDispatchNotification` directly.
export const dispatchNotification: DispatchNotificationFn = makeDispatchNotification({
  db: defaultDb,
  publishJob: defaultPublishJob,
});
