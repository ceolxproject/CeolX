import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { changePasswordSchema } from '@CeolX/shared/validators';

import { AppButton } from '@/components/AppButton';
import { authClient } from '@/lib/auth-client';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Reuse the shared schema so the strength rules match sign-up / reset.
    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the fields and try again.');
      return;
    }

    setLoading(true);
    setError('');

    // revokeOtherSessions evicts every other device on password change, so a
    // stolen/old session can't persist after the user rotates their password.
    const { error: apiError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    setLoading(false);

    if (apiError) {
      setError(mapChangeError(apiError));
      return;
    }

    Alert.alert(
      'Password updated',
      'Your password has been changed. You have been signed out on your other devices.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0c0f' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {/* Header — back button */}
          <View className="flex-row items-center p-5">
            <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-70">
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-[36px] font-bold text-white leading-10 font-sans mb-2">
              Change password
            </Text>
            <Text className="text-[15px] text-gray-10 leading-[22px] font-inter mb-8">
              Enter your current password, then choose a new one (at least 8 characters with an
              uppercase, lowercase, number, and special character).
            </Text>

            {/* Current password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                Current Password
              </Text>
              <TextInput
                className="bg-white rounded-lg h-[52px] px-4 text-base font-sans font-medium text-black leading-5"
                placeholder="Enter current password"
                placeholderTextColor="#8d8d8d"
                secureTextEntry={!passwordVisible}
                autoComplete="current-password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            </View>

            {/* New password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                New Password
              </Text>
              <View className="flex-row items-center">
                <TextInput
                  className="flex-1 bg-white rounded-lg h-[52px] px-4 text-base font-sans font-medium text-black leading-5"
                  placeholder="Enter new password"
                  placeholderTextColor="#8d8d8d"
                  secureTextEntry={!passwordVisible}
                  autoComplete="new-password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Pressable
                  className="absolute right-4 h-[52px] justify-center"
                  onPress={() => setPasswordVisible((v) => !v)}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#8d8d8d"
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm password */}
            <View className="gap-2 mb-4">
              <Text className="text-sm font-medium font-inter text-white/80 leading-5">
                Confirm New Password
              </Text>
              <TextInput
                className="bg-white rounded-lg h-[52px] px-4 text-base font-sans font-medium text-black leading-5"
                placeholder="Re-enter new password"
                placeholderTextColor="#8d8d8d"
                secureTextEntry={!passwordVisible}
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

            <AppButton
              variant="primary"
              isLoading={loading}
              onPress={handleSubmit}
              className="w-full rounded-full py-4 mt-2"
            >
              UPDATE PASSWORD
            </AppButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function mapChangeError(error: { status?: number; message?: string; code?: string }): string {
  // BetterAuth returns 400/INVALID_PASSWORD when the current password is wrong.
  if (error.code === 'INVALID_PASSWORD' || error.status === 400) {
    return 'Your current password is incorrect.';
  }
  return error.message ?? 'Something went wrong. Please try again.';
}
