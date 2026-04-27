import { Stack } from 'expo-router';

export default function DiscoverStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="event/[eventId]" />
    </Stack>
  );
}
