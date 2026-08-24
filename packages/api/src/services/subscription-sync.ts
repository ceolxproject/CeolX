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
import { getStripeClient, intervalForPriceId } from './stripe';

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
   * Confirm a real payment to the venue (D-64).
   *
   * Passed in rather than imported for the same reason as the notifier: the email
   * senders live outside this package. Omitted in tests and anywhere confirmation is
   * not wanted.
   */
  confirmPayment?: (receipt: PaymentReceipt) => Promise<void>;
}

/** What the venue is told after a successful charge (D-64). */
export interface PaymentReceipt {
  venueId: string;
  /** Formatted with currency, straight from the invoice — never recomputed locally. */
  amount: string;
  interval: 'monthly' | 'annual';
  nextBillingDate: Date | null;
  invoiceUrl: string | null;
}

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

  let previousStatus: VenueSubscriptionStatus | null = null;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: venueSubscriptions.id,
        trialEndsAt: venueSubscriptions.trialEndsAt,
        plan: venueSubscriptions.plan,
      })
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, venueId))
      .limit(1);

    // trial_ends_at is write-once-ish: it is the record that this account has
    // consumed its one trial (D-42) and must survive a cancellation. Only ever
    // move it forward from null, never clear it.
    const trialEndsAt = existing?.trialEndsAt ?? trialEnd;

    // No past-due bookkeeping. Dunning is Stripe's (D-33, revised 18/08/2026): its
    // retry schedule decides how long to chase the charge and cancels when it gives up,
    // so `past_due` simply means "still collectable" and `cancelled` means "not". We
    // used to stamp an origin here and hide the venue 7 days later, on our own clock,
    // which could disagree with whether Stripe was still retrying at all.

    // No interval from Stripe and none stored is a genuine anomaly: a subscription
    // whose price has no recurring block. Throwing returns 500, so Stripe retries and
    // the failure is visible, rather than writing a plausible-looking wrong plan.
    const resolvedPlan = interval ?? existing?.plan;
    if (!resolvedPlan) {
      throw new Error(
        `[subscription-sync] ${subscription.id} has no billing interval and no stored plan — refusing to guess`
      );
    }

    const row = {
      venueId,
      stripeCustomerId: idOf(subscription.customer),
      stripeSubscriptionId: subscription.id,
      // The stored interval, not a hardcoded default. Defaulting to monthly here
      // relabels an annual subscriber, and `handleSubscriptionTrialEnding` then quotes
      // them €19.99 seven days before we take €199 — the exact chargeback that
      // handler's own docblock warns about.
      plan: resolvedPlan,
      currentPeriodStart: toDate(item?.current_period_start),
      currentPeriodEnd: toDate(item?.current_period_end),
      trialEndsAt,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      // Null when nothing is scheduled, which also clears a change the venue reverted.
      pendingPlan: await resolvePendingPlan(stripe, subscription),
      updatedAt: new Date(),
    };

    // Upsert on the unique venue_id rather than branching on the SELECT above.
    //
    // The read and the write are separate statements under READ COMMITTED, so two
    // concurrent first-time events for the same venue both saw no row and both
    // INSERTed — one of them dying on the unique violation. Stripe fans out
    // `customer.subscription.created` and `invoice.paid` at essentially the same
    // instant, and there is deliberately no processed-event table to serialise them,
    // so this is a live race rather than a theoretical one.
    //
    // `existing` is still read above because the write-once trial date and the
    // grace-window origin depend on the prior row; it is no longer what decides
    // insert-vs-update.
    await tx
      .insert(venueSubscriptions)
      .values(row)
      .onConflictDoUpdate({ target: venueSubscriptions.venueId, set: row });

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

  // The trial-ending warning is sent by the daily `subscription.trial-ending-sweep`
  // cron, not queued here. A delayed job would need a ~176-day delay for the default
  // 183-day trial, and this repo already established that a 30-day QStash delay
  // exceeds the plan cap and fails silently (Asana 1215276188230541).
  //
  // Nothing needs clearing when Stripe's trial end moves: `trialEndsAt` above is
  // write-once by design (D-42 uses it as the record that this account consumed its
  // one trial), so the stored date never shifts. The cost is that a trial extended in
  // the Stripe Dashboard leaves us warning against the original date — early rather
  // than late, so no one is charged unwarned. Splitting "trial consumed" from "current
  // charge date" into two columns is the fix if that ever matters.

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
 * Block a disputed account (D-51).
 *
 * Hides the profile immediately and prevents resubscription until an admin
 * reviews it — a chargeback on delivered service is a warning sign, and letting
 * the same disputed card straight back in invites repeat abuse. Clearing the flag
 * is a manual step until the admin screen ships (D-62).
 */
