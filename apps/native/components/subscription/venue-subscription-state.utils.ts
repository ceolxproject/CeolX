import type { VenueSubscriptionStatus } from '@CeolX/shared';

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
 * Creating public content is part of the paid service. The server refuses it too
 * (`assertVenueMayPublish`) — this only explains why the button is dim, because a
 * disabled control with no reason reads as a bug.
 */
export const PUBLISH_BLOCKED_MESSAGE =
  'An active subscription is needed to publish. Check your email to reactivate.';

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
