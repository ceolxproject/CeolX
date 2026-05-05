import { and, eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import {
  refreshDeviceTokenSchema,
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

export const deviceTokensRouter = router({
  // First-time registration after the OS permission prompt is granted.
  // If the same FCM token is already on file for *another* user — the device
  // changed hands — reassign the row instead of inserting a duplicate. The
  // unique index on (user_id, fcm_token) wouldn't catch this on its own
  // because the (other_user, token) tuple is technically distinct.
  register: protectedProcedure.input(registerDeviceTokenSchema).mutation(async ({ input, ctx }) => {
    const existing = await db
      .select({ id: deviceTokens.id })
      .from(deviceTokens)
      .where(eq(deviceTokens.fcmToken, input.token))
      .limit(1);

    const now = new Date();

    if (existing.length > 0 && existing[0]) {
      await db
        .update(deviceTokens)
        .set({
          userId: ctx.userId,
          platform: input.platform,
          isActive: true,
          lastUsedAt: now,
          updatedAt: now,
        })
        .where(eq(deviceTokens.id, existing[0].id));
    } else {
      await db.insert(deviceTokens).values({
        userId: ctx.userId,
        fcmToken: input.token,
        platform: input.platform,
        isActive: true,
        lastUsedAt: now,
      });
    }

    return { success: true as const };
  }),

  // Called on every app launch — touch lastUsedAt and reactivate any
  // soft-deactivated row for this (user, token). Falls back to insert
  // when no row matches (first launch on this device after install).
  refresh: protectedProcedure.input(refreshDeviceTokenSchema).mutation(async ({ input, ctx }) => {
    const now = new Date();

    const updated = await db
      .update(deviceTokens)
      .set({
        platform: input.platform,
        isActive: true,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(and(eq(deviceTokens.userId, ctx.userId), eq(deviceTokens.fcmToken, input.token)))
      .returning({ id: deviceTokens.id });

    if (updated.length === 0) {
      await db.insert(deviceTokens).values({
        userId: ctx.userId,
        fcmToken: input.token,
        platform: input.platform,
        isActive: true,
        lastUsedAt: now,
      });
    }

    return { success: true as const };
  }),

  // Sign-out of the current device — soft-deactivate so the server stops
  // sending pushes here but the row stays for diagnostics. Idempotent.
  unregister: protectedProcedure
    .input(unregisterDeviceTokenSchema)
    .mutation(async ({ input, ctx }) => {
      await db
        .update(deviceTokens)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(deviceTokens.userId, ctx.userId), eq(deviceTokens.fcmToken, input.token)));

      return { success: true as const };
    }),

  // Hard logout / account deletion — deactivate every device for this user.
  deactivateAll: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(deviceTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(deviceTokens.userId, ctx.userId));

    return { success: true as const };
  }),
});
