import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';

import { env } from '@CeolX/env/server';
import { BillingInterval } from '@CeolX/shared';

// Stripe — venue subscriptions (M8). This module is the only place that touches
// the Stripe SDK or reads STRIPE_* configuration, so routers stay free of both.
//
// Deliberately no `apiVersion` is passed: the SDK falls back to its own pinned
// version (`props.apiVersion || DEFAULT_API_VERSION` in stripe.core.js), which is
// the exact version its TypeScript types were generated against. Hardcoding a
// version string here would be a second source of truth that silently drifts from
// the installed SDK on the next upgrade. Pin it only to deliberately lag behind.

/**
 * Dashboard label for every session this flow creates.
 *
 * Stripe's guidance for API version 2026-03-25.dahlia and later is to tag Checkout
 * Sessions with `integration_identifier`, including an 8-letter random suffix, so
 * flows can be compared in the Dashboard. It is deliberately a fixed constant
 * rather than per-call: the whole point is that every session from this flow
 * carries the SAME label so they aggregate into one row.
 */
const CHECKOUT_INTEGRATION_IDENTIFIER = 'ceolx-venue-subscription-krtmvhqz';

let cachedClient: Stripe | null = null;

/**
 * Lazily construct and cache the Stripe client.
 *
 * Configuration is optional in the env schema so the server, the admin app and
 * every test suite boot without billing set up. The cost of that choice is paid
 * here: the first call with a missing key throws a loud PRECONDITION_FAILED
 * naming the variable, rather than a confusing Stripe auth error later.
 */
export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;

  const { STRIPE_SECRET_KEY } = env;
  if (!STRIPE_SECRET_KEY) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY.',
    });
  }

  cachedClient = new Stripe(STRIPE_SECRET_KEY);
  return cachedClient;
}

/** Test seam — the module-level cache would otherwise leak across cases. */
export function __resetStripeClientForTests(): void {
  cachedClient = null;
}

/**
 * Resolve a billing interval to its Stripe Price ID.
 *
 * The interval is the only plan value that ever crosses a trust boundary
 * (M8-T0 D-08); the Price ID lives in configuration and is resolved here. That
 * is what stops a crafted activation link from pointing checkout at an arbitrary
 * Price — including one belonging to another account, or one priced at zero.
 */
export function priceIdForInterval(interval: BillingInterval): string {
  const isMonthly = interval === BillingInterval.MONTHLY;
  const priceId = isMonthly ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_ANNUAL;

  if (!priceId) {
    const varName = isMonthly ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_ANNUAL';
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `Stripe is not configured. Set ${varName}.`,
    });
  }

  return priceId;
}

/**
 * Verify a webhook signature and return the parsed event.
 *
 * Signature verification is the whole security model of the webhook endpoint: the
 * URL is public and unauthenticated, so this is the only thing distinguishing
 * Stripe from anyone who can POST. It must run before the payload is read for any
 * purpose, and the RAW body must reach it unparsed — re-serialising the JSON
 * changes the bytes and the signature no longer matches.
 *
 * Throws on a missing secret, a missing signature, or a bad signature. The caller
 * turns all three into a 400.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string | undefined
): Stripe.Event {
  const { STRIPE_WEBHOOK_SECRET } = env;
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Stripe is not configured. Set STRIPE_WEBHOOK_SECRET.',
    });
  }
  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }

  return getStripeClient().webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Create a Stripe Customer Portal session (M8-T0 D-45).
 *
 * The Portal is where cards, cancellation, plan switching and invoices all live —
 * we build no billing screens of our own, so there is nothing here to keep in step
 * with Stripe.
 *
 * The returned URL is a bearer credential for someone's billing account and is
 * short-lived by design. It is never stored and never reused: every request mints
 * a fresh one (D-45).
 *
 * Note the Portal's own configuration — cancel-at-period-end, prorated upgrades,
 * downgrades scheduled to period end (D-39, D-43) — lives in the Stripe Dashboard,
 * not here. It is environment-specific: test-mode and live-mode configurations are
 * separate objects, so configuring one does not configure the other.
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<string> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Stripe returned a Billing Portal session without a url',
    });
  }

  return session.url;
}

export interface PriceSummary {
  /** Localised for display, e.g. "€19.99". */
  formatted: string;
  /** Minor units, exactly as Stripe reports them. */
  unitAmount: number;
  currency: string;
}

let cachedPriceSummaries: Record<BillingInterval, PriceSummary> | null = null;

/** Test seam — the price cache would otherwise leak across cases. */
export function __resetPriceSummaryCacheForTests(): void {
  cachedPriceSummaries = null;
}

/**
 * Fetch both Prices from Stripe and format them for display.
 *
 * The activation email states what the venue will be charged, so the amount has
 * to come from Stripe rather than a constant in our code or a second env var —
 * either would be a duplicate that silently drifts, and an email quoting the
 * wrong price to an EU consumer is not a cosmetic bug.
 *
 * Cached for the life of the process, which is safe because a Stripe Price's
 * `unit_amount` is immutable: changing what you charge means creating a *new*
 * Price, which means new configuration and a new deploy anyway.
 *
 * Throws if Stripe is unreachable. Callers that merely want nicer button labels
 * should treat that as non-fatal — see `venues.requestActivation`.
 */
