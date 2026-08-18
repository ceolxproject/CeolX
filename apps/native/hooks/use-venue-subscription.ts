import {
  venueStateFor,
  type VenueSubscriptionStatusValue,
} from '@/components/subscription/VenueSubscriptionState';
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
 * Reads `users.me`, so it shares that query's cache and its guest guard. Refreshes on
 * app foreground via the existing resume hook — activation completes on a different
 * device (the venue is on a laptop reading email), so there is nothing to poll for.
 */
export function useVenueSubscription() {
  const { data: me } = useMe();

  const status = (me?.venueProfile?.subscriptionStatus ??
    null) as VenueSubscriptionStatusValue | null;

  // Default to "not on hold" until `me` resolves: the alternative flashes a false
  // "your profile isn't live" on every cold start. Every gate is enforced server-side,
  // so an optimistic first paint costs nothing.
  const onHold = me?.venueProfile?.onHold ?? false;

  return {
    status,
    trialEndsAt: me?.venueProfile?.trialEndsAt ?? null,
    onHold,
    /** Which subscription surface to render: activate | trial | past_due | none. */
    state: venueStateFor({ status, onHold }),
    /** V-14 — resolved server-side, mirroring `assertVenueMayPublish`. */
    mayPublish: me?.venueProfile?.mayPublish ?? true,
  };
}
