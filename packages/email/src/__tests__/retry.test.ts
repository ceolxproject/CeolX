import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withRetry } from '../retry.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('returns the value on first success without delay', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const promise = withRetry(fn);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once after the configured delay on failure', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { retryDelayMs: 3000 });
    // allow the rejected first attempt to settle
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the second error when both attempts fail', async () => {
    const fn = vi
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'));

    const promise = withRetry(fn, { retryDelayMs: 3000 });
    // Attach expectation before advancing timers so the rejection isn't unhandled
    const assertion = expect(promise).rejects.toThrow('second');
    await vi.advanceTimersByTimeAsync(3000);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry when isRetryable returns false', async () => {
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(new Error('permanent'));
    const assertion = expect(withRetry(fn, { isRetryable: () => false })).rejects.toThrow(
      'permanent'
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
