import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, View } from 'react-native';

interface LocationIndicatorProps {
  /** The effective location label (place name or a source-based fallback). */
  label: string;
  /**
   * `true` when the shown location is a temporary place search (not the
   * saved/default). Swaps the caption to "Searching" and reveals the reset
   * control.
   */
  isSearch?: boolean;
  /** Open the location picker (temporary search). */
  onPress?: () => void;
  /** Clear the temporary search → return to the saved/default location. */
  onReset?: () => void;
  /**
   * - `inline` — the two-line block used in the Feed header.
   * - `floating` — a compact dark chip overlaid on the Map.
   */
  variant: 'inline' | 'floating';
  /** Extra classes on the outer row (e.g. `flex-1` in the Feed header). */
  className?: string;
}

/**
 * The shared "current location" affordance rendered identically on the Feed and
 * the Map so the two screens read the same. A temporary search adds a "Searching"
 * caption and a reset (✕) button that drops back to the saved/default location.
 *
 * Positioning (absolute placement, safe-area offsets) is the caller's job — this
 * component only renders the chip/block and its reset sibling.
 */
export function LocationIndicator({
  label,
  isSearch = false,
  onPress,
  onReset,
  variant,
  className,
}: LocationIndicatorProps) {
  const caption = isSearch ? 'Searching' : 'Your location';
  const captionIcon = isSearch ? 'search' : 'location-outline';
  // Accent the caption while searching so the temporary state is unmistakable.
  const captionColor = isSearch ? '#C8FF2F' : '#8D8D8D';

  if (variant === 'inline') {
    return (
      <View className={cn('flex-row items-center gap-2', className)}>
        <Pressable onPress={onPress} className="flex-1 flex-row items-center gap-1">
          <View className="flex-1 flex-col">
            <View className="flex-row items-center gap-1">
              <Ionicons name={captionIcon} size={14} color={captionColor} />
              <Text className="text-xs font-urbanist" style={{ color: captionColor }}>
                {caption}
              </Text>
            </View>
            <View className="flex-row items-center gap-1 mt-0.5">
              {/* Tail-truncated so only the start of a long address shows and the
                  chevron stays visible (cf. the reference design). */}
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                className="flex-1 text-[15px] font-medium text-white font-urbanist"
              >
                {label}
              </Text>
              <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        {isSearch && onReset && (
          <Pressable
            onPress={onReset}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reset to your saved location"
            className="w-8 h-8 rounded-full bg-[#1d1d1d] items-center justify-center shrink-0"
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    );
  }

  // floating
  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <Pressable
        onPress={onPress}
        className="flex-row items-center gap-2 rounded-full bg-[rgba(0,0,0,0.6)] pl-3.5 pr-3 py-2"
      >
        <Ionicons name={captionIcon} size={14} color={isSearch ? '#C8FF2F' : '#FFFFFF'} />
        <View className="flex-col max-w-[180px]">
          <Text
            className="text-[10px] font-urbanist leading-[12px]"
            style={{ color: captionColor }}
          >
            {caption}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-[14px] font-medium text-white font-urbanist"
          >
            {label}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
      </Pressable>

      {isSearch && onReset && (
        <Pressable
          onPress={onReset}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reset to your saved location"
          className="w-10 h-10 rounded-full bg-[rgba(0,0,0,0.6)] items-center justify-center"
        >
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}
