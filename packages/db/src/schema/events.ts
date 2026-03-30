import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { eventStatusEnum } from './enums';
import { users, venueProfiles } from './users';

// ---------------------------------------------------------------------------
// collections — declared before events because events.collection_id FKs here.
// Only venues can create collections.
// ---------------------------------------------------------------------------
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  logo: text('logo'), // S3/CloudFront URL
  createdBy: uuid('created_by')
    .notNull()
    .references(() => venueProfiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// events — the most query-intensive table. Serves map viewport queries, feed,
// moderation queue, and creator dashboards.
//
// Indexes:
//   events_spatial_idx  — GIST on ll_to_earth(lat, lng) WHERE status='active'
//                         Fast bounding-box map queries (earthdistance extension required)
//   events_status_date_idx — B-tree on (status, date_start) for feed/map filtering
//   events_created_by_idx  — B-tree on (created_by, status) for "My Events" list
//
// Check constraints enforce valid Irish coordinate ranges and sane date ordering.
// ---------------------------------------------------------------------------
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    coverImage: text('cover_image'), // S3/CloudFront URL
    dateStart: timestamp('date_start').notNull(),
    dateEnd: timestamp('date_end'), // null for single-day events
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(), // ~1.1m precision
    lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
    venueId: uuid('venue_id').references(() => venueProfiles.id, { onDelete: 'set null' }),
    venueAddress: text('venue_address'), // free-text fallback when no registered venue
    category: varchar('category', { length: 100 }).notNull(),
    ticketLink: text('ticket_link'), // external URL — not validated in DB
    isGigOpportunity: boolean('is_gig_opportunity').default(false), // visible to Artists only when true
    collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: eventStatusEnum('status').notNull().default('draft'),
    rejectionReason: text('rejection_reason'), // populated only when status = 'rejected'
    viewCount: integer('view_count').default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // GIST partial index — only active events appear on the map
    // Requires: CREATE EXTENSION IF NOT EXISTS cube; CREATE EXTENSION IF NOT EXISTS earthdistance;
    index('events_spatial_idx')
      .using('gist', sql`ll_to_earth(${t.lat}, ${t.lng})`)
      .where(sql`${t.status} = 'active'`),
    index('events_status_date_idx').on(t.status, t.dateStart),
    index('events_created_by_idx').on(t.createdBy, t.status),
    // Valid Irish coordinate ranges
    check('lat_range_check', sql`${t.lat} BETWEEN 51 AND 55`),
    check('lng_range_check', sql`${t.lng} BETWEEN -11 AND -5`),
    check('date_range_check', sql`${t.dateEnd} IS NULL OR ${t.dateEnd} >= ${t.dateStart}`),
  ]
);

// ---------------------------------------------------------------------------
// saved_events — spectator/artist bookmarks. Unique constraint enables
// idempotent save/unsave (INSERT ON CONFLICT DO NOTHING / DELETE).
// ---------------------------------------------------------------------------
export const savedEvents = pgTable(
  'saved_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_events_user_event_idx').on(t.userId, t.eventId)]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  createdBy: one(venueProfiles, {
    fields: [collections.createdBy],
    references: [venueProfiles.id],
  }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
  venue: one(venueProfiles, {
    fields: [events.venueId],
    references: [venueProfiles.id],
  }),
  collection: one(collections, {
    fields: [events.collectionId],
    references: [collections.id],
  }),
  savedBy: many(savedEvents),
}));

export const savedEventsRelations = relations(savedEvents, ({ one }) => ({
  user: one(users, {
    fields: [savedEvents.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [savedEvents.eventId],
    references: [events.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type SavedEvent = typeof savedEvents.$inferSelect;
export type NewSavedEvent = typeof savedEvents.$inferInsert;
