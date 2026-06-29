import { eq } from 'drizzle-orm';

import type { DispatchNotificationFn } from '@CeolX/api/context';
import { db as defaultDb } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { notifications, notificationUsers } from '@CeolX/db/schema/notifications';
import {
  buildAppRedirectUrl,
  buildNotification,
  NOTIFICATION_TRIGGERS,
  NotificationSurface,
} from '@CeolX/shared';

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
    // Default fan-out is all surfaces (email still gated on the trigger having
    // email copy, below). An explicit `surfaces` list runs only that subset —
    // e.g. the onboarding welcome push, whose inbox row + email already went
    // out at the first session, passes `[PUSH]`.
    const wants = (surface: NotificationSurface): boolean =>
      input.surfaces === undefined || input.surfaces.includes(surface);

    // 1. Content row (notifications) + per-user delivery row. The same content
    //    row can fan out to many users when M4-T5 saved-event reminders land —
    //    we write it once. Mark-read / archive operations target the join row.
    if (wants(NotificationSurface.IN_APP)) {
      const inApp = buildNotification(input.trigger, NotificationSurface.IN_APP, input.vars);

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

      await deps.db.insert(notificationUsers).values({
        notificationId,
        userId: input.recipientUserId,
      });
    }

    // 2. Per-user push job — handler resolves tokens + calls sendEach.
    //    Cheap when the user has no devices: handler returns early. We
    //    accept that small cost in exchange for not duplicating the token
    //    lookup here.
    if (wants(NotificationSurface.PUSH)) {
      const push = buildNotification(input.trigger, NotificationSurface.PUSH, input.vars);

      await deps.publishJob('notification.push', {
        userId: input.recipientUserId,
        title: push.title,
        body: push.body,
        persona: push.persona,
        route: push.route,
      });
    }

    if (!wants(NotificationSurface.EMAIL)) return;

    // 3. Email fan-out — only for triggers whose matrix row has an EMAIL surface
    //    (booking lifecycle: A-09..V-13). Triggers with `email: null` (co-artist,
    //    in-product-only rows) are skipped, so `buildNotification(EMAIL)` is never
    //    asked for copy that doesn't exist. Email-only lifecycle rows (payment
    //    failed, GDPR) deliberately do NOT route through here — they'd write an
    //    unwanted inbox row — they call their sender directly at the event source.
    const def = NOTIFICATION_TRIGGERS[input.trigger];
    const base = process.env.BETTER_AUTH_URL;
    if (def.email && !base) {
      console.warn('[dispatchNotification] EMAIL surface skipped: BETTER_AUTH_URL unset', {
        trigger: input.trigger,
      });
    }
    if (def.email && base) {
      const recipient = await deps.db.query.user.findFirst({
        where: eq(user.id, input.recipientUserId),
        columns: { email: true, name: true },
      });
      if (recipient?.email) {
        const email = buildNotification(input.trigger, NotificationSurface.EMAIL, input.vars);
        await deps.publishJob('email.send', {
          to: recipient.email,
          template: 'notification',
          locale: 'en',
          data: {
            userName: recipient.name ?? '',
            subject: email.title,
            body: email.body,
            ctaUrl: buildAppRedirectUrl(base, email.route),
          },
        });
      }
    }
  };
}

// Default-wired dispatcher used by the production server. Tests pass their
// own `db` + `publishJob` to `makeDispatchNotification` directly.
export const dispatchNotification: DispatchNotificationFn = makeDispatchNotification({
  db: defaultDb,
  publishJob: defaultPublishJob,
});
