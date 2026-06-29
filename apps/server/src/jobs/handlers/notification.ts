import { and, eq, inArray } from 'drizzle-orm';
import type { Message } from 'firebase-admin/messaging';

import { db } from '@CeolX/db';
import { deviceTokens } from '@CeolX/db/schema/notifications';

import { getMessaging } from '../../lib/firebase-admin.js';
import type { JobPayload } from '../types.js';

// Terminal FCM error codes — the token is dead. Soft-deactivate the row
// (mentor pattern §4) so we stop sending to it; QStash treats this as the
// success path, NOT a retry signal.
const TERMINAL_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Per-user push handler. Looks up every active device token for the user,
 * builds a platform-specific message for each, and dispatches them in one
 * messaging.sendEach call. Stale tokens are soft-deactivated based on the
 * per-message error codes returned in the BatchResponse.
 *
 * Returns silently when:
 *   - Firebase is not configured (dev/CI)
 *   - The user has no active tokens (logged in on web only, never granted
 *     OS permission, etc.)
 *
 * Throws when:
 *   - sendEach itself errors at the network/auth layer (QStash will retry)
 *
 * Does NOT throw on per-message terminal errors — that's the cleanup path.
 */
export async function handleNotificationPush(
  payload: JobPayload<'notification.push'>
): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;

  const tokens = await db
    .select({ id: deviceTokens.id, fcmToken: deviceTokens.fcmToken })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, payload.userId), eq(deviceTokens.isActive, true)));

  if (tokens.length === 0) return;

  const messages: Message[] = tokens.map((t) => ({
    token: t.fcmToken,
    notification: { title: payload.title, body: payload.body },
    data: {
      persona: payload.persona,
      route: payload.route,
      ...(payload.data ?? {}),
    },
    android: {
      priority: 'high',
      notification: { channelId: 'default', sound: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  }));

  const response = await messaging.sendEach(messages);

  const stale: string[] = [];
  response.responses.forEach((result, i) => {
    if (result.success) return;

    const code = result.error?.code;
    if (code && TERMINAL_TOKEN_ERROR_CODES.has(code)) {
      const row = tokens[i];
      if (row) stale.push(row.id);
      return;
    }

    // Non-terminal failure (bad payload, expired APNs cert, quota/rate limit,
    // server unavailable, …). sendEach resolved fine and the token is still
    // valid, so there's nothing to clean up — but swallowing it silently hides
    // systemic delivery outages (zero pushes delivered, undebuggable). Log it.
    console.error('[FCM] push delivery failed', {
      userId: payload.userId,
      code,
      message: result.error?.message,
    });
  });

  if (stale.length > 0) {
    await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(deviceTokens.id, stale));
    console.warn(
      `[FCM] soft-deactivated ${stale.length} stale token(s) for user ${payload.userId}`
    );
  }
}

// M7-T1 R7 batch path is out of scope (rate limiting deferred). Keep stub so
// the QStash router still finds a handler if a job ever lands.
export function handleNotificationBatch(_payload: JobPayload<'notification.batch'>): Promise<void> {
  console.warn('[FCM] notification.batch is not implemented (M7-T1 R7.2 deferred)');
  return Promise.resolve();
}
