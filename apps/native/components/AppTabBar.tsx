import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { cn } from 'heroui-native';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMe } from '@/hooks/use-me';

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
  { name: 'bookings', label: 'Requests', activeIcon: 'mail', inactiveIcon: 'mail-outline' },
  { name: 'profile', label: 'Profile', activeIcon: 'person', inactiveIcon: 'person-outline' },
];

// Extract the tabBar callback parameter type directly from Expo Router's <Tabs> component
type TabBarCallbackProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export type AppTabBarProps = TabBarCallbackProps & {
  onFabPress?: () => void;
};

export function AppTabBar({ state, navigation, onFabPress }: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const currentRole = me?.currentRole ?? 'spectator';

  const getTabLabel = (tab: TabConfig) => {
    if (tab.name === 'bookings') {
      return currentRole === 'spectator' ? 'Bookings' : 'Requests';
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
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(tab.name);
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

  return (
    <View
      className="flex-row items-start bg-[#6155F5] pt-2"
      style={{ paddingBottom: insets.bottom, height: 60 + insets.bottom }}
    >
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
    </View>
  );
}
