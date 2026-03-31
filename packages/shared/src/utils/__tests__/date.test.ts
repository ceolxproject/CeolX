import { describe, it, expect } from 'vitest';

import {
  formatEventDate,
  formatRelativeTime,
  formatDateRange,
  isEventUpcoming,
  isEventPast,
  isEventToday,
} from '../date.js';

describe('formatEventDate', () => {
  it('formats a date in Europe/Dublin timezone with correct pattern', () => {
    // 2026-04-05T20:00:00Z is 9pm Dublin time (UTC+1 in April)
    const result = formatEventDate('2026-04-05T20:00:00.000Z');
    // Should be "Sun, 5 Apr · 9:00pm" (BST = UTC+1 in April)
    expect(result).toMatch(/Sun, 5 Apr/);
    expect(result).toMatch(/·/);
    expect(result).toMatch(/9:00pm/);
  });

  it('formats midnight correctly', () => {
    // 2026-06-01T00:00:00+01:00 = midnight Dublin time
    const result = formatEventDate('2026-05-31T23:00:00.000Z');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/12:00am/);
  });
});

describe('formatRelativeTime', () => {
  it('returns a relative time string', () => {
    const nearFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(nearFuture);
    expect(result).toMatch(/days?/i);
  });

  it('includes "ago" for past dates', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(past);
    expect(result).toMatch(/ago/i);
  });
});

describe('formatDateRange', () => {
  it('returns single date when no end date', () => {
    const result = formatDateRange('2026-04-05T00:00:00.000Z');
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/2026/);
  });

  it('collapses same-month range', () => {
    const result = formatDateRange('2026-04-05T00:00:00.000Z', '2026-04-07T00:00:00.000Z');
    // Should be "5–7 Apr 2026"
    expect(result).toMatch(/5/);
    expect(result).toMatch(/7/);
    expect(result).toMatch(/Apr 2026/);
    expect(result).not.toMatch(/Apr.*Apr/);
  });

  it('shows both months for cross-month range', () => {
    const result = formatDateRange('2026-04-30T00:00:00.000Z', '2026-05-02T00:00:00.000Z');
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/May/);
  });
});

describe('isEventToday', () => {
  it('returns true for a date that is today', () => {
    const todayIso = new Date().toISOString();
    expect(isEventToday(todayIso)).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isEventToday(yesterday)).toBe(false);
  });
});

describe('isEventUpcoming / isEventPast', () => {
  it('isEventUpcoming returns true for future dates', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isEventUpcoming(future)).toBe(true);
    expect(isEventPast(future)).toBe(false);
  });

  it('isEventPast returns true for past dates', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(isEventPast(past)).toBe(true);
    expect(isEventUpcoming(past)).toBe(false);
  });
});
