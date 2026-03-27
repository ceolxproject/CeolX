import '@/global.css';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AppThemeProvider } from '@/contexts/app-theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { queryClient } from '@/utils/trpc';

// Initialise Sentry before any component mounts.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__,
  tracesSampleRate: 0.1,
  release: Constants.expoConfig?.version,
  dist: String(
    Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? 1
  ),
});

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <AuthProvider>
                <RootStack />
              </AuthProvider>
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

// Sentry.wrap adds automatic error boundary and app-start performance tracking
export default Sentry.wrap(Layout);
