import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TtlCache } from '../utils/ttl-cache';

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for missing keys', () => {
    const cache = new TtlCache<string>();
    expect(cache.get('missing')).toBeNull();
  });

  it('returns the stored value within ttl', () => {
    const cache = new TtlCache<{ count: number }>();
    cache.set('users', { count: 42 }, 5_000);
    expect(cache.get('users')).toEqual({ count: 42 });
  });

  it('returns null after ttl expires', () => {
    const cache = new TtlCache<string>();
    cache.set('k', 'v', 1_000);
    vi.advanceTimersByTime(999);
    expect(cache.get('k')).toBe('v');
    vi.advanceTimersByTime(2);
    expect(cache.get('k')).toBeNull();
  });

  it('overwrites the value and resets ttl on re-set', () => {
    const cache = new TtlCache<number>();
    cache.set('k', 1, 1_000);
    vi.advanceTimersByTime(900);
    cache.set('k', 2, 1_000);
    vi.advanceTimersByTime(900);
    expect(cache.get('k')).toBe(2);
  });

  it('isolates different keys', () => {
    const cache = new TtlCache<string>();
    cache.set('a', 'A', 5_000);
    cache.set('b', 'B', 5_000);
    expect(cache.get('a')).toBe('A');
    expect(cache.get('b')).toBe('B');
  });

  it('treats ttl of 0 as immediately expired', () => {
    const cache = new TtlCache<string>();
    cache.set('k', 'v', 0);
    expect(cache.get('k')).toBeNull();
  });
});
