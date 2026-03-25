import { Stack } from "expo-router";

export default function BookingsStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[bookingId]" options={{ title: "Booking Detail" }} />
    </Stack>
  );
}
