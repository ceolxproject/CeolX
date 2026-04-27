import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

import { CeolxLogo } from './CeolxLogo';
import { BellWithBadge } from './notifications/BellWithBadge';

interface FeedHeaderProps {
  locationText?: string;
  onBookmarkPress?: () => void;
  onNotificationPress?: () => void;
  onLocationPress?: () => void;
  onCalendarPress?: () => void;
  onFilterPress?: () => void;
  className?: string;
}

export function FeedHeader({
  locationText = 'Ireland',
  onBookmarkPress,
  onNotificationPress,
  onLocationPress,
  onCalendarPress,
  onFilterPress,
  className,
}: FeedHeaderProps) {
  return (
    <View className={cn('px-5 gap-3', className)}>
      {/* Row 1: Logo + action icons */}
      <View className="flex-row items-center justify-between">
        <CeolxLogo fontSize={18} letterSpacing={2} />

        <View className="flex-row items-center gap-4">
          <Pressable onPress={onBookmarkPress} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={22} color="#FFFFFF" />
          </Pressable>
          {onNotificationPress && <BellWithBadge onPress={onNotificationPress} />}
        </View>
      </View>

      {/* Row 2: Location + filter/sort buttons */}
      <View className="flex-row items-center justify-between">
        <Pressable onPress={onLocationPress} className="flex-row items-center gap-1">
          <View className="flex-col">
            <View className="flex-row items-center gap-1">
              <Ionicons name="location-outline" size={14} color="#8D8D8D" />
              <Text className="text-xs text-[#8D8D8D] font-urbanist">Your location</Text>
            </View>
            <View className="flex-row items-center gap-1 mt-0.5">
              <Text className="text-[15px] font-medium text-white font-urbanist">
                {locationText}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        {/* Left: calendar — Right: filter sliders (matches Figma node 1:3349) */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onCalendarPress}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-[#1d1d1d] items-center justify-center"
          >
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={onFilterPress}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-[#1d1d1d] items-center justify-center"
          >
            <Ionicons name="options-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
