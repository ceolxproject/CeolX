import { describe, expect, it } from 'vitest';

import {
  activationPanelFor,
  canManageBilling,
  planSummaryFor,
  asVenueStatus,
  formatTrialEnd,
  isActivated,
  venueStateFor,
} from '@/components/subscription/venue-subscription-state.utils';

/**
 * `venueStateFor` decides whether a venue is told its profile is not live. Getting it
 * wrong tells a paying customer their listing is dead, so it is worth pinning.
 *
 * The two bugs these guard against, both from deriving the answer from status alone:
 *   - the gate ships disabled, under which every venue is fully visible while still
 *     sitting at `inactive` — so all 47 would have seen "your profile isn't live yet"
 *   - `past_due` inside the grace window is still visible and still publishing, while
 *     past the window it is hidden; the status is identical in both cases
 */
describe('venueStateFor — gate-aware, not status-inferred', () => {
  it('prompts a grandfathered venue WITHOUT claiming its profile is dead', () => {
    // The distinction that matters most at cutover. A venue that signed up before
    // subscriptions existed has a live, working profile. It still needs to act — it
    // loses access when the gate turns on — but "your profile isn't live yet" would be
    // false, and returning 'none' (the previous behaviour) told it nothing at all and
    // would have hidden it without warning.
    expect(venueStateFor({ status: 'inactive', onHold: false })).toBe('activate_grace');
    expect(venueStateFor({ status: 'cancelled', onHold: false })).toBe('activate_grace');
  });

  it('separates "not live yet" from "keep it live"', () => {
    // Same status, opposite truths — only `onHold` distinguishes them.
    expect(venueStateFor({ status: 'inactive', onHold: true })).toBe('activate');
    expect(venueStateFor({ status: 'inactive', onHold: false })).toBe('activate_grace');
  });

  it('prompts activation only when the gate says the venue is hidden', () => {
    expect(venueStateFor({ status: 'inactive', onHold: true })).toBe('activate');
    expect(venueStateFor({ status: 'cancelled', onHold: true })).toBe('activate');
  });

  it('shows the trial notice for a trialing venue regardless of the gate', () => {
    expect(venueStateFor({ status: 'trialing', onHold: false })).toBe('trial');
    expect(venueStateFor({ status: 'trialing', onHold: true })).toBe('trial');
  });

  it('shows the past-due banner both inside and outside the grace window', () => {
    // Past the window the venue is hidden, but it needs the fix-payment banner more
    // than an activation prompt — the subscription still exists.
    expect(venueStateFor({ status: 'past_due', onHold: false })).toBe('past_due');
    expect(venueStateFor({ status: 'past_due', onHold: true })).toBe('past_due');
  });

  it('shows nothing for an active subscriber', () => {
    // Only a venue with no subscription is ever prompted.
    expect(venueStateFor({ status: 'active', onHold: false })).toBe('none');
  });

  it('shows nothing before the status is known', () => {
    // First paint, before users.me resolves. Flashing "not live" here would be a lie
    // on every cold start.
    // Neither prompt fires before we know the status — a cold start must not flash
    // either "isn't live" or "keep it live" at a venue we know nothing about yet.
    expect(venueStateFor({ status: null, onHold: false })).toBe('none');
    expect(venueStateFor({ status: undefined, onHold: false })).toBe('none');
  });

  it('never returns activate for a status that has live billing', () => {
    // Nobody with a live subscription is told to activate. This caught a real case: a
    // chargeback sets billing_blocked, which hides the venue while Stripe still reports
    // `active` — and requestActivation refuses blocked accounts, so the button would
    // have failed on tap.
    for (const status of ['trialing', 'active', 'past_due'] as const) {
      expect(venueStateFor({ status, onHold: true })).not.toBe('activate');
    }
  });

  it('says nothing to a chargeback-blocked venue rather than offering a dead button', () => {
    // The "under review, contact us" surface is deferred with the rest of the chargeback
    // handling (D-62). Until it exists, silence beats a control that errors.
    expect(venueStateFor({ status: 'active', onHold: true })).toBe('none');
  });
});

