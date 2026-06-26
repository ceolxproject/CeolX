import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAP_HEADER_HEIGHT, MAP_SEARCH_BAR_GAP } from '@/constants/map-layout';

interface MapSearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onClear?: () => void;
  onFilterPress?: () => void;
  activeFilterCount?: number;
  /** Focus the field (and raise the keyboard) as soon as the bar mounts. */
  autoFocus?: boolean;
}

export function MapSearchBar({
  placeholder = 'Search a place, venue, town or county',
  value,
  onChangeText,
  onClear,
  onFilterPress,
  activeFilterCount = 0,
  autoFocus = false,
}: MapSearchBarProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + MAP_HEADER_HEIGHT + MAP_SEARCH_BAR_GAP;

  return (
    <View className="absolute left-4 right-4" style={{ top }}>
      {/* The pill used to be a Pressable wrapping the TextInput so tapping
          anywhere on the pill would focus the field. On android that pattern
          fights the TextInput for the touch responder — keystrokes could
          trigger the parent onPress and re-focus the field mid-IME-composition,
          dropping typed characters. The TextInput is already full-width inside
          the pill (flex-1), so a plain View is enough to render the bg + icons
          without intercepting input touches. */}
      <View className="flex-row items-center bg-white rounded-full h-11 px-4 gap-2">
        <Ionicons name="search" size={20} color="#8D8D8D" />
        <TextInput
          className="flex-1 text-[#1A1A1A] text-[14px]"
          style={{ padding: 0 }}
          placeholder={placeholder}
          placeholderTextColor="#8D8D8D"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        {value ? (
          <Pressable hitSlop={8} onPress={onClear}>
            <Ionicons name="close-circle" size={18} color="#8D8D8D" />
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={10}
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
      </View>
    </View>
  );
}
