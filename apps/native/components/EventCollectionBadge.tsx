import { Text, View } from 'react-native';

interface EventCollectionBadgeProps {
  /** Collection name to display, e.g. "Galway Festival". */
  name: string;
  className?: string;
}

/**
 * The top-left tag on an event card/cover that names the collection the event
 * belongs to (e.g. a festival grouping). Category lives separately at the
 * bottom-left of the card — these two must never share the top-left slot.
 * Rendered only when an event actually belongs to a collection.
 */
export function EventCollectionBadge({ name, className }: EventCollectionBadgeProps) {
  return (
    <View
      className={['rounded-xl px-2 py-1.5', className].filter(Boolean).join(' ')}
      style={{ backgroundColor: 'rgba(8,8,8,0.85)' }}
    >
      <Text
        className="text-[12px] text-[#C8FF2F] font-semibold tracking-wide font-urbanist"
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}
