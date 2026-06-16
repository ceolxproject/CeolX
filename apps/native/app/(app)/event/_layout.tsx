import { Stack } from 'expo-router';

export default function EventDeepLinkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#080808' },
      }}
    >
      <Stack.Screen name="[eventId]" />
    </Stack>
  );
}
