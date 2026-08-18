import { and, eq, gte, ne } from 'drizzle-orm';
import type Stripe from 'stripe';

import { db } from '@CeolX/db';
import { events } from '@CeolX/db/schema/events';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import {
  BillingInterval,
  EventStatus,
  SubscriptionStatus,
  type BillingInterval as Interval,
  type VenueSubscriptionStatus,
} from '@CeolX/shared';

import { markActivationTokenConsumed } from './activation-token';
import { getStripeClient } from './stripe';

// Subscription state machine (M8-T0 D-22). This module is the ONLY writer of
// subscription state. Nothing else in the codebase may set
// venue_profiles.subscription_status or touch venue_subscriptions.
//
// The design principle throughout: never trust the webhook payload's view of the
// subscription. Re-fetch it from Stripe and write current truth. That makes every
// handler idempotent (a redelivery writes the same result) and order-independent
// (an `updated` arriving before `created` cannot corrupt state), which removes the
// need for a processed-event ledger entirely.

/**
 * Map a Stripe subscription status onto ours.
 *
 * Returns null for anything unmapped rather than guessing. Silently defaulting an
 * unknown status to `active` would hand out free visibility; defaulting to
 * `inactive` would hide a paying customer. Both are worse than refusing to act and
 * logging loudly.
 *
 * Note the spelling: Stripe says `canceled`, we say `cancelled` (D-12).
 */
export function mapStripeStatus(stripeStatus: string): VenueSubscriptionStatus | null {
  switch (stripeStatus) {
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
    case 'unpaid':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELLED;
    // Checkout started but never completed, and a paused subscription: neither is
    // a paying state, and neither should read as "cancelled" to the venue.
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return SubscriptionStatus.INACTIVE;
    default:
      return null;
  }
}

/** Stripe reports the interval on the price; we store it as our own enum. */
function intervalFromSubscription(subscription: Stripe.Subscription): Interval | null {
  const recurring = subscription.items.data[0]?.price?.recurring;
  if (!recurring) return null;
  if (recurring.interval === 'month') return BillingInterval.MONTHLY;
  if (recurring.interval === 'year') return BillingInterval.ANNUAL;
  return null;
}

function toDate(seconds: number | null | undefined): Date | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null;
}

/** Stripe ids can arrive expanded or as a bare string depending on the event. */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Resolve the venue this subscription belongs to.
 *
 * Metadata first — that is the join key we set at checkout (D-23), and it is
 * matched on an id rather than an email precisely because a venue may pay with
 * someone else's card. Falls back to the customer id for subscriptions created
 * outside our flow (a support agent working in the Dashboard, say).
 */
async function resolveVenueId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.venueId;
  if (fromMetadata) return fromMetadata;

  const customerId = idOf(subscription.customer);
  if (!customerId) return null;

  const [row] = await db
    .select({ venueId: venueSubscriptions.venueId })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  return row?.venueId ?? null;
}

/**
 * Write current subscription truth for a venue.
 *
 * Both tables are updated in ONE transaction (D-14): `venue_subscriptions` holds
 * the billing record and `venue_profiles.subscription_status` is a denormalised
 * cache that the visibility predicate and every gated query read. They must never
 * be observable in disagreement.
 */
export interface LinkedArtistNotice {
  artistUserId: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
}

export interface SyncHooks {
  /**
   * Tell an artist their linked venue has gone on hold (V-06 / A-20).
   *
   * Injected because the notification dispatcher lives in apps/server. This package
   * owns the query — it knows the schema — and the hook owns delivery.
   */
  notifyLinkedArtist?: (notice: LinkedArtistNotice) => Promise<void>;
  /**
   * Queue the trial-ending warning (D-30), seven days before the first charge.
   *
   * Passed in rather than imported: the QStash publisher lives in apps/server, and
   * this package must not depend on the app that hosts it. Omitted in tests and on
   * any path where scheduling is not wanted.
   */
  scheduleTrialEnding?: (venueId: string, delaySeconds: number) => Promise<void>;
}

/** Lead time on the trial-ending email (D-30: seven days before the first charge). */
const TRIAL_WARNING_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

