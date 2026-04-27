import type { Context as HonoContext } from 'hono';

import { auth } from '@CeolX/auth';
import type { NotificationTrigger } from '@CeolX/shared';

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
};

export type DispatchNotificationFn = (input: DispatchNotificationInput) => Promise<void>;

export type CreateContextOptions = {
  context: HonoContext;
  dispatchNotification: DispatchNotificationFn;
};

export async function createContext({ context, dispatchNotification }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return { session, dispatchNotification };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
