import * as Sentry from '@sentry/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { CeolxLogo } from '@/components/CeolxLogo';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  // Evidence that the deep link actually landed here (vs. being dropped back to
  // the splash). Pairs with the 'splash redirect' breadcrumb. (Asana 1215040939202673)
  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'navigation',
      level: 'info',
      message: 'reset-password mounted',
      data: { hasToken: !!token },
    });
  }, [token]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: apiError } = await authClient.resetPassword({
      newPassword,
      token,
    });

    setLoading(false);

    if (apiError) {
      setError(mapResetError(apiError));
      return;
    }

    router.replace({
      pathname: '/(auth)/sign-in',
      params: { message: 'Password reset successfully. Please sign in.' },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0c0f' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <AppHeader bgClassName="bg-surface-dark" leadingNode={<CeolxLogo />} />

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Heading — Urbanist Bold 36/40 */}
            <Text className="text-[36px] font-bold text-white leading-10 font-sans mb-2">
              Create new password
            </Text>
            <Text className="text-[15px] text-gray-10 leading-[22px] font-inter mb-8">
              Your new password must be at least 8 characters.
            </Text>

            {/* New password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                New Password
              </Text>
              <AppTextField
                variant="light"
                className="font-sans font-medium"
                placeholder="Enter your new password"
                secureTextEntry
                autoComplete="new-password"
                value={newPassword}
                onChangeText={setNewPassword}
              />
            </View>

            {/* Confirm password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                Confirm Password
              </Text>
              <AppTextField
                variant="light"
                className="font-sans font-medium"
                placeholder="Re-enter your new password"
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>

            {error ? (
              <View className="bg-error/15 rounded-lg p-3 mb-4">
                <Text className="text-error text-sm font-inter font-medium">{error}</Text>
              </View>
            ) : null}

            {/* Reset — Urbanist Bold 17/20 */}
            <AppButton
              variant="primary"
              isLoading={loading}
              onPress={handleReset}
              className="w-full rounded-full py-4 mt-2"
            >
              RESET PASSWORD
            </AppButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function mapResetError(error: { status?: number; message?: string }): string {
  if (error.status === 410) return 'This link has expired. Please request a new one.';
  if (error.status === 409) return 'This link has already been used. Please request a new one.';
  if (error.status === 400) return error.message ?? 'Invalid reset link.';
  return 'Something went wrong. Please try again.';
}
