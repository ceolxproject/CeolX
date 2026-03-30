import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { bookingDirectionEnum, bookingStatusEnum, subscriptionStatusEnum } from './enums';
import { events } from './events';
import { artistProfiles, venueProfiles } from './users';

// ---------------------------------------------------------------------------
// bookings — bidirectional Artist ↔ Venue engagement.
// direction disambiguates who initiated:
//   venue_to_artist = venue sent an invitation to an artist
//   artist_to_venue = artist applied to a gig opportunity (is_gig_opportunity=true)
//
// event_id is nullable — a venue can send a general inquiry without attaching
// it to a specific event.
//
// State machine (enforced at application layer, not DB):
//   pending → accepted | rejected
//   accepted → cancelled (either party)
// ---------------------------------------------------------------------------
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artistProfiles.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venueProfiles.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    status: bookingStatusEnum('status').notNull().default('pending'),
    direction: bookingDirectionEnum('direction').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('bookings_artist_status_idx').on(t.artistId, t.status),
    index('bookings_venue_status_idx').on(t.venueId, t.status),
  ]
);

// ---------------------------------------------------------------------------
// venue_subscriptions — source of truth for Stripe billing lifecycle.
// One subscription per venue (unique on venue_id). If a venue cancels and
// resubscribes, the existing row is updated — not replaced.
// Subscription history lives in the Stripe dashboard, not here.
//
// plan is varchar (not enum) — Lite/Pro tiers are not finalised with the client
// (Open Item #2 in CLAUDE.md). Avoid enum migration pain when tiers are confirmed.
// ---------------------------------------------------------------------------
export const venueSubscriptions = pgTable('venue_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  venueId: uuid('venue_id')
    .notNull()
    .unique() // one active subscription per venue
    .references(() => venueProfiles.id, { onDelete: 'cascade' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(), // cus_xxx
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull(), // sub_xxx
  plan: varchar('plan', { length: 50 }).notNull().default('lite'), // varchar not enum — tiers TBC
  status: subscriptionStatusEnum('status').notNull().default('inactive'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const bookingsRelations = relations(bookings, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [bookings.artistId],
    references: [artistProfiles.id],
  }),
  venue: one(venueProfiles, {
    fields: [bookings.venueId],
    references: [venueProfiles.id],
  }),
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.id],
  }),
}));

export const venueSubscriptionsRelations = relations(venueSubscriptions, ({ one }) => ({
  venue: one(venueProfiles, {
    fields: [venueSubscriptions.venueId],
    references: [venueProfiles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type VenueSubscription = typeof venueSubscriptions.$inferSelect;
export type NewVenueSubscription = typeof venueSubscriptions.$inferInsert;
