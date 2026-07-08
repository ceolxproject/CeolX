import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const mockGetItemAsync = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null));
const mockSetItemAsync = vi.fn((key: string, value: string) => {
  store.set(key, value);
  return Promise.resolve();
});
const mockDeleteItemAsync = vi.fn((key: string) => {
  store.delete(key);
  return Promise.resolve();
});

vi.mock('expo-secure-store', () => ({
  getItemAsync: (...a: unknown[]) => mockGetItemAsync(...(a as [string])),
  setItemAsync: (...a: unknown[]) => mockSetItemAsync(...(a as [string, string])),
  deleteItemAsync: (...a: unknown[]) => mockDeleteItemAsync(...(a as [string])),
}));

import {
  clearLocationSetupComplete,
  getLocationSetupComplete,
  setLocationSetupComplete,
} from '../location-setup';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('location-setup (per-user)', () => {
  it('returns false when the user has never completed setup', async () => {
    expect(await getLocationSetupComplete('user-a')).toBe(false);
  });

  it('marks and reads completion for a single user', async () => {
    await setLocationSetupComplete('user-a');
    expect(await getLocationSetupComplete('user-a')).toBe(true);
  });

  it('keeps completion independent per user (the reported bug)', async () => {
    await setLocationSetupComplete('user-a');
    // A brand-new account on the same device must NOT inherit user-a's flag.
    expect(await getLocationSetupComplete('user-b')).toBe(false);
  });

  it('namespaces the SecureStore key by user id', async () => {
    await setLocationSetupComplete('user-a');
    expect(mockSetItemAsync).toHaveBeenCalledWith('ceolx.location-setup-complete.user-a', '1');
  });

  it('clears only the given user’s flag', async () => {
    await setLocationSetupComplete('user-a');
    await setLocationSetupComplete('user-b');
    await clearLocationSetupComplete('user-a');
    expect(await getLocationSetupComplete('user-a')).toBe(false);
    expect(await getLocationSetupComplete('user-b')).toBe(true);
  });

  it('never throws on a read error (returns false)', async () => {
    mockGetItemAsync.mockRejectedValueOnce(new Error('keychain locked'));
    expect(await getLocationSetupComplete('user-a')).toBe(false);
  });
});
