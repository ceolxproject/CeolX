import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authClient } from '@/lib/auth-client';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      .then(({ error }) => {
        if (error) {
          setVerifyError(error.message ?? 'Verification failed. The link may have expired.');
        } else {
          void SecureStore.deleteItemAsync('pendingVerificationEmail');
          router.replace('/(app)/(tabs)/map');
        }
      })
      .catch(() => setVerifyError('Something went wrong. Please try again.'))
      .finally(() => setIsVerifying(false));
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6741FF" />
        <Text style={styles.verifyingText}>Verifying your email…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.inner}>
          <Text style={styles.logoText}>CEOLX</Text>

          <Text style={styles.icon}>✉️</Text>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.body}>
            We've sent a verification link to{'\n'}
            <Text style={styles.emailHighlight}>{email ?? 'your email address'}</Text>.{'\n\n'}
            Tap the link in the email to activate your account.
          </Text>

          {verifyError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{verifyError}</Text>
            </View>
          ) : null}

          {resendSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>Verification email sent!</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenEmailApp}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>OPEN EMAIL APP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendButton, (resendCooldown > 0 || !email) && styles.resendDisabled]}
            onPress={handleResend}
            disabled={resendCooldown > 0 || !email}
            activeOpacity={0.7}
          >
            <Text style={styles.resendText}>
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Didn't receive it? Resend email"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.backLink}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  safeArea: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
    marginBottom: 40,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emailHighlight: {
    color: '#ffffff',
    fontWeight: '600',
  },
  verifyingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  successBanner: {
    backgroundColor: 'rgba(52,199,89,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  successText: { color: '#34C759', fontSize: 14, textAlign: 'center' },
  primaryButton: {
    backgroundColor: '#6741FF',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  resendButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  resendDisabled: { opacity: 0.4 },
  resendText: {
    color: '#D4FC5A',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  backLink: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
  },
});
