import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Platform } from 'react-native';

import { appToast } from '@/components/AppToast';
import { authClient } from '@/lib/auth-client';
import { getGoogleIdToken } from '@/lib/google-signin';

const POST_AUTH_ROUTE = '/(app)/(tabs)/map' as const;
// Where a brand-new social user is sent to pick a role and complete sign-up
// (role + ToS), instead of being silently created as a spectator.
const REGISTER_ROUTE = '/(auth)/who-are-you' as const;

type Role = 'spectator' | 'artist' | 'venue';

export type SocialSignupOptions = {
  currentRole: Role;
  marketingConsent: boolean;
};

type SocialAuthError = { code?: string; message?: string } | null | undefined;

const VALID_ROLES: readonly Role[] = ['spectator', 'artist', 'venue'];

// A social call carries sign-UP intent only when it originates from the sign-up
// screen, which always passes a concrete role. The Login screen passes nothing.
// This is what we forward as `requestSignUp` so the server (which has
// disableImplicitSignUp on) is allowed to create the account — the sign-in path
// omits it, so an unknown identity is refused.
export function isSignupAttempt(
  opts: SocialSignupOptions | undefined
): opts is SocialSignupOptions {
  return !!opts && VALID_ROLES.includes(opts.currentRole);
}

// With implicit signup disabled, BetterAuth's idToken path — now used by BOTH
// Apple and Google (native account sheet) — rejects an unknown identity with
// OAUTH_LINK_ERROR / "signup disabled" instead of creating a row. The error
// comes straight back in the response (no browser redirect to swallow it).
export function isNoAccountError(error: SocialAuthError): boolean {
  if (!error) return false;
  if (error.code === 'OAUTH_LINK_ERROR') return true;
  return (error.message ?? '').toLowerCase().includes('signup disabled');
}

export type SignInOutcome = 'error' | 'no-account' | 'enter-app';

// Decide what to do after a social sign-IN attempt (no requestSignUp sent):
//   - 'no-account': unknown identity → send to Who-are-you to register
//   - 'error'     : a real failure to surface (network, provider, bad token)
//   - 'enter-app' : signed in, OR the outcome is unknown but a session may exist
//                   — we never eject a user we cannot prove is signed out.
export function resolveSignInOutcome(params: {
  error?: SocialAuthError;
  hasSession: boolean;
  sessionError?: boolean;
}): SignInOutcome {
  const { error, hasSession, sessionError } = params;
  if (isNoAccountError(error)) return 'no-account'; // idToken path (Apple + Google)
  if (error) return 'error'; // any other provider error
  if (hasSession || sessionError) return 'enter-app'; // signed in, or don't risk a bounce
  return 'no-account'; // no error yet no session — treat as unknown identity (defensive)
}

// Persist the chosen role across the OAuth roundtrip. auth-context.tsx picks
// this up on the next valid session and calls users.completeRegistration —
// same machinery the email signup already uses.
async function stashPendingRegistration(opts: SocialSignupOptions) {
  await SecureStore.setItemAsync(
    'pendingRegistration',
    JSON.stringify({ currentRole: opts.currentRole, marketingConsent: opts.marketingConsent })
  );
}

export function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('cancel') || msg.includes('dismiss')) return 'Sign-in was cancelled.';
    if (msg.includes('network') || msg.includes('fetch')) return 'Network error. Please try again.';
    if (msg.includes('not available')) return 'Apple Sign-In is not available on this device.';
    if (msg.includes('invalid_client')) return 'Configuration error. Please contact support.';
    if (msg.includes('access_denied')) return 'Access was denied by the provider.';
    if (msg.includes('already_linked') || msg.includes('social_account_already_linked'))
      return 'This account is already linked to another user.';
    if (msg.includes('user_already_exists'))
      return 'An account with this email already exists. Try signing in instead.';
  }
  return 'Sign-in failed. Please try again.';
}

