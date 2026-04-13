import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DATE_RANGE_OPTIONS, EVENT_CATEGORIES } from '@CeolX/shared';
import type { FeedQueryInput } from '@CeolX/shared';

type DateRange = FeedQueryInput['dateRange'];
type Category = FeedQueryInput['category'];

export interface FeedFilters {
  dateRange?: DateRange;
  category?: Category;
}

const DATE_RANGE_LABELS: Record<NonNullable<DateRange>, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_weekend: 'This Weekend',
  this_month: 'This Month',
};

interface FeedFilterSheetProps {
  visible: boolean;
  filters: FeedFilters;
  onApply: (filters: FeedFilters) => void;
  onClose: () => void;
}

export function FeedFilterSheet({ visible, filters, onApply, onClose }: FeedFilterSheetProps) {
  const insets = useSafeAreaInsets();

  const toggle = <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) => {
    const next = { ...filters };
    if (next[key] === value) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onApply(next);
  };

  const clearAll = () => onApply({});
  const hasFilters = filters.category || filters.dateRange;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#1a1a1a]" style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/10">
          <Text className="text-lg font-bold text-white font-urbanist">Filters</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* When */}
          <Text className="text-[15px] font-semibold text-white font-urbanist mb-3">When</Text>
          <View className="flex-row flex-wrap gap-2">
            {DATE_RANGE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                className={cn(
                  'px-[14px] py-2 rounded-full border-[1.5px]',
                  filters.dateRange === option
                    ? 'bg-[#C8FF2F]/20 border-[#C8FF2F]'
                    : 'bg-white/5 border-white/10'
                )}
                onPress={() => toggle('dateRange', option)}
              >
                <Text
                  className={cn(
                    'text-[13px] font-medium font-urbanist',
                    filters.dateRange === option ? 'text-[#C8FF2F] font-semibold' : 'text-white/60'
                  )}
                >
                  {DATE_RANGE_LABELS[option]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Category */}
          <Text className="text-[15px] font-semibold text-white font-urbanist mb-3 mt-6">
            Category
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EVENT_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                className={cn(
                  'px-[14px] py-2 rounded-full border-[1.5px]',
                  filters.category === cat
                    ? 'bg-[#C8FF2F]/20 border-[#C8FF2F]'
                    : 'bg-white/5 border-white/10'
                )}
                onPress={() => toggle('category', cat)}
              >
                <Text
                  className={cn(
                    'text-[13px] font-medium font-urbanist',
                    filters.category === cat ? 'text-[#C8FF2F] font-semibold' : 'text-white/60'
                  )}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          className="flex-row items-center px-5 pt-3 border-t border-white/10 gap-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {hasFilters ? (
            <Pressable className="flex-1 h-12 justify-center items-center" onPress={clearAll}>
              <Text className="text-[15px] font-semibold text-white/60 font-urbanist underline">
                Clear all
              </Text>
            </Pressable>
          ) : (
            <View className="flex-1 h-12" />
          )}
          <Pressable
            className="flex-1 h-12 rounded-full bg-[#C8FF2F] items-center justify-center"
            onPress={onClose}
          >
            <Text className="text-[15px] font-semibold text-black font-urbanist">Show results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
