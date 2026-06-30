import { describe, expect, it } from 'vitest';

import { formatRequestAttempts } from '../format-request-attempts';

describe('formatRequestAttempts', () => {
  it('returns null for a single attempt (no repeat note)', () => {
    expect(formatRequestAttempts(1, '2026-04-15T10:00:00Z')).toBeNull();
    expect(formatRequestAttempts(0, '2026-04-15T10:00:00Z')).toBeNull();
  });

  it('summarises repeat attempts with a count and last-requested date', () => {
    const label = formatRequestAttempts(2, '2026-04-15T10:00:00Z');
    expect(label).toContain('Requested 2 times');
    // Irish locale → day-first ("15 Apr 2026").
    expect(label).toContain('15 Apr 2026');
  });

  it('scales the count for more attempts', () => {
    expect(formatRequestAttempts(5, '2026-04-15T10:00:00Z')).toContain('Requested 5 times');
  });
});