export function useSocialAuth() {
  const [isLoading, setIsLoading] = useState(false);

  function goRegister() {
    appToast.info('No account found', "Let's get you registered.");
    router.replace(REGISTER_ROUTE);
  }

  // Route the outcome of a social sign-IN attempt (Login screen, no requestSignUp).
  async function routeAfterSignIn(error: SocialAuthError) {
    // Apple's blocked-signup is unambiguous — no need to probe for a session.
    if (isNoAccountError(error)) {
      goRegister();
      return;
    }
    if (error) {
      appToast.error('Sign-in failed', toUserMessage(new Error(error.message ?? '')));
      return;
    }
    // No error object: an existing user signed in. Confirm the session landed
    // before entering the app (the idToken response sets the cookie; we read it
    // back rather than assume). A missing session here is the defensive
    // unknown-identity fallback handled by resolveSignInOutcome.
    let hasSession = false;
    let sessionError = false;
    try {
      const session = await authClient.getSession({ query: { disableCookieCache: true } });
      hasSession = !!session.data?.user;
      sessionError = !!session.error;
    } catch {
      sessionError = true;
    }
    if (resolveSignInOutcome({ error, hasSession, sessionError }) === 'enter-app') {
      router.replace(POST_AUTH_ROUTE);
    } else {
      goRegister();
    }
  }

  async function signInWithGoogle(signupOptions?: SocialSignupOptions) {
    setIsLoading(true);
    try {
      // Open the native Google account sheet and get a signed ID token. Throws
      // GoogleSignInCancelledError on dismiss (swallowed below by the cancelled
      // check) and GoogleSignInUnavailableError when the SDK isn't configured.
      const idToken = await getGoogleIdToken();

      const isSignup = isSignupAttempt(signupOptions);
      if (isSignup) await stashPendingRegistration(signupOptions);

      // Native idToken flow — identical shape to Apple below. No callbackURL and
      // no browser redirect: the session (or OAUTH_LINK_ERROR for an unknown
      // identity) returns in the response and navigation is handled client-side.
      const result = await authClient.signIn.social({
        provider: 'google',
        idToken: {
          token: idToken,
        },
        ...(isSignup ? { requestSignUp: true } : {}),
      });

      if (isSignup) {
        // requestSignUp allowed account creation; role lands via
        // pendingRegistration in auth-context.
        if (result.error) throw new Error(result.error.message ?? 'Google Sign-In failed.');
        router.replace(POST_AUTH_ROUTE);
        return;
      }

      await routeAfterSignIn(result.error);
    } catch (error) {
      const msg = toUserMessage(error);
      if (!msg.includes('cancelled')) {
        appToast.error('Google Sign-In', msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithApple(signupOptions?: SocialSignupOptions) {
    if (Platform.OS !== 'ios') return;
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const isSignup = isSignupAttempt(signupOptions);
      if (isSignup) await stashPendingRegistration(signupOptions);

      // No callbackURL: the idToken flow has no browser redirect, so the expo
      // client forwards callbackURL to the server untouched. Passing the
      // expo-router path POST_AUTH_ROUTE ('/(app)/(tabs)/map') makes BetterAuth
      // reject it with 403 INVALID_CALLBACK_URL (the parens are not URL-safe).
      // The session comes back in the response and navigation is handled
      // client-side via router.replace below — so no server callback is needed.
      const result = await authClient.signIn.social({
        provider: 'apple',
        idToken: {
          token: credential.identityToken,
        },
        ...(isSignup ? { requestSignUp: true } : {}),
      });

      if (isSignup) {
        if (result.error) throw new Error(result.error.message ?? 'Apple Sign-In failed.');
        router.replace(POST_AUTH_ROUTE);
        return;
      }

      await routeAfterSignIn(result.error);
    } catch (error) {
      const msg = toUserMessage(error);
      if (!msg.includes('cancelled')) {
        appToast.error('Apple Sign-In', msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { signInWithGoogle, signInWithApple, isLoading };
}
