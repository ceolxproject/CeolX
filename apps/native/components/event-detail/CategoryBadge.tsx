import { cn } from 'heroui-native';
import { Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@CeolX/shared';

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <View className={cn('self-start bg-[#080808]/80 rounded-xl px-2 py-1.5', className)}>
      <Text className="text-green-10 text-xs font-bold tracking-widest uppercase font-sans">
        {label}
      </Text>
    </View>
  );
}
