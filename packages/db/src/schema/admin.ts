import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { user } from './auth';

// ---------------------------------------------------------------------------
// admin_audit_log — append-only record of every admin action that mutates
// platform data (event removal, restore, future user suspensions, etc.).
//
// Why a generic shape rather than per-action tables:
//   * Each new admin action would otherwise demand a new schema migration.
//   * Reviewers and the future activity-feed UI care about a single
//     chronological stream — keep one table, query by (target_type, target_id)
//     for "what happened to this event" or by admin_id for "what did Sean do".
//
// `metadata` is intentionally jsonb (not a typed column) — different actions
// carry different context (previous values, affected user count for cascades,
// etc.) and we don't want a wide nullable schema. Strict typing happens at
// the call site via the `logAdminAction` helper.
//
// admin_id cascades on user delete: if a Super Admin account is anonymised
// (GDPR right-to-erasure), their actions are scrubbed too. The action history
// for the *target* (e.g. event) survives because it's joined to events.id
// indirectly via target_id (text), not a foreign key.
// ---------------------------------------------------------------------------
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: text('admin_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('admin_audit_log_target_idx').on(t.targetType, t.targetId),
    index('admin_audit_log_admin_idx').on(t.adminId),
  ]
);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLog = typeof adminAuditLog.$inferInsert;
