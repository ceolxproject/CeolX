import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from '@/constants/layout';

type MapEmptyStateCardProps = {
  onDismiss: () => void;
  onBrowseAll: () => void;
};

export function MapEmptyStateCard({ onDismiss, onBrowseAll }: MapEmptyStateCardProps) {
  const insets = useSafeAreaInsets();
  // Float clear of the (still-visible) tab bar so the dismiss × and the CTA stay tappable.
  const bottom = insets.bottom + TAB_BAR_HEIGHT + 16;

  return (
    <View
      className="absolute self-center z-10 bg-[rgba(43,43,43,0.95)] px-5 py-4 rounded-2xl max-w-[300px]"
      style={{ bottom }}
    >
      <Pressable onPress={onDismiss} hitSlop={8} className="absolute top-2 right-3 z-10">
        <Text className="text-white/60 text-[16px] font-bold">×</Text>
      </Pressable>

      <Text className="text-white text-[14px] text-center mb-3">
        No events near here. Try searching for Dublin, Galway, or Cork.
      </Text>

      <Pressable
        onPress={onBrowseAll}
        className="bg-[#6155F5] min-h-[44px] py-2.5 px-4 rounded-xl items-center justify-center"
      >
        <Text className="text-white text-[14px] font-semibold">Browse all upcoming events</Text>
      </Pressable>
    </View>
  );
}
