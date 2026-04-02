import { Link, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authClient } from '@/lib/auth-client';

type ErrorState =
  | { type: 'unverified'; email: string }
  | { type: 'generic'; message: string }
  | null;

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>(null);

  const handleSignIn = async () => {
    setErrorState(null);
    setIsSubmitting(true);

    try {
      const { error: authError } = await authClient.signIn.email({ email, password });

      if (authError) {
        const status = authError.status ?? 0;
        const msg = authError.message?.toLowerCase() ?? '';

        if (status === 403 || msg.includes('email_not_verified') || msg.includes('not verified')) {
          setErrorState({ type: 'unverified', email });
        } else if (status === 429) {
          setErrorState({
            type: 'generic',
            message: 'Too many attempts. Try again in 15 minutes.',
          });
        } else {
          setErrorState({ type: 'generic', message: 'Invalid email or password' });
        }
        return;
      }

      router.replace('/(app)/(tabs)/map');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (errorState?.type !== 'unverified') return;
    await authClient.sendVerificationEmail({ email: errorState.email });
    router.push('/(auth)/verify-email');
  };

  const handleSkip = async () => {
    await SecureStore.setItemAsync('isGuest', 'true');
    router.replace('/(app)/(tabs)/map');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <View style={styles.inner}>
            <View style={styles.headerRow}>
              <Text style={styles.logoText}>CEOLX</Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>SKIP</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heading}>Login to your{'\n'}account</Text>

            {errorState?.type === 'unverified' ? (
              <View style={styles.warningBanner}>
                <Text style={styles.warningText}>Please verify your email before signing in.</Text>
                <TouchableOpacity onPress={handleResendVerification}>
                  <Text style={styles.resendLink}>Resend verification email →</Text>
                </TouchableOpacity>
              </View>
            ) : errorState?.type === 'generic' ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorState.message}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Your password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry={!passwordVisible}
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((v) => !v)}
              >
                <Text style={styles.eyeText}>{passwordVisible ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>SIGN IN</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/who-are-you" style={styles.footerLink}>
                Register
              </Link>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
  },
  skipButton: {
    borderWidth: 1,
    borderColor: '#8D8D8D',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  skipText: {
    color: '#8D8D8D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heading: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 40,
    marginBottom: 24,
  },
  warningBanner: {
    backgroundColor: 'rgba(255,204,0,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  warningText: { color: '#FFCC00', fontSize: 14 },
  resendLink: { color: '#D4FC5A', fontSize: 14, fontWeight: '600' },
  errorBanner: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#FF3B30', fontSize: 14 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 52,
    justifyContent: 'center',
  },
  eyeText: { fontSize: 18 },
  forgotLink: {
    color: '#6741FF',
    fontSize: 14,
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6155F5',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  footerLink: { color: '#D4FC5A', fontSize: 14, fontWeight: '700' },
});
