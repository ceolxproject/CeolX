import { Ionicons } from '@expo/vector-icons';
import { type Tabs, usePathname } from 'expo-router';
import { cn } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { getTabPressActions } from './app-tab-bar.utils';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility-context';
import { useMe } from '@/hooks/use-me';

// Nested stack routes inside (tabs) that render full-screen and must hide the tab bar.
const HIDDEN_TAB_BAR_PATHS = new Set(['/profile/followers', '/profile/following']);

// Dynamic detail routes (event/booking id in the path) that must hide the tab
// bar. Matched by prefix since the trailing segment is the id. Each tab owns its
// own copy of a detail route so drilling in stays within that tab's stack.
const HIDDEN_TAB_BAR_PREFIXES = [
  '/discover/event/',
  '/map/event/',
  '/profile/event/',
  '/profile/booking/',
  '/bookings/event/',
];

const shouldHideTabBar = (pathname: string) =>
  HIDDEN_TAB_BAR_PATHS.has(pathname) ||
  HIDDEN_TAB_BAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  label: string;
  activeIcon: IoniconsName;
  inactiveIcon: IoniconsName;
};

export const TAB_CONFIG: TabConfig[] = [
  { name: 'map', label: 'Map', activeIcon: 'location', inactiveIcon: 'location-outline' },
  { name: 'discover', label: 'Discover', activeIcon: 'home', inactiveIcon: 'home-outline' },
  { name: 'bookings', label: 'My Events', activeIcon: 'mail', inactiveIcon: 'mail-outline' },
  { name: 'profile', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

// Extract the tabBar callback parameter type directly from Expo Router's <Tabs> component
type TabBarCallbackProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type AppTabBarProps = TabBarCallbackProps & {
  onFabPress?: () => void;
};

export function AppTabBar({ state, navigation, onFabPress }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { hidden } = useTabBarVisibility();
  const { data: me } = useMe();
  const currentRole = me?.currentRole ?? 'spectator';

  // Route-based hide (detail screens) OR an overlay on the current screen asked
  // to own the bottom (e.g. the map's event preview card / same-location sheet).
  if (hidden || shouldHideTabBar(pathname)) return null;

  const getTabLabel = (tab: TabConfig) => {
    if (tab.name === 'bookings') {
      return currentRole === UserRole.SPECTATOR ? 'Bookings' : 'My Events';
    }
    return tab.label;
  };

  const renderTab = (tab: TabConfig, actualIndex: number) => {
    const isFocused = state.index === actualIndex;
    const route = state.routes[actualIndex];

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route?.key ?? '',
        canPreventDefault: true,
      });

      // A tab hosts a nested Stack whose history survives tab switches. Reset that
      // stack to its root list view on press so the tab never reopens a previously
      // visited detail screen (discover/event/[id], bookings/[bookingId], …).
      const actions = getTabPressActions({
        isFocused,
        defaultPrevented: event.defaultPrevented,
        tabName: tab.name,
        nestedStackKey: route?.state?.key,
      });

      for (const action of actions) {
        if (action.type === 'popToTop') {
          navigation.dispatch({ type: 'POP_TO_TOP', target: action.target });
        } else {
          navigation.navigate(action.tab);
        }
      }
    };

    return (
      <Pressable key={tab.name} onPress={onPress} className="flex-1 items-center pt-1">
        <View
          className={cn(
            'w-7 h-7 rounded-full items-center justify-center',
            isFocused ? 'bg-[#D4FC5A]' : 'bg-[rgba(141,141,141,0.3)]'
          )}
        >
          <Ionicons
            name={isFocused ? tab.activeIcon : tab.inactiveIcon}
            size={18}
            color={isFocused ? '#080808' : '#ffffff'}
          />
        </View>
        <Text className={cn('text-white text-[10px] mt-0.5', isFocused && 'font-semibold')}>
          {getTabLabel(tab)}
        </Text>
      </Pressable>
    );
  };

  const showFab = currentRole !== UserRole.SPECTATOR;

  return (
    <View
      className="flex-row items-start bg-[#6155F5] pt-2"
      style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom }}
    >
      {showFab ? (
        <>
          {/* Left two tabs */}
          <View className="flex-1 flex-row justify-around">
            {TAB_CONFIG.slice(0, 2).map((tab, i) => renderTab(tab, i))}
          </View>

          {/* Center FAB */}
          <View className="w-[72px] items-center">
            <Pressable
              className="absolute -top-6 w-12 h-12 rounded-full bg-[#8d8d8d] items-center justify-center"
              style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
              onPress={onFabPress}
            >
              <Ionicons name="add" size={28} color="#ffffff" />
            </Pressable>
          </View>

          {/* Right two tabs */}
          <View className="flex-1 flex-row justify-around">
            {TAB_CONFIG.slice(2, 4).map((tab, i) => renderTab(tab, i + 2))}
          </View>
        </>
      ) : (
        /* Spectator: evenly spaced tabs, no FAB gap */
        TAB_CONFIG.map((tab, i) => renderTab(tab, i))
      )}
    </View>
  );
}
