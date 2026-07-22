import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

type EmptyVariant = 'no-events' | 'no-posts' | 'no-results' | 'no-bookings' | 'no-notifications';

const VARIANT_CONFIG: Record<
  EmptyVariant,
  { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }
> = {
  'no-events': {
    icon: 'musical-notes-outline',
    title: 'No events nearby',
    subtitle: 'Try searching for Dublin, Galway, or Cork',
  },
  'no-posts': {
    icon: 'document-text-outline',
    title: 'No posts yet',
    subtitle: 'Posts from this profile will appear here.',
  },
  'no-results': {
    icon: 'search-outline',
    title: 'No results found',
    subtitle: 'Try adjusting your search or filters',
  },
  'no-bookings': {
    icon: 'calendar-outline',
    title: 'No performance requests yet',
    subtitle: 'Your performance requests will appear here',
  },
  'no-notifications': {
    icon: 'notifications-outline',
    title: 'No notifications yet',
    subtitle: 'New activity will show up here',
  },
};

interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void };
  className?: string;
}

export function EmptyState({ variant, title, subtitle, cta, className }: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];
  const displayTitle = title ?? config.title;
  const displaySubtitle = subtitle ?? config.subtitle;

  return (
    <View className={cn('flex-1 items-center justify-center px-8 gap-4', className)}>
      <Ionicons name={config.icon} size={48} color="rgba(255,255,255,0.2)" />
      <View className="items-center gap-2">
        <Text className="text-lg font-semibold text-white text-center">{displayTitle}</Text>
        <Text className="text-sm text-gray-7 text-center">{displaySubtitle}</Text>
      </View>
      {cta && (
        <Pressable
          onPress={cta.onPress}
          className="mt-2 px-6 py-3 bg-[#662FFF] rounded-full active:opacity-80"
        >
          <Text className="text-xs font-bold text-white uppercase tracking-wider font-urbanist">
            {cta.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