/**
 * The activation hand-off screen's panel choice.
 *
 * This is the screen every new venue walks through, and it has already shipped two bugs —
 * both ordering mistakes in exactly this decision, and neither reachable by a test while the
 * logic lived inline in JSX:
 *
 *   - it rendered "One last step" to a venue whose payment had landed 96 seconds earlier,
 *     because nothing re-read the subscription state
 *   - before that it asserted an email had been sent while the request was still in flight
 */
describe('activationPanelFor — order is the substance', () => {
  const waiting = { activated: false, error: null, isPending: false, sent: false };

  it('shows the waiting copy on a fresh arrival', () => {
    expect(activationPanelFor({ ...waiting, isPending: false })).toBe('waiting');
  });

  it('holds a spinner until the first send resolves, rather than claiming it sent', () => {
    expect(activationPanelFor({ ...waiting, isPending: true })).toBe('sending');
  });

  it('keeps the waiting copy for a RESEND — an email is already away', () => {
    // Once any email is out, the waiting copy is true. Blanking the screen to a spinner
    // would take away what the venue is reading mid-resend.
    expect(activationPanelFor({ ...waiting, isPending: true, sent: true })).toBe('waiting');
  });

  it('keeps the failure visible while a retry is in flight', () => {
    // The retry button carries its own spinner; swapping the whole screen for one would
    // hide the reason they are retrying.
    expect(activationPanelFor({ ...waiting, error: 'nope', isPending: true })).toBe('error');
  });

  it('lets activation outrank a failed email — the email was only ever the means', () => {
    // The regression that motivated all of this. A venue with live billing must never see a
    // failure or a "we're waiting" state, whatever the email request did.
    expect(
      activationPanelFor({ activated: true, error: 'nope', isPending: true, sent: false })
    ).toBe('success');
  });

  it('lets activation outrank an in-flight send', () => {
    expect(activationPanelFor({ activated: true, error: null, isPending: true, sent: false })).toBe(
      'success'
    );
  });
});

describe('isActivated', () => {
  it('treats past-due as activated — the profile is live and the card merely failed', () => {
    // D-33: the grace window exists to absorb an expired card. Prompting them to "activate"
    // would be wrong; they are a paying customer.
    for (const status of ['trialing', 'active', 'past_due'] as const) {
      expect(isActivated(status)).toBe(true);
    }
  });

  it('treats every non-billing state as not activated', () => {
    for (const status of ['inactive', 'cancelled'] as const) {
      expect(isActivated(status)).toBe(false);
    }
    expect(isActivated(null)).toBe(false);
    expect(isActivated(undefined)).toBe(false);
  });
});

describe('formatTrialEnd', () => {
  it('formats an ISO date the way the badge and the success panel both need it', () => {
    expect(formatTrialEnd('2027-02-17T00:00:00.000Z')).toBe('17 February 2027');
  });

  it('returns null rather than "Invalid Date" for absent or junk input', () => {
    // `users.me` LEFT JOINs the billing row, so null is the normal case for an unsubscribed
    // venue and for every seeded venue — not an error.
    expect(formatTrialEnd(null)).toBeNull();
    expect(formatTrialEnd(undefined)).toBeNull();
    expect(formatTrialEnd('')).toBeNull();
    expect(formatTrialEnd('not-a-date')).toBeNull();
  });
});

describe('asVenueStatus', () => {
  it('maps absent values to null so callers have one shape to handle', () => {
    expect(asVenueStatus(undefined)).toBeNull();
    expect(asVenueStatus(null)).toBeNull();
  });

  it('passes a real status through untouched', () => {
    expect(asVenueStatus('trialing')).toBe('trialing');
  });
});

/**
 * The one line in Settings answering "which plan am I on, and what happens next".
 *
 * Before this existed a paying subscriber saw nothing at all about their subscription —
 * `venueStateFor` collapses `active` to 'none', and the plan columns never left the
 * server. QA reported it as "I cannot see my subscribed plan".
 *
 * Every case asserts NO amount appears: D-16 forbids any price in the app, and this
 * string is the most likely place for one to creep in later.
 */
