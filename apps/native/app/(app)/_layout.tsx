import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/contexts/auth-context";

export default function AppLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Splash screen wired in M2
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
