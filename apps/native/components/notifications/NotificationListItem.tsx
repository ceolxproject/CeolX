import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

import { formatRelativeTime } from '@CeolX/shared';
import type { NotificationDto } from '@CeolX/shared/validators';

interface NotificationListItemProps {
  notification: NotificationDto;
  onPress: (notification: NotificationDto) => void;
}

export function NotificationListItem({ notification, onPress }: NotificationListItemProps) {
  const { title, body, createdAt, isRead } = notification;

  return (
    <Pressable
      onPress={() => onPress(notification)}
      className={cn(
        'flex-row gap-3 px-5 py-4 border-b border-[#1d1d1d]',
        !isRead && 'bg-[#0f0f0f]'
      )}
      accessibilityRole="button"
      accessibilityLabel={isRead ? title : `Unread: ${title}`}
    >
      {/* Unread dot — left rail, hidden once read */}
      <View className="w-2 pt-2">
        {!isRead && <View className="w-2 h-2 rounded-full bg-blue-10" />}
      </View>

      <View className="flex-1 gap-1">
        <Text
          className={cn(
            'text-[15px] text-white font-urbanist',
            isRead ? 'font-normal' : 'font-semibold'
          )}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-sm text-[#afafaf] font-urbanist" numberOfLines={2}>
          {body}
        </Text>
        <Text className="text-xs text-[#8d8d8d] font-urbanist mt-0.5">
          {formatRelativeTime(createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}
