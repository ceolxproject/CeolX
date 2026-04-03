import { router } from 'expo-router';
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
      <SafeAreaView style={layout.container}>
        <View style={styles.inner}>
          <Text style={styles.icon}>✉️</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            If an account exists with that email, we've sent a password reset link. The link expires
            in 15 minutes.
          </Text>
          <TouchableOpacity style={form.button} onPress={() => router.back()}>
            <Text style={form.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

        <TextInput
          style={[form.input, { marginBottom: 8 }]}
          placeholder="Email"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[form.button, { marginTop: 8 }, loading && styles.disabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={form.buttonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, padding: 24, paddingTop: 16 },
  backBtn: { marginBottom: 32 },
  backText: { fontSize: 16, color: '#00a86b' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 24, lineHeight: 22 },
  icon: { fontSize: 56, textAlign: 'center', marginBottom: 24 },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  disabled: { opacity: 0.6 },
});
