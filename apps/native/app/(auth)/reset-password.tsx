import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authClient } from '@/lib/auth-client';
import { form, layout } from '@/styles/shared';

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
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>Your new password must be at least 8 characters.</Text>

        <TextInput
          style={[form.input, { marginBottom: 12 }]}
          placeholder="New password"
          placeholderTextColor="#999"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TextInput
          style={[form.input, { marginBottom: 8 }]}
          placeholder="Confirm password"
          placeholderTextColor="#999"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[form.button, { marginTop: 8 }, loading && styles.disabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={form.buttonText}>Reset Password</Text>
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

const styles = StyleSheet.create({
  inner: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 28, lineHeight: 22 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  disabled: { opacity: 0.6 },
});
