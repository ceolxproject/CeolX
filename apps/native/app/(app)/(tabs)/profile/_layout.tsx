import { Stack } from 'expo-router';

export default function ProfileStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="switch-account" options={{ title: 'Switch Account Type' }} />
      <Stack.Screen name="saved-events" options={{ headerShown: false }} />
      <Stack.Screen name="collections" options={{ headerShown: false }} />
      <Stack.Screen name="collection/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
