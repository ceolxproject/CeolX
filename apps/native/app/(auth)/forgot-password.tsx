import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { form, layout } from '@/styles/shared';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');

  const handleSend = () => {
    // Wired in M2-T1
    router.back();
  };

  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

        <TextInput
          style={[form.input, { marginBottom: 16 }]}
          placeholder="Email"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={form.button} onPress={handleSend}>
          <Text style={form.buttonText}>Send Reset Link</Text>
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
});
