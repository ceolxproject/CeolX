import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { notifications } from '@CeolX/db/schema/notifications';
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  type NotificationDto,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

type NotificationRow = typeof notifications.$inferSelect;

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    route: row.route,
    persona: row.persona as NotificationDto['persona'],
    isRead: row.isRead,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export const notificationsRouter = router({
  // List paginated, newest first. Excludes archived (>90d or archivedAt set).
  list: protectedProcedure.input(listNotificationsSchema).query(async ({ input, ctx }) => {
    const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
    const where = and(
      eq(notifications.userId, ctx.userId),
      isNull(notifications.archivedAt),
      gt(notifications.createdAt, cutoff)
    );
    const offset = (input.page - 1) * input.limit;

    const rows = (await db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(input.limit)
      .offset(offset)) as NotificationRow[];

    const totalRows = (await db
      .select({ total: count() })
      .from(notifications)
      .where(where)) as Array<{ total: number }>;
    const total = Number(totalRows[0]?.total ?? 0);

    return {
      notifications: rows.map(toDto),
      total,
      hasMore: offset + rows.length < total,
    };
  }),

  // Mark a single notification read. Idempotent — already-read rows are no-ops.
  // Scoped to caller's userId so users cannot mark someone else's row.
  markAsRead: protectedProcedure
    .input(markNotificationReadSchema)
    .mutation(async ({ input, ctx }) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.userId)))
        .returning({ id: notifications.id });

      return { success: true as const };
    }),

  // Flip every unread row for the caller. Returns count for UX feedback.
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, ctx.userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return { success: true as const, marked: updated.length };
  }),

  // Badge count: unread notifications for the caller.
  // V1 polled from the mobile app every 30s; replace with WebSocket post-V1.
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const rows = (await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), eq(notifications.isRead, false)))) as Array<{
      count: number;
    }>;

    return { count: Number(rows[0]?.count ?? 0) };
  }),
});
