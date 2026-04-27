import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useUnreadBadgeCount } from '@/hooks/use-unread-badge-count';

interface BellWithBadgeProps {
  onPress: () => void;
  iconColor?: string;
  size?: number;
}

// Bell icon with red unread-count badge. Hidden when count is 0 (R3.4).
// Cap displayed value at 99+ to keep the badge small in the header.
export function BellWithBadge({ onPress, iconColor = '#FFFFFF', size = 22 }: BellWithBadgeProps) {
  const count = useUnreadBadgeCount();
  const display = count > 99 ? '99+' : String(count);

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel="Open notifications">
      <View>
        <Ionicons name="notifications-outline" size={size} color={iconColor} />
        {count > 0 && (
          <View
            className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 items-center justify-center px-1"
            accessibilityLabel={`${count} unread notifications`}
          >
            <Text className="text-white text-[10px] font-bold leading-none">{display}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