export async function blockBillingForCustomer(stripeCustomerId: string): Promise<void> {
  const [row] = await db
    .select({
      id: venueSubscriptions.id,
      venueId: venueSubscriptions.venueId,
      stripeSubscriptionId: venueSubscriptions.stripeSubscriptionId,
    })
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

  // Cancel at Stripe as well, or the subscription keeps billing and the next
  // `invoice.paid` re-syncs this venue straight back to `active` — the local write
  // above would silently revert within one billing cycle.
  //
  // Deliberately after the local write and best-effort: `billing_blocked` is our own
  // durable record and `venueVisibilityFor` honours it ahead of status, so a Stripe
  // outage here degrades to "still hidden, still billing" rather than losing the block.
  if (row.stripeSubscriptionId) {
    try {
      await getStripeClient().subscriptions.cancel(row.stripeSubscriptionId);
    } catch (err) {
      console.error(
        `[subscription-sync] dispute: could not cancel ${row.stripeSubscriptionId} at Stripe —`,
        'the venue stays blocked locally but is still being billed. Cancel it by hand:',
        err
      );
    }
  }
}

/**
 * The interval a deferred plan change will switch to, or null when none is pending.
 *
 * Enabling plan switching (D-70) made `plan` alone insufficient. Stripe defers a
 * downgrade into a `subscription_schedule` and leaves the subscription on its current
 * price, so `plan` keeps reading `annual` while the next charge will be monthly. Read
 * from the schedule's *next* phase rather than its last, because a schedule may hold more
 * than two phases and only the next one is what the venue is about to be moved onto.
 *
 * Returns null for an unrecognised Price — see `intervalForPriceId` — so an unfamiliar
 * schedule records "nothing pending" instead of a guess.
 */
async function resolvePendingPlan(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<BillingInterval | null> {
  const scheduleId = idOf(subscription.schedule);
  if (!scheduleId) return null;

  let schedule: Stripe.SubscriptionSchedule;
  try {
    schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  } catch (err) {
    // Never fail the whole sync for this: the status and period are the load-bearing
    // fields, and a missing pending-plan only costs a slightly stale Settings line.
    console.warn('[subscription-sync] could not read schedule', scheduleId, err);
    return null;
  }

  // A released or cancelled schedule is history, not a pending change.
  if (schedule.status !== 'active' && schedule.status !== 'not_started') return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const currentIdx = schedule.phases.findIndex(
    (ph) => ph.start_date <= nowSec && (!ph.end_date || nowSec < ph.end_date)
  );
  const next = currentIdx >= 0 ? schedule.phases[currentIdx + 1] : schedule.phases[0];
  if (!next) return null;

  const pending = intervalForPriceId(idOf(next.items?.[0]?.price));
  // A phase that keeps the current price is not a change worth surfacing.
  return pending && pending !== intervalForPriceId(idOf(subscription.items.data[0]?.price?.id))
    ? pending
    : null;
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

    // Recovery: clear the marker, then re-read the subscription so status and period
    // end come from Stripe rather than being assumed from the invoice.
    case 'invoice.paid': {
      const invoice = event.data.object;
      const customerId = relatedId(invoice.customer);
      const subscriptionId = subscriptionIdOfInvoice(invoice);
      if (subscriptionId) await syncSubscriptionFromStripe(subscriptionId, hooks);

      // D-64: confirm the charge. Deliberately last, so an email problem cannot stop
      // the state write above from committing.
      //
      // `amount_paid > 0` matters: Stripe also emits invoice.paid for the €0 invoice
      // that opens a trial, and "payment received — €0.00" six months before anyone is
      // charged is worse than silence.
      //
      // Not exactly-once. A redelivered invoice.paid re-sends, because there is no
      // processed-event table by design (D-22 re-fetches instead). A duplicate receipt
      // is the accepted cost; if it ever becomes a complaint, store the last paid
      // invoice id on the subscription row and compare.
      if (hooks.confirmPayment && customerId && (invoice.amount_paid ?? 0) > 0) {
        await sendPaymentReceipt(customerId, invoice, hooks.confirmPayment).catch(
          (err: unknown) => {
            console.error('[subscription-sync] could not confirm payment:', err);
          }
        );
      }
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

/**
 * Build and dispatch the payment receipt for a paid invoice (D-64).
 *
 * Every figure comes off the invoice Stripe just charged — the amount is formatted
 * from `amount_paid`/`currency` rather than from a local price constant, so the email
 * cannot state a different number from the one on the customer's statement.
 */
async function sendPaymentReceipt(
  stripeCustomerId: string,
  invoice: Stripe.Invoice,
  confirm: (receipt: PaymentReceipt) => Promise<void>
): Promise<void> {
  const [row] = await db
    .select({
      venueId: venueSubscriptions.venueId,
      plan: venueSubscriptions.plan,
      currentPeriodEnd: venueSubscriptions.currentPeriodEnd,
    })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);

  if (!row) return;

  const amount = new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: (invoice.currency ?? 'eur').toUpperCase(),
  }).format((invoice.amount_paid ?? 0) / 100);

  await confirm({
    venueId: row.venueId,
    amount,
    interval: row.plan === 'annual' ? 'annual' : 'monthly',
    nextBillingDate: row.currentPeriodEnd ?? null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
  });
}
