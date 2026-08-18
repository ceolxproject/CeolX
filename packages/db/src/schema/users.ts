import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { socialPlatformEnum, subscriptionStatusEnum } from './enums';

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
  genre: varchar('genre', { length: 100 }), // DEPRECATED: use `genres` (text[]) instead — kept for backward compat
  genres: text('genres').array().default([]),
  location: varchar('location', { length: 255 }),
  profileImageUrl: text('profile_image_url'), // CDN URL — populated via presigned S3 upload (M10-T1)
  coverImageUrl: text('cover_image_url'), // CDN URL — populated via presigned S3 upload (M10-T1)
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
  county: varchar('county', { length: 100 }),
  bio: text('bio'),
  contactEmail: varchar('contact_email', { length: 255 }), // public booking email for artists to contact venue
  lat: numeric('lat', { precision: 10, scale: 7 }), // same precision as events table
  lng: numeric('lng', { precision: 10, scale: 7 }),
  profileImageUrl: text('profile_image_url'), // CDN URL — populated via presigned S3 upload (M10-T1)
  coverImageUrl: text('cover_image_url'), // CDN URL — populated via presigned S3 upload (M10-T1)
  websiteUrl: text('website_url'),
  phone: varchar('phone', { length: 30 }),
  // The single source of subscription state (M8-T0 D-14). Written only by the
  // Stripe webhook (D-22); read by the visibility predicate and every surface
  // that gates on it. `venue_subscriptions` holds the billing record and
  // deliberately has no status column of its own.
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('inactive'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }), // set when Stripe customer is created
  // `is_active` removed in M8-T1 (D-14). It duplicated subscription_status while
  // meaning the exact opposite of artist_profiles.is_active ("persona switched
  // away", default true) in tables that get joined together — a find-and-replace
  // waiting to take out the artist gate. It also never once held `true`: the only
  // writers ever set it false. Visibility now comes from venueVisibilityFor().
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// profile_social_links — one row per platform per user.
// Shared across both artist and venue roles — links persist on persona switch.
// Unique constraint on (user_id, platform) prevents duplicate entries.
// ---------------------------------------------------------------------------
export const profileSocialLinks = pgTable(
  'profile_social_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: socialPlatformEnum('platform').notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('profile_social_links_user_id_idx').on(t.userId),
    unique('profile_social_links_user_platform_uniq').on(t.userId, t.platform),
  ]
);

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

export const profileSocialLinksRelations = relations(profileSocialLinks, ({ one }) => ({
  user: one(user, {
    fields: [profileSocialLinks.userId],
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
export type ProfileSocialLink = typeof profileSocialLinks.$inferSelect;
export type NewProfileSocialLink = typeof profileSocialLinks.$inferInsert;
