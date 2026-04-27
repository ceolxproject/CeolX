import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { platformEnum } from './enums';

// ─────────────────────────────────────────────────────────────────────────────
// notifications — content layer.
// One row per notification *message* (title, body, route, persona, type).
// Recipient state (who has read / archived it) lives in notification_users
// so that the same message can fan out to many users without duplicating
// the content (saved-event reminders, M9-T2 admin-removal cascades, etc).
//
// Valid `type` values come from packages/shared/src/notifications/triggers
// — kept as varchar (not enum) so milestones can add types without a
// schema migration.
// ─────────────────────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 100 }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  route: text('route').notNull(),
  persona: varchar('persona', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// notification_users — per-user delivery state.
// One row per (notification, user) pair. Mark-read, mark-all-read, archive,
// and delete operations all target this table — never `notifications`.
// ─────────────────────────────────────────────────────────────────────────────

export const notificationUsers = pgTable(
  'notification_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at'),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // Inbox list: newest-first per user, drives the main feed query.
    index('notification_users_user_created_idx').on(t.userId, t.createdAt.desc()),
    // Unread badge count: filtered scan per user.
    index('notification_users_user_unread_idx').on(t.userId, t.isRead),
    // Idempotency: a user receives a given notification at most once.
    uniqueIndex('notification_users_unique_idx').on(t.notificationId, t.userId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// device_tokens — FCM registration tokens per device.
// Unique on (user_id, fcm_token) — prevents duplicate registrations.
// Upsert pattern on app open:
//   INSERT ... ON CONFLICT (user_id, fcm_token) DO UPDATE SET updated_at = NOW()
// Clean up tokens when FCM returns UNREGISTERED error (token rotation).
// ─────────────────────────────────────────────────────────────────────────────

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    fcmToken: text('fcm_token').notNull(),
    platform: platformEnum('platform').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('device_tokens_user_token_idx').on(t.userId, t.fcmToken)]
);

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ many }) => ({
  recipients: many(notificationUsers),
}));

export const notificationUsersRelations = relations(notificationUsers, ({ one }) => ({
  notification: one(notifications, {
    fields: [notificationUsers.notificationId],
    references: [notifications.id],
  }),
  user: one(user, {
    fields: [notificationUsers.userId],
    references: [user.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(user, {
    fields: [deviceTokens.userId],
    references: [user.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationUser = typeof notificationUsers.$inferSelect;
export type NewNotificationUser = typeof notificationUsers.$inferInsert;
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
