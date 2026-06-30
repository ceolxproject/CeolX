import { cn } from 'heroui-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { CATEGORY_LABELS, EVENT_CATEGORIES } from '@CeolX/shared';

import { CategoryIcon } from '@/components/icons/CategoryIcon';

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
            category={cat}
            label={CATEGORY_LABELS[cat]}
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
  category,
  isActive,
  onPress,
}: {
  label: string;
  /** Omitted for the "All" chip, which renders no icon. */
  category?: EventCategory;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-1 px-4 py-2 rounded-full',
        isActive ? 'bg-[#C8FF2F]' : 'bg-white/10'
      )}
    >
      {category ? (
        <CategoryIcon
          category={category}
          size={12}
          color={isActive ? '#000' : 'rgba(255,255,255,0.6)'}
        />
      ) : null}
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
