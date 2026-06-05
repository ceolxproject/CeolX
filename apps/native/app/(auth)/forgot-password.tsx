import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { authClient } from '@/lib/auth-client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: apiError } = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
    });

    setLoading(false);

    if (apiError?.status === 429) {
      setError('Too many requests. Please wait before trying again.');
      return;
    }

    // Always show success — generic message prevents email enumeration
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080808' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View className="flex-1 p-6 items-center justify-center">
            <Text className="text-5xl mb-6 text-center">✉️</Text>
            <Text className="text-[28px] font-bold text-white mb-2 text-center">
              Check your email
            </Text>
            <Text className="text-[15px] text-gray-10 text-center leading-[22px] mb-8">
              If an account exists with that email, we've sent a password reset link. The link
              expires in 15 minutes.
            </Text>
            <AppButton
              variant="primary"
              onPress={() => router.back()}
              className="w-full rounded-full py-[18px]"
            >
              Back to Sign In
            </AppButton>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View className="flex-1 p-6 pt-4">
            <Pressable onPress={() => router.back()} className="flex-row items-center mb-8">
              <Ionicons name="arrow-back" size={20} color="#ffffff" />
              <Text className="text-white text-base ml-1">Back</Text>
            </Pressable>

            <Text className="text-[28px] font-bold text-white mb-2">Reset Password</Text>
            <Text className="text-[15px] text-gray-10 mb-6 leading-[22px]">
              Enter your email and we'll send you a reset link.
            </Text>

            <View className="gap-2 mb-4">
              <TextInput
                className="bg-white rounded-lg h-[52px] px-4 text-base text-black"
                placeholder="Email"
                placeholderTextColor="#8d8d8d"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              {error ? <Text className="text-red-500 text-sm">{error}</Text> : null}
            </View>

            <AppButton
              variant="primary"
              isLoading={loading}
              onPress={handleSend}
              className="w-full rounded-full py-[18px]"
            >
              Send Reset Link
            </AppButton>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
