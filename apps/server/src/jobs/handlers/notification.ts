import type { JobPayload } from '../types.js';

// TODO M7-Notifications: implement FCM push notification delivery
export async function handleNotificationPush(
  _payload: JobPayload<'notification.push'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}

// TODO M7-Notifications: implement notification batch digest
export async function handleNotificationBatch(
  _payload: JobPayload<'notification.batch'>
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}
