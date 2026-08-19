import { describe, expect, it } from 'vitest';

import { isEventNotFinished } from '../lib/event-window';

/**
 * The has-it-finished rule, in the form the profile screens use.
 *
 * The SQL halves cannot be unit-tested without a database, but they are the same rule
 * and are verified against the local Postgres in the PR. This covers the JS form, which
 * is what `artists.byId`, `venues.byId` and `collections.byId` split their upcoming/past
 * sections on — and until this existed, reverting the entire fix left the suite green.
 *
 * Every case here is one the old `dateStart`-only rule got wrong or had to keep right.
 */
describe('isEventNotFinished', () => {
  const now = new Date('2026-08-12T21:00:00.000Z');

  it('keeps a gig that has started but not ended', () => {
    // The reported bug: a gig running 20:00-23:00 vanished at 20:01.
    expect(
      isEventNotFinished(
        { dateStart: '2026-08-12T20:00:00.000Z', dateEnd: '2026-08-12T23:00:00.000Z' },
        now
      )
    ).toBe(true);
  });

  it('keeps a multi-day festival on its middle days', () => {
    // The other half: a festival running 10-14 August disappeared from the 11th.
    expect(
      isEventNotFinished(
        { dateStart: '2026-08-10T12:00:00.000Z', dateEnd: '2026-08-14T23:00:00.000Z' },
        now
      )
    ).toBe(true);
  });

  it('drops an event that has genuinely ended', () => {
    // Matters as much as the two above — the fix must not resurrect finished events.
    expect(
      isEventNotFinished(
        { dateStart: '2026-08-11T20:00:00.000Z', dateEnd: '2026-08-11T23:00:00.000Z' },
        now
      )
    ).toBe(false);
  });

  it('falls back to the start when there is no end time', () => {
    // A single-evening gig has no dateEnd, so behaviour is unchanged for it.
    expect(isEventNotFinished({ dateStart: '2026-08-13T20:00:00.000Z', dateEnd: null }, now)).toBe(
      true
    );
    expect(isEventNotFinished({ dateStart: '2026-08-11T20:00:00.000Z', dateEnd: null }, now)).toBe(
      false
    );
  });

  it('counts an event ending exactly now as still on', () => {
    // Pins the boundary, because the SQL form uses `>=` and a JS `>` here would let an
    // event sit in neither the upcoming nor the past section for one instant.
    expect(isEventNotFinished({ dateStart: '2026-08-12T18:00:00.000Z', dateEnd: now }, now)).toBe(
      true
    );
  });

  it('accepts Date objects as well as ISO strings', () => {
    // The profile routers pass serialised strings; the promo helpers pass Dates.
    expect(
      isEventNotFinished({ dateStart: new Date('2026-08-12T20:00:00.000Z'), dateEnd: null }, now)
    ).toBe(false);
  });
});
