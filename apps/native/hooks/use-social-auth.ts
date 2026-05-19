import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { authClient } from '@/lib/auth-client';

const POST_AUTH_ROUTE = '/(app)/(tabs)/map' as const;

type Role = 'spectator' | 'artist' | 'venue';

export type SocialSignupOptions = {
  currentRole: Role;
  marketingConsent: boolean;
};

// Persist the chosen role across the OAuth roundtrip. auth-context.tsx picks
// this up on the next valid session and calls users.completeRegistration —
// same machinery the email signup already uses.
async function stashPendingRegistration(opts: SocialSignupOptions | undefined) {
  if (!opts) return;
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

  async function signInWithGoogle(signupOptions?: SocialSignupOptions) {
    setIsLoading(true);
    try {
      await stashPendingRegistration(signupOptions);

      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: POST_AUTH_ROUTE,
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Google Sign-In failed.');
      }

      router.replace(POST_AUTH_ROUTE);
    } catch (error) {
      console.error('[google-signin]', error);
      const msg = toUserMessage(error);
      if (!msg.includes('cancelled')) {
        Alert.alert('Google Sign-In', msg);
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

      await stashPendingRegistration(signupOptions);

      const result = await authClient.signIn.social({
        provider: 'apple',
        idToken: {
          token: credential.identityToken,
        },
        callbackURL: POST_AUTH_ROUTE,
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Apple Sign-In failed.');
      }

      router.replace(POST_AUTH_ROUTE);
    } catch (error) {
      const msg = toUserMessage(error);
      if (!msg.includes('cancelled')) {
        Alert.alert('Apple Sign-In', msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { signInWithGoogle, signInWithApple, isLoading };
}
