import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { cn } from 'heroui-native';
import { Pressable, View } from 'react-native';

import { CeolxLogo } from '@/components/CeolxLogo';
import { BellWithBadge } from '@/components/notifications/BellWithBadge';

interface EventDetailHeaderProps {
  onBack: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  className?: string;
}

export function EventDetailHeader({
  onBack,
  isSaved,
  onToggleSave,
  className,
}: EventDetailHeaderProps) {
  return (
    <View
      className={cn('flex-row items-center justify-between px-5 h-14 bg-background', className)}
    >
      <Pressable onPress={onBack} hitSlop={12} className="active:opacity-70">
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <CeolxLogo fontSize={16} letterSpacing={2} />

      <View className="flex-row items-center gap-4">
        <Pressable onPress={onToggleSave} hitSlop={12} className="active:opacity-70">
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={23} color="#fff" />
        </Pressable>
        <BellWithBadge onPress={() => router.push('/notifications')} size={24} />
      </View>
    </View>
  );
}
