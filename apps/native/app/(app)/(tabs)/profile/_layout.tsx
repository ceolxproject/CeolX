import { Stack } from 'expo-router';

// Anchors the profile screen under any deep-linked screen in this stack, so a
// link opened from a cold start has somewhere to go back to.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function ProfileStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="account-edit" />
      <Stack.Screen name="switch-account" />
      <Stack.Screen name="saved-events" />
      <Stack.Screen name="collections" />
      <Stack.Screen name="collection/[id]" />
      <Stack.Screen name="event/[eventId]" />
      <Stack.Screen name="booking/[bookingId]" />
      <Stack.Screen name="following" />
      <Stack.Screen name="followers" />
    </Stack>
  );
}
