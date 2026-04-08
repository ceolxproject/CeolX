import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 52;
const SEARCH_BAR_GAP = 8;

interface MapSearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFilterPress?: () => void;
  activeFilterCount?: number;
}

export function MapSearchBar({
  placeholder = 'Search by county / artist / category',
  value,
  onChangeText,
  onFilterPress,
  activeFilterCount = 0,
}: MapSearchBarProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT + SEARCH_BAR_GAP;
  const inputRef = useRef<TextInput>(null);

  return (
    <View className="absolute left-4 right-4" style={{ top }}>
      <Pressable
        className="flex-row items-center bg-white rounded-full h-11 px-4 gap-2"
        onPress={() => inputRef.current?.focus()}
      >
        <Ionicons name="search" size={20} color="#8D8D8D" />
        <TextInput
          ref={inputRef}
          className="flex-1 text-[#1A1A1A] text-[14px]"
          style={{ padding: 0 }}
          placeholder={placeholder}
          placeholderTextColor="#8D8D8D"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable
          className={cn(
            'w-8 h-8 rounded-full items-center justify-center',
            activeFilterCount > 0 ? 'bg-[#662FFF]' : 'bg-[#F0F0F0]'
          )}
          onPress={onFilterPress}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? '#FFFFFF' : '#8D8D8D'}
          />
          {activeFilterCount > 0 && (
            <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF3B30] items-center justify-center">
              <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </View>
  );
}
