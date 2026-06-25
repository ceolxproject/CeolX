import { describe, it, expect } from 'vitest';

import {
  formatEventDate,
  formatRelativeTime,
  formatPostTimestamp,
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

describe('formatPostTimestamp', () => {
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString();
  const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  it('shows "Just now" for posts under a minute old', () => {
    expect(formatPostTimestamp(minutesAgo(0))).toBe('Just now');
    expect(formatPostTimestamp(new Date(Date.now() - 30 * 1000).toISOString())).toBe('Just now');
  });

  it('treats future timestamps as "Just now" (clock skew guard)', () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    expect(formatPostTimestamp(future)).toBe('Just now');
  });

  it('shows singular vs plural minutes', () => {
    expect(formatPostTimestamp(minutesAgo(1))).toBe('1 minute ago');
    expect(formatPostTimestamp(minutesAgo(5))).toBe('5 minutes ago');
    expect(formatPostTimestamp(minutesAgo(59))).toBe('59 minutes ago');
  });

  it('shows singular vs plural hours', () => {
    expect(formatPostTimestamp(hoursAgo(1))).toBe('1 hour ago');
    expect(formatPostTimestamp(hoursAgo(2))).toBe('2 hours ago');
    expect(formatPostTimestamp(hoursAgo(23))).toBe('23 hours ago');
  });

  it('shows "Yesterday" for a post from the previous calendar day', () => {
    expect(formatPostTimestamp(daysAgo(1))).toBe('Yesterday');
  });

  it('switches to an absolute date for posts 2+ days old', () => {
    const result = formatPostTimestamp('2026-06-15T12:00:00.000Z');
    expect(result).toBe('15 Jun 2026');
  });

  it('never shows "ago" once it falls back to an absolute date', () => {
    const result = formatPostTimestamp(daysAgo(40));
    expect(result).not.toMatch(/ago/i);
    expect(result).not.toBe('Yesterday');
    expect(result).toMatch(/\d{4}/);
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
