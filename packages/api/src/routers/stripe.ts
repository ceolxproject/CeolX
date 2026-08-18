import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { env } from '@CeolX/env/server';
import { ACTIVATION_RETURN_PATHS, hasLiveBilling, type BillingInterval } from '@CeolX/shared';

import { createSubscriptionCheckoutSession } from '../services/stripe';

/** Statuses that already have live billing — a second checkout would double-charge. */

export interface CheckoutContext {
  userId: string;
  venueId: string;
  email: string;
  interval: BillingInterval;
  /** Set when the session was started from an emailed activation link. */
  activationTokenId?: string;
}

/**
 * Build a Checkout Session for a venue, applying every guard.
 *
 * Extracted from the tRPC procedure because `GET /activate` needs exactly the same
 * logic — the token-bearing link is the primary route (M8-T0 D-60) and the mutation
 * is the authenticated equivalent. Duplicating the guards across the two entry
 * points is how one of them ends up missing the chargeback check.
 */
export async function buildCheckoutSessionForVenue({
  userId,
  venueId,
  email,
  interval,
  activationTokenId,
}: CheckoutContext): Promise<{ url: string; sessionId: string }> {
  const [profile] = await db
    .select({ id: venueProfiles.id, subscriptionStatus: venueProfiles.subscriptionStatus })
    .from(venueProfiles)
    .where(eq(venueProfiles.id, venueId))
    .limit(1);

  if (!profile) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'No venue profile for this account' });
  }

  // D-49: refuse a second checkout while one is already live. This is the guard
  // that makes double-clicking, two devices and an impatient reload harmless.
  if (hasLiveBilling(profile.subscriptionStatus)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'This venue already has an active subscription',
    });
  }

  const [subscription] = await db
    .select({
      stripeCustomerId: venueSubscriptions.stripeCustomerId,
      trialEndsAt: venueSubscriptions.trialEndsAt,
      billingBlocked: venueSubscriptions.billingBlocked,
    })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.venueId, profile.id))
    .limit(1);

  // D-51: a chargeback blocks resubscription until an admin reviews the account.
  if (subscription?.billingBlocked) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This account is under billing review. Please contact support.',
    });
  }

  // D-42: one free trial per account, ever. A recorded trial end date is the proof
  // the trial was consumed — it is never cleared, which is why no separate flag
  // exists. A returning venue pays from day one.
  const trialDays = subscription?.trialEndsAt ? null : env.STRIPE_TRIAL_DAYS;

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, '');

  return createSubscriptionCheckoutSession({
    interval,
    userId,
    venueId: profile.id,
    email,
    stripeCustomerId: subscription?.stripeCustomerId,
    trialDays,
    activationTokenId,
    successUrl: `${origin}${ACTIVATION_RETURN_PATHS.complete}`,
    cancelUrl: `${origin}${ACTIVATION_RETURN_PATHS.cancelled}`,
  });
}

/**
 * No tRPC surface for checkout — deliberately (D-16).
 *
 * `stripeRouter` used to expose `createCheckoutSession`, which returned a live Stripe
 * Checkout URL to any authenticated venue. Nothing in the app called it, but its mere
 * existence left the Apple Rule 3.1.1 position one client change away from breaking:
 * the rule is about a payment URL being reachable from inside the app, not about which
 * screen happens to open it.
 *
 * Checkout is minted server-side only, by `GET /activate` in apps/server, which 302s
 * the browser straight to Stripe. `buildCheckoutSessionForVenue` above is the single
 * entry point and carries all the guards.
 */
