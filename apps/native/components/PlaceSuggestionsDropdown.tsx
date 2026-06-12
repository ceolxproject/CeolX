import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAP_HEADER_HEIGHT,
  MAP_SEARCH_BAR_GAP,
  MAP_SEARCH_BAR_HEIGHT,
} from '@/constants/map-layout';
import type { GeocodeResult } from '@/utils/geocode';

const DROPDOWN_GAP = 4;

interface PlaceSuggestionsDropdownProps {
  suggestions: GeocodeResult[];
  isSearching: boolean;
  onSelect: (result: GeocodeResult) => void;
}

/**
 * Live place/venue suggestions for the map search bar. Unlike the old county
 * dropdown it always renders while the parent has it mounted (gated on
 * `isDropdownVisible`), so it can show a "searching" spinner and a "no places
 * found" empty state — not just a list of hits.
 */
export function PlaceSuggestionsDropdown({
  suggestions,
  isSearching,
  onSelect,
}: PlaceSuggestionsDropdownProps) {
  const insets = useSafeAreaInsets();
  const top =
    insets.top + MAP_HEADER_HEIGHT + MAP_SEARCH_BAR_GAP + MAP_SEARCH_BAR_HEIGHT + DROPDOWN_GAP;

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel="Place suggestions"
      className="absolute left-4 right-4 bg-white rounded-2xl overflow-hidden shadow-lg"
      style={{ top, elevation: 8 }}
    >
      {suggestions.length === 0 ? (
        <View className="flex-row items-center px-4 py-3 gap-3">
          {isSearching ? (
            <>
              <ActivityIndicator size="small" color="#8D8D8D" />
              <Text className="text-[14px] text-[#8D8D8D]">Searching…</Text>
            </>
          ) : (
            <>
              <Ionicons name="search" size={20} color="#8D8D8D" />
              <Text className="text-[14px] text-[#8D8D8D]">
                No places found — try a town or county.
              </Text>
            </>
          )}
        </View>
      ) : (
        suggestions.map((result) => (
          <Pressable
            key={`${result.lat},${result.lng},${result.address}`}
            accessibilityRole="button"
            accessibilityLabel={result.address}
            className="flex-row items-center px-4 py-3 gap-3 active:bg-[#F5F5F5]"
            onPress={() => onSelect(result)}
          >
            <View className="w-9 h-9 rounded-full bg-[#F0F0F0] items-center justify-center">
              <Ionicons name="location-outline" size={20} color="#666" />
            </View>
            <Text className="flex-1 text-[14px] text-[#1A1A1A]" numberOfLines={2}>
              {result.address}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
