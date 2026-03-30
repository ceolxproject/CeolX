import { relations } from 'drizzle-orm';
import { boolean, index, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { subscriptionStatusEnum, userRoleEnum } from './enums';

// ---------------------------------------------------------------------------
// users — application-level user record (separate from BetterAuth's `user`).
// Shares the same UUID as auth.user — linked at the application layer on
// registration. BetterAuth owns auth identity; this table owns domain data.
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }),
    avatar: text('avatar'), // S3/CloudFront URL
    hashedPassword: varchar('hashed_password', { length: 255 }), // NULL for Google/Apple Sign-In users
    currentRole: userRoleEnum('current_role').notNull().default('spectator'),
    lastLoginAt: timestamp('last_login_at'),
    flaggedInactive: boolean('flagged_inactive').default(false), // set after 24 months inactivity (GDPR)
    consentAt: timestamp('consent_at').notNull(), // Privacy Policy + ToS acceptance — no default, must be explicit
    marketingConsent: boolean('marketing_consent').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('users_email_idx').on(t.email)]
);

// ---------------------------------------------------------------------------
// artist_profiles — one per user account, toggled via is_active on persona switch.
// NEVER delete a profile when a user switches away — flip is_active to false instead.
// ---------------------------------------------------------------------------
export const artistProfiles = pgTable('artist_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique() // one artist profile per user account
    .references(() => users.id, { onDelete: 'cascade' }),
  stageName: varchar('stage_name', { length: 255 }).notNull(),
  bio: text('bio'),
  genre: varchar('genre', { length: 100 }).notNull(),
  links: json('links'), // Array of { label: string; url: string }
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
  userId: uuid('user_id')
    .notNull()
    .unique() // one venue profile per user account
    .references(() => users.id, { onDelete: 'cascade' }),
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
export const usersRelations = relations(users, ({ one }) => ({
  artistProfile: one(artistProfiles, {
    fields: [users.id],
    references: [artistProfiles.userId],
  }),
  venueProfile: one(venueProfiles, {
    fields: [users.id],
    references: [venueProfiles.userId],
  }),
}));

export const artistProfilesRelations = relations(artistProfiles, ({ one }) => ({
  user: one(users, {
    fields: [artistProfiles.userId],
    references: [users.id],
  }),
}));

export const venueProfilesRelations = relations(venueProfiles, ({ one }) => ({
  user: one(users, {
    fields: [venueProfiles.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ArtistProfile = typeof artistProfiles.$inferSelect;
export type NewArtistProfile = typeof artistProfiles.$inferInsert;
export type VenueProfile = typeof venueProfiles.$inferSelect;
export type NewVenueProfile = typeof venueProfiles.$inferInsert;
