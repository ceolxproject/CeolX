import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@CeolX/shared';

import { CategoryIcon } from '@/components/icons/CategoryIcon';

type CategoryChipSize = 'sm' | 'md';

interface CategoryChipProps {
  /** Category key (stored value from EVENT_CATEGORIES). */
  category: string;
  /**
   * sm — compact pill for event cards (default).
   * md — taller pill for the event-detail hero, sized to sit level with the
   * attendee badge beside it.
   */
  size?: CategoryChipSize;
  className?: string;
}

/**
 * The single source of truth for how an event category is displayed as a tag.
 *
 * Renders the brand green pill with black text, the category's vector icon, and
 * the title-case label — identical on every surface (event cards, collection
 * cards, event-detail hero). Only the size differs per surface; the colour,
 * casing, icon and shape never do. Always render category tags via this
 * component so the surfaces can't drift apart again.
 */
const SIZE_STYLES: Record<CategoryChipSize, { container: string; text: string; icon: number }> = {
  sm: { container: 'h-4 px-2 gap-0.5', text: 'text-[11px]', icon: 11 },
  md: { container: 'px-2 py-1.5 gap-1', text: 'text-xs', icon: 13 },
};

export function CategoryChip({ category, size = 'sm', className }: CategoryChipProps) {
  const label = CATEGORY_LABELS[category] ?? category;
  const styles = SIZE_STYLES[size];

  return (
    <View
      className={cn(
        'self-start flex-row items-center bg-green-10 rounded-full',
        styles.container,
        className
      )}
    >
      <CategoryIcon category={category} size={styles.icon} color="#000" />
      <Text className={cn('font-semibold text-black font-urbanist', styles.text)}>{label}</Text>
    </View>
  );
}
