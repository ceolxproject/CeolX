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
 * The inverse of `priceIdForInterval` — which of our two intervals a Price id is.
 *
 * Deliberately a local lookup rather than a Stripe fetch: it is called from the webhook
 * while resolving a scheduled plan change, and a subscription schedule gives its phases
 * as bare Price ids. Two configured ids answer the question without a network round trip
 * on a path that already re-reads the subscription.
 *
 * Returns null for anything unrecognised — a legacy or hand-made Price — so the caller
 * records "no pending change" rather than mislabelling one.
 */
export function intervalForPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_MONTHLY) return BillingInterval.MONTHLY;
  if (priceId === env.STRIPE_PRICE_ANNUAL) return BillingInterval.ANNUAL;
  return null;
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
export async function createBillingPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: stripeCustomerId,
    // No `return_url` — deliberate, and the reason there is no parameter for one (D-71).
    //
    // Passing one makes Stripe render a "← Return to CeolX" link that deep-links back
    // into the app, and that round trip is exactly what an App Review reader should not
    // be able to draw: the app is already careful never to show a price or a payment URL
    // (D-16), and a return path from the payment page undoes that care from the far end.
    // Verified by rendering the hosted page headless both ways — with a return_url the
    // page carries "Return to CeolX" and three links to ceolx.com; without it, none at
    // all. The venue closes the tab and reopens the app, which costs them nothing.
    //
    // The configuration's `default_return_url` would put the link back on its own, so it
    // must stay unset in **both** modes — test and live are separate objects (M12-T3).
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
    // Charge in euro, always — never Stripe's Adaptive Pricing conversion.
    //
    // Adaptive Pricing defaults to the *Dashboard* setting, and with it on a venue
    // outside the eurozone is quoted their local currency plus a **4% conversion fee**:
    // a test checkout from India rendered "₹22,923.04 per year — 1 EUR = 115.1912 INR
    // (includes 4% conversion fee)" and no euro figure anywhere on the page.
    //
    // Two things break if that reaches a customer. D-04 fixed the price at €19.99 / €199,
    // and a 4% markup is not that price. Worse, every figure we email is read from the
    // Price in euro (`getPriceSummaries`), so the trial-ending warning would quote €199
    // while the card is charged a number the venue has never seen — which is exactly the
    // mismatch D-30 exists to prevent, in the one email whose whole job is to prevent a
    // chargeback. CeolX has global access, so this is reachable, not hypothetical.
    //
    // Set in code rather than left to the Dashboard toggle, for the same reason VAT is
    // (M12-T3): a billing rule that a click can silently reverse is not a rule.
    adaptive_pricing: { enabled: false },
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
    //
    // `accountType` is a constant — only venues ever hold a subscription, so nothing
    // reads it and `venueId` already implies it. It is here because the AC asks for
    // "user ID plus account type in metadata" and a tester inspecting the session in
    // the Stripe Dashboard should find what the criterion promises. It also gives that
    // Dashboard view a persona without a CeolX lookup.
    metadata: { userId: params.userId, venueId: params.venueId, accountType: 'venue' },
    subscription_data: {
      metadata: {
        userId: params.userId,
        venueId: params.venueId,
        accountType: 'venue',
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

/**
 * What Stripe will actually charge next, and when.
 *
 * Preferred over `getPriceSummaries` wherever a figure is quoted **to a customer**,
 * because the catalogue price is only correct while nothing is scheduled. Once plan
 * switching was enabled (D-70) a deferred downgrade left `plan` reading `annual` while
 * the next invoice was monthly — so the trial-ending email would have promised €199 and
 * taken €19.99. A preview accounts for schedules, proration and discounts by construction,
 * which no amount of local arithmetic can.
 *
 * Returns null rather than throwing when Stripe cannot preview (no upcoming invoice yet,
 * a subscription in an odd state). Callers fall back to the catalogue, which is wrong only
 * in the rare scheduled case and is better than sending nothing at all.
 */
export async function getNextInvoicePreview(
  subscriptionId: string
): Promise<{ formatted: string; interval: BillingInterval | null; periodEnd: Date | null } | null> {
  const stripe = getStripeClient();
  try {
    const preview = await stripe.invoices.createPreview({ subscription: subscriptionId });
    const line = preview.lines?.data?.[0];
    const priceId =
      typeof line?.pricing?.price_details?.price === 'string'
        ? line.pricing.price_details.price
        : null;
    return {
      formatted: new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: (preview.currency || 'eur').toUpperCase(),
      }).format((preview.amount_due ?? 0) / 100),
      interval: intervalForPriceId(priceId),
      periodEnd: preview.period_end ? new Date(preview.period_end * 1000) : null,
    };
  } catch (err) {
    console.warn('[stripe] could not preview the next invoice for', subscriptionId, err);
    return null;
  }
}

/** A Checkout Session as this flow needs it — enough to decide whether to reuse it. */
export interface ExistingCheckoutSession {
  id: string;
  /** Null once the session is no longer payable; Stripe drops the url on completion. */
  url: string | null;
  status: Stripe.Checkout.Session.Status | null;
  /** Which plan the venue was looking at, read back from the line item's Price. */
  interval: BillingInterval | null;
}

/**
 * Look up a Checkout Session we previously created.
 *
 * `line_items` is expanded because the interval is the deciding factor for whether
 * the session can be reused: the activation email offers both plans behind one token
 * (D-08, D-63), so a stored session may be for the plan the venue has since changed
 * their mind about. Reading it back from the Price beats storing the interval a second
 * time and letting the two disagree.
 *
 * Returns null when Stripe has no such session — a stored id from a rotated key or a
 * different account. The caller then mints a fresh one, which is the safe direction:
 * a session Stripe cannot see is a session nobody can pay.
 */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<ExistingCheckoutSession | null> {
  const stripe = getStripeClient();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    });
    const priceId = session.line_items?.data?.[0]?.price?.id ?? null;
    return {
      id: session.id,
      url: session.url,
      status: session.status,
      interval: intervalForPriceId(priceId),
    };
  } catch (err) {
    console.warn('[stripe] could not retrieve checkout session', sessionId, err);
    return null;
  }
}

/**
 * Close a Checkout Session so it can never be paid.
 *
 * Used when a venue returns to their activation email and picks the other plan: the
 * page they abandoned must stop being payable, or the two links behind one token could
 * both be completed and produce two subscriptions.
 *
 * Failure is logged and swallowed. The caller's next step is minting the session the
 * venue actually asked for, and blocking that on this cleanup would turn a Stripe
 * hiccup into a venue who cannot pay at all.
 */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  const stripe = getStripeClient();
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    console.warn('[stripe] could not expire checkout session', sessionId, err);
  }
}
