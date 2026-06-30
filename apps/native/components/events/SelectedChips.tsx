import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

export interface ChipItem {
  key: string;
  label: string;
  /** Optional leading icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Optional leading avatar url — takes precedence over `icon` when set */
  imageUrl?: string;
}

interface SelectedChipsProps {
  items: ChipItem[];
  onRemove: (key: string) => void;
  /** Chip color variant */
  variant?: 'purple' | 'neutral';
}

const VARIANTS = {
  purple: {
    container: 'bg-[#6C63FF]/20 border-[#6C63FF]/40',
    text: 'text-[#6C63FF]',
    iconColor: '#6C63FF',
  },
  neutral: {
    container: 'bg-white/10 border-gray-8',
    text: 'text-gray-3',
    iconColor: '#8d8d8d',
  },
} as const;

export function SelectedChips({ items, onRemove, variant = 'purple' }: SelectedChipsProps) {
  if (items.length === 0) return null;

  const palette = VARIANTS[variant];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2">
        {items.map((item) => (
          <View
            key={item.key}
            className={cn(
              'flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border',
              palette.container
            )}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="w-4 h-4 rounded-full" />
            ) : (
              item.icon && <Ionicons name={item.icon} size={12} color={palette.iconColor} />
            )}
            <Text className={cn('text-xs font-semibold font-urbanist', palette.text)}>
              {item.label}
            </Text>
            <Pressable onPress={() => onRemove(item.key)} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color={palette.iconColor} />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
