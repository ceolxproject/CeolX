import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { deviceTokens } from '@CeolX/db/schema/notifications';

import { getMessaging } from '../../lib/firebase-admin.js';
import type { JobPayload } from '../types.js';

// Terminal FCM error codes — the token is dead. Delete it so we stop trying.
// QStash should not retry these; the cleanup IS the success path.
const TERMINAL_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function isFirebaseError(err: unknown): err is { code: string; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

export async function handleNotificationPush(
  payload: JobPayload<'notification.push'>
): Promise<void> {
  const { deviceToken, title, body, persona, route, data } = payload;

  try {
    await getMessaging().send({
      token: deviceToken,
      notification: { title, body },
      data: { persona, route, ...data },
    });
  } catch (err) {
    if (isFirebaseError(err) && TERMINAL_TOKEN_ERROR_CODES.has(err.code)) {
      // Token is dead — clean up and swallow so QStash marks the job done.
      await db.delete(deviceTokens).where(eq(deviceTokens.fcmToken, deviceToken));
      console.warn(`[FCM] dropped dead token (code=${err.code}): ${deviceToken.slice(0, 16)}…`);
      return;
    }
    // Anything else (server error, rate limit, network) — let QStash retry.
    throw err;
  }
}

// M7-T1 R7 batch path is out of scope (rate limiting deferred). Keep stub so
// the QStash router still finds a handler if a job ever lands.
export function handleNotificationBatch(_payload: JobPayload<'notification.batch'>): Promise<void> {
  console.warn('[FCM] notification.batch is not implemented (M7-T1 R7.2 deferred)');
  return Promise.resolve();
}
