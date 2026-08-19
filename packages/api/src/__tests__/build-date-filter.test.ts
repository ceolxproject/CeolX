import { describe, expect, it } from 'vitest';

import { buildDateFilter } from '../routers/events/helpers';

/**
 * The filter behind the map, the feed and search.
 *
 * Both branches test **overlap**, not "starts inside the window". Filtering on
 * `date_start` alone dropped an event the instant it began: a gig running 20:00–23:00
 * vanished at 20:01 while it was on, and a festival running 10–14 August was gone from
 * the 11th onwards. Found in map-pointer QA on 11/08/2026 and shipped to production long
 * before that, so these assertions are the guard against it returning.
 *
 * `date_end` is optional in the Typesense schema and a range filter never matches a
 * document missing the field — hence the `||` rather than a COALESCE, with the start as
 * the fallback for events that genuinely have no end time.
 */
describe('buildDateFilter', () => {
  it('keeps an event that has started but not finished', () => {
    const now = 1_700_000_000;
    // The bug in one line: an in-progress event has date_start < now, so a
    // `date_start:>=now` filter excluded it. date_end is what keeps it.
    expect(buildDateFilter(now)).toBe(` && (date_end:>=${now} || date_start:>=${now})`);
  });

  it('falls back to the start date for an event with no end time', () => {
    // Same string serves both: a single-evening gig has no date_end, so the second
    // clause decides it — which is exactly the old behaviour, kept for the events the
    // old behaviour was already right about.
    const now = 1_700_000_000;
    expect(buildDateFilter(now)).toContain(`date_start:>=${now}`);
  });

  describe('picked day window', () => {
    it('matches any event overlapping the day, not only those starting in it', () => {
      const day = { start: 1_760_000_000, end: 1_760_086_400 };
      const now = 1_700_000_000;

      // Starts before the day ends AND has not finished when the day begins. This is
      // what makes day three of a multi-day festival list it.
      expect(buildDateFilter(now, day)).toBe(
        ` && date_start:<${day.end} && (date_end:>=${day.start} || date_start:>=${day.start})`
      );
    });

    it('does not clamp to now — earlier-today events on the picked day still show', () => {
      // `now` falls inside the window; the day's own bounds must survive untouched.
      const day = { start: 1_760_000_000, end: 1_760_086_400 };
      const now = day.start + 3600; // one hour into the day

      const filter = buildDateFilter(now, day);
      expect(filter).toContain(`date_end:>=${day.start}`);
      expect(filter).not.toContain(String(now));
    });
  });
});
