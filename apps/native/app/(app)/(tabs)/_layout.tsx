import { Tabs } from 'expo-router';

import { AppTabBar } from '@/components/AppTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Force dark bg on every tab screen so the white React Navigation
        // default doesn't bleed through while Tailwind classes are loading.
        sceneStyle: { backgroundColor: '#080808' },
      }}
    >
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
