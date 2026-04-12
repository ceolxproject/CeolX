import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { cn } from 'heroui-native';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, Text } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { EVENT_CATEGORIES } from '@CeolX/shared';

type Props = {
  visible: boolean;
  selected: EventCategory | '';
  onSelect: (category: EventCategory | '') => void;
  onClose: () => void;
};

export function CategoryPicker({ visible, selected, onSelect, onClose }: Props) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%'], []);

  const handleSelect = useCallback(
    (cat: EventCategory) => {
      onSelect(cat);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: '#1b1b1b' }}
      handleIndicatorStyle={{ backgroundColor: '#666' }}
    >
      <BottomSheetView className="flex-1 px-5 pt-2">
        <Text className="mb-4 text-lg font-semibold text-white">Select Category</Text>
        {EVENT_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            className={cn(
              'mb-2 rounded-lg px-4 py-3',
              selected === cat ? 'bg-[#C8FF2F]' : 'bg-white/10'
            )}
            onPress={() => handleSelect(cat)}
          >
            <Text
              className={cn(
                'text-base',
                selected === cat ? 'font-semibold text-black' : 'text-white'
              )}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </BottomSheetView>
    </BottomSheet>
  );
}
