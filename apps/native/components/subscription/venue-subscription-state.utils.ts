import {
  hasLiveBilling,
  VENUE_PUBLISH_BLOCKED_MESSAGE,
  VENUE_PUBLISH_BLOCKED_REASON,
  type VenueSubscriptionStatus,
} from '@CeolX/shared';

/**
 * Pure subscription-state logic, kept out of the component module.
 *
 * Split out because VenueSubscriptionState.tsx imports Ionicons and trpc, which do not
 * resolve under the node test environment — so these functions were untestable while
 * they lived there, which is why the branchiest logic in the M8 client shipped with no
 * coverage at all. Mirrors the existing `*.utils.ts` convention in this app.
 */

/**
 * Re-exported from shared rather than re-declared.
 *
 * A local copy compiled cleanly when a sixth status was added to shared, and the new
 * value fell through to the `activate` branch below — telling an active subscriber their
 * profile was not live. Importing the union makes that a type error instead.
 */
export type VenueSubscriptionStatusValue = VenueSubscriptionStatus;

/**
 * Copy for the disabled create actions (V-14).
 *
 * Re-exported from shared rather than restated: the server throws the same sentence as its
 * `FORBIDDEN` message, and the two literals had already drifted once. Importers keep the
 * old local name.
 */
export const PUBLISH_BLOCKED_MESSAGE = VENUE_PUBLISH_BLOCKED_MESSAGE;

/**
 * Just the cause, for the in-form notice that carries its own action button.
 *
 * The notice must not say "open your profile": doing that from the event form's last step
 * unmounted the form and lost everything the venue had typed.
 */
export const PUBLISH_BLOCKED_REASON = VENUE_PUBLISH_BLOCKED_REASON;

/**
 * How often a screen that is *waiting* for activation re-checks `users.me`.
 *
 * Payment happens in a browser, often on another device (D-16), so nothing pushes the
 * result back to the app — every surface that shows "we're waiting" has to ask. Shared
 * because there are two such surfaces (the onboarding hand-off and the profile prompt) and
 * the first version polled on only one of them, which left a venue who had just paid
 * staring at "One last step".
 */
export const ACTIVATION_POLL_MS = 10_000;

/**
 * Which surface a venue's own subscription state should show.
 *
 * Takes the server's `onHold` rather than inferring hidden-ness from the status. The
 * status alone cannot answer it: VENUE_GATE_ENABLED may be off — the shipping default,
 * under which every venue is fully visible despite sitting at `inactive` — and the
 * past-due grace window and `billing_blocked` both change the answer without changing
 * the status.
 *
 * `venueMayPublish` used to live beside this and hand-copied the server's rule, then
 * diverged from it for expired-grace past-due venues. It is gone: `mayPublish` now
 * arrives resolved on `users.me`.
 */
export function venueStateFor({
  status,
  onHold,
}: {
  status: VenueSubscriptionStatusValue | null | undefined;
  onHold: boolean;
}) {
  // Informational states first — both are true regardless of the gate, and a past-due
  // venue needs the fix-payment banner more than an activation prompt even after the
  // grace window has lapsed.
  if (status === 'trialing') return 'trial' as const;
  if (status === 'past_due') return 'past_due' as const;

  // A venue Stripe still reports as `active` is never told to activate, even when the
  // gate hides it. The only way to reach that combination is `billing_blocked` after a
  // chargeback (D-51), and `requestActivation` refuses those accounts — so the button
  // would fail on tap.
  //
  // Known gap: such a venue is hidden and told nothing. The proper surface is an
  // "under review, contact us" state, which is deferred with the rest of the chargeback
  // handling (D-62). Silence is the lesser wrong; a control that errors is worse.
  //
  // For the ordinary paying subscriber — by far the commoner reading of `active` — 'none'
  // is now deliberate rather than an omission. Their plan and renewal date live on the
  // **Manage Subscription** row in Settings (`planSummaryFor`), which keeps a healthy
  // profile free of billing prose. QA reported the earlier state as "I cannot see my
  // subscribed plan", and that is what the Settings row answers.
  if (status === 'active') return 'none' as const;

  // Two different truths, so two different states.
  //
  // `activate` — the venue is genuinely hidden, so "your profile isn't live yet" is
  // accurate. This is a new venue that never completed payment setup.
  //
  // `activate_grace` — the venue has no subscription but IS still visible, because the
  // gate is off or it is grandfathered through the cutover (O-08). Telling this venue
  // its profile is not live would be **false**: it signed up before subscriptions
  // existed and its profile works today. It still needs prompting, because it loses
  // access when the gate turns on — but the copy has to say "keep it live", not
  // "it isn't live". Returning `none` here (the previous behaviour) was worse still:
  // the venue was told nothing at all and would have been hidden without warning.
  //
  // `cancelled` and `inactive` share one recovery flow either way; the single
  // difference (no second free trial, D-42) is enforced server-side.
  if (onHold) return 'activate' as const;
  if (status === 'inactive' || status === 'cancelled') return 'activate_grace' as const;

  return 'none' as const;
}

