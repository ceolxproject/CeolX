import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_STATUSES, SubscriptionStatus } from '../../enums.js';
import {
  ProfileVisibility,
  isPubliclyVisible,
  venueVisibilityFor,
  type VenueVisibility,
} from '../venue-visibility.js';

// Fixed instant so the past-due grace assertions cannot drift with the clock.
const NOW = new Date('2026-08-18T12:00:00.000Z');
const inGrace = new Date('2026-08-20T00:00:00.000Z'); // after NOW
const graceLapsed = new Date('2026-08-17T00:00:00.000Z'); // before NOW

describe('venueVisibilityFor', () => {
  it('shows a venue on trial — the trial is the product, not a preview (D-28)', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.TRIALING }, NOW)).toBe(
      ProfileVisibility.VISIBLE
    );
  });

  it('shows a paying venue', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.ACTIVE }, NOW)).toBe(
      ProfileVisibility.VISIBLE
    );
  });

  it('holds a venue that never completed payment setup', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.INACTIVE }, NOW)).toBe(
      ProfileVisibility.ON_HOLD
    );
  });

  it('holds a venue whose paid period has elapsed', () => {
    expect(venueVisibilityFor({ status: SubscriptionStatus.CANCELLED }, NOW)).toBe(
      ProfileVisibility.ON_HOLD
    );
  });

  describe('past_due', () => {
    it('stays visible inside the grace window (D-33)', () => {
      expect(
        venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, graceEndsAt: inGrace }, NOW)
      ).toBe(ProfileVisibility.VISIBLE);
    });

    it('goes on hold once the grace window has lapsed', () => {
      expect(
        venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, graceEndsAt: graceLapsed }, NOW)
      ).toBe(ProfileVisibility.ON_HOLD);
    });

    it('goes on hold exactly at the boundary — the window is half-open', () => {
      expect(
        venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, graceEndsAt: NOW }, NOW)
      ).toBe(ProfileVisibility.ON_HOLD);
    });

    it('fails open when no grace end is recorded, rather than hiding a paying venue', () => {
      // Pins the deliberate choice documented in venue-visibility.ts: a null here is
      // a data bug in the webhook, and hiding a customer whose card merely expired is
      // the worse of the two errors. If this ever flips, it must be a decision.
      expect(venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE }, NOW)).toBe(
        ProfileVisibility.VISIBLE
      );
      expect(
        venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, graceEndsAt: null }, NOW)
      ).toBe(ProfileVisibility.VISIBLE);
    });
  });

  it('never returns not_found — a status implies a row exists', () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(venueVisibilityFor({ status, graceEndsAt: inGrace }, NOW)).not.toBe(
        ProfileVisibility.NOT_FOUND
      );
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
      past_due: ProfileVisibility.VISIBLE, // with graceEndsAt in the future
      cancelled: ProfileVisibility.ON_HOLD,
    };
    expect(Object.keys(expected).sort()).toEqual([...SUBSCRIPTION_STATUSES].sort());

    for (const status of SUBSCRIPTION_STATUSES) {
      expect(venueVisibilityFor({ status, graceEndsAt: inGrace }, NOW)).toBe(expected[status]);
    }
  });

  it('defaults `now` to the current time when not supplied', () => {
    const wellPast = new Date(Date.now() - 60_000);
    expect(venueVisibilityFor({ status: SubscriptionStatus.PAST_DUE, graceEndsAt: wellPast })).toBe(
      ProfileVisibility.ON_HOLD
    );
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

  it('holds even inside a live grace window', () => {
    // A dispute is not an innocent expired card, so the D-33 grace period must not
    // rescue it.
    expect(
      venueVisibilityFor({
        status: SubscriptionStatus.PAST_DUE,
        graceEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        billingBlocked: true,
      })
    ).toBe(ProfileVisibility.ON_HOLD);
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
