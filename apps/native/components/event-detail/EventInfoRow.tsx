import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

interface EventInfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  /** Optional trailing action (e.g. "Add to calendar"). Omit for info-only rows like price. */
  actionLabel?: string;
  onAction?: () => void;
  onTitlePress?: () => void;
  className?: string;
}

export function EventInfoRow({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  onTitlePress,
  className,
}: EventInfoRowProps) {
  const titleBody = (
    <View className="flex-1">
      <Text className="text-base font-bold text-white font-sans" numberOfLines={1}>
        {title}
      </Text>
      <Text className="text-sm text-white/60 font-sans mt-0.5" numberOfLines={2}>
        {subtitle}
      </Text>
    </View>
  );

  const hasAction = !!actionLabel && !!onAction;

  return (
    <View className={cn('flex-row items-start justify-between', className)}>
      {onTitlePress ? (
        <Pressable
          onPress={onTitlePress}
          hitSlop={6}
          className="flex-row items-start gap-2 flex-1 mr-3 active:opacity-70"
        >
          <Ionicons name={icon} size={20} color="#fff" style={{ marginTop: 1 }} />
          {titleBody}
        </Pressable>
      ) : (
        <View className="flex-row items-start gap-2 flex-1 mr-3">
          <Ionicons name={icon} size={20} color="#fff" style={{ marginTop: 1 }} />
          {titleBody}
        </View>
      )}

      {hasAction && (
        <Pressable onPress={onAction} hitSlop={8} className="active:opacity-70 mt-0.5">
          <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-sans">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