/**
 * Trial end date as the app shows it.
 *
 * One formatter because two surfaces print this date — the profile badge and the activation
 * screen's success panel — and a venue seeing two different renderings of their own trial
 * end would reasonably wonder which one is real.
 *
 * Returns null for absent OR unparseable input rather than throwing or printing
 * "Invalid Date": `users.me` LEFT JOINs the billing row, so null is the normal case for a
 * venue with no subscription and for every seeded venue.
 */
export function formatTrialEnd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Which panel the activation hand-off screen should render. */
export type ActivationPanel = 'success' | 'error' | 'sending' | 'waiting';

/**
 * Panel choice for the activation hand-off screen, as a pure function.
 *
 * Extracted because this screen is the one every new venue walks through and it has already
 * shipped two bugs — it rendered "One last step" to a venue who had paid 96 seconds earlier,
 * and before that it claimed an email had been sent that had not been. Both were ordering
 * mistakes in exactly this decision, and neither was reachable by any test while the logic
 * lived inline in JSX.
 *
 * Order is the substance:
 *
 * - `activated` outranks everything. A venue with live billing must never be shown a
 *   failure or a "we're waiting" state, whatever the email request did — the email is a
 *   means to activation, and activation has happened.
 * - `error` outranks `sending`, so a retry already in flight keeps the failure visible
 *   instead of flipping the whole screen back to a spinner. The retry button shows its own.
 * - `sending` requires `!sent`: once any email is away the waiting copy is true, so a
 *   later resend must not blank the screen the venue is reading.
 */
export function activationPanelFor({
  activated,
  error,
  isPending,
  sent,
}: {
  activated: boolean;
  error: string | null;
  isPending: boolean;
  sent: boolean;
}): ActivationPanel {
  if (activated) return 'success';
  if (error) return 'error';
  if (isPending && !sent) return 'sending';
  return 'waiting';
}

/**
 * Narrow the wire's `string` subscription status to the union, in one place.
 *
 * `users.me` serialises the enum as a plain string, so every consumer needs this cast. It
 * was written inline in two places and about to be a third; a single site is one thing to
 * audit if the enum ever gains a member.
 */
export function asVenueStatus(
  status: string | null | undefined
): VenueSubscriptionStatusValue | null {
  return (status ?? null) as VenueSubscriptionStatusValue | null;
}

/** True when the venue's billing is live enough that no activation prompt applies. */
export function isActivated(status: VenueSubscriptionStatusValue | null | undefined): boolean {
  return !!status && hasLiveBilling(status);
}

/**
 * One line answering "which plan am I on, and what happens next".
 *
 * Deliberately carries **no amount**. D-16 forbids any price in the app, so the interval
 * and the date are the most that can be said — which is still the whole question a venue
 * was asking, because before this nothing about their plan was visible anywhere.
 *
 * `cancelAtPeriodEnd` is called out separately from `cancelled`: the first is still a
 * paying, fully visible venue who has chosen to stop at the period end (D-29), and
 * showing it as "cancelled" would be wrong while they still have access.
 */
export function planSummaryFor({
  status,
  plan,
  pendingPlan,
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd,
}: {
  status: VenueSubscriptionStatusValue | null | undefined;
  plan: string | null | undefined;
  /** Interval a deferred change switches to at period end, when one is scheduled. */
  pendingPlan?: string | null;
  trialEndsAt: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  cancelAtPeriodEnd: boolean;
}): string {
  const interval = plan === 'annual' ? 'Annual' : plan === 'monthly' ? 'Monthly' : null;
  const trialEnd = formatTrialEnd(trialEndsAt);
  const periodEnd = formatTrialEnd(currentPeriodEnd);

  if (status === 'trialing') {
    // The trial end IS the first charge date, so it is the useful date here.
    return trialEnd ? `Free trial until ${trialEnd}` : 'Free trial';
  }

  // A scheduled switch outranks "renews": saying a plan renews when it is about to
  // become a different plan is the same class of untruth as quoting the wrong amount,
  // which is what made D-70 dangerous in the trial email.
  if (pendingPlan && pendingPlan !== plan) {
    const to = pendingPlan === 'annual' ? 'annual' : 'monthly';
    const on = periodEnd ?? trialEnd;
    return on ? `Changes to ${to} on ${on}` : `Changes to ${to} at the end of this period`;
  }

  if (cancelAtPeriodEnd) {
    return periodEnd ? `Cancels on ${periodEnd}` : 'Cancels at the end of this period';
  }

  if (status === 'past_due') return 'Payment failed — update your card';

  if (status === 'active') {
    if (interval && periodEnd) return `${interval} · renews ${periodEnd}`;
    if (interval) return interval;
    return 'Active';
  }

  // `cancelled` past its period end, or `inactive`. Reachable here only via the
  // never-cleared Stripe customer id, which is what keeps the Portal (and invoice
  // history) available to a venue who has stopped paying.
  return 'No active subscription';
}

/**
 * Whether the settings sheet should offer the billing Portal at all.
 *
 * Keyed on having a Stripe customer, not on being currently paid: a lapsed venue still
 * needs their invoices, and a cancelling one still needs to be able to resubscribe. The
 * server refuses with PRECONDITION_FAILED when no customer exists, so hiding the row in
 * that case is what stops the venue tapping into a guaranteed error.
 */
export function canManageBilling(hasStripeCustomer: boolean): boolean {
  return hasStripeCustomer;
}
