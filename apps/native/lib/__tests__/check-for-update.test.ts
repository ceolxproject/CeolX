import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPendingUpdate,
  checkForUpdateManually,
  DEEP_LINK_RELOAD_GRACE_MS,
  getRunningBundleInfo,
  RESUME_UPDATE_THRESHOLD_MS,
  shouldApplyOnResume,
} from '../check-for-update';

// vitest hoists vi.mock above the imports above at runtime, so the mocked
// modules resolve to these factories despite the source-order placement.
vi.mock('expo-updates', () => ({
  isEnabled: true,
  isEmbeddedLaunch: true,
  updateId: undefined,
  createdAt: undefined,
  channel: 'preview',
  runtimeVersion: 'test-fingerprint',
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));

vi.mock('expo-linking', () => ({
  getInitialURL: vi.fn(),
}));

// The update helpers guard on __DEV__. vitest's node env has no __DEV__ global,
// so we set it explicitly per-suite (RN defines it at runtime). Referencing the
// bare identifier only happens inside the functions, which run after beforeEach.
const g = globalThis as Record<string, unknown>;

const mockCheckForUpdate = Updates.checkForUpdateAsync as ReturnType<typeof vi.fn>;
const mockFetchUpdate = Updates.fetchUpdateAsync as ReturnType<typeof vi.fn>;
const mockReload = Updates.reloadAsync as ReturnType<typeof vi.fn>;
const mockGetInitialURL = Linking.getInitialURL as ReturnType<typeof vi.fn>;

describe('checkForUpdateManually', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    g.__DEV__ = false;
    (Updates as Record<string, unknown>).isEnabled = true;
  });

  it('returns disabled when __DEV__ is true', async () => {
    g.__DEV__ = true;
    const result = await checkForUpdateManually();
    expect(result).toEqual({ status: 'disabled' });
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it('returns disabled when Updates.isEnabled is false', async () => {
    (Updates as Record<string, unknown>).isEnabled = false;
    const result = await checkForUpdateManually();
    expect(result).toEqual({ status: 'disabled' });
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });

  it('returns up_to_date when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: false });
    const result = await checkForUpdateManually();
    expect(result).toEqual({ status: 'up_to_date' });
    expect(mockFetchUpdate).not.toHaveBeenCalled();
  });

  it('fetches and returns applied when an update is available, without calling reloadAsync', async () => {
    // reloadAsync is NOT called here — the About screen shows a confirmation
    // dialog and reloads only after the user opts in.
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: true });
    mockFetchUpdate.mockResolvedValueOnce({});
    const result = await checkForUpdateManually();
    expect(result).toEqual({ status: 'applied' });
    expect(mockFetchUpdate).toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('returns error status (not throws) and captures the raw message when checkForUpdateAsync rejects', async () => {
    const nativeError = new Error(
      "Call to function 'ExpoUpdates.checkForUpdateAsync' has been rejected. → Caused by: Failed to check for update"
    );
    mockCheckForUpdate.mockRejectedValueOnce(nativeError);

    const result = await checkForUpdateManually();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe(nativeError.message);
    }
  });

  it('returns error with unknown_error for non-Error rejections', async () => {
    mockCheckForUpdate.mockRejectedValueOnce('string-rejection');
    const result = await checkForUpdateManually();
    expect(result).toEqual({ status: 'error', message: 'unknown_error' });
  });

  it('returns error when timeout fires before checkForUpdateAsync resolves', async () => {
    vi.useFakeTimers();
    mockCheckForUpdate.mockImplementationOnce(
      () =>
        new Promise<never>(() => {
          // never resolves
        })
    );
    const resultPromise = checkForUpdateManually();
    vi.advanceTimersByTime(25_000);
    const result = await resultPromise;
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('ota_timeout');
    }
    vi.useRealTimers();
  });
});

