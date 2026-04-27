import { Stack } from 'expo-router';

export default function PostLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#080808' },
      }}
    >
      <Stack.Screen name="[postId]" />
    </Stack>
  );
}
