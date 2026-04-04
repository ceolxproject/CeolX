import { cn } from 'heroui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabItem {
  key: string;
  label: string;
  icon: (props: { color: string; size: number }) => ReactNode;
  badge?: number;
}

type BarVariant = 'end-user' | 'artist-venue';

interface BottomTabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  variant?: BarVariant;
  onFabPress?: () => void;
  className?: string;
}

export function BottomTabBar({
  tabs,
  activeKey,
  onTabPress,
  variant = 'end-user',
  onFabPress,
  className,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className={cn('bg-surface-dark border-t border-gray-8 flex-row items-center', className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            className="flex-1 items-center py-3 gap-1"
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <View className="relative">
              {tab.icon({ color: isActive ? '#662fff' : '#afafaf', size: 22 })}
              {tab.badge !== undefined && tab.badge > 0 && (
                <View className="absolute -top-1 -right-2 h-4 min-w-4 px-1 bg-error rounded-full items-center justify-center">
                  <Text className="text-[10px] text-white font-bold leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className={cn('text-[10px]', isActive ? 'text-blue-10 font-semibold' : 'text-gray-7')}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}

      {variant === 'artist-venue' && (
        <Pressable
          onPress={onFabPress}
          className="absolute -top-6 self-center h-12 w-12 rounded-full bg-green-10 items-center justify-center shadow-lg active:opacity-80"
          style={{ left: '50%', transform: [{ translateX: -24 }] }}
          accessibilityLabel="Create event"
        >
          <Text className="text-2xl text-surface-dark font-bold leading-none">+</Text>
        </Pressable>
      )}
    </View>
  );
}
