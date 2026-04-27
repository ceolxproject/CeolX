import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { platformEnum } from './enums';

// ---------------------------------------------------------------------------
// notifications — inbox for all in-app notifications across personas.
// type is varchar (not enum) — notification types evolve across milestones.
//   Valid types defined in packages/shared/src/constants.ts as NOTIFICATION_TYPES.
// title/body/route/persona are flat columns (M7-T2 inbox spec). The earlier
// JSONB payload was migrated to top-level columns to satisfy R1.2 and to
// keep query plans simple for the inbox list endpoint.
//
// Two-migration sequence for the flat-column rollout:
//   1. add nullable flat columns + backfill from payload (additive)
//   2. drop legacy `payload` and `read` columns + tighten NOT NULL
// During (1), legacy `payload` and `read` still exist; remove them only
// after every writer is updated and rows are backfilled.
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 100 }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    route: text('route').notNull(),
    persona: varchar('persona', { length: 20 }).notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    archivedAt: timestamp('archived_at'),
    // Legacy JSONB payload — still present in DB until migration 2 drops it.
    // New writers must not set this. Reads ignore it.
    payload: jsonb('payload'),
    // Legacy boolean — superseded by is_read. Drop in migration 2.
    read: boolean('read'),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('notifications_user_unread_idx').on(t.userId, t.isRead),
  ]
);

// ---------------------------------------------------------------------------
// device_tokens — FCM registration tokens per device.
// Unique on (user_id, fcm_token) — prevents duplicate registrations.
// Upsert pattern on app open:
//   INSERT ... ON CONFLICT (user_id, fcm_token) DO UPDATE SET updated_at = NOW()
// Clean up tokens when FCM returns UNREGISTERED error (token rotation).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(user, {
    fields: [deviceTokens.userId],
    references: [user.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