describe('applyPendingUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    g.__DEV__ = false;
    (Updates as Record<string, unknown>).isEnabled = true;
    // Default: not a deep-link launch.
    mockGetInitialURL.mockResolvedValue(null);
  });

  it('returns false when __DEV__ is true', async () => {
    g.__DEV__ = true;
    expect(await applyPendingUpdate()).toBe(false);
  });

  it('returns false when no update is available', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: false });
    expect(await applyPendingUpdate()).toBe(false);
  });

  it('returns false silently when checkForUpdateAsync throws', async () => {
    mockCheckForUpdate.mockRejectedValueOnce(new Error('network failure'));
    await expect(applyPendingUpdate()).resolves.toBe(false);
  });

  it('fetches and reloads when an update is available and the app was not launched from a deep link', async () => {
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: true });
    mockFetchUpdate.mockResolvedValueOnce({});
    mockGetInitialURL.mockResolvedValueOnce(null);
    const result = await applyPendingUpdate();
    expect(mockFetchUpdate).toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('stages the update but does NOT reload when a deep-link launch is in flight', async () => {
    // Reloading mid cold-start deep-link restoration drops the deep link
    // (Asana 1215040939202673). Stage the OTA and let it apply next launch.
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: true });
    mockFetchUpdate.mockResolvedValueOnce({});
    mockGetInitialURL.mockResolvedValueOnce('ceolx://events/e-1');
    const result = await applyPendingUpdate();
    expect(mockFetchUpdate).toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  /**
   * The regression this budget exists for: a few-MB bundle on mobile data takes
   * longer than the old 3s shared timeout, so the first cold start gave up,
   * the download staged in the background, and only the SECOND close-and-reopen
   * ran the new bundle. A download slower than 3s but within the fetch budget
   * must apply on THIS launch.
   */
  it('still reloads when the download takes longer than the old 3s budget', async () => {
    vi.useFakeTimers();
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: true });
    mockFetchUpdate.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({}), 10_000))
    );
    mockGetInitialURL.mockResolvedValueOnce(null);
    const resultPromise = applyPendingUpdate();
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;
    expect(mockReload).toHaveBeenCalled();
    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it('gives up (staging for next launch) when the download exceeds the fetch budget', async () => {
    vi.useFakeTimers();
    mockCheckForUpdate.mockResolvedValueOnce({ isAvailable: true });
    mockFetchUpdate.mockImplementationOnce(
      () =>
        new Promise<never>(() => {
          // never resolves — the timed-out fetch keeps downloading in the
          // background and expo-updates applies it natively next cold start.
        })
    );
    const resultPromise = applyPendingUpdate();
    await vi.advanceTimersByTimeAsync(16_000);
    const result = await resultPromise;
    expect(mockReload).not.toHaveBeenCalled();
    expect(result).toBe(false);
    vi.useRealTimers();
  });
});

describe('getRunningBundleInfo', () => {
  it('returns embedded when isEmbeddedLaunch is true', () => {
    (Updates as Record<string, unknown>).isEmbeddedLaunch = true;
    (Updates as Record<string, unknown>).updateId = undefined;
    expect(getRunningBundleInfo()).toEqual({ source: 'embedded' });
  });

  it('returns embedded when updateId is absent', () => {
    (Updates as Record<string, unknown>).isEmbeddedLaunch = false;
    (Updates as Record<string, unknown>).updateId = undefined;
    expect(getRunningBundleInfo()).toEqual({ source: 'embedded' });
  });

  it('returns ota with updateId and createdAt when OTA launched', () => {
    const createdAt = new Date('2026-05-28T10:00:00Z');
    (Updates as Record<string, unknown>).isEmbeddedLaunch = false;
    (Updates as Record<string, unknown>).updateId = 'abc-123';
    (Updates as Record<string, unknown>).createdAt = createdAt;
    const result = getRunningBundleInfo();
    expect(result).toEqual({ source: 'ota', updateId: 'abc-123', createdAt });
  });
});

describe('shouldApplyOnResume', () => {
  const NOW = new Date('2026-08-03T12:00:00Z').getTime();

  it('does not restart when the app never went to the background', () => {
    expect(shouldApplyOnResume(null, NOW)).toBe(false);
  });

  /**
   * The case this guard exists for: verify-email and forgot-password send the
   * user to their mail app and straight back. Restarting on that round trip
   * would drop them out of the flow they are standing in.
   */
  it('does not restart on a short trip to another app', () => {
    expect(shouldApplyOnResume(NOW - 30_000, NOW)).toBe(false);
  });

  it('does not restart just under the threshold', () => {
    expect(shouldApplyOnResume(NOW - RESUME_UPDATE_THRESHOLD_MS + 1, NOW)).toBe(false);
  });

  it('restarts once away for the full threshold', () => {
    expect(shouldApplyOnResume(NOW - RESUME_UPDATE_THRESHOLD_MS, NOW)).toBe(true);
  });

  it('restarts after a long break', () => {
    expect(shouldApplyOnResume(NOW - 8 * 60 * 60 * 1000, NOW)).toBe(true);
  });

  /**
   * Someone who taps a shared link after a long time away qualifies on the
   * threshold alone. Restarting there discards the URL that just arrived and
   * the app comes back on the screen it was already showing — the failure the
   * grace window exists to prevent.
   */
  it('does not restart when a deep link just arrived', () => {
    const away = NOW - 8 * 60 * 60 * 1000;
    expect(shouldApplyOnResume(away, NOW, NOW - 500)).toBe(false);
  });

  it('restarts once the deep-link grace window has passed', () => {
    const away = NOW - 8 * 60 * 60 * 1000;
    expect(shouldApplyOnResume(away, NOW, NOW - DEEP_LINK_RELOAD_GRACE_MS)).toBe(true);
  });

  it('ignores a deep link from earlier in the session', () => {
    const away = NOW - 8 * 60 * 60 * 1000;
    expect(shouldApplyOnResume(away, NOW, NOW - 60 * 60 * 1000)).toBe(true);
  });

  it('still refuses a short trip even with no deep link', () => {
    expect(shouldApplyOnResume(NOW - 30_000, NOW, null)).toBe(false);
  });
});
