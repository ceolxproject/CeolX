import { Ionicons } from '@expo/vector-icons';
import { cn, Popover } from 'heroui-native';
import { Text, View } from 'react-native';

type Props = {
  /** The field label text shown to the user. */
  label: string;
  /** Help text revealed in the tooltip when the info (ⓘ) icon is tapped. */
  hint: string;
  /** Extra classes for the label text (e.g. to tweak weight/colour per step). */
  className?: string;
};

/**
 * A form field label with an inline info (ⓘ) button that opens a tooltip
 * explaining the field. Used across the event creation/edit form so every
 * field has discoverable help without cluttering the layout with helper text.
 *
 * The tooltip uses heroui-native's Popover, which renders into the app-level
 * portal (HeroUINativeProvider in app/_layout.tsx) and auto-handles placement +
 * collision detection — so it never gets clipped by the surrounding ScrollView.
 */
export function FieldLabel({ label, hint, className }: Props) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className={cn('text-sm font-semibold text-gray-3 font-urbanist', className)}>
        {label}
      </Text>
      <Popover>
        <Popover.Trigger hitSlop={8} accessibilityLabel={`What is ${label}?`}>
          <Ionicons name="information-circle-outline" size={15} color="#8d8d8d" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Overlay />
          <Popover.Content
            presentation="popover"
            placement="top"
            width={260}
            className="border border-gray-8 bg-[#1B1B1B]"
          >
            <Popover.Arrow />
            <Popover.Description className="text-xs text-gray-3 font-urbanist leading-5">
              {hint}
            </Popover.Description>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </View>
  );
}
