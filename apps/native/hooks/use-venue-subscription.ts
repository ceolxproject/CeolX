import {
  ACTIVATION_POLL_MS,
  asVenueStatus,
  canManageBilling,
  isActivated,
  planSummaryFor,
  venueStateFor,
} from '@/components/subscription/venue-subscription-state.utils';
import { useMe } from '@/hooks/use-me';

/**
 * The authenticated venue's own subscription state (M8).
 *
 * One place for "what does this venue see about their billing", so the profile screen,
 * the event form and the post composer cannot disagree — they previously each rendered
 * the interim free-access notice independently, which is exactly how they drift.
 *
 * `onHold` and `mayPublish` are read from the server, never derived here. Deriving them
 * from `subscriptionStatus` was wrong twice: it ignored VENUE_GATE_ENABLED, so with the
 * gate off — the shipping default — every venue would be told its profile was not live
 * while all of them were in fact visible; and it ignored the past-due grace window and
 * `billing_blocked`, so a venue eight days down was told it was still live and then hit
 * a raw FORBIDDEN on publish.
 *
 * Reads `users.me`, so it shares that query's cache and its guest guard. Refreshes on app
 * foreground via `installAppStateFocusBridge` (auth-context), which bridges AppState into
 * React Query's focus manager.
 *
 * That foreground refresh is not sufficient on its own, which the original version of this
 * docstring got wrong by asserting "there is nothing to poll for". Activation completes in a
 * browser, so a venue who pays without ever backgrounding the app gets no refresh at all:
 * the profile tab stays mounted, and pull-to-refresh reloaded only the events list. Hence
 * `pollUntilActivated`, for the surfaces that are explicitly waiting.
 */
export function useVenueSubscription({ pollUntilActivated = false } = {}) {
  // `pollUntilActivated` — for a surface that is *waiting* on an activation completed
  // elsewhere. Payment happens in a browser, usually on another device (D-16), so there is
  // no callback, deep link or push to react to; asking periodically is the only option.
  //
  // The interval is a function so TanStack evaluates it against live query state and stops
  // the moment billing goes live. The previous shape mirrored that into a `useState` +
  // `useEffect` in the screen, which meant two sources of truth for one fact and a second
  // `useMe` observer alongside it.
  const { data: me } = useMe({
    refetchInterval: pollUntilActivated
      ? (query) =>
          isActivated(asVenueStatus(query.state.data?.venueProfile?.subscriptionStatus))
            ? false
            : ACTIVATION_POLL_MS
      : false,
  });

  const status = asVenueStatus(me?.venueProfile?.subscriptionStatus);

  // Default to "not on hold" until `me` resolves: the alternative flashes a false
  // "your profile isn't live" on every cold start. Every gate is enforced server-side,
  // so an optimistic first paint costs nothing.
  const onHold = me?.venueProfile?.onHold ?? false;

  return {
    status,
    trialEndsAt: me?.venueProfile?.trialEndsAt ?? null,
    onHold,
    /**
     * Which surface to render: activate | activate_grace | trial | past_due | none.
     *
     * `activate` and `activate_grace` are both "no subscription", but only the first
     * means the profile is actually hidden — the copy differs because for a grandfathered
     * venue the profile is live and saying otherwise would be false.
     */
    state: venueStateFor({ status, onHold }),
    /** V-14 — resolved server-side, mirroring `assertVenueMayPublish`. */
    mayPublish: me?.venueProfile?.mayPublish ?? true,
    /**
     * Billing is live (trialing, active, or past-due inside grace).
     *
     * Deliberately not `state !== 'activate'`: `state` also answers "which card do we
     * render", and a chargeback-blocked venue reports `none` there while being anything but
     * activated.
     */
    activated: isActivated(status),
    /**
     * Whether the settings sheet offers the billing Portal, and the one line describing
     * the plan. Both live here so the sheet renders no billing logic of its own.
     */
    canManageBilling: canManageBilling(me?.venueProfile?.hasBilling ?? false),
    planSummary: planSummaryFor({
      status,
      plan: me?.venueProfile?.plan,
      trialEndsAt: me?.venueProfile?.trialEndsAt,
      currentPeriodEnd: me?.venueProfile?.currentPeriodEnd,
      cancelAtPeriodEnd: me?.venueProfile?.cancelAtPeriodEnd ?? false,
    }),
  };
}
