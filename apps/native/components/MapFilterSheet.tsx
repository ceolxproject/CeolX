import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useCallback } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DATE_RANGE_OPTIONS, EVENT_CATEGORIES, IRISH_COUNTIES } from '@CeolX/shared';
import type { DateRangeOption } from '@CeolX/shared';

import type { MapFilters } from '@/hooks/use-map-events';

const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_weekend: 'This Weekend',
  this_month: 'This Month',
};

interface MapFilterSheetProps {
  visible: boolean;
  filters: MapFilters;
  onApply: (filters: MapFilters) => void;
  onClose: () => void;
}

export function MapFilterSheet({ visible, filters, onApply, onClose }: MapFilterSheetProps) {
  const insets = useSafeAreaInsets();

  const toggle = useCallback(
    <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
      const next = { ...filters };
      if (next[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      onApply(next);
    },
    [filters, onApply]
  );

  const clearAll = useCallback(() => onApply({}), [onApply]);

  const hasFilters = filters.category || filters.county || filters.dateRange;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-[#E0E0E0]">
          <Text className="text-lg font-bold text-[#1A1A1A]">Filters</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#1A1A1A" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* When */}
          <Text className="text-[15px] font-semibold text-[#1A1A1A] mb-3 mt-5">When</Text>
          <View className="flex-row flex-wrap gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                className={cn(
                  'px-[14px] py-2 rounded-full border-[1.5px]',
                  filters.dateRange === option
                    ? 'bg-[#EDE9FF] border-[#662FFF]'
                    : 'bg-[#F5F5F5] border-[#F5F5F5]'
                )}
                onPress={() => toggle('dateRange', option)}
              >
                <Text
                  className={cn(
                    'text-[13px] font-medium',
                    filters.dateRange === option ? 'text-[#662FFF] font-semibold' : 'text-[#666666]'
                  )}
                >
                  {DATE_RANGE_LABELS[option]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Category */}
          <Text className="text-[15px] font-semibold text-[#1A1A1A] mb-3 mt-5">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {EVENT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                className={cn(
                  'px-[14px] py-2 rounded-full border-[1.5px]',
                  filters.category === cat
                    ? 'bg-[#EDE9FF] border-[#662FFF]'
                    : 'bg-[#F5F5F5] border-[#F5F5F5]'
                )}
                onPress={() => toggle('category', cat)}
              >
                <Text
                  className={cn(
                    'text-[13px] font-medium',
                    filters.category === cat ? 'text-[#662FFF] font-semibold' : 'text-[#666666]'
                  )}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* County */}
          <Text className="text-[15px] font-semibold text-[#1A1A1A] mb-3 mt-5">County</Text>
          <View className="flex-row flex-wrap gap-2">
            {IRISH_COUNTIES.map((county) => (
              <Pressable
                key={county}
                className={cn(
                  'px-[14px] py-2 rounded-full border-[1.5px]',
                  filters.county === county
                    ? 'bg-[#EDE9FF] border-[#662FFF]'
                    : 'bg-[#F5F5F5] border-[#F5F5F5]'
                )}
                onPress={() => toggle('county', county)}
              >
                <Text
                  className={cn(
                    'text-[13px] font-medium',
                    filters.county === county ? 'text-[#662FFF] font-semibold' : 'text-[#666666]'
                  )}
                >
                  {county}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          className="flex-row items-center px-5 pt-3 border-t border-[#E0E0E0] gap-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {hasFilters ? (
            <Pressable className="flex-1 h-12 justify-center items-center" onPress={clearAll}>
              <Text className="text-[15px] font-semibold text-[#1A1A1A] underline">Clear all</Text>
            </Pressable>
          ) : (
            <View className="flex-1 h-12" />
          )}
          <Pressable
            className="flex-1 h-12 rounded-full bg-[#662FFF] items-center justify-center"
            onPress={onClose}
          >
            <Text className="text-[15px] font-semibold text-white">Show results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
