import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_STATUSES, SubscriptionStatus } from '../../enums.js';
import {
  ProfileVisibility,
  isPubliclyVisible,
  venueVisibilityFor,
  type VenueVisibility,
} from '../venue-visibility.js';

// Fixed instant so the past-due grace assertions cannot drift with the clock.

describe('venueVisibilityFor', () => {
  it('shows a venue on trial — the trial is the product, not a preview (D-28)', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.TRIALING })).toBe(
      ProfileVisibility.VISIBLE
    );
  });

  it('shows a paying venue', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.ACTIVE })).toBe(
      ProfileVisibility.VISIBLE
    );
  });

  it('holds a venue that never completed payment setup', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.INACTIVE })).toBe(
      ProfileVisibility.ON_HOLD
    );
  });

  it('holds a venue whose paid period has elapsed', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.CANCELLED })).toBe(
      ProfileVisibility.ON_HOLD
    );
  });

  describe('past_due — dunning is delegated to Stripe (D-33, revised 18/08/2026)', () => {
    it('stays visible for as long as Stripe reports past_due', () => {
      // No dates involved any more. `past_due` means Stripe is still retrying the
      // charge; its retry schedule decides when to stop and cancels at that point,
      // which flips the status to `cancelled` and hides the venue via the branch below.
      expect(venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE })).toBe(
        ProfileVisibility.VISIBLE
      );
    });

    it('is hidden once Stripe gives up and cancels', () => {
      // The end of the grace window is now expressed as a Stripe cancellation, not as
      // arithmetic on our clock. This is the pair that used to be a 7-day comparison.
      expect(venueVisibilityFor({ status: SubscriptionStatus.CANCELLED })).toBe(
        ProfileVisibility.ON_HOLD
      );
    });

    it('is still hidden while past_due if a chargeback blocked billing', () => {
      // billing_blocked outranks everything, including a collectable past_due (D-51).
      expect(
        venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, billingBlocked: true })
      ).toBe(ProfileVisibility.ON_HOLD);
    });
  });

  it('takes no clock at all, so it cannot drift from Stripe', () => {
    // The whole reason for the change: a 7-day window measured on our clock could
    // disagree with whether Stripe was still retrying. There is nothing left to sync.
    expect(venueVisibilityFor.length).toBe(1);
  });

  it('never returns not_found — a status implies a row exists', () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(venueVisibilityFor({ status })).not.toBe(ProfileVisibility.NOT_FOUND);
    }
  });

  it('resolves every status in the enum — a new status cannot be silently unhandled', () => {
    // Guards the case where SUBSCRIPTION_STATUSES gains a value and nobody revisits
    // the predicate: an unhandled status would fall through to the ON_HOLD default
    // and quietly hide venues. This asserts the mapping is total and intentional.
    const expected: Record<(typeof SUBSCRIPTION_STATUSES)[number], VenueVisibility> = {
      inactive: ProfileVisibility.ON_HOLD,
      trialing: ProfileVisibility.VISIBLE,
      active: ProfileVisibility.VISIBLE,
      past_due: ProfileVisibility.VISIBLE, // Stripe still retrying; it cancels when it stops
      cancelled: ProfileVisibility.ON_HOLD,
    };
    expect(Object.keys(expected).sort()).toEqual([...SUBSCRIPTION_STATUSES].sort());

    for (const status of SUBSCRIPTION_STATUSES) {
      expect(venueVisibilityFor({ status })).toBe(expected[status]);
    }
  });
});

describe('isPubliclyVisible', () => {
  it('treats on_hold as not visible but distinct from not_found (D-52)', () => {
    expect(isPubliclyVisible(ProfileVisibility.VISIBLE)).toBe(true);
    expect(isPubliclyVisible(ProfileVisibility.ON_HOLD)).toBe(false);
    expect(isPubliclyVisible(ProfileVisibility.NOT_FOUND)).toBe(false);
    // The two falsy cases must remain separate values so callers can render
    // different states; this asserts they were not collapsed into one constant.
    expect(ProfileVisibility.ON_HOLD).not.toBe(ProfileVisibility.NOT_FOUND);
  });
});

describe('billingBlocked outranks status (D-51)', () => {
  // The revert this guards: the dispute handler writes `cancelled` but does not cancel
  // the Stripe subscription, so the next invoice.paid re-syncs the venue to `active`.
  // If visibility read status alone, the disputed venue would come back publicly.
  it.each([
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.INACTIVE,
    SubscriptionStatus.CANCELLED,
  ])('holds a blocked venue whatever Stripe last said (%s)', (status) => {
    expect(venueVisibilityFor({ status, billingBlocked: true })).toBe(ProfileVisibility.ON_HOLD);
  });

  it('holds a past_due venue Stripe is still happily retrying', () => {
    // past_due is otherwise visible now that dunning is Stripe's. A dispute is not an
    // innocent expired card, so the block must outrank a collectable status.
    expect(venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, billingBlocked: true })).toBe(
      ProfileVisibility.ON_HOLD
    );
  });

  it('leaves an unblocked venue unaffected', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.ACTIVE, billingBlocked: false })).toBe(
      ProfileVisibility.VISIBLE
    );
    // Omitted entirely — every existing caller shape must keep working.
    expect(venueVisibilityFor({ status: SubscriptionStatus.ACTIVE })).toBe(
      ProfileVisibility.VISIBLE
    );
  });
});
