import { Tabs, useRouter } from 'expo-router';

import { AppTabBar } from '@/components/AppTabBar';
import { LocationOverrideProvider } from '@/contexts/location-override-context';
import { TabBarVisibilityProvider } from '@/contexts/tab-bar-visibility-context';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <LocationOverrideProvider>
      <TabBarVisibilityProvider>
        <Tabs
          // Android hardware back returns to the previously focused tab instead of
          // the default `firstRoute` (Map), which made back from Profile flows jump
          // to Map (Asana 1215493984649842, scenario 3). No-op on iOS (no hw back).
          backBehavior="history"
          tabBar={(props) => <AppTabBar {...props} onFabPress={() => router.push('/create')} />}
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
      </TabBarVisibilityProvider>
    </LocationOverrideProvider>
  );
}
