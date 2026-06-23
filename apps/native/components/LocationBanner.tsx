import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAP_HEADER_HEIGHT,
  MAP_SEARCH_BAR_GAP,
  MAP_SEARCH_BAR_HEIGHT,
} from '@/constants/map-layout';

type LocationBannerProps = {
  message: string;
  onDismiss: () => void;
};

export function LocationBanner({ message, onDismiss }: LocationBannerProps) {
  const insets = useSafeAreaInsets();
  // Sit just under the search bar (same anchor as the suggestions dropdown) so the
  // banner never overlaps it or hides behind the status bar on tall-notch devices.
  const top = insets.top + MAP_HEADER_HEIGHT + MAP_SEARCH_BAR_GAP + MAP_SEARCH_BAR_HEIGHT + 8;

  return (
    <View
      className="absolute self-center z-10 flex-row items-center bg-[rgba(43,43,43,0.92)] px-4 py-2 rounded-full max-w-[320px]"
      style={{ top }}
    >
      <Text className="text-white text-[13px] flex-1">{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8} className="ml-2">
        <Text className="text-white/60 text-[16px] font-bold">×</Text>
      </Pressable>
    </View>
  );
}
