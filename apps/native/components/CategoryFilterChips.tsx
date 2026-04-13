import { cn } from 'heroui-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { CATEGORY_ICONS, CATEGORY_LABELS, EVENT_CATEGORIES } from '@CeolX/shared';

interface CategoryFilterChipsProps {
  selected?: EventCategory;
  onSelect: (category: EventCategory | undefined) => void;
  className?: string;
}

export function CategoryFilterChips({ selected, onSelect, className }: CategoryFilterChipsProps) {
  return (
    <View className={className}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-5"
      >
        <Chip label="All" isActive={!selected} onPress={() => onSelect(undefined)} />
        {EVENT_CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={`${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}`}
            isActive={selected === cat}
            onPress={() => onSelect(selected === cat ? undefined : cat)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('px-4 py-2 rounded-full', isActive ? 'bg-[#C8FF2F]' : 'bg-white/10')}
    >
      <Text
        className={cn(
          'text-xs font-semibold font-urbanist',
          isActive ? 'text-black' : 'text-white/60'
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
