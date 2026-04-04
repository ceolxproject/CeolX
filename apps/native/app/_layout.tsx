import '@/global.css';
import { Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
  Urbanist_900Black,
} from '@expo-google-fonts/urbanist';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { FallbackComponent } from '@/components/sentry-fallback';
import { AppThemeProvider } from '@/contexts/app-theme-context';
import { AuthProvider } from '@/contexts/auth-context';
import { queryClient } from '@/utils/trpc';

// Initialise Sentry before any component mounts.
const iosBuild = Constants.expoConfig?.ios?.buildNumber;
const androidBuild = Constants.expoConfig?.android?.versionCode;
const dist =
  iosBuild ??
  (androidBuild !== null && androidBuild !== undefined ? String(androidBuild) : undefined);

if (!dist) {
  console.warn('[Sentry] No build number — source map resolution will fail');
}

Sentry.init({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__,
  tracesSampleRate: 0.1,
  release: Constants.expoConfig?.version,
  dist: dist ?? 'unknown',
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
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Urbanist_900Black,
  });

  if (!fontsLoaded) return null;

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

export default function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={<FallbackComponent />}>
      <Layout />
    </Sentry.ErrorBoundary>
  );
}
