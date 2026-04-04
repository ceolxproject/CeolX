import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';

export default function AppLayout() {
  const { user, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user && !isGuest) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
