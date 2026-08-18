import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

interface VenueOnHoldEventCardProps {
  title: string;
  dateStart: string;
}

/**
 * A saved event whose venue has gone on hold (M8-T0 V-03).
 *
 * Everywhere else an on-hold venue's events are simply dropped. A **saved** event
 * is not: the spectator deliberately saved it, and having it silently vanish reads
 * as CeolX losing their plans. The client asked for a "TBC by venue" marker so the
 * absence attributes to the venue instead (D-52).
 *
 * Deliberately not pressable. `events.byId` withholds the promotional detail for an
 * on-hold venue — description, ticket link and ad copy — so the detail screen would
 * only repeat what this card already says. The card is the explanation, not a route.
 *
 * The withholding is real, not cosmetic: an earlier version of this note claimed the
 * server withheld the detail when in fact `byId` had no gate at all, so the same event
 * opened in full via deep link, share URL or search.
 */
export function VenueOnHoldEventCard({ title, dateStart }: VenueOnHoldEventCardProps) {
  const date = new Date(dateStart);
  const formatted = Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${title}. To be confirmed by the venue.`}
      className="rounded-2xl border border-gray-8 bg-[#26262A] px-4 py-3.5 gap-1.5"
    >
      <View className="flex-row items-center gap-2">
        <View className="rounded border border-gray-7 px-1.5 py-px">
          <Text className="text-[10px] font-bold uppercase tracking-[0.2px] text-gray-7 font-urbanist">
            TBC by venue
          </Text>
        </View>
        {formatted ? <Text className="text-xs text-gray-7 font-urbanist">{formatted}</Text> : null}
      </View>

      <Text className="text-sm font-semibold text-white/70 font-urbanist" numberOfLines={2}>
        {title}
      </Text>

      <View className="flex-row items-start gap-1.5">
        <Ionicons
          name="information-circle-outline"
          size={13}
          color="rgba(255,255,255,0.4)"
          style={{ marginTop: 1 }}
        />
        <Text className="shrink text-xs leading-[17px] text-white/40 font-urbanist">
          This venue&apos;s profile is on hold, so the details aren&apos;t available right now.
          We&apos;ve kept it in your saved list.
        </Text>
      </View>
    </View>
  );
}
