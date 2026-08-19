import { describe, expect, it } from 'vitest';

import { buildDateFilter } from '../routers/events/helpers';

/**
 * The Typesense filter behind the map, feed and search.
 *
 * Asserted as exact strings on purpose. A partial assertion here is worth very little:
 * the whole class of bug this guards against is a dropped clause, and a `toContain` still
 * passes when the bound that limits the window goes missing.
 */
describe('buildDateFilter', () => {
  it('keeps an event that has started but not finished', () => {
    const now = 1_700_000_000;
    // The bug in one line: an in-progress event has date_start < now, so a
    // `date_start:>=now` filter excluded it while it was actually on.
    expect(buildDateFilter(now)).toBe(` && (date_end:>=${now} || date_start:>=${now})`);
  });

  describe('picked day window', () => {
    const day = { start: 1_760_000_000, end: 1_760_086_400 };

    it('matches any event overlapping the day, not only those starting in it', () => {
      // Starts before the day ends AND has not finished when the day begins — which is
      // what makes day three of a multi-day festival list it.
      expect(buildDateFilter(1_700_000_000, day)).toBe(
        ` && date_start:<${day.end} && (date_end:>=${day.start} || date_start:>=${day.start})`
      );
    });

    it('keeps the upper bound, so a later event cannot leak into the picked day', () => {
      // Named separately because losing `date_start:<end` is the silent failure: every
      // future event would match the day, and the exact-string assertion above is the
      // only thing that catches it.
      expect(buildDateFilter(1_700_000_000, day)).toContain(`date_start:<${day.end}`);
    });

    it('does not clamp to now — earlier-today events on the picked day still show', () => {
      // `now` inside the window must not push the day's own start up to it. Asserted as
      // the full string so a clamp using any derived value (now - 1, a rounded hour) is
      // caught, which a `not.toContain(String(now))` check would miss.
      const now = day.start + 3600; // one hour into the day
      expect(buildDateFilter(now, day)).toBe(
        ` && date_start:<${day.end} && (date_end:>=${day.start} || date_start:>=${day.start})`
      );
    });
  });
});
