import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { billingIntervalEnum } from './enums';
import { venueProfiles } from './users';

// ---------------------------------------------------------------------------
// Venue subscriptions and activation tokens (M8).
//
// A note on timestamps. Every other table in this schema uses `timestamp`
// without a timezone, and these tables deliberately do not. `timestamp without
// time zone` is read back by node-postgres in the *process's* local timezone,
// so a server or developer machine outside UTC shifts the value — this codebase
// is developed in IST, a 5h30m offset. For an event's start time that is a
// cosmetic bug; for a trial end date it moves money, and for a token expiry it
// is a security boundary that could be extended by five and a half hours.
//
// Both tables therefore use timestamptz. venue_subscriptions had zero rows when
// this landed, so converting its existing columns cost nothing. The other 60
// naive timestamp columns are a pre-existing hazard and want their own ticket —
// widening that here would have made this migration unreviewable.
// ---------------------------------------------------------------------------

/**
 * venue_subscriptions — the Stripe billing record for a venue.
 *
 * One row per venue (unique on venue_id). A venue that cancels and resubscribes
 * updates the existing row; subscription history lives in Stripe, not here.
 *
 * This table deliberately holds NO status column. `venue_profiles.subscription_status`
 * is the single source of subscription state (M8-T0 D-14) — it is what the
 * visibility predicate, users.me, venues.byId and the admin counts all read, and
 * keeping a second copy here invited exactly the drift D-14 exists to prevent.
 * The Stripe webhook (M8-T3) is the only writer of either this row or that column.
 */
export const venueSubscriptions = pgTable(
  'venue_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venueId: uuid('venue_id')
      .notNull()
      .unique() // one subscription record per venue
      .references(() => venueProfiles.id, { onDelete: 'cascade' }),
    // Nullable: a Stripe customer is created before any subscription exists, so a
    // venue can legitimately hold a customer id and no subscription id yet (D-21).
    // Reusing one customer per venue for the account's lifetime is also what makes
    // "one free trial, ever" enforceable (D-42).
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    // Kept as `plan` per D-07 — the column is reused rather than renamed. No
    // default: an interval is always known when a subscription is written, and
    // defaulting to 'monthly' would silently mislabel an annual subscriber if a
    // writer ever forgot to set it.
    plan: billingIntervalEnum('plan').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    /**
     * When the free trial ends (D-05). Also the record of trial *consumption*:
     * a non-null value means this account has had its one trial, so a returning
     * venue gets no second one (D-42). It is never cleared — that is the point,
     * and it is why no separate `trial_used` flag exists.
     */
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    /** Cancelled but still inside the paid period (D-39) — access continues. */
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    /**
     * When the current run of failed payments began. The grace window (D-33) is
     * this plus STRIPE_GRACE_DAYS, evaluated at read time rather than by a job,
     * so the webhook stays the only writer of subscription state (D-22).
     * Cleared on recovery.
     */
    pastDueSince: timestamp('past_due_since', { withTimezone: true }),
    /**
     * Set when a chargeback arrives (D-51). Blocks resubscription until an admin
     * reviews the account — a dispute on delivered service is a warning sign, and
     * letting the same disputed card straight back in invites repeat abuse.
     */
    billingBlocked: boolean('billing_blocked').notNull().default(false),
    /**
     * Last time a Customer Portal link was emailed for this venue.
     *
     * Backs the cooldown on `venues.requestBillingPortal`. A dedicated column
     * rather than `updated_at`, because that one is written by the Stripe webhook
     * on every subscription event and would reset the cooldown constantly. Each
     * request mints a real Stripe session, so this guards spend as well as spam.
     */
    lastPortalRequestAt: timestamp('last_portal_request_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // The webhook resolves a row by Stripe's subscription id on every event.
    index('venue_subscriptions_stripe_subscription_id_idx').on(t.stripeSubscriptionId),
  ]
);

/**
 * activation_tokens — one-time links that carry a venue into Stripe Checkout.
 *
 * The token is the only credential on the activation path: the emailed link is
 * the sole route to payment (D-16), and it must work for accounts created via
 * Google or Apple that have no password at all (D-19). It is therefore treated
 * as a credential, not an identifier:
 *
 *   - Only a SHA-256 hash is stored. A database or backup disclosure must not
 *     yield usable activation links.
 *   - `expires_at` is absolute, set from ACTIVATION_TOKEN_TTL_MINUTES (D-17).
 *   - `consumed_at` is stamped on successful payment, not on page load — a venue
 *     who opens the link and closes the tab must be able to return (D-24).
 *   - Issuing a new token invalidates every earlier unconsumed one for that user
 *     (D-18), which is why user_id is indexed.
 *
 * Keyed on user_id rather than venue_id because the token identifies the account
 * (D-17), and the same id is what joins the eventual Stripe payment back to it.
 *
 * Deliberately NOT better-auth's `verification` table: that table deletes every
 * expired row as a side effect of any unrelated verification lookup, which would
 * destroy the difference between "expired" and "never existed" — and D-24
 * requires us to tell a venue their link expired and offer a fresh one.
 */
export const activationTokens = pgTable(
  'activation_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // text, not uuid — better-auth's user.id is text.
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** SHA-256 of the raw token, base64url. The raw value is never persisted. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Bulk-invalidate every prior token for a user when a new one is issued (D-18).
    index('activation_tokens_user_id_idx').on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const venueSubscriptionsRelations = relations(venueSubscriptions, ({ one }) => ({
  venue: one(venueProfiles, {
    fields: [venueSubscriptions.venueId],
    references: [venueProfiles.id],
  }),
}));

export const activationTokensRelations = relations(activationTokens, ({ one }) => ({
  user: one(user, {
    fields: [activationTokens.userId],
    references: [user.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type VenueSubscription = typeof venueSubscriptions.$inferSelect;
export type NewVenueSubscription = typeof venueSubscriptions.$inferInsert;
export type ActivationToken = typeof activationTokens.$inferSelect;
export type NewActivationToken = typeof activationTokens.$inferInsert;
