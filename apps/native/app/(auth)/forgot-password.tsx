import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');

  const handleSend = () => {
    // Wired in M2-T1
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
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
            </View>

            <AppButton
              variant="primary"
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
