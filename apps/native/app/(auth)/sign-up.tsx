import { useMutation } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signUpSchema } from '@CeolX/shared/validators';

import { authClient } from '@/lib/auth-client';
import { trpc } from '@/utils/trpc';

type Role = 'spectator' | 'artist' | 'venue';

export default function SignUpScreen() {
  const { role } = useLocalSearchParams<{ role?: Role }>();
  const currentRole: Role = role ?? 'spectator';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeRegistration = useMutation(trpc.users.completeRegistration.mutationOptions());

  const handleSignUp = async () => {
    setError(null);

    const parsed = signUpSchema
      .omit({ confirmPassword: true })
      .safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    if (!tosAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy');
      return;
    }

    const { data, error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (authError) {
      if (authError.status === 409 || authError.message?.toLowerCase().includes('already')) {
        setError('An account with this email already exists');
      } else {
        setError(authError.message ?? 'Sign up failed. Please try again.');
      }
      return;
    }

    if (data) {
      await completeRegistration.mutateAsync({
        currentRole,
        marketingConsent: marketingOptIn,
      });
    }

    await SecureStore.setItemAsync('pendingVerificationEmail', email);
    router.replace('/(auth)/verify-email');
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
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Text style={styles.logoText}>CEOLX</Text>
              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>SKIP</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>
              Join as{' '}
              <Text style={styles.roleHighlight}>
                {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
              </Text>
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />

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
                placeholder="Min 8 chars, uppercase, number, symbol"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry={!passwordVisible}
                autoComplete="new-password"
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

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setTosAccepted((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
                {tosAccepted ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>
                I agree with <Text style={styles.linkText}>Terms of Service</Text>
                {' and '}
                <Text style={styles.linkText}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setMarketingOptIn((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]}>
                {marketingOptIn ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
              <Text style={styles.checkLabel}>I'd like to receive news and offers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, completeRegistration.isPending && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={completeRegistration.isPending}
              activeOpacity={0.85}
            >
              {completeRegistration.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>REGISTER</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/sign-in" style={styles.footerLink}>
                Sign In
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 32,
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
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
  },
  roleHighlight: {
    color: '#6741FF',
    fontWeight: '700',
  },
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#6741FF',
    borderColor: '#6741FF',
  },
  checkMark: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  linkText: { color: '#6741FF' },
  button: {
    backgroundColor: '#6741FF',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
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
