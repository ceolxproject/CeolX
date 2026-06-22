import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppTextField } from '@/components/AppTextField';
import { CeolxLogo } from '@/components/CeolxLogo';
import { SocialLoginButtons } from '@/components/SocialLoginButtons';
import { useAuth } from '@/contexts/auth-context';
import { useSocialAuth } from '@/hooks/use-social-auth';
import { authClient } from '@/lib/auth-client';

// ── Types ────────────────────────────────────────────────────────────

type ErrorState =
  | { type: 'unverified'; email: string }
  | { type: 'generic'; message: string }
  | null;

// ── Screen ──────────────────────────────────────────────────────────

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState>(null);
  const { signInWithGoogle, signInWithApple } = useSocialAuth();
  const { continueAsGuest } = useAuth();

  const handleSignIn = async () => {
    setErrorState(null);
    setIsSubmitting(true);

    // Canonicalize before sending so login matches the lowercased email stored
    // at signup — the byte-exact email lookup otherwise fails on a casing
    // difference and reports "not verified" (Asana 1215700058851867). The
    // server normalizes too; this keeps the resend banner's email consistent.
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { error: authError } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        const status = authError.status ?? 0;
        const msg = authError.message?.toLowerCase() ?? '';

        if (status === 403 || msg.includes('email_not_verified') || msg.includes('not verified')) {
          setErrorState({ type: 'unverified', email: normalizedEmail });
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
    await continueAsGuest();
    router.replace('/(app)/(tabs)/map');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0c0f' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {/* Header — Urbanist Bold 12 */}
          <View className="flex-row justify-between items-center p-5 bg-surface-dark">
            <CeolxLogo />
            <Pressable
              onPress={handleSkip}
              className="border border-gray-10 rounded-[20px] h-9 px-5 items-center justify-center"
            >
              <Text className="text-white text-xs font-bold tracking-wide uppercase font-sans">
                skip
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading — Urbanist Bold 36/40 */}
            <Text className="text-[36px] font-bold text-white leading-10 font-sans mb-6">
              Login to your account
            </Text>

            <SocialLoginButtons
              separator="Or sign in with"
              // Wrap in arrows — Pressable would otherwise pass the press event
              // as the `signupOptions` argument, writing a corrupt
              // pendingRegistration. Sign-in has no role to pass.
              onGooglePress={() => signInWithGoogle()}
              onApplePress={() => signInWithApple()}
            />

            {/* Error / warning banners */}
            {errorState?.type === 'unverified' ? (
              <View className="bg-warning/15 rounded-lg p-3 mb-4 gap-2">
                <Text className="text-warning text-sm font-inter font-medium">
                  Please verify your email before signing in.
                </Text>
                <Pressable onPress={handleResendVerification}>
                  <Text className="text-green-10 text-sm font-inter font-semibold">
                    Resend verification email →
                  </Text>
                </Pressable>
              </View>
            ) : errorState?.type === 'generic' ? (
              <View className="bg-error/15 rounded-lg p-3 mb-4">
                <Text className="text-error text-sm font-inter font-medium">
                  {errorState.message}
                </Text>
              </View>
            ) : null}

            {/* Email — label: Inter Medium 14/20, input: Urbanist Medium 16/20 */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                Email Address
              </Text>
              <AppTextField
                variant="light"
                className="font-sans font-medium"
                placeholder="Enter your email address"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password — same font specs as email */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                Password
              </Text>
              <AppTextField
                variant="light"
                className="font-sans font-medium"
                placeholder="Enter your password"
                secureTextEntry
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Forgot password — Inter Medium 14/20 */}
            <Link
              href="/(auth)/forgot-password"
              className="text-blue-10 text-sm font-medium font-inter self-end mb-8 leading-5"
            >
              Forgot password?
            </Link>

            {/* Sign in — Urbanist Bold 17/20 */}
            <AppButton
              variant="primary"
              isLoading={isSubmitting}
              onPress={handleSignIn}
              className="w-full rounded-full py-4 mb-6"
            >
              SIGN IN
            </AppButton>

            {/* Footer — Urbanist SemiBold 15/20 */}
            <View className="flex-row justify-center items-center">
              <Text className="text-white text-[15px] font-semibold font-sans leading-5">
                Don't have an account?{' '}
              </Text>
              <Link
                href="/(auth)/who-are-you"
                className="text-[#d4fc5a] text-[15px] font-semibold font-sans leading-5"
              >
                Register
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
