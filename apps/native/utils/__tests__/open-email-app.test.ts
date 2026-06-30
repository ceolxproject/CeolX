import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

const mockOpenURL = vi.fn();
const mockStartActivityAsync = vi.fn();
const mockOpenApplication = vi.fn();

vi.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args) as unknown,
}));

vi.mock('expo-intent-launcher', () => ({
  startActivityAsync: (...args: unknown[]) => mockStartActivityAsync(...args) as unknown,
  openApplication: (...args: unknown[]) => mockOpenApplication(...args) as unknown,
}));

// react-native's Platform is only used for the default arg; tests pass `os`
// explicitly, but the import must still resolve.
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { ANDROID_EMAIL_PACKAGES, openEmailApp } from '../open-email-app';

beforeEach(() => {
  mockOpenURL.mockReset();
  mockStartActivityAsync.mockReset();
  mockOpenApplication.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// iOS
// ---------------------------------------------------------------------------

describe('openEmailApp — iOS', () => {
  it('opens the first inbox scheme that succeeds', async () => {
    mockOpenURL.mockResolvedValueOnce(undefined);

    const opened = await openEmailApp('ios');

    expect(opened).toBe(true);
    expect(mockOpenURL).toHaveBeenCalledOnce();
    expect(mockOpenURL).toHaveBeenCalledWith('message://');
  });

  it('falls through to the next scheme when one is not handled', async () => {
    mockOpenURL.mockRejectedValueOnce(new Error('no handler')).mockResolvedValueOnce(undefined);

    const opened = await openEmailApp('ios');

    expect(opened).toBe(true);
    expect(mockOpenURL).toHaveBeenCalledTimes(2);
    expect(mockOpenURL).toHaveBeenLastCalledWith('googlegmail://');
  });

  it('returns false when no scheme is handled', async () => {
    mockOpenURL.mockRejectedValue(new Error('no handler'));

    const opened = await openEmailApp('ios');

    expect(opened).toBe(false);
    // Never reaches the Android launcher.
    expect(mockStartActivityAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Android
// ---------------------------------------------------------------------------

describe('openEmailApp — Android', () => {
  it('uses CATEGORY_APP_EMAIL first and does not touch the package fallback', async () => {
    mockStartActivityAsync.mockResolvedValueOnce(undefined);

    const opened = await openEmailApp('android');

    expect(opened).toBe(true);
    expect(mockStartActivityAsync).toHaveBeenCalledOnce();
    expect(mockStartActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.MAIN',
      expect.objectContaining({ category: 'android.intent.category.APP_EMAIL' })
    );
    expect(mockOpenApplication).not.toHaveBeenCalled();
  });

  it('falls back to launching a known email package when CATEGORY_APP_EMAIL throws', async () => {
    // No app declares CATEGORY_APP_EMAIL (the real bug, Asana 1215960893303593).
    mockStartActivityAsync.mockRejectedValueOnce(new Error('ActivityNotFoundException'));
    mockOpenApplication.mockReturnValueOnce(undefined); // first package (Gmail) launches

    const opened = await openEmailApp('android');

    expect(opened).toBe(true);
    expect(mockOpenApplication).toHaveBeenCalledOnce();
    expect(mockOpenApplication).toHaveBeenCalledWith(ANDROID_EMAIL_PACKAGES[0]);
  });

  it('walks the package list until one is installed', async () => {
    mockStartActivityAsync.mockRejectedValueOnce(new Error('ActivityNotFoundException'));
    mockOpenApplication
      .mockImplementationOnce(() => {
        throw new Error('PackageNotFound'); // Gmail not installed
      })
      .mockReturnValueOnce(undefined); // Outlook launches

    const opened = await openEmailApp('android');

    expect(opened).toBe(true);
    expect(mockOpenApplication).toHaveBeenCalledTimes(2);
    expect(mockOpenApplication).toHaveBeenLastCalledWith(ANDROID_EMAIL_PACKAGES[1]);
  });

  it('returns false when no strategy succeeds', async () => {
    mockStartActivityAsync.mockRejectedValueOnce(new Error('ActivityNotFoundException'));
    mockOpenApplication.mockImplementation(() => {
      throw new Error('PackageNotFound');
    });

    const opened = await openEmailApp('android');

    expect(opened).toBe(false);
    expect(mockOpenApplication).toHaveBeenCalledTimes(ANDROID_EMAIL_PACKAGES.length);
  });
});
