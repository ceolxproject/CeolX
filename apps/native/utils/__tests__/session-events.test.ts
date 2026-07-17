import { afterEach, describe, expect, it, vi } from 'vitest';

import { emitSessionExpired, onSessionExpired, resetSessionExpired } from '../session-events';

describe('session-events bus', () => {
  afterEach(() => {
    // Leave the latch clean for the next test.
    resetSessionExpired();
  });

  it('notifies a subscriber when a session expires', () => {
    const cb = vi.fn();
    onSessionExpired(cb);
    emitSessionExpired();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('de-dupes: repeated emits fire the callback only once', () => {
    const cb = vi.fn();
    onSessionExpired(cb);
    emitSessionExpired();
    emitSessionExpired();
    emitSessionExpired();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires again after the latch is reset', () => {
    const cb = vi.fn();
    onSessionExpired(cb);
    emitSessionExpired();
    resetSessionExpired();
    emitSessionExpired();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not notify after unsubscribe', () => {
    const cb = vi.fn();
    const unsubscribe = onSessionExpired(cb);
    unsubscribe();
    emitSessionExpired();
    expect(cb).not.toHaveBeenCalled();
  });

  it('notifies multiple subscribers on a single emit', () => {
    const a = vi.fn();
    const b = vi.fn();
    onSessionExpired(a);
    onSessionExpired(b);
    emitSessionExpired();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
