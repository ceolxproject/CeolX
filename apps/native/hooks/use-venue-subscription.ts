import {
  venueMayPublish,
  venueStateFor,
  type VenueSubscriptionStatusValue,
} from '@/components/subscription/VenueSubscriptionState';
import { useMe } from '@/hooks/use-me';

/**
 * The authenticated venue's own subscription state (M8).
 *
 * One place for "what does this venue see about their billing", so the profile
 * screen, the event form and the post composer cannot disagree — they previously
 * each rendered the interim free-access notice independently, which is exactly how
 * they would drift.
 *
 * Reads `users.me`, so it shares that query's cache and its guest guard. Refreshes
 * on app foreground via the existing resume hook — activation completes on a
 * different device (the venue is on a laptop reading email), so there is nothing to
 * poll for here.
 */
export function useVenueSubscription() {
  const { data: me } = useMe();

  const status = (me?.venueProfile?.subscriptionStatus ??
    null) as VenueSubscriptionStatusValue | null;

  return {
    status,
    trialEndsAt: me?.venueProfile?.trialEndsAt ?? null,
    /** Which subscription surface to render: activate | trial | past_due | none. */
    state: venueStateFor(status),
    /** V-14 — may this venue publish events and posts? */
    mayPublish: venueMayPublish(status),
    /** True once we actually know the status, so nothing flashes on first paint. */
    isResolved: !!me,
  };
}
