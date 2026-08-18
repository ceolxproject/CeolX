import { SubscriptionStatus, type VenueSubscriptionStatus } from '../enums.js';

/**
 * Venue subscription visibility (M8-T0 D-13, D-52).
 *
 * Three-way, not boolean. "On hold" must stay distinguishable from "does not
 * exist": an unpaid venue renders a state that reads as the venue's own lapse,
 * never a neutral "unavailable" that reads as CeolX being broken. Collapsing
 * these two into `false` is the bug D-52 exists to prevent.
 *
 * `not_found` is not derivable from a subscription status — it means no profile
 * row. Callers map a missing lookup to it; `venueVisibilityFor` never returns it.
 */
export const ProfileVisibility = {
  VISIBLE: 'visible',
  ON_HOLD: 'on_hold',
  NOT_FOUND: 'not_found',
} as const;

export type ProfileVisibility = (typeof ProfileVisibility)[keyof typeof ProfileVisibility];

/** What a status alone can decide — a row exists, so `not_found` is impossible. */
export type VenueVisibility = typeof ProfileVisibility.VISIBLE | typeof ProfileVisibility.ON_HOLD;

/**
 * Statuses under which a venue's profile and content are publicly visible.
 *
 * Module-private on purpose. Every caller goes through `venueVisibilityFor`, so
 * this list cannot be inlined at a call site and drift out of step (D-13). Adding
 * a status here changes visibility across every surface at once — which is the
 * point, given Section 9 spans a dozen separate queries.
 *
 * `past_due` is conditionally visible, so it is handled in the function body
 * rather than listed here.
 */
const ALWAYS_VISIBLE_STATUSES: readonly VenueSubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
];

export interface VenueVisibilityInput {
  status: VenueSubscriptionStatus;
  /**
   * End of the past-due grace window (D-33: 7 days, configurable), computed by
   * the caller from the recorded first-failure timestamp plus the configured
   * grace days. Only consulted when `status` is `past_due`.
   */
  graceEndsAt?: Date | null;
  /**
   * Billing blocked after a chargeback (D-51).
   *
   * Checked before status, because status alone is not durable here: the dispute
   * handler writes `cancelled`, but it does not cancel the Stripe subscription, so a
   * later `invoice.paid` or `customer.subscription.updated` re-syncs the venue back to
   * `active`. This flag is never cleared by a webhook, so honouring it here is what
   * keeps a disputed venue hidden through that revert.
   */
  billingBlocked?: boolean;
}

/**
 * Resolve a venue's public visibility from its subscription state.
 *
 * Pure and side-effect free so it can be unit-tested directly. That matters more
 * than usual here: the API tests mock the database, which makes a *missing* SQL
 * filter invisible to them — so correctness has to be pinned on the predicate
 * itself rather than inferred from a query's result.
 */
export function venueVisibilityFor(
  { status, graceEndsAt, billingBlocked }: VenueVisibilityInput,
  now: Date = new Date()
): VenueVisibility {
  // Before status: a chargeback outranks whatever Stripe last told us (D-51).
  if (billingBlocked) return ProfileVisibility.ON_HOLD;

  if (ALWAYS_VISIBLE_STATUSES.includes(status)) return ProfileVisibility.VISIBLE;

  if (status === SubscriptionStatus.PAST_DUE) {
    // A missing grace-window end means we cannot tell how long the venue has been
    // failing. We fail *open* deliberately: the grace period exists precisely to
    // absorb the innocent expired card, and hiding a customer who is still paying
    // is the worse error. A null here is a data bug in whatever wrote `past_due`
    // without a first-failure timestamp, not a licence to keep free visibility —
    // the webhook (M8-T3) is responsible for always recording one.
    if (!graceEndsAt) return ProfileVisibility.VISIBLE;
    return now < graceEndsAt ? ProfileVisibility.VISIBLE : ProfileVisibility.ON_HOLD;
  }

  // inactive (never completed payment setup) and cancelled (paid period elapsed).
  return ProfileVisibility.ON_HOLD;
}

/**
 * Convenience for the common "did this resolve to something renderable" check.
 * Exists so callers do not re-derive it and accidentally treat `on_hold` as
 * `not_found` — the exact collapse D-52 forbids.
 */
export function isPubliclyVisible(visibility: ProfileVisibility): boolean {
  return visibility === ProfileVisibility.VISIBLE;
}

/**
 * Does this venue already have live billing?
 *
 * Guards the "start a subscription" paths — a second checkout against a venue that is
 * already trialing, active or past-due would double-charge them. Distinct from
 * `venueVisibilityFor`, which answers a different question: `past_due` counts as live
 * billing here (there IS a subscription) while it may still resolve to ON_HOLD there
 * once the grace window lapses.
 *
 * Lives in shared because it was previously copied verbatim into both
 * `routers/stripe.ts` and `routers/venues.ts`, each with its own `readonly string[]`
 * cast at the call site.
 */
export function hasLiveBilling(status: VenueSubscriptionStatus): boolean {
  return (
    status === SubscriptionStatus.TRIALING ||
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE
  );
}
