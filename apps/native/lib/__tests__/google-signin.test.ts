import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before importing the module under test
// ---------------------------------------------------------------------------

const mockConfigure = vi.fn();
const mockHasPlayServices = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args) as unknown,
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args) as unknown,
    signIn: (...args: unknown[]) => mockSignIn(...args) as unknown,
    signOut: (...args: unknown[]) => mockSignOut(...args) as unknown,
  },
  isCancelledResponse: (r: { type?: string }) => r?.type === 'cancelled',
  isSuccessResponse: (r: { type?: string }) => r?.type === 'success',
  isErrorWithCode: () => false,
  statusCodes: { SIGN_IN_CANCELLED: '12501', PLAY_SERVICES_NOT_AVAILABLE: '7' },
}));

vi.mock('@CeolX/env/native', () => ({
  env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client-id.apps.googleusercontent.com' },
}));

import { getGoogleIdToken, signOutGoogle } from '../google-signin';

beforeEach(() => {
  mockConfigure.mockReset();
  mockHasPlayServices.mockReset().mockResolvedValue(true);
  mockSignIn.mockReset();
  mockSignOut.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('signOutGoogle', () => {
  it('clears the native SDK cached account', async () => {
    await signOutGoogle();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('swallows errors when there is no signed-in account', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('no account'));
    await expect(signOutGoogle()).resolves.toBeUndefined();
  });
});

describe('getGoogleIdToken', () => {
  it('signs out the cached account BEFORE opening the chooser so a different account can be picked', async () => {
    const order: string[] = [];
    mockSignOut.mockImplementation(() => {
      order.push('signOut');
      return Promise.resolve();
    });
    mockSignIn.mockImplementation(() => {
      order.push('signIn');
      return Promise.resolve({ type: 'success', data: { idToken: 'fresh-token' } });
    });

    const token = await getGoogleIdToken();

    expect(token).toBe('fresh-token');
    // The cache must be cleared first — otherwise the SDK silently re-uses the
    // previous account instead of showing the chooser (Asana 1215590343284856).
    expect(order).toEqual(['signOut', 'signIn']);
  });
});
