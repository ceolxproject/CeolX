import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: mockGet,
  setItemAsync: mockSet,
}));

import { dismissAd, DISMISSED_ADS_KEY, getDismissedAdIds } from '../dismissed-ads';

describe('dismissed-ads storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array when SecureStore has no value', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getDismissedAdIds()).toEqual([]);
  });

  it('returns the parsed array when SecureStore has a value', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a', 'b']));
    expect(await getDismissedAdIds()).toEqual(['a', 'b']);
  });

  it('returns [] and does not throw when stored value is malformed', async () => {
    mockGet.mockResolvedValueOnce('not-json');
    expect(await getDismissedAdIds()).toEqual([]);
  });

  it('appends a new id to existing ids', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a']));
    await dismissAd('b');
    expect(mockSet).toHaveBeenCalledWith(DISMISSED_ADS_KEY, JSON.stringify(['a', 'b']));
  });

  it('does not write to SecureStore when dismissing an already-dismissed id', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(['a']));
    await dismissAd('a');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('drops the oldest id when the cap of 50 is exceeded', async () => {
    const existing = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    mockGet.mockResolvedValueOnce(JSON.stringify(existing));
    await dismissAd('new');
    const expected = [...existing.slice(1), 'new'];
    expect(mockSet).toHaveBeenCalledWith(DISMISSED_ADS_KEY, JSON.stringify(expected));
  });
});
