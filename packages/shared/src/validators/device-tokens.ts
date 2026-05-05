import { z } from 'zod';

import { PLATFORMS } from '../enums.js';

// FCM tokens are ~152 chars — min(50) catches obviously-bogus inputs without
// false rejecting. Mentor pattern §6 (validators).
const fcmTokenSchema = z.string().min(50, 'Invalid FCM token');

// Register a device's FCM token after permission is granted on the client.
// On collision (someone else's row already has this token), the router
// reassigns the row to the current user — handles devices changing hands.
export const registerDeviceTokenSchema = z.object({
  token: fcmTokenSchema,
  platform: z.enum(PLATFORMS),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

// Called on every app launch to keep `last_used_at` fresh and reactivate
// any soft-deactivated row for this (user, token). Falls back to insert
// when the row is missing.
export const refreshDeviceTokenSchema = z.object({
  token: fcmTokenSchema,
  platform: z.enum(PLATFORMS),
});

export type RefreshDeviceTokenInput = z.infer<typeof refreshDeviceTokenSchema>;

// Sign-out of a single device — soft-deactivates the row.
export const unregisterDeviceTokenSchema = z.object({
  token: fcmTokenSchema,
});

export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
