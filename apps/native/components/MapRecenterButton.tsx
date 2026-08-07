import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

type MapRecenterButtonProps = {
  onPress: () => void;
  /** Distance from the screen bottom, kept clear of the tab bar by the caller. */
  bottom: number;
};

/**
 * Circular "center on my location" control for the map, styled to match the app's
 * other round icon buttons (cf. the recenter button in LocationSheet) instead
 * of Google's default square native button. Anchored bottom-right.
 */
export function MapRecenterButton({ onPress, bottom }: MapRecenterButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Center map on my location"
      className="absolute right-4 w-12 h-12 rounded-full bg-white items-center justify-center shadow-lg active:opacity-80"
      style={{ bottom, elevation: 6 }}
    >
      <Ionicons name="locate" size={22} color="#1A1A1A" />
    </Pressable>
  );
}
