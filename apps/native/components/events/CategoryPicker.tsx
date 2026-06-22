import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { CATEGORY_LABELS, EVENT_CATEGORIES } from '@CeolX/shared';

import { CategoryIcon } from '@/components/icons/CategoryIcon';

type Props = {
  value: EventCategory | '';
  onChange: (cat: EventCategory) => void;
  error?: string;
};

/**
 * Inline attached dropdown for selecting an event category.
 * Renders as a trigger button + an expandable list that opens below it,
 * matching the Figma design (no bottom-sheet modal).
 */
export function CategoryPicker({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel = value ? (CATEGORY_LABELS[value] ?? value) : null;

  return (
    <View className="gap-1">
      {/* ── Trigger ── */}
      <Pressable
        className={cn(
          'flex-row items-center justify-between rounded-lg border bg-surface px-4 py-3',
          error ? 'border-error' : open ? 'border-[#6C63FF]' : 'border-gray-8'
        )}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Select event category"
      >
        <View className="flex-row items-center gap-2">
          {value ? <CategoryIcon category={value} size={16} color="#fff" /> : null}
          <Text
            className={cn('text-sm font-urbanist', selectedLabel ? 'text-white' : 'text-gray-7')}
          >
            {selectedLabel ?? 'Select Category'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#8d8d8d" />
      </Pressable>

      {/* ── Inline option list ── */}
      {open && (
        <View className="rounded-lg border border-gray-8 bg-surface overflow-hidden">
          {EVENT_CATEGORIES.map((cat, index) => (
            <Pressable
              key={cat}
              className={cn(
                'flex-row items-center gap-3 px-4 py-3 active:bg-white/5',
                index < EVENT_CATEGORIES.length - 1 && 'border-b border-gray-8/40',
                value === cat && 'bg-[#C8FF2F]/10'
              )}
              onPress={() => {
                onChange(cat);
                setOpen(false);
              }}
              accessibilityRole="menuitem"
            >
              <CategoryIcon category={cat} size={16} color={value === cat ? '#C8FF2F' : '#fff'} />
              <Text
                className={cn(
                  'flex-1 text-sm font-urbanist',
                  value === cat ? 'font-bold text-[#C8FF2F]' : 'text-white'
                )}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </Text>
              {value === cat && <Ionicons name="checkmark" size={16} color="#C8FF2F" />}
            </Pressable>
          ))}
        </View>
      )}

      {error && <Text className="text-xs text-error font-urbanist">{error}</Text>}
    </View>
  );
}
