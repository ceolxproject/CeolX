import { relations } from 'drizzle-orm';
import { boolean, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { subscriptionStatusEnum } from './enums';

// ---------------------------------------------------------------------------
// artist_profiles — one per user account, toggled via is_active on persona switch.
// NEVER delete a profile when a user switches away — flip is_active to false instead.
// userId is text (not uuid) — matches BetterAuth's user.id type.
// ---------------------------------------------------------------------------
export const artistProfiles = pgTable('artist_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique() // one artist profile per user account
    .references(() => user.id, { onDelete: 'cascade' }),
  stageName: varchar('stage_name', { length: 255 }).notNull(),
  bio: text('bio'),
  contactEmail: varchar('contact_email', { length: 255 }), // public booking email, may differ from account email
  genre: varchar('genre', { length: 100 }), // nullable — not collected during initial onboarding
  links: json('links'), // Structured social links: { instagram?, facebook?, tiktok?, youtube? }
  isActive: boolean('is_active').default(true), // false when persona switched away
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// venue_profiles — one per user account. is_active gates visibility.
// subscription_status is a denormalized cache from venue_subscriptions —
// updated atomically by the Stripe webhook handler (M8-T2).
// ---------------------------------------------------------------------------
export const venueProfiles = pgTable('venue_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique() // one venue profile per user account
    .references(() => user.id, { onDelete: 'cascade' }),
  venueName: varchar('venue_name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  bio: text('bio'),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('inactive'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }), // set when Stripe customer is created
  isActive: boolean('is_active').default(false), // true only when subscription is active
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const artistProfilesRelations = relations(artistProfiles, ({ one }) => ({
  user: one(user, {
    fields: [artistProfiles.userId],
    references: [user.id],
  }),
}));

export const venueProfilesRelations = relations(venueProfiles, ({ one }) => ({
  user: one(user, {
    fields: [venueProfiles.userId],
    references: [user.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ArtistProfile = typeof artistProfiles.$inferSelect;
export type NewArtistProfile = typeof artistProfiles.$inferInsert;
export type VenueProfile = typeof venueProfiles.$inferSelect;
export type NewVenueProfile = typeof venueProfiles.$inferInsert;
