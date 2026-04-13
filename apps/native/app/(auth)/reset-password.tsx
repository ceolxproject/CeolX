import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authClient } from '@/lib/auth-client';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
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
      // TODO (M2-T3): Map BetterAuth error codes to user-friendly messages
      setError(mapResetError(apiError));
      return;
    }

    router.replace({
      pathname: '/(auth)/sign-in',
      params: { message: 'Password reset successfully. Please sign in.' },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6 pt-12">
        <Text className="text-[28px] font-bold mb-2">Create New Password</Text>
        <Text className="text-[15px] text-[#666] mb-7 leading-[22px]">
          Your new password must be at least 8 characters.
        </Text>

        <TextInput
          className="border border-[#e5e5e5] rounded-lg p-3 text-[16px] bg-[#fafafa] mb-3"
          placeholder="New password"
          placeholderTextColor="#999"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TextInput
          className="border border-[#e5e5e5] rounded-lg p-3 text-[16px] bg-[#fafafa] mb-2"
          placeholder="Confirm password"
          placeholderTextColor="#999"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text className="text-[#dc2626] text-[14px] mb-2">{error}</Text> : null}

        <TouchableOpacity
          className="bg-[#16a34a] rounded-lg p-[14px] items-center mt-2 disabled:opacity-60"
          onPress={handleReset}
          disabled={loading}
          style={loading ? { opacity: 0.6 } : undefined}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-[16px] font-semibold">Reset Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function mapResetError(error: { status?: number; message?: string }): string {
  if (error.status === 410) return 'This link has expired. Please request a new one.';
  if (error.status === 409) return 'This link has already been used. Please request a new one.';
  if (error.status === 400) return error.message ?? 'Invalid reset link.';
  return 'Something went wrong. Please try again.';
}
