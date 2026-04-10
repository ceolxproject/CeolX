import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

import { CeolxLogo } from './CeolxLogo';

interface FeedHeaderProps {
  locationText?: string;
  onBookmarkPress?: () => void;
  onNotificationPress?: () => void;
  onLocationPress?: () => void;
  className?: string;
}

export function FeedHeader({
  locationText = 'Ireland',
  onBookmarkPress,
  onNotificationPress,
  onLocationPress,
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
          <Pressable onPress={onNotificationPress} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* Row 2: Location */}
      <Pressable onPress={onLocationPress} className="flex-row items-center gap-1">
        <View className="flex-col">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={14} color="#8D8D8D" />
            <Text className="text-xs text-[#8D8D8D] font-urbanist">Your location</Text>
          </View>
          <View className="flex-row items-center gap-1 mt-0.5">
            <Text className="text-[15px] font-medium text-white font-urbanist">{locationText}</Text>
            <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
