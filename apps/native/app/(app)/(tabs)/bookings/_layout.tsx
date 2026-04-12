import { Stack } from 'expo-router';

export default function BookingsStack() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#080808' },
        headerTintColor: '#ffffff',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[bookingId]"
        options={{
          title: 'Request Detail',
          headerBackTitle: 'Requests',
        }}
      />
    </Stack>
  );
}
