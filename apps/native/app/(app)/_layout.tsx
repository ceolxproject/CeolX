import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';
import { trpc } from '@/utils/trpc';

export default function AppLayout() {
  const { user, isGuest, isLoading } = useAuth();

  const { data: meData, isLoading: meLoading } = useQuery({
    ...trpc.users.me.queryOptions(),
    enabled: !!user && !isGuest,
  });

  if (isLoading || (!!user && !isGuest && meLoading)) {
    return null;
  }

  if (!user && !isGuest) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Redirect artist/venue users who haven't completed onboarding
  if (user && meData && !meData.onboardingComplete) {
    if (meData.currentRole === 'artist') {
      return <Redirect href="/(auth)/artist-onboarding" />;
    }
    // Venue onboarding redirect will be added in a future task
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
