import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { eventStatusEnum } from './enums';
import { venueProfiles } from './users';

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
    ticketPrice: integer('ticket_price'), // stored in cents (e.g. 49900 = €499.00)
    isGigOpportunity: boolean('is_gig_opportunity'), // DEPRECATED — nullable, no longer written
    unregisteredCollaborators: jsonb('unregistered_collaborators')
      .$type<Array<{ name: string; email: string }>>()
      .default([]),
    collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
    adTitle: varchar('ad_title', { length: 100 }),
    adDescription: varchar('ad_description', { length: 50 }),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: eventStatusEnum('status').notNull().default('active'),
    rejectionReason: text('rejection_reason'), // legacy — kept for enum compat, not used in V1
    removalReason: text('removal_reason'), // populated by admin on post-publication takedown
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
    // Valid global coordinate ranges
    check('lat_range_check', sql`${t.lat} BETWEEN -90 AND 90`),
    check('lng_range_check', sql`${t.lng} BETWEEN -180 AND 180`),
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
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_events_user_event_idx').on(t.userId, t.eventId)]
);

// ---------------------------------------------------------------------------
// event_collaborators — artists collaborating on an event. Managed by the
// event creator. Separate table (not array column) for relational queries
// like "which artists are available on this date".
// ---------------------------------------------------------------------------
export const eventCollaborators = pgTable(
  'event_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    artistProfileId: text('artist_profile_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('event_collaborators_event_artist_idx').on(t.eventId, t.artistProfileId),
    index('event_collaborators_event_idx').on(t.eventId),
  ]
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
  creator: one(user, {
    fields: [events.createdBy],
    references: [user.id],
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
  collaborators: many(eventCollaborators),
}));

export const savedEventsRelations = relations(savedEvents, ({ one }) => ({
  user: one(user, {
    fields: [savedEvents.userId],
    references: [user.id],
  }),
  event: one(events, {
    fields: [savedEvents.eventId],
    references: [events.id],
  }),
}));

export const eventCollaboratorsRelations = relations(eventCollaborators, ({ one }) => ({
  event: one(events, {
    fields: [eventCollaborators.eventId],
    references: [events.id],
  }),
  artist: one(user, {
    fields: [eventCollaborators.artistProfileId],
    references: [user.id],
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
export type EventCollaborator = typeof eventCollaborators.$inferSelect;
export type NewEventCollaborator = typeof eventCollaborators.$inferInsert;