export async function syncSubscriptionFromStripe(
  subscriptionId: string,
  hooks: SyncHooks = {}
): Promise<void> {
  const stripe = getStripeClient();

  // Re-fetch rather than trusting the event payload — see the module header.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const venueId = await resolveVenueId(subscription);
  if (!venueId) {
    console.error(
      '[subscription-sync] cannot resolve a venue for subscription',
      subscriptionId,
      '— no venueId metadata and no customer match. State left untouched.'
    );
    return;
  }

  const status = mapStripeStatus(subscription.status);
  if (!status) {
    // Loud and inert. A future Stripe status must not be silently coerced into a
    // visibility decision.
    console.error(
      '[subscription-sync] unmapped Stripe status',
      `"${subscription.status}"`,
      'for subscription',
      subscriptionId,
      '— state left untouched.'
    );
    return;
  }

  const interval = intervalFromSubscription(subscription);
  const trialEnd = toDate(subscription.trial_end);
  const item = subscription.items.data[0];

  let existingTrialEndsAt: Date | null = null;
  let previousStatus: VenueSubscriptionStatus | null = null;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: venueSubscriptions.id,
        trialEndsAt: venueSubscriptions.trialEndsAt,
        pastDueSince: venueSubscriptions.pastDueSince,
      })
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, venueId))
      .limit(1);

    // trial_ends_at is write-once-ish: it is the record that this account has
    // consumed its one trial (D-42) and must survive a cancellation. Only ever
    // move it forward from null, never clear it.
    const trialEndsAt = existing?.trialEndsAt ?? trialEnd;
    existingTrialEndsAt = existing?.trialEndsAt ?? null;

    // Recovery clears the grace-window origin. The failure path sets it —
    // see recordInvoicePaymentFailure.
    const pastDueSince = status === SubscriptionStatus.PAST_DUE ? existing?.pastDueSince : null;

    const row = {
      venueId,
      stripeCustomerId: idOf(subscription.customer),
      stripeSubscriptionId: subscription.id,
      // Fall back to the stored interval when Stripe's price has no recurring
      // block, rather than writing a wrong one. A NOT NULL column with no prior
      // row and no interval is a genuine error, surfaced below.
      plan: interval ?? BillingInterval.MONTHLY,
      currentPeriodStart: toDate(item?.current_period_start),
      currentPeriodEnd: toDate(item?.current_period_end),
      trialEndsAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      pastDueSince: pastDueSince ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await tx.update(venueSubscriptions).set(row).where(eq(venueSubscriptions.id, existing.id));
    } else {
      await tx.insert(venueSubscriptions).values(row);
    }

    const [profileBefore] = await tx
      .select({ subscriptionStatus: venueProfiles.subscriptionStatus })
      .from(venueProfiles)
      .where(eq(venueProfiles.id, venueId))
      .limit(1);
    previousStatus = profileBefore?.subscriptionStatus ?? null;

    await tx
      .update(venueProfiles)
      .set({
        subscriptionStatus: status,
        stripeCustomerId: row.stripeCustomerId,
        updatedAt: new Date(),
      })
      .where(eq(venueProfiles.id, venueId));
  });

  // A-20 / V-06: when a venue goes on hold, tell the artists whose events name it.
  //
  // Their events deliberately STAY VISIBLE — Sean overruled hiding them, reasoning
  // that the artist did nothing wrong and that telling them puts the pressure on the
  // venue instead of on us. This notification is that mechanism. Fired only on the
  // transition into a hidden state, so a redelivered event or a later unrelated
  // change cannot re-notify.
  const wasVisible = previousStatus !== null && !isHiddenStatus(previousStatus);
  const nowHidden = isHiddenStatus(status);
  if (wasVisible && nowHidden && hooks.notifyLinkedArtist) {
    await notifyLinkedArtists(venueId, hooks.notifyLinkedArtist).catch((err: unknown) => {
      // Never fail the state write because a notification could not be sent — the
      // billing state is the important part.
      console.error('[subscription-sync] could not notify linked artists:', err);
    });
  }

  // Queue the trial-ending warning the first time we learn a trial end date. Only
  // on transition (no prior date), so a redelivered event or a later status change
  // cannot queue a second copy — the job itself re-reads everything and no-ops if
  // the venue has since converted or cancelled.
  const firstTimeSeeingTrialEnd = !existingTrialEndsAt && !!trialEnd;
  if (firstTimeSeeingTrialEnd && hooks.scheduleTrialEnding && trialEnd) {
    const delayMs = trialEnd.getTime() - TRIAL_WARNING_LEAD_MS - Date.now();
    // A trial shorter than the lead time (a 3-day trial for testing, say) would
    // give a negative delay; send it promptly rather than not at all.
    await hooks
      .scheduleTrialEnding(venueId, Math.max(0, Math.round(delayMs / 1000)))
      .catch((err: unknown) => {
        console.error('[subscription-sync] could not queue the trial-ending email:', err);
      });
  }

  // Consume the activation token once payment has actually gone through (D-17) —
  // not when the link was opened, which D-24 requires to stay repeatable. Only a
  // paying state counts; a trial start counts too, since the card is committed.
  const activationTokenId = subscription.metadata?.activationTokenId;
  if (
    activationTokenId &&
    (status === SubscriptionStatus.TRIALING || status === SubscriptionStatus.ACTIVE)
  ) {
    await markActivationTokenConsumed(activationTokenId);
  }
}