describe('planSummaryFor', () => {
  const base = {
    plan: 'monthly' as string | null,
    trialEndsAt: null as string | null,
    currentPeriodEnd: null as string | null,
    cancelAtPeriodEnd: false,
  };

  it('shows the first-charge date while trialing', () => {
    expect(
      planSummaryFor({ ...base, status: 'trialing', trialEndsAt: '2027-02-17T00:00:00.000Z' })
    ).toBe('Free trial until 17 February 2027');
  });

  it('shows interval and renewal date when active', () => {
    expect(
      planSummaryFor({ ...base, status: 'active', currentPeriodEnd: '2027-03-17T00:00:00.000Z' })
    ).toBe('Monthly · renews 17 March 2027');
    expect(
      planSummaryFor({
        ...base,
        status: 'active',
        plan: 'annual',
        currentPeriodEnd: '2027-03-17T00:00:00.000Z',
      })
    ).toBe('Annual · renews 17 March 2027');
  });

  it('announces a scheduled plan change instead of claiming the plan renews', () => {
    // D-70 enabled plan switching, and Stripe defers a downgrade into a schedule: the
    // subscription stays on annual while the next charge is monthly. Saying "Annual ·
    // renews 23 February" there is untrue in the way that matters — the venue is about
    // to be billed a different amount on a different cycle.
    expect(
      planSummaryFor({
        ...base,
        status: 'active',
        plan: 'annual',
        pendingPlan: 'monthly',
        currentPeriodEnd: '2027-02-23T00:00:00.000Z',
      })
    ).toBe('Changes to monthly on 23 February 2027');
  });

  it('ignores a pending plan identical to the current one', () => {
    // A schedule phase that keeps the same price is not a change worth announcing.
    expect(
      planSummaryFor({
        ...base,
        status: 'active',
        plan: 'monthly',
        pendingPlan: 'monthly',
        currentPeriodEnd: '2027-03-17T00:00:00.000Z',
      })
    ).toBe('Monthly · renews 17 March 2027');
  });

  it('says "cancels on" rather than "cancelled" while access remains', () => {
    // D-29: a venue who cancelled mid-period is still paying and still fully visible.
    // Calling that "cancelled" would be wrong while they still have access.
    expect(
      planSummaryFor({
        ...base,
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: '2027-03-17T00:00:00.000Z',
      })
    ).toBe('Cancels on 17 March 2027');
  });

  it('names the problem when past due', () => {
    expect(planSummaryFor({ ...base, status: 'past_due' })).toBe(
      'Payment failed — update your card'
    );
  });

  it('degrades without dates rather than printing "Invalid Date"', () => {
    // Every seeded venue has no billing row, so null dates are the normal case.
    expect(planSummaryFor({ ...base, status: 'trialing' })).toBe('Free trial');
    expect(planSummaryFor({ ...base, status: 'active', plan: null })).toBe('Active');
    expect(planSummaryFor({ ...base, status: 'inactive', plan: null })).toBe(
      'No active subscription'
    );
  });

  it('never contains a price', () => {
    const all = (['trialing', 'active', 'past_due', 'cancelled', 'inactive'] as const).flatMap(
      (status) => [
        planSummaryFor({ ...base, status, currentPeriodEnd: '2027-03-17T00:00:00.000Z' }),
        planSummaryFor({ ...base, status, cancelAtPeriodEnd: true }),
      ]
    );
    for (const line of all) {
      expect(line).not.toMatch(/[€$£]|\d+\.\d{2}|19\.99|199/);
    }
  });
});

describe('canManageBilling', () => {
  it('offers the Portal whenever a Stripe customer exists, paid or not', () => {
    // A lapsed venue still needs their invoices, and a returning one still needs to
    // resubscribe — so this keys on having a customer, not on being currently active.
    expect(canManageBilling(true)).toBe(true);
  });

  it('hides the row with no customer, because the server would refuse it', () => {
    // requestBillingPortal throws PRECONDITION_FAILED with no stripeCustomerId. Showing
    // the row anyway would invite a tap into a guaranteed error.
    expect(canManageBilling(false)).toBe(false);
  });
});
