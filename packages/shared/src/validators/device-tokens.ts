import { z } from 'zod';

import { PLATFORMS } from '../enums.js';

// Register a device's FCM token after permission is granted.
// Idempotent — re-registration with the same (userId, fcmToken) updates the row.
export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1, 'FCM token cannot be empty'),
  platform: z.enum(PLATFORMS),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;

// Deregister on sign-out so the user no longer receives push to that device.
export const unregisterDeviceTokenSchema = z.object({
  token: z.string().min(1),
});

export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
