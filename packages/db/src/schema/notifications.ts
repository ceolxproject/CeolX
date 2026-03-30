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

import { platformEnum } from './enums';
import { users } from './users';

// ---------------------------------------------------------------------------
// notifications — inbox for all in-app notifications across personas.
// type is varchar (not enum) — notification types evolve across milestones.
//   Valid types defined in packages/shared/src/constants.ts as NOTIFICATION_TYPES.
// payload is jsonb (not json) — binary, indexed, supports -> / #> operators.
//   Shape: { persona, route, title, body, action? } — see NotificationPayload in shared.
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(), // NotificationPayload from packages/shared
    read: boolean('read').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.read)]
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
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
