import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

// ---------------------------------------------------------------------------
// collaboration_interests — append-log of "Share Interest" signals between
// artists and venues (not tied to any event). One row per accepted tap.
// The most recent row for a (sender, recipient) pair drives the 24h cooldown
// that blocks spamming the same recipient. Directional: A→B and B→A are
// independent rows, so mutual interest is never blocked.
// userId columns are text — matches BetterAuth's user.id type.
// ---------------------------------------------------------------------------
export const collaborationInterests = pgTable(
  'collaboration_interests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('collaboration_interests_pair_idx').on(t.senderUserId, t.recipientUserId)]
);
