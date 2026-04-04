import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { CeolxLogo } from '@/components/CeolxLogo';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { mutateAsync: completeRegistration } = useMutation(
    trpc.users.completeRegistration.mutationOptions()
  );

  // Load pending email from SecureStore (set during sign-up)
  useEffect(() => {
    SecureStore.getItemAsync('pendingVerificationEmail')
      .then((val) => setEmail(val))
      .catch(() => {});
  }, []);

  // Handle deep link token — verify the email automatically
  useEffect(() => {
    if (!token) return;
    setIsVerifying(true);

    authClient
      .verifyEmail({ query: { token } })
      .then(async ({ error }) => {
        if (error) {
          setVerifyError(error.message ?? 'Verification failed. The link may have expired.');
          return;
        }

        // Email verified — BetterAuth has now created a session.
        // Finish registration by writing role + consent to the DB.
        const raw = await SecureStore.getItemAsync('pendingRegistration');
        let currentRole: 'spectator' | 'artist' | 'venue' = 'spectator';
        if (raw) {
          const pending = JSON.parse(raw) as {
            currentRole: 'spectator' | 'artist' | 'venue';
            marketingConsent: boolean;
          };
          currentRole = pending.currentRole;
          await completeRegistration({ currentRole, marketingConsent: pending.marketingConsent });
          void SecureStore.deleteItemAsync('pendingRegistration');
        }

        void SecureStore.deleteItemAsync('pendingVerificationEmail');

        // Route artists to onboarding form; spectators go straight to the app
        if (currentRole === 'artist') {
          router.replace('/(auth)/artist-onboarding');
        } else {
          router.replace('/(app)/(tabs)/map');
        }
      })
      .catch(() => setVerifyError('Something went wrong. Please try again.'))
      .finally(() => setIsVerifying(false));
    // completeRegistration (mutateAsync) is a stable reference from TanStack Query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setResendSuccess(false);

    const { error } = await authClient.sendVerificationEmail({ email });
    if (error) return;

    setResendSuccess(true);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    cooldownRef.current = interval;
  };

  const handleOpenEmailApp = () => {
    void Linking.openURL('message://');
  };

  if (isVerifying) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#080808',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#662FFF" />
        <Text className="text-white text-base mt-4">Verifying your email...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 px-6 pt-6 items-center justify-center">
          <CeolxLogo />

          <View className="items-center mt-8 mb-6">
            <Ionicons name="mail-outline" size={64} color="#662FFF" />
          </View>

          <Text className="text-[28px] font-bold text-white mb-4 text-center">
            Check your email
          </Text>
          <Text className="text-base text-white/60 text-center leading-6 mb-8">
            We've sent a verification link to{'\n'}
            <Text className="text-white font-semibold">{email ?? 'your email address'}</Text>.
            {'\n\n'}
            Tap the link in the email to activate your account.
          </Text>

          {verifyError ? (
            <View className="bg-error/15 rounded-lg p-3 mb-4 self-stretch">
              <Text className="text-error text-sm text-center">{verifyError}</Text>
            </View>
          ) : null}

          {resendSuccess ? (
            <View className="bg-[rgba(52,199,89,0.15)] rounded-lg p-3 mb-4 self-stretch">
              <Text className="text-[#34C759] text-sm text-center">Verification email sent!</Text>
            </View>
          ) : null}

          <AppButton
            variant="primary"
            onPress={handleOpenEmailApp}
            className="w-full rounded-full py-[18px] mb-4"
          >
            OPEN EMAIL APP
          </AppButton>

          <Pressable
            className={`py-3 mb-4 ${resendCooldown > 0 || !email ? 'opacity-40' : ''}`}
            onPress={handleResend}
            disabled={resendCooldown > 0 || !email}
          >
            <Text className="text-green-10 text-sm font-semibold text-center">
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Didn't receive it? Resend email"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
            <Text className="text-white/40 text-sm text-center">Back to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
