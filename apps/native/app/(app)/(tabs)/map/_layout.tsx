import { Stack } from 'expo-router';

export default function MapStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="event/[eventId]" />
      <Stack.Screen name="artist/[artistId]" />
      <Stack.Screen name="venue/[venueId]" />
    </Stack>
  );
}
