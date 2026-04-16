import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useCallback } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Theme palettes ─────────────────────────────────────────────────────────

const PALETTES = {
  dark: {
    bg: 'bg-[#1a1a1a]',
    headerBorder: 'border-white/10',
    footerBorder: 'border-white/10',
    titleText: 'text-white',
    sectionText: 'text-white',
    closeIconColor: '#ffffff',
    chipDefault: 'bg-white/5 border-white/10',
    chipDefaultText: 'text-white/60',
    chipActive: 'bg-[#C8FF2F]/20 border-[#C8FF2F]',
    chipActiveText: 'text-[#C8FF2F]',
    clearText: 'text-white/60',
    applyBg: 'bg-[#C8FF2F]',
    applyText: 'text-black',
  },
  light: {
    bg: 'bg-white',
    headerBorder: 'border-[#E0E0E0]',
    footerBorder: 'border-[#E0E0E0]',
    titleText: 'text-[#1A1A1A]',
    sectionText: 'text-[#1A1A1A]',
    closeIconColor: '#1A1A1A',
    chipDefault: 'bg-[#F5F5F5] border-[#F5F5F5]',
    chipDefaultText: 'text-[#666666]',
    chipActive: 'bg-[#EDE9FF] border-[#662FFF]',
    chipActiveText: 'text-[#662FFF]',
    clearText: 'text-[#1A1A1A]',
    applyBg: 'bg-[#662FFF]',
    applyText: 'text-white',
  },
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FilterSection {
  /** Unique key matching the filter record key */
  key: string;
  /** Section heading text */
  label: string;
  /** Available option values */
  options: readonly string[];
  /** Optional display labels for options (key → label). Falls back to raw value. */
  labels?: Record<string, string>;
}

interface FilterSheetProps {
  visible: boolean;
  /** Current filter state — keys match section keys, values are selected option or undefined */
  filters: Record<string, string | undefined>;
  sections: FilterSection[];
  variant: 'light' | 'dark';
  onApply: (filters: Record<string, string | undefined>) => void;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FilterSheet({
  visible,
  filters,
  sections,
  variant,
  onApply,
  onClose,
}: FilterSheetProps) {
  const insets = useSafeAreaInsets();
  const palette = PALETTES[variant];

  const toggle = useCallback(
    (key: string, value: string) => {
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

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={cn('flex-1', palette.bg)} style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View
          className={cn(
            'flex-row items-center justify-between px-5 py-3 border-b',
            palette.headerBorder
          )}
        >
          <Text className={cn('text-lg font-bold font-urbanist', palette.titleText)}>Filters</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={palette.closeIconColor} />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section, sectionIdx) => (
            <View key={section.key}>
              <Text
                className={cn(
                  'text-[15px] font-semibold font-urbanist mb-3',
                  sectionIdx > 0 && 'mt-5',
                  palette.sectionText
                )}
              >
                {section.label}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {section.options.map((option) => {
                  const isActive = filters[section.key] === option;
                  const displayLabel = section.labels?.[option] ?? option;

                  return (
                    <Pressable
                      key={option}
                      className={cn(
                        'px-[14px] py-2 rounded-full border-[1.5px]',
                        isActive ? palette.chipActive : palette.chipDefault
                      )}
                      onPress={() => toggle(section.key, option)}
                    >
                      <Text
                        className={cn(
                          'text-[13px] font-medium font-urbanist',
                          isActive
                            ? cn(palette.chipActiveText, 'font-semibold')
                            : palette.chipDefaultText
                        )}
                      >
                        {displayLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Footer */}
        <View
          className={cn('flex-row items-center px-5 pt-3 gap-3 border-t', palette.footerBorder)}
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {hasFilters ? (
            <Pressable className="flex-1 h-12 justify-center items-center" onPress={clearAll}>
              <Text
                className={cn(
                  'text-[15px] font-semibold underline font-urbanist',
                  palette.clearText
                )}
              >
                Clear all
              </Text>
            </Pressable>
          ) : (
            <View className="flex-1 h-12" />
          )}
          <Pressable
            className={cn('flex-1 h-12 rounded-full items-center justify-center', palette.applyBg)}
            onPress={onClose}
          >
            <Text className={cn('text-[15px] font-semibold font-urbanist', palette.applyText)}>
              Show results
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
