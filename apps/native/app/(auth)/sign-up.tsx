import { Link, router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signUpSchema, SIGNUP_NAME_MAX } from '@CeolX/shared/validators';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { CeolxLogo } from '@/components/CeolxLogo';
import { CheckboxField } from '@/components/CheckboxField';
import { SocialLoginButtons } from '@/components/SocialLoginButtons';
import { useAuth } from '@/contexts/auth-context';
import { useSocialAuth } from '@/hooks/use-social-auth';
import { authClient } from '@/lib/auth-client';

type Role = 'spectator' | 'artist' | 'venue';

const TERMS_URL = 'https://ceolx.com/terms';
const PRIVACY_URL = 'https://ceolx.com/privacy';

export default function SignUpScreen() {
  const { role } = useLocalSearchParams<{ role?: Role }>();
  const currentRole: Role = role ?? 'spectator';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signInWithGoogle, signInWithApple } = useSocialAuth();
  const { continueAsGuest } = useAuth();

  const handleSkip = async () => {
    await continueAsGuest();
    router.replace('/(app)/(tabs)/map');
  };

  const handleSignUp = async () => {
    setErrors({});
    setSubmitError(null);

    const parsed = signUpSchema.safeParse({ name, email, password, confirmPassword: password });
    if (!parsed.success) {
      // Map every zod issue to its field path so the message renders next to
      // the field that triggered it (P2 #B3 — password errors used to appear
      // above the Full Name field).
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || '_form';
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    if (!tosAccepted) {
      setSubmitError('You must accept the Terms of Service and Privacy Policy');
      return;
    }

    // Use the schema-transformed (lowercased) email, not the raw input, so the
    // value stored at signup matches what login/resend send later. The server
    // also normalizes, but keeping the client consistent avoids a mismatched
    // `pendingVerificationEmail` (Asana 1215700058851867).
    const normalizedEmail = parsed.data.email;

    setIsSubmitting(true);
    try {
      const { data, error: authError } = await authClient.signUp.email({
        name,
        email: normalizedEmail,
        password,
        currentRole,
      });

      if (authError) {
        // The server's before-hook throws an "already exists" APIError for a
        // duplicate email (Asana 1215616181509943); surface its message verbatim
        // next to the email field so the copy stays owned by the backend.
        const message = authError.message ?? '';
        if (authError.status === 409 || message.toLowerCase().includes('already')) {
          setErrors({ email: message || 'An account with this email already exists.' });
        } else {
          setSubmitError(message || 'Sign up failed. Please try again.');
        }
        return;
      }

      if (data) {
        // Store registration data so verify-email screen can call completeRegistration
        // after the email is verified and BetterAuth has created a session.
        await SecureStore.setItemAsync(
          'pendingRegistration',
          JSON.stringify({ currentRole, marketingConsent: marketingOptIn })
        );
      }

      await SecureStore.setItemAsync('pendingVerificationEmail', normalizedEmail);
      router.replace('/(auth)/verify-email');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Social sign-up must accept Terms & Privacy first, exactly like the email
  // button above — otherwise an account could be created without consent, which
  // breaks the GDPR "ToS accepted at sign-up" requirement (Asana 1215188822147991).
  const handleSocialSignUp = (provider: 'google' | 'apple') => {
    setErrors({});
    setSubmitError(null);
    if (!tosAccepted) {
      setSubmitError('You must accept the Terms of Service and Privacy Policy');
      return;
    }
    const opts = { currentRole, marketingConsent: marketingOptIn };
    if (provider === 'google') {
      void signInWithGoogle(opts);
    } else {
      void signInWithApple(opts);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          // 'padding' on both platforms gives consistent behaviour: the
          // ScrollView gets extra bottom padding equal to the keyboard height,
          // so a focused input near the bottom stays scrollable above the
          // keyboard instead of being covered by it.
          behavior="padding"
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <AppHeader
              className="px-0 mb-8"
              leadingNode={<CeolxLogo />}
              trailingAccessory={
                <Pressable
                  onPress={handleSkip}
                  className="border border-gray-10 rounded-[20px] py-1.5 px-4"
                >
                  <Text className="text-gray-10 text-xs font-bold tracking-widest">SKIP</Text>
                </Pressable>
              }
            />

            <Text className="text-[36px] font-bold text-white leading-10 mb-2">Create Account</Text>
            <Text className="text-base text-white/60 mb-6">
              Join as{' '}
              <Text className="text-blue-10 font-bold">
                {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
              </Text>
            </Text>

            <SocialLoginButtons
              separator="Or sign up with"
              onGooglePress={() => handleSocialSignUp('google')}
              onApplePress={() => handleSocialSignUp('apple')}
            />

            {submitError ? (
              <View className="bg-error/15 rounded-lg p-3 mb-4">
                <Text className="text-error text-sm">{submitError}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-bold text-white/80">Full Name</Text>
              <AppTextField
                variant="light"
                placeholder="Enter your full name"
                autoCapitalize="words"
                autoComplete="name"
                value={name}
                onChangeText={setName}
                maxLength={SIGNUP_NAME_MAX}
              />
              {errors.name && <Text className="text-error text-xs mt-1">{errors.name}</Text>}
            </View>

            {/* Email */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-bold text-white/80">Email Address</Text>
              <AppTextField
                variant="light"
                placeholder="Enter your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(t) => setEmail(t.toLowerCase())}
              />
              {errors.email && <Text className="text-error text-xs mt-1">{errors.email}</Text>}
            </View>

            {/* Password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-bold text-white/80">Password</Text>
              <AppTextField
                variant="light"
                placeholder="Enter your password"
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
              />
              {errors.password && (
                <Text className="text-error text-xs mt-1">{errors.password}</Text>
              )}
            </View>

            {/* Checkboxes */}
            <CheckboxField
              checked={tosAccepted}
              onChange={setTosAccepted}
              className="mb-4"
              label={
                <Text className="text-sm text-white/70 leading-5">
                  I agree with{' '}
                  <Text className="text-blue-10" onPress={() => Linking.openURL(TERMS_URL)}>
                    Terms of Service
                  </Text>
                  {' and '}
                  <Text className="text-blue-10" onPress={() => Linking.openURL(PRIVACY_URL)}>
                    Privacy Policy
                  </Text>
                </Text>
              }
            />

            <CheckboxField
              checked={marketingOptIn}
              onChange={setMarketingOptIn}
              className="mb-4"
              label="I'd like to receive news and offers"
            />

            {/* Register button */}
            <AppButton
              variant="primary"
              isLoading={isSubmitting}
              onPress={handleSignUp}
              className="w-full rounded-full py-[18px] mt-2 mb-6"
            >
              REGISTER
            </AppButton>

            {/* Footer */}
            <View className="flex-row justify-center items-center">
              <Text className="text-white/60 text-sm">Already have an account? </Text>
              <Link href="/(auth)/sign-in" className="text-green-10 text-sm font-bold">
                Sign In
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
