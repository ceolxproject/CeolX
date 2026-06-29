import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { deviceTokens } from '@CeolX/db/schema/notifications';
import { NotificationSurface, NotificationTrigger } from '@CeolX/shared';
import {
  refreshDeviceTokenSchema,
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
} from '@CeolX/shared/validators';

import type { DispatchNotificationFn } from '../context';
import { protectedProcedure, router } from '../index';

// Onboarding welcome PUSH (ONB-01). The in-app row + welcome email already went
// out at the user's first authenticated session (packages/auth login-hook); the
// push is deferred to here because no FCM token exists until the device
// registers one. Fires exactly once per account via an atomic claim on
// `welcomePushSentAt`; the `welcomeSentAt IS NOT NULL` guard means pre-launch /
// backfilled accounts (never welcomed) don't get a stray push. Best-effort —
// a failure here must never fail token registration.
async function maybeSendWelcomePush(ctx: {
  userId: string;
  dispatchNotification: DispatchNotificationFn;
}): Promise<void> {
  try {
    const [claimed] = await db
      .update(user)
      .set({ welcomePushSentAt: new Date() })
      .where(
        and(eq(user.id, ctx.userId), isNotNull(user.welcomeSentAt), isNull(user.welcomePushSentAt))
      )
      .returning({ id: user.id });

    if (!claimed) return;

    await ctx.dispatchNotification({
      trigger: NotificationTrigger.USER_WELCOME,
      recipientUserId: ctx.userId,
      vars: {},
      surfaces: [NotificationSurface.PUSH],
    });
  } catch (err) {
    // Log the full error (stack included) — a missed/duplicate welcome push is
    // never a reason to fail token registration, but we don't want it silent.
    console.error('[device-tokens] welcome push dispatch failed for user', ctx.userId, err);
  }
}

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

    await maybeSendWelcomePush(ctx);

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

    // Covers users who already had push permission before this feature shipped
    // (their first post-deploy launch hits refresh, not register).
    await maybeSendWelcomePush(ctx);

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
