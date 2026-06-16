import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: mockGet,
  setItemAsync: mockSet,
  deleteItemAsync: mockDelete,
}));

import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  onboardingDraftKey,
  saveOnboardingDraft,
} from '../onboarding-draft';

interface SampleDraft {
  stageName: string;
  currentStep: number;
}

describe('onboardingDraftKey', () => {
  it('namespaces the key by role and user id', () => {
    expect(onboardingDraftKey('artist', 'user_123')).toBe('onboarding-draft-artist-user_123');
    expect(onboardingDraftKey('venue', 'user_123')).toBe('onboarding-draft-venue-user_123');
  });

  it('sanitises characters SecureStore keys disallow', () => {
    // SecureStore only permits [A-Za-z0-9._-]; anything else must be replaced.
    expect(onboardingDraftKey('artist', 'abc/def:ghi')).toBe('onboarding-draft-artist-abc_def_ghi');
  });
});

describe('loadOnboardingDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when there is no stored draft', async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await loadOnboardingDraft<SampleDraft>('artist', 'u1')).toBeNull();
  });

  it('returns the parsed draft when one is stored', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ stageName: 'DJ Sean', currentStep: 2 }));
    expect(await loadOnboardingDraft<SampleDraft>('artist', 'u1')).toEqual({
      stageName: 'DJ Sean',
      currentStep: 2,
    });
  });

  it('returns null and does not throw when the stored value is malformed', async () => {
    mockGet.mockResolvedValueOnce('not-json');
    expect(await loadOnboardingDraft<SampleDraft>('artist', 'u1')).toBeNull();
  });

  it('returns null when the stored value parses to a non-object', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify('just a string'));
    expect(await loadOnboardingDraft<SampleDraft>('artist', 'u1')).toBeNull();
  });

  it('does not touch SecureStore when the user id is empty', async () => {
    expect(await loadOnboardingDraft<SampleDraft>('artist', '')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('reads from the role+user namespaced key', async () => {
    mockGet.mockResolvedValueOnce(null);
    await loadOnboardingDraft<SampleDraft>('venue', 'u9');
    expect(mockGet).toHaveBeenCalledWith('onboarding-draft-venue-u9');
  });
});

describe('saveOnboardingDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the serialised draft to the namespaced key', async () => {
    const draft: SampleDraft = { stageName: 'DJ Sean', currentStep: 3 };
    await saveOnboardingDraft('artist', 'u1', draft);
    expect(mockSet).toHaveBeenCalledWith('onboarding-draft-artist-u1', JSON.stringify(draft));
  });

  it('does not write when the user id is empty', async () => {
    await saveOnboardingDraft('artist', '', { stageName: 'x', currentStep: 1 });
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('clearOnboardingDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the namespaced key', async () => {
    await clearOnboardingDraft('venue', 'u1');
    expect(mockDelete).toHaveBeenCalledWith('onboarding-draft-venue-u1');
  });

  it('does not delete when the user id is empty', async () => {
    await clearOnboardingDraft('venue', '');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
