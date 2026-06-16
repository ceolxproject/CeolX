import { Redirect, Stack, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/auth-context';

// Screens under (auth) that must render even for an authenticated session, so the
// "authenticated → leave auth" guard below must skip them:
//   - onboarding: (app)/_layout redirects profile-less artist/venue users *into*
//     them; redirecting back out would bounce the user forever.
//   - reset-password / verify-email: these are public deep-link targets. A reset
//     or verification link must open regardless of who is currently logged in —
//     otherwise a logged-in user tapping a reset link gets bounced to the map.
const AUTH_REDIRECT_EXEMPT = [
  'artist-onboarding',
  'venue-onboarding',
  'reset-password',
  'verify-email',
];

export default function AuthLayout() {
  const { user } = useAuth();
  const segments = useSegments();

  // NOTE: we deliberately do NOT `return null` while the session is loading.
  // Unmounting this Stack races with Expo Router's cold-start deep-link
  // restoration and drops the reset-password screen back to the splash anchor.
  // The navigator stays mounted; the index (splash) shows branding while loading,
  // and the authed redirect below only fires once `user` actually resolves.
  // (Asana 1215040939202673)
  const currentScreen = segments[segments.length - 1];
  const exempt = AUTH_REDIRECT_EXEMPT.includes(currentScreen);

  // An authenticated user has no business on sign-in/sign-up. Redirecting
  // *declaratively from the layout* (vs an imperative router.replace inside each
  // screen) unmounts this whole Stack, so the screens the sign-up flow pushed
  // (who-are-you, sign-up, …) are dropped from history. The device back button on
  // Home can then exit the app instead of popping back into the sign-up flow.
  // (Bug: Asana 1215189394487253)
  if (user && !exempt) {
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
