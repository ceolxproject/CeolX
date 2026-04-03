import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useSocialAuth } from '@/hooks/use-social-auth';
import { form, layout, typography } from '@/styles/shared';

export default function SignInScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInWithGoogle, signInWithApple, isLoading } = useSocialAuth();

  const handleSignIn = async () => {
    // Wired in M2-T1
    await login('mock-token', {
      userId: 'mock-id',
      currentRole: 'spectator',
      email,
      emailVerified: false,
    });
    router.replace('/(app)/(tabs)/map');
  };

  return (
    <SafeAreaView style={layout.container}>
      <View style={styles.inner}>
        <Text style={typography.authTitle}>Sign In</Text>
        <Text style={typography.authSubtitle}>Welcome back to CeolX</Text>

        <TextInput
          style={form.input}
          placeholder="Email"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={form.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          Forgot Password?
        </Link>

        <TouchableOpacity style={[form.button, { marginBottom: 16 }]} onPress={handleSignIn}>
          <Text style={form.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={[styles.socialButton, isLoading && styles.socialButtonDisabled]}
          onPress={signInWithGoogle}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#333" />
          ) : (
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              styles.socialButton,
              styles.appleButton,
              isLoading && styles.socialButtonDisabled,
            ]}
            onPress={signInWithApple}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={[form.footer, { marginTop: 8 }]}>
          <Text style={typography.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" style={typography.linkText}>
            Sign Up
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  forgotLink: {
    alignSelf: 'flex-end',
    color: '#00a86b',
    fontSize: 14,
    marginBottom: 20,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  divider: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 14 },
  socialButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  socialButtonDisabled: { opacity: 0.6 },
  socialButtonText: { fontSize: 16, color: '#333', fontWeight: '500' },
  appleButton: { backgroundColor: '#000', borderColor: '#000' },
  appleButtonText: { color: '#fff' },
});
