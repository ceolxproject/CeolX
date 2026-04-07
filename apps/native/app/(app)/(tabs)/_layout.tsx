import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Array<{
  name: string;
  label: string;
  activeIcon: IoniconsName;
  inactiveIcon: IoniconsName;
}> = [
  { name: 'map', label: 'Map', activeIcon: 'map-pin', inactiveIcon: 'map-pin-outline' },
  { name: 'discover', label: 'Discover', activeIcon: 'home', inactiveIcon: 'home-outline' },
  { name: 'bookings', label: 'Bookings', activeIcon: 'mail', inactiveIcon: 'mail-outline' },
  { name: 'profile', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

type CustomTabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  descriptors: Record<string, { options: Record<string, unknown> }>;
  navigation: {
    emit: (args: { type: string; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

function CustomTabBar({ state, navigation }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.tabBarContainer, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]}
    >
      {/* Left two tabs */}
      <View style={styles.tabGroup}>
        {TAB_CONFIG.slice(0, 2).map((tab, index) => {
          const isFocused = state.index === index;
          const route = state.routes[index];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route?.key ?? '',
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable key={tab.name} onPress={onPress} style={styles.tabItem}>
              <View
                style={[
                  styles.iconPill,
                  isFocused ? styles.iconPillActive : styles.iconPillInactive,
                ]}
              >
                <Ionicons
                  name={isFocused ? tab.activeIcon : tab.inactiveIcon}
                  size={18}
                  color={isFocused ? '#080808' : '#ffffff'}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Center FAB placeholder */}
      <View style={styles.fabPlaceholder}>
        <Pressable
          style={styles.fab}
          onPress={() => {
            // FAB action — navigate to event creation or relevant screen
          }}
        >
          <Ionicons name="add" size={28} color="#080808" />
        </Pressable>
      </View>

      {/* Right two tabs */}
      <View style={styles.tabGroup}>
        {TAB_CONFIG.slice(2, 4).map((tab, index) => {
          const actualIndex = index + 2;
          const isFocused = state.index === actualIndex;
          const route = state.routes[actualIndex];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route?.key ?? '',
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable key={tab.name} onPress={onPress} style={styles.tabItem}>
              <View
                style={[
                  styles.iconPill,
                  isFocused ? styles.iconPillActive : styles.iconPillInactive,
                ]}
              >
                <Ionicons
                  name={isFocused ? tab.activeIcon : tab.inactiveIcon}
                  size={18}
                  color={isFocused ? '#080808' : '#ffffff'}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...(props as CustomTabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#6155F5',
    paddingTop: 8,
    borderTopWidth: 0,
    // No shadow / border on top
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: '#D4FC5A',
  },
  iconPillInactive: {
    backgroundColor: 'rgba(141,141,141,0.3)',
  },
  tabLabel: {
    color: '#ffffff',
    fontSize: 10,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  fabPlaceholder: {
    width: 72,
    alignItems: 'center',
    // The FAB floats above the tab bar
    position: 'relative',
  },
  fab: {
    position: 'absolute',
    top: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
});
