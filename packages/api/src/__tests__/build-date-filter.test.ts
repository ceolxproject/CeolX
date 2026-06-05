import { describe, expect, it } from 'vitest';

import { buildDateFilter } from '../routers/events/helpers';

// All boundaries are built server-local (matching the named presets), so these
// tests construct their expected Unix seconds the same way.
const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

describe('buildDateFilter', () => {
  it('returns an open-ended "from now" filter when nothing is given', () => {
    const now = 1_700_000_000;
    expect(buildDateFilter(undefined, now)).toBe(` && date_start:>=${now}`);
  });

  describe('specificDate', () => {
    it('builds a single-day [start, start+1day) window for a future date', () => {
      // A date far past `now` so the past-event clamp does not kick in.
      const now = toUnix(new Date(2026, 5, 1)); // 1 Jun 2026
      const start = toUnix(new Date(2026, 5, 12)); // 12 Jun 2026 00:00
      const end = toUnix(new Date(2026, 5, 13)); // 13 Jun 2026 00:00

      expect(buildDateFilter(undefined, now, '2026-06-12')).toBe(
        ` && date_start:>=${start} && date_start:<${end}`
      );
    });

    it('clamps the window start to now so earlier-today events are hidden', () => {
      // `now` is midday on the picked day → start should clamp up to `now`.
      const now = toUnix(new Date(2026, 5, 12, 12, 0, 0));
      const end = toUnix(new Date(2026, 5, 13));

      expect(buildDateFilter(undefined, now, '2026-06-12')).toBe(
        ` && date_start:>=${now} && date_start:<${end}`
      );
    });

    it('takes precedence over a dateRange preset when both are present', () => {
      const now = toUnix(new Date(2026, 5, 1));
      const start = toUnix(new Date(2026, 5, 12));
      const end = toUnix(new Date(2026, 5, 13));

      expect(buildDateFilter('this_month', now, '2026-06-12')).toBe(
        ` && date_start:>=${start} && date_start:<${end}`
      );
    });
  });
});
