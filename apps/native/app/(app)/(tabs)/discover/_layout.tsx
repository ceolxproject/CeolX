import { Stack } from 'expo-router';

export default function DiscoverStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="event/[eventId]" options={{ title: 'Event Detail' }} />
    </Stack>
  );
}
