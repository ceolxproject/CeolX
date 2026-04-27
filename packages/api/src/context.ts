import type { Context as HonoContext } from 'hono';

import { auth } from '@CeolX/auth';
import type { NotificationPersona } from '@CeolX/shared';

// ─── Notification dispatcher (M7-T1) ─────────────────────────────────────────
// The dispatcher is injected via context so packages/api routers can fan out
// FCM pushes without importing from apps/server (which owns Firebase + QStash).
// Real impl: apps/server/src/services/notifications-dispatcher.ts
// ─────────────────────────────────────────────────────────────────────────────

export type DispatchNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  route: string;
  persona: NotificationPersona;
  data?: Record<string, string>;
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
