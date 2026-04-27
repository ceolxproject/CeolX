import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { notifications, notificationUsers } from '@CeolX/db/schema/notifications';
import {
  listNotificationsSchema,
  markNotificationReadSchema,
  type NotificationDto,
} from '@CeolX/shared/validators';

import { protectedProcedure, router } from '../index';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// Joined inbox row — notifications content + notification_users state.
type InboxRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  route: string;
  persona: string;
  isRead: boolean;
  createdAt: Date | string;
};

function toDto(row: InboxRow): NotificationDto {
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
  // The id returned is the notification_users.id — that's what mark-read /
  // archive mutations target.
  list: protectedProcedure.input(listNotificationsSchema).query(async ({ input, ctx }) => {
    const cutoff = new Date(Date.now() - NINETY_DAYS_MS);
    const where = and(
      eq(notificationUsers.userId, ctx.userId),
      isNull(notificationUsers.archivedAt),
      gt(notificationUsers.createdAt, cutoff)
    );
    const offset = (input.page - 1) * input.limit;

    const rows = (await db
      .select({
        id: notificationUsers.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        route: notifications.route,
        persona: notifications.persona,
        isRead: notificationUsers.isRead,
        createdAt: notificationUsers.createdAt,
      })
      .from(notificationUsers)
      .innerJoin(notifications, eq(notificationUsers.notificationId, notifications.id))
      .where(where)
      .orderBy(desc(notificationUsers.createdAt))
      .limit(input.limit)
      .offset(offset)) as InboxRow[];

    const totalRows = (await db
      .select({ total: count() })
      .from(notificationUsers)
      .where(where)) as Array<{ total: number }>;
    const total = Number(totalRows[0]?.total ?? 0);

    return {
      notifications: rows.map(toDto),
      total,
      hasMore: offset + rows.length < total,
    };
  }),

  // Mark a single notification_users row read. Idempotent — already-read
  // rows are no-ops. Scoped to caller's userId so users cannot mark
  // someone else's row.
  markAsRead: protectedProcedure
    .input(markNotificationReadSchema)
    .mutation(async ({ input, ctx }) => {
      await db
        .update(notificationUsers)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notificationUsers.id, input.id), eq(notificationUsers.userId, ctx.userId)))
        .returning({ id: notificationUsers.id });

      return { success: true as const };
    }),

  // Flip every unread row for the caller. Returns count for UX feedback.
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await db
      .update(notificationUsers)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notificationUsers.userId, ctx.userId), eq(notificationUsers.isRead, false)))
      .returning({ id: notificationUsers.id });

    return { success: true as const, marked: updated.length };
  }),

  // Badge count: unread notification_users rows for the caller.
  // V1 polled from the mobile app every 30s; replace with WebSocket post-V1.
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const rows = (await db
      .select({ count: count() })
      .from(notificationUsers)
      .where(
        and(eq(notificationUsers.userId, ctx.userId), eq(notificationUsers.isRead, false))
      )) as Array<{ count: number }>;

    return { count: Number(rows[0]?.count ?? 0) };
  }),
});
