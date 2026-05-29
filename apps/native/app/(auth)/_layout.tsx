import { Redirect, Stack, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';

// Onboarding screens live under (auth) but require an authenticated session —
// (app)/_layout redirects profile-less artist/venue users *into* them. They must
// be exempt from the "authenticated → leave auth" guard below, otherwise the two
// guards would bounce the user back and forth forever.
const ONBOARDING_SCREENS = ['artist-onboarding', 'venue-onboarding'];

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  // Wait for the session to resolve before deciding — otherwise a returning user
  // briefly renders the sign-in screen on cold start before the redirect kicks in.
  if (isLoading) return null;

  const currentScreen = segments[segments.length - 1];
  const onOnboarding = ONBOARDING_SCREENS.includes(currentScreen);

  // An authenticated user has no business on sign-in/sign-up/verify-email.
  // Redirecting *declaratively from the layout* (vs an imperative router.replace
  // inside each screen) unmounts this whole Stack, so the screens the sign-up
  // flow pushed (who-are-you, sign-up, …) are dropped from history. The device
  // back button on Home can then exit the app instead of popping back into the
  // sign-up flow. (Bug: Asana 1215189394487253)
  if (user && !onOnboarding) {
    return <Redirect href="/(app)/(tabs)/map" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
      <Stack.Screen name="index" />
      <Stack.Screen name="get-started" />
      <Stack.Screen name="who-are-you" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="artist-onboarding" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
