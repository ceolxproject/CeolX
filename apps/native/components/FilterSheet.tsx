import { cn } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/icons/CategoryIcon';

// ─── Palette (single dark sheet — Figma node 1:3817) ─────────────────────────

const SHEET_BG = '#2b2b2b';
const HANDLE = '#8d8d8d';
const CHIP_ACTIVE = '#d4fc5a'; // selected pill (lime)
const APPLY_BG = '#6155f5'; // purple CTA

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FilterSection {
  /** Unique key matching the filter record key */
  key: string;
  /** Section heading text (shown only when more than one section is present) */
  label: string;
  /** Available option values */
  options: readonly string[];
  /** Optional display labels for options (key → label). Falls back to raw value. */
  labels?: Record<string, string>;
  /** Label for the "clear this filter" chip. Defaults to "All". */
  allLabel?: string;
  /** When true, options render the shared category icon (options must be category keys). */
  showIcons?: boolean;
}

interface FilterSheetProps {
  visible: boolean;
  /** Current filter state — keys match section keys, values are selected option or undefined */
  filters: Record<string, string | undefined>;
  sections: FilterSection[];
  onApply: (filters: Record<string, string | undefined>) => void;
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FilterSheet({ visible, filters, sections, onApply, onClose }: FilterSheetProps) {
  const insets = useSafeAreaInsets();

  // Staged selection — chips edit this local copy; nothing is committed to the
  // parent until "Apply filters". Re-seeded from `filters` each time the sheet opens.
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const select = (key: string, value: string | undefined) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const showHeadings = sections.length > 1;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Dimmed backdrop — tap to dismiss without applying */}
      <Pressable className="flex-1 bg-black/60" onPress={onClose} />

      <View
        className="rounded-t-3xl px-6 pt-3"
        style={{ backgroundColor: SHEET_BG, paddingBottom: insets.bottom + 16 }}
      >
        {/* Drag handle */}
        <View className="items-center pb-4">
          <View className="h-1 w-9 rounded-full" style={{ backgroundColor: HANDLE }} />
        </View>

        <Text className="text-2xl font-semibold text-white font-urbanist mb-5">Filters</Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          style={{ maxHeight: 360 }}
        >
          {sections.map((section, sectionIdx) => (
            <View key={section.key} className={cn(sectionIdx > 0 && 'mt-5')}>
              {showHeadings && (
                <Text className="text-[15px] font-semibold text-white font-urbanist mb-3">
                  {section.label}
                </Text>
              )}
              <View className="flex-row flex-wrap gap-2">
                {/* "All" chip — active when this filter key is unset */}
                <Chip
                  label={section.allLabel ?? 'All'}
                  isActive={draft[section.key] === undefined}
                  onPress={() => select(section.key, undefined)}
                />
                {section.options.map((option) => {
                  const isActive = draft[section.key] === option;
                  return (
                    <Chip
                      key={option}
                      label={section.labels?.[option] ?? option}
                      icon={section.showIcons ? option : undefined}
                      isActive={isActive}
                      onPress={() => select(section.key, isActive ? undefined : option)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Apply CTA */}
        <Pressable
          className="h-12 rounded-full items-center justify-center mt-5"
          style={{ backgroundColor: APPLY_BG }}
          onPress={handleApply}
        >
          <Text className="text-white text-base font-bold font-urbanist tracking-wide uppercase">
            Apply filters
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  icon,
  isActive,
  onPress,
}: {
  label: string;
  /** Category key to render the shared icon for. Omitted → no icon (e.g. the "All" chip). */
  icon?: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('flex-row items-center gap-1 px-5 py-1.5 rounded-2xl', !isActive && 'bg-white')}
      style={isActive ? { backgroundColor: CHIP_ACTIVE } : undefined}
    >
      {icon ? <CategoryIcon category={icon} size={13} color="#000" /> : null}
      <Text className="text-[13px] font-semibold text-black font-urbanist">{label}</Text>
    </Pressable>
  );
}
