import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { activationTokens, venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { env } from '@CeolX/env/server';
import { ACTIVATION_RETURN_PATHS, hasLiveBilling, type BillingInterval } from '@CeolX/shared';

import {
  createSubscriptionCheckoutSession,
  expireCheckoutSession,
  retrieveCheckoutSession,
  type ExistingCheckoutSession,
} from '../services/stripe';

/** Message for every "you are already paying" refusal, so the page copy is one thing. */
const ALREADY_SUBSCRIBED = 'This venue already has an active subscription';

/**
 * The Checkout Session this activation token has already opened, if any.
 *
 * Null both when the token has never opened one and when Stripe no longer knows the
 * stored id — the caller treats those the same way, by minting a fresh session.
 */
async function existingSessionForToken(tokenId: string): Promise<ExistingCheckoutSession | null> {
  const [row] = await db
    .select({ sessionId: activationTokens.checkoutSessionId })
    .from(activationTokens)
    .where(eq(activationTokens.id, tokenId))
    .limit(1);

  return row?.sessionId ? retrieveCheckoutSession(row.sessionId) : null;
}

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
      message: ALREADY_SUBSCRIBED,
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

  // D-49, the half the status check cannot cover: at most one *payable* Checkout
  // Session per activation token.
  //
  // Every guard above reads state that only the Stripe webhook writes, so in the window
  // before it lands there is nothing to read — and the activation email deliberately
  // carries two links, monthly and annual, behind the one token (D-08). Clicking both in
  // that window created two Stripe Customers, two subscriptions and two six-month
  // trials, and because `venue_subscriptions` is unique per venue only one could ever be
  // recorded: the other billed on with no trace in CeolX at all. Seen in test mode — one
  // token, two subscriptions, 102 seconds apart.
  //
  // The token is what the venue actually holds, which makes it the right thing to
  // enforce against, and unlike every other guard it needs no webhook to have arrived.
  const existing = activationTokenId ? await existingSessionForToken(activationTokenId) : null;

  if (existing?.status === 'complete') {
    // Paid, webhook still in flight. Answering with CONFLICT keeps the response the same
    // as it will be a second later, instead of putting a second payment page in front of
    // a venue who has already paid.
    throw new TRPCError({ code: 'CONFLICT', message: ALREADY_SUBSCRIBED });
  }

  if (existing?.status === 'open' && existing.url) {
    // Same plan: hand back the same page, so a double-click, an impatient reload and a
    // second device all converge on one session. A different plan is a change of mind,
    // which D-63 exists to allow — close the abandoned page before opening the new one,
    // or both links behind this token stay payable.
    if (existing.interval === interval) {
      return { url: existing.url, sessionId: existing.id };
    }
    await expireCheckoutSession(existing.id);
  }

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, '');

  const created = await createSubscriptionCheckoutSession({
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

  if (!activationTokenId) return created;

  // Claim the token's one session slot conditionally, so two requests that both got past
  // the read above cannot both record theirs. The condition matches on the session this
  // request set out to replace — null on a first click, the superseded id on a plan
  // change — which is what makes a competing write visible instead of silently lost.
  const [claimed] = await db
    .update(activationTokens)
    .set({ checkoutSessionId: created.sessionId })
    .where(
      and(
        eq(activationTokens.id, activationTokenId),
        existing
          ? eq(activationTokens.checkoutSessionId, existing.id)
          : isNull(activationTokens.checkoutSessionId)
      )
    )
    .returning({ id: activationTokens.id });

  if (claimed) return created;

  // Lost the claim: another request is the one of record. Ours must not survive as a
  // second payable page, so it is closed, and the venue is sent to the winning session.
  // It may be for the plan the other click chose rather than this one — the wrong page is
  // recoverable, two payable pages are not.
  await expireCheckoutSession(created.sessionId);

  const winner = await existingSessionForToken(activationTokenId);
  if (winner?.status === 'open' && winner.url) {
    return { url: winner.url, sessionId: winner.id };
  }

  // The winner is no longer payable, which in practice means it was just completed.
  throw new TRPCError({ code: 'CONFLICT', message: ALREADY_SUBSCRIBED });
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
