import { describe, expect, it } from 'vitest';

import { buildDateFilter } from '../routers/events/helpers';

// The picked-day window is supplied by the client as absolute Unix seconds and
// filtered as-is; with no day it's an open-ended "from now" filter.
describe('buildDateFilter', () => {
  it('returns an open-ended "from now" filter when no day is given', () => {
    const now = 1_700_000_000;
    expect(buildDateFilter(now)).toBe(` && date_start:>=${now}`);
  });

  describe('picked day window', () => {
    it('filters the exact [start, end) window the client provided', () => {
      const now = 1_700_000_000;
      const day = { start: 1_760_000_000, end: 1_760_086_400 };

      expect(buildDateFilter(now, day)).toBe(
        ` && date_start:>=${day.start} && date_start:<${day.end}`
      );
    });

    it('does not clamp to now — earlier-today events on the picked day still show', () => {
      // `now` falls inside the window; the start must NOT be pushed up to it.
      const day = { start: 1_760_000_000, end: 1_760_086_400 };
      const now = day.start + 3600; // one hour into the day

      expect(buildDateFilter(now, day)).toBe(
        ` && date_start:>=${day.start} && date_start:<${day.end}`
      );
    });
  });
});
