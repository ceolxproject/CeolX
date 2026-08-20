import { Stack } from 'expo-router';

// Anchors the discover feed under any deep-linked screen in this stack, so a
// shared event link opened from a cold start goes back to the feed.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function DiscoverStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="event/[eventId]" />
      <Stack.Screen name="collection/[id]" />
    </Stack>
  );
}
