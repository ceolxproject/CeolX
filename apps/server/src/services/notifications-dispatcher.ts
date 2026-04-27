import { eq } from 'drizzle-orm';

import type { DispatchNotificationFn } from '@CeolX/api/context';
import { db as defaultDb } from '@CeolX/db';
import { deviceTokens, notifications } from '@CeolX/db/schema/notifications';

import { publishJob as defaultPublishJob } from '../jobs/publish.js';
import type { JobPayload, JobType } from '../jobs/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// notifications-dispatcher — single fan-out point for in-app + push.
//
// Called from packages/api routers via `ctx.dispatchNotification(...)` (the
// function is injected when the tRPC context is built — see apps/server/src/
// index.ts). Live in apps/server because it depends on QStash + (transitively)
// firebase-admin, both server-only.
//
// Flow per call:
//   1. INSERT one row into the `notifications` inbox (read by M7-T2 inbox UI)
//   2. SELECT every active fcm_token for the recipient
//   3. For each token, publishJob('notification.push', ...) → QStash → handler
//
// We rely on QStash's per-job retry (3 attempts, exponential backoff) for
// transient FCM failures (R7.3). The handler swallows UNREGISTERED token
// errors so they don't burn retries.
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
    // 1. Inbox row (M7-T2 reads from `notifications`)
    await deps.db.insert(notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      route: input.route,
      persona: input.persona,
    });

    // 2. Token fan-out
    const tokens = (await deps.db
      .select({ fcmToken: deviceTokens.fcmToken })
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, input.userId))) as Array<{ fcmToken: string }>;

    if (tokens.length === 0) return;

    await Promise.all(
      tokens.map((t) =>
        deps.publishJob('notification.push', {
          deviceToken: t.fcmToken,
          title: input.title,
          body: input.body,
          persona: input.persona,
          route: input.route,
          ...(input.data && { data: input.data }),
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
