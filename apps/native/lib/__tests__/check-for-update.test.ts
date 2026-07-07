import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPendingUpdate,
  checkForUpdateManually,
  getRunningBundleInfo,
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
