import { Stack } from 'expo-router';

export default function CreateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#080808' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="post" />
    </Stack>
  );
}
