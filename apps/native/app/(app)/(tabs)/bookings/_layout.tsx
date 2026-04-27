import { Stack } from 'expo-router';

export default function BookingsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
