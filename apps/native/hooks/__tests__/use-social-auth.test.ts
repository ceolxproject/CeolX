import { describe, expect, it, vi } from 'vitest';

// Mock React so the pure helper functions can be tested without a React Native
// environment (same approach as use-county-search.test.ts).
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
}));

// use-social-auth.ts imports a handful of native-only modules at the top level.
// None are touched by the pure helpers under test, so a minimal stub of each is
// enough to let the module import in the node test environment.
vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: vi.fn(),
}));
vi.mock('expo-router', () => ({ router: { replace: vi.fn(), push: vi.fn() } }));
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios' },
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { social: vi.fn() }, getSession: vi.fn() },
}));
vi.mock('@/components/AppToast', () => ({
  appToast: { info: vi.fn(), error: vi.fn() },
}));

import { isNoAccountError, isSignupAttempt, resolveSignInOutcome } from '../use-social-auth';

describe('isSignupAttempt', () => {
  it('is true when a valid role is provided (sign-up path)', () => {
    expect(isSignupAttempt({ currentRole: 'artist', marketingConsent: false })).toBe(true);
    expect(isSignupAttempt({ currentRole: 'venue', marketingConsent: true })).toBe(true);
    expect(isSignupAttempt({ currentRole: 'spectator', marketingConsent: false })).toBe(true);
  });

  it('is false when no options are provided (sign-in path)', () => {
    expect(isSignupAttempt(undefined)).toBe(false);
  });

  it('is false for an invalid role (e.g. a Pressable event leaking in)', () => {
    // @ts-expect-error — intentionally invalid to model a bad caller
    expect(isSignupAttempt({ currentRole: 'admin', marketingConsent: false })).toBe(false);
    // @ts-expect-error — a press event has no currentRole
    expect(isSignupAttempt({ nativeEvent: {} })).toBe(false);
  });
});

describe('isNoAccountError', () => {
  it('detects the Apple idToken "signup disabled" rejection by code', () => {
    expect(isNoAccountError({ code: 'OAUTH_LINK_ERROR', message: 'signup disabled' })).toBe(true);
  });

  it('detects "signup disabled" by message even without the code', () => {
    expect(isNoAccountError({ message: 'Signup disabled' })).toBe(true);
  });

  it('is false for a null/undefined error (success)', () => {
    expect(isNoAccountError(null)).toBe(false);
    expect(isNoAccountError(undefined)).toBe(false);
  });

  it('is false for an unrelated error (e.g. invalid token)', () => {
    expect(isNoAccountError({ code: 'INVALID_TOKEN', message: 'invalid token' })).toBe(false);
  });
});

describe('resolveSignInOutcome', () => {
  it('routes a blocked Apple signup to registration', () => {
    expect(
      resolveSignInOutcome({
        error: { code: 'OAUTH_LINK_ERROR', message: 'signup disabled' },
        hasSession: false,
      })
    ).toBe('no-account');
  });

  it('surfaces a genuine provider/network error', () => {
    expect(
      resolveSignInOutcome({ error: { code: 'INVALID_TOKEN', message: 'bad' }, hasSession: false })
    ).toBe('error');
  });

  it('enters the app when an existing user has a session', () => {
    expect(resolveSignInOutcome({ error: null, hasSession: true })).toBe('enter-app');
  });

  it('routes a new Google user (no error, no session) to registration', () => {
    // Google swallows the redirect error, so "completed but no session" is the
    // only signal that the identity has no account.
    expect(resolveSignInOutcome({ error: null, hasSession: false })).toBe('no-account');
  });

  it('does NOT bounce a possibly-signed-in user when the session check itself failed', () => {
    // A flaky getSession must not eject an existing user who just logged in.
    expect(resolveSignInOutcome({ error: null, hasSession: false, sessionError: true })).toBe(
      'enter-app'
    );
  });
});
