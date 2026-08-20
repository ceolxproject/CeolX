import { Stack } from 'expo-router';

// Anchors the bookings inbox under any deep-linked screen in this stack, so a
// link opened from a cold start has somewhere to go back to.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function BookingsStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="event/[eventId]" />
      <Stack.Screen name="[bookingId]" />
    </Stack>
  );
}
