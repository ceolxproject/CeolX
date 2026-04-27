import { and, eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import { registerDeviceTokenSchema, unregisterDeviceTokenSchema } from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

export const deviceTokensRouter = router({
  // Register an FCM device token after permission is granted on the client.
  // Upserts on (user_id, fcm_token); re-registration just bumps updated_at.
  register: protectedProcedure.input(registerDeviceTokenSchema).mutation(async ({ input, ctx }) => {
    await db
      .insert(deviceTokens)
      .values({
        userId: ctx.userId,
        fcmToken: input.token,
        platform: input.platform,
      })
      .onConflictDoUpdate({
        target: [deviceTokens.userId, deviceTokens.fcmToken],
        set: { updatedAt: new Date(), platform: input.platform },
      });

    return { success: true as const };
  }),

  // Deregister on sign-out so the user no longer receives push to that device.
  // Idempotent — deleting a non-existent token is a no-op.
  unregister: protectedProcedure
    .input(unregisterDeviceTokenSchema)
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(deviceTokens)
        .where(and(eq(deviceTokens.userId, ctx.userId), eq(deviceTokens.fcmToken, input.token)));

      return { success: true as const };
    }),
});
