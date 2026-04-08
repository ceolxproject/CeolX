import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CountyResult } from '@/hooks/use-county-search';

const HEADER_HEIGHT = 52;
const SEARCH_BAR_GAP = 8;
const SEARCH_BAR_HEIGHT = 44;
const DROPDOWN_GAP = 4;

interface CountySuggestionsDropdownProps {
  suggestions: CountyResult[];
  onSelect: (result: CountyResult) => void;
}

export function CountySuggestionsDropdown({
  suggestions,
  onSelect,
}: CountySuggestionsDropdownProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT + SEARCH_BAR_GAP + SEARCH_BAR_HEIGHT + DROPDOWN_GAP;

  if (suggestions.length === 0) return null;

  return (
    <View
      className="absolute left-4 right-4 bg-white rounded-2xl overflow-hidden"
      style={{
        top,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {suggestions.map((result) => (
        <Pressable
          key={result.name}
          className="flex-row items-center px-4 py-3 gap-3 active:bg-[#F5F5F5]"
          onPress={() => onSelect(result)}
        >
          <View className="w-9 h-9 rounded-full bg-[#F0F0F0] items-center justify-center">
            <Ionicons name="location-outline" size={20} color="#666" />
          </View>
          <View className="flex-1">
            <Text className="text-[14px] text-[#1A1A1A] font-medium">{result.name}</Text>
            <Text className="text-[12px] text-[#8D8D8D]">County, Ireland</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
