import { describe, expect, it } from 'vitest';

import { venueStateFor } from '@/components/subscription/venue-subscription-state.utils';

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
