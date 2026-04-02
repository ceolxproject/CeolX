import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';

/**
 * Splash screen — shown on every cold start.
 * Routes based on session and onboarding state:
 *   - active session  → (app) layout handles redirect to map
 *   - seen onboarding → sign-in
 *   - new user        → get-started
 */
export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const navigate = async () => {
      if (user) {
        router.replace('/(app)/(tabs)/map');
        return;
      }

      const hasSeen = await SecureStore.getItemAsync('hasSeenOnboarding');
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (hasSeen === 'true') {
        router.replace('/(auth)/sign-in');
      } else {
        router.replace('/(auth)/get-started');
      }
    };

    void navigate();
  }, [isLoading, user]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>CEOLX</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0c0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 6,
  },
});
