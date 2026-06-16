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

import { clearBaseLocation, getBaseLocation, setBaseLocation } from '../base-location';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('base-location', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getBaseLocation()).toBeNull();
  });

  it('round-trips a saved location', async () => {
    const loc = { lat: 53.35, lng: -6.26, label: 'Dublin' };
    await setBaseLocation(loc);
    expect(await getBaseLocation()).toEqual(loc);
  });

  it('returns null for corrupt JSON', async () => {
    store.set('ceolx.base-location', '{not json');
    expect(await getBaseLocation()).toBeNull();
  });

  it('returns null when the stored shape is invalid', async () => {
    store.set('ceolx.base-location', JSON.stringify({ lat: 'x', lng: -6, label: 'Dublin' }));
    expect(await getBaseLocation()).toBeNull();
  });

  it('returns null when lat/lng are not finite', async () => {
    store.set('ceolx.base-location', JSON.stringify({ lat: NaN, lng: -6, label: 'Dublin' }));
    expect(await getBaseLocation()).toBeNull();
  });

  it('clears a saved location', async () => {
    await setBaseLocation({ lat: 53.35, lng: -6.26, label: 'Dublin' });
    await clearBaseLocation();
    expect(await getBaseLocation()).toBeNull();
  });

  it('propagates a write failure (does not swallow like reads do)', async () => {
    mockSetItemAsync.mockRejectedValueOnce(new Error('keychain locked'));
    await expect(setBaseLocation({ lat: 53.35, lng: -6.26, label: 'Dublin' })).rejects.toThrow(
      'keychain locked'
    );
  });
});
