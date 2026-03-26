import { Stack } from "expo-router";

export default function MapStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="event/[eventId]"
        options={{ title: "Event Detail" }}
      />
      <Stack.Screen
        name="artist/[artistId]"
        options={{ title: "Artist Profile" }}
      />
    </Stack>
  );
}
