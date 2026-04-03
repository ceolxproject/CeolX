import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';

import { authClient } from '@/lib/auth-client';

const POST_AUTH_ROUTE = '/(app)/(tabs)/map' as const;

function toUserMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('cancel') || msg.includes('dismiss')) return 'Sign-in was cancelled.';
    if (msg.includes('network') || msg.includes('fetch')) return 'Network error. Please try again.';
    if (msg.includes('not available')) return 'Apple Sign-In is not available on this device.';
  }
  return 'Sign-in failed. Please try again.';
}

export function useSocialAuth() {
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: POST_AUTH_ROUTE,
      });
    } catch (error) {
      Alert.alert('Google Sign-In', toUserMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithApple() {
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
