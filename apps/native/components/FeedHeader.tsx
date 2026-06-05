import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

import { CeolxLogo } from './CeolxLogo';
import { BellWithBadge } from './notifications/BellWithBadge';

interface FeedHeaderProps {
  locationText?: string;
  onNotificationPress?: () => void;
  onLocationPress?: () => void;
  onFilterPress?: () => void;
  className?: string;
}

export function FeedHeader({
  locationText = 'Ireland',
  onNotificationPress,
  onLocationPress,
  onFilterPress,
  className,
}: FeedHeaderProps) {
  return (
    <View className={cn('px-5 gap-3', className)}>
      {/* Row 1: Logo + action icons */}
      <View className="flex-row items-center justify-between">
        <CeolxLogo fontSize={18} letterSpacing={2} />
      </View>

      {/* Row 2: Location */}
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
            </View>
          </View>
        </Pressable>

        {/* Filter sliders + notification bell */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onFilterPress}
            hitSlop={8}
            className="w-10 h-10 rounded-full bg-[#1d1d1d] items-center justify-center"
          >
            <Ionicons name="options-outline" size={20} color="#FFFFFF" />
          </Pressable>
          {onNotificationPress && <BellWithBadge onPress={onNotificationPress} />}
        </View>
      </View>
    </View>
  );
}