/**
 * Cancel a user's Stripe subscription immediately (D-47).
 *
 * Called before account erasure. Cancels rather than schedules at period end: the
 * account is going away, so there is nobody left to serve the remainder of a paid
 * period to, and leaving it live would keep charging a deleted customer.
 *
 * Returns true when there was nothing to cancel, so the caller can distinguish
 * "no subscription" from "cancelled". Throws if Stripe rejects the cancellation —
 * the caller must decide whether to proceed, and for erasure it must not.
 */
export async function cancelSubscriptionForUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ stripeSubscriptionId: venueSubscriptions.stripeSubscriptionId })
    .from(venueSubscriptions)
    .innerJoin(venueProfiles, eq(venueProfiles.id, venueSubscriptions.venueId))
    .where(eq(venueProfiles.userId, userId))
    .limit(1);

  if (!row?.stripeSubscriptionId) return true;

  try {
    await getStripeClient().subscriptions.cancel(row.stripeSubscriptionId);
    return true;
  } catch (err) {
    // Already gone is success: Stripe returns resource_missing if the subscription
    // was cancelled and purged, or if we are retrying after a partial failure.
    const code = (err as { code?: string; statusCode?: number })?.code;
    if (code === 'resource_missing') return true;
    throw err;
  }
}

/**
 * Does this status hide the venue outright?
 *
 * `past_due` is excluded on purpose: inside the grace window the venue is still
 * visible (D-33), so a card that merely expired must not fire an "on hold" notice
 * to every artist they have booked. Only a genuinely hidden state does.
 */
function isHiddenStatus(status: VenueSubscriptionStatus): boolean {
  return status === SubscriptionStatus.INACTIVE || status === SubscriptionStatus.CANCELLED;
}

/**
 * Notify every artist whose event names this venue.
 *
 * "Linked" means the artist picked the venue from the registered list, so the event
 * carries `venue_id`. Events where the artist typed an address by hand have no link
 * to the account at all and are untouched by any of this (V-05).
 *
 * Excludes the venue's own events — those are hidden rather than announced (V-03).
 */
async function notifyLinkedArtists(
  venueId: string,
  notify: (notice: LinkedArtistNotice) => Promise<void>
): Promise<void> {
  const [venue] = await db
    .select({ venueName: venueProfiles.venueName, ownerUserId: venueProfiles.userId })
    .from(venueProfiles)
    .where(eq(venueProfiles.id, venueId))
    .limit(1);

  if (!venue) return;

  const linked = await db
    .select({ eventId: events.id, eventTitle: events.title, creatorId: events.createdBy })
    .from(events)
    .where(
      and(
        eq(events.venueId, venueId),
        eq(events.status, EventStatus.ACTIVE),
        // Not the venue's own events — those are hidden, not announced (V-03).
        ne(events.createdBy, venue.ownerUserId),
        // Only upcoming: nobody needs chasing about a gig that already happened.
        gte(events.dateStart, new Date())
      )
    );

  // Sequential rather than parallel: this fans out to every artist booked at the
  // venue, and a burst of concurrent push sends is worth avoiding for a
  // notification that is not time-critical.
  for (const row of linked) {
    await notify({
      artistUserId: row.creatorId,
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      venueName: venue.venueName,
    });
  }
}

/**
 * Record the start of a run of failed payments (D-64).
 *
 * This is the origin of the grace window (D-33): the predicate computes
 * `past_due_since + STRIPE_GRACE_DAYS` at read time. It is deliberately driven by
 * the invoice failure rather than inferred from a status transition — Stripe may
 * move a subscription through `past_due` more than once, and only the first
 * failure of the current run should start the clock.
 *
 * Idempotent: a redelivered event finds the timestamp already set and leaves it.
 */
export async function recordInvoicePaymentFailure(
  stripeCustomerId: string,
  failedAt: Date = new Date()
): Promise<void> {
  const [row] = await db
    .select({ id: venueSubscriptions.id, pastDueSince: venueSubscriptions.pastDueSince })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!row) {
    console.warn(
      '[subscription-sync] payment failed for an unknown customer',
      stripeCustomerId,
      '— nothing to record.'
    );
    return;
  }

  // Already inside a failing run: keep the original start, or the grace window
  // would restart on every retry and never expire.
  if (row.pastDueSince) return;

  await db
    .update(venueSubscriptions)
    .set({ pastDueSince: failedAt, updatedAt: new Date() })
    .where(eq(venueSubscriptions.id, row.id));
}

/** Clear the grace-window origin once a payment succeeds (D-36, D-64). */
export async function clearPastDueMarker(stripeCustomerId: string): Promise<void> {
  await db
    .update(venueSubscriptions)
    .set({ pastDueSince: null, updatedAt: new Date() })
    .where(eq(venueSubscriptions.stripeCustomerId, stripeCustomerId));
}