export async function getPriceSummaries(): Promise<Record<BillingInterval, PriceSummary>> {
  if (cachedPriceSummaries) return cachedPriceSummaries;

  const stripe = getStripeClient();
  const [monthly, annual] = await Promise.all([
    stripe.prices.retrieve(priceIdForInterval(BillingInterval.MONTHLY)),
    stripe.prices.retrieve(priceIdForInterval(BillingInterval.ANNUAL)),
  ]);

  const summarise = (price: { unit_amount: number | null; currency: string }): PriceSummary => {
    const unitAmount = price.unit_amount ?? 0;
    const currency = price.currency.toUpperCase();
    return {
      unitAmount,
      currency,
      // en-IE: the audience is Irish venues and the product is priced in euro.
      formatted: new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(
        unitAmount / 100
      ),
    };
  };

  cachedPriceSummaries = { monthly: summarise(monthly), annual: summarise(annual) };
  return cachedPriceSummaries;
}

export interface CreateSubscriptionCheckoutParams {
  interval: BillingInterval;
  /** CeolX user id — the join key between a Stripe payment and an account. */
  userId: string;
  /** Venue profile id, carried through so the webhook needs no second lookup. */
  venueId: string;
  /** Account email, prefilled into Checkout for convenience only. */
  email: string;
  /** Reuse an existing Stripe customer when the venue already has one (D-21). */
  stripeCustomerId?: string | null;
  /**
   * Trial length in days, or null for no trial. Callers pass null once a venue
   * has already consumed its one trial (D-42) — this module does not decide
   * eligibility, it only applies what it is given.
   */
  trialDays: number | null;
  /**
   * Activation token row id, when the session was started from an emailed link.
   * Travels to Stripe so the webhook can mark the token consumed on successful
   * payment (D-17) without ever holding the raw token. An id rather than the hash,
   * so no credential-derived material leaves our system.
   */
  activationTokenId?: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a subscription Checkout Session.
 *
 * A card is always collected: `payment_method_collection` defaults to `'always'`,
 * which is what D-05 requires, so it is left unset rather than restated.
 *
 * The account is matched by `client_reference_id` and `metadata`, never by email
 * (D-23) — a venue may legitimately pay with someone else's card or a different
 * billing address, and matching on email would attach that payment to the wrong
 * account or none at all.
 */
export async function createSubscriptionCheckoutSession(
  params: CreateSubscriptionCheckoutParams
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    // No `automatic_tax` — deliberate, and NOT a Dashboard toggle.
    //
    // It defaults to disabled on API-created Sessions, so enabling Stripe Tax in the
    // Dashboard changes nothing here. Chongie has no Irish VAT registration confirmed
    // yet (D-66), and with `tax_behavior: 'inclusive'` Prices the result either way is
    // €19.99 with €0.00 VAT and no error raised.
    //
    // To switch it on: add `automatic_tax: { enabled: true }` AND
    // `customer_update: { address: 'auto' }` (required because we reuse an existing
    // Customer and Stripe needs an address to pick a rate), then verify VAT appears as
    // a line on a real test invoice. Registration first — enabling it without one is
    // indistinguishable from this state. Blocking item in M12-T3.
    integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
    // `payment_method_types` is deliberately absent. Stripe determines eligible
    // methods dynamically from Dashboard settings; hardcoding ['card'] would lock
    // out methods that improve conversion, and Stripe's own guidance is to never
    // pass it outside Terminal integrations.
    line_items: [{ price: priceIdForInterval(params.interval), quantity: 1 }],
    // Reusing the customer keeps one Stripe customer per venue for the account's
    // lifetime, which is what makes "one free trial ever" enforceable (D-42) and
    // keeps billing history in a single place. Only prefill the email when there
    // is no customer yet — Stripe rejects both together.
    ...(params.stripeCustomerId
      ? { customer: params.stripeCustomerId }
      : { customer_email: params.email }),
    client_reference_id: params.userId,
    // Mirrored onto the subscription as well: the webhook reads the subscription,
    // not the session (M8-T3), so metadata set only on the session is invisible
    // to it.
    metadata: { userId: params.userId, venueId: params.venueId },
    subscription_data: {
      metadata: {
        userId: params.userId,
        venueId: params.venueId,
        ...(params.activationTokenId ? { activationTokenId: params.activationTokenId } : {}),
      },
      ...(params.trialDays === null
        ? {}
        : {
            trial_period_days: params.trialDays,
            // Belt and braces. A card is collected up front, so this should be
            // unreachable — but if Stripe ever ends a trial with no usable payment
            // method, cancel rather than raising an invoice nobody agreed to.
            trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
          }),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    // Only happens for non-hosted UI modes, which we never request. Treated as a
    // server fault rather than silently handing the caller an empty redirect.
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Stripe returned a Checkout Session without a url',
    });
  }

  return { url: session.url, sessionId: session.id };
}
