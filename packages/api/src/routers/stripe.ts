import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { env } from '@CeolX/env/server';
import { SubscriptionStatus, type BillingInterval } from '@CeolX/shared';
import { createCheckoutSessionSchema } from '@CeolX/shared/validators';

import { router, venueProcedure } from '../index';
import { createSubscriptionCheckoutSession } from '../services/stripe';

/** Statuses that already have live billing — a second checkout would double-charge. */
const ALREADY_SUBSCRIBED: readonly string[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

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
  if (ALREADY_SUBSCRIBED.includes(profile.subscriptionStatus)) {
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
    successUrl: `${origin}/activate/complete`,
    cancelUrl: `${origin}/activate/cancelled`,
  });
}

export const stripeRouter = router({
  /**
   * Create a Checkout Session for the authenticated venue.
   *
   * Note this is NOT how a venue normally reaches Stripe — the emailed link is
   * (D-16), and nothing in the mobile app may call this or surface the URL it
   * returns. It exists for the web activation route and for support use.
   *
   * The venue is resolved from the session, never from the input, so one venue can
   * never open a checkout against another.
   */
  createCheckoutSession: venueProcedure
    .input(createCheckoutSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const [profile] = await db
        .select({ id: venueProfiles.id })
        .from(venueProfiles)
        .where(eq(venueProfiles.userId, ctx.userId))
        .limit(1);

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No venue profile for this account' });
      }

      const [account] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, ctx.userId))
        .limit(1);

      if (!account?.email) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Account has no email address',
        });
      }

      const { url, sessionId } = await buildCheckoutSessionForVenue({
        userId: ctx.userId,
        venueId: profile.id,
        email: account.email,
        interval: input.plan,
      });

      return { checkoutUrl: url, sessionId };
    }),
});