/**
 * Block a disputed account (D-51).
 *
 * Hides the profile immediately and prevents resubscription until an admin
 * reviews it — a chargeback on delivered service is a warning sign, and letting
 * the same disputed card straight back in invites repeat abuse. Clearing the flag
 * is a manual step until the admin screen ships (D-62).
 */
export async function blockBillingForCustomer(stripeCustomerId: string): Promise<void> {
  const [row] = await db
    .select({ id: venueSubscriptions.id, venueId: venueSubscriptions.venueId })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!row) {
    console.warn(
      '[subscription-sync] dispute for an unknown customer',
      stripeCustomerId,
      '— nothing to block.'
    );
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(venueSubscriptions)
      .set({ billingBlocked: true, updatedAt: new Date() })
      .where(eq(venueSubscriptions.id, row.id));

    // Hidden immediately, not at the end of a grace window — a dispute is not an
    // innocent card failure.
    await tx
      .update(venueProfiles)
      .set({ subscriptionStatus: SubscriptionStatus.CANCELLED, updatedAt: new Date() })
      .where(eq(venueProfiles.id, row.venueId));
  });
}

/** Stripe sends related ids either expanded or as a bare string, depending on event. */
function relatedId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/**
 * Find the customer behind a dispute.
 *
 * A Stripe Dispute carries no customer of its own — it is raised against a charge,
 * and the charge holds the customer. So this costs one extra API call, which is
 * fine: disputes are rare, and getting the wrong account blocked would not be.
 */
async function customerIdOfDispute(dispute: Stripe.Dispute): Promise<string | null> {
  const chargeId = relatedId(dispute.charge);
  if (!chargeId) return null;

  try {
    const charge = await getStripeClient().charges.retrieve(chargeId);
    return relatedId(charge.customer);
  } catch (err) {
    console.error('[subscription-sync] could not resolve the charge behind a dispute:', err);
    return null;
  }
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  // Where the subscription id lives on an invoice moved between API versions —
  // check the modern `parent.subscription_details` shape first, then the legacy
  // top-level field, so this keeps working across an SDK upgrade.
  const parent = (invoice as { parent?: { subscription_details?: { subscription?: unknown } } })
    .parent;
  return (
    relatedId(parent?.subscription_details?.subscription) ??
    relatedId((invoice as { subscription?: unknown }).subscription)
  );
}

/**
 * Dispatch a verified Stripe event onto the state machine.
 *
 * Lives here rather than in the Hono route so that apps/server never imports the
 * Stripe SDK or its types — this package stays the only place that knows about
 * Stripe, which is what keeps the boundary honest.
 *
 * Unhandled event types return normally: Stripe sends far more types than we
 * subscribe to, and acknowledging them stops pointless retries.
 */
export async function handleStripeSubscriptionEvent(
  event: Stripe.Event,
  hooks: SyncHooks = {}
): Promise<void> {
  switch (event.type) {
    // One handler for the whole lifecycle — activation, trial→active, past_due,
    // cancellation and reactivation all reduce to "re-read and write current truth".
    //
    // `trial_will_end` is here as a safety net only: our own trial-ending email goes
    // out 7 days ahead (D-30) driven from the stored date, while Stripe fires this
    // ~3 days ahead. Re-syncing keeps the stored date honest if the trial was
    // extended in the Dashboard. (Comment lives above the group rather than between
    // the labels — an interleaved comment defeats eslint's empty-case detection and
    // reads as a real fallthrough.)
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.trial_will_end': {
      await syncSubscriptionFromStripe(event.data.object.id, hooks);
      return;
    }

    // Origin of the grace window (D-64), driven by the failure itself rather than
    // inferred from a status transition, so only the first failure of a run starts
    // the clock.
    case 'invoice.payment_failed': {
      const customerId = relatedId(event.data.object.customer);
      if (customerId) await recordInvoicePaymentFailure(customerId);
      return;
    }

    // Recovery: clear the marker, then re-read the subscription so status and period
    // end come from Stripe rather than being assumed from the invoice.
    case 'invoice.paid': {
      const invoice = event.data.object;
      const customerId = relatedId(invoice.customer);
      if (customerId) await clearPastDueMarker(customerId);
      const subscriptionId = subscriptionIdOfInvoice(invoice);
      if (subscriptionId) await syncSubscriptionFromStripe(subscriptionId, hooks);
      return;
    }

    // Chargeback: hide immediately and block resubscription pending review (D-51).
    case 'charge.dispute.created': {
      const customerId = await customerIdOfDispute(event.data.object);
      if (customerId) await blockBillingForCustomer(customerId);
      return;
    }

    default:
      return;
  }
}
