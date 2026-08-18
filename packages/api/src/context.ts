import type { Context as HonoContext } from 'hono';

import { auth } from '@CeolX/auth';
import type { NotificationSurface, NotificationTrigger } from '@CeolX/shared';

// ─── Notification dispatcher (M7-T1) ─────────────────────────────────────────
// Routers fan out push + inbox writes through `ctx.dispatchNotification`.
// The trigger registry in @CeolX/shared/notifications resolves the right
// title/body/persona/route per surface. Real impl lives in
// apps/server/src/services/notifications-dispatcher.ts; tests inject vi.fn().
// ─────────────────────────────────────────────────────────────────────────────

export type DispatchNotificationInput = {
  trigger: NotificationTrigger;
  recipientUserId: string;
  /** Template vars consumed by the trigger's copy + route (e.g. bookingId, eventTitle, date). */
  vars: Record<string, string>;
  /**
   * Restrict which surfaces fire. Omit for the default fan-out (in-app inbox +
   * push, plus email when the trigger has email copy). Pass an explicit list to
   * run a subset — e.g. `[NotificationSurface.PUSH]` for the onboarding welcome
   * push, whose inbox row + email already went out at the first session.
   */
  surfaces?: NotificationSurface[];
};

export type DispatchNotificationFn = (input: DispatchNotificationInput) => Promise<void>;

// ─── Account-deletion erasure (M11-T1) ───────────────────────────────────────
// `users.requestAccountDeletion` only stamps the deletion timestamps. Erasure
// is driven by the daily `account.anonymize-sweep` QStash cron, so the request
// path needs no injected scheduler (Asana 1215276188230541).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Subscription reminder scheduling (M8-T6) ────────────────────────────────
// `venues.requestActivation` queues the three activation nudges (D-26: 24 h,
// 3 days, 7 days). Injected rather than imported because the QStash publisher
// lives in apps/server and packages/api must not depend on the app that hosts
// it — the same reasoning as dispatchNotification above. Tests inject vi.fn().
//
// A cron sweep was the alternative (and is what account erasure uses), but it
// would need a new "which reminders have been sent" record to stay idempotent,
// where three delayed jobs each re-check live state and need no new state at all.
// ─────────────────────────────────────────────────────────────────────────────

export type ScheduleActivationReminderFn = (
  userId: string,
  attempt: 1 | 2 | 3,
  delay: string
) => Promise<void>;

export type CreateContextOptions = {
  context: HonoContext;
  dispatchNotification: DispatchNotificationFn;
  scheduleActivationReminder: ScheduleActivationReminderFn;
};

export async function createContext({
  context,
  dispatchNotification,
  scheduleActivationReminder,
}: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return { session, dispatchNotification, scheduleActivationReminder };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
