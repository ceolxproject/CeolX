import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Suggestion } from '@CeolX/shared/validators';

type SearchSuggestionsProps = {
  artists: Suggestion[];
  venues: Suggestion[];
  events: Suggestion[];
  isLoading: boolean;
  onSelect: (label: string) => void;
};

// "Aug 2, 5:00 PM" — matches the design's US-style short date + 12h time.
function formatEventDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Circular 40px avatar. Falls back to the label's initial on a muted disc when
// the entity has no uploaded image (most events/venues pre-launch).
function Avatar({ uri, label }: { uri?: string; label: string }) {
  if (uri) {
    return <Image source={{ uri }} className="size-[40px] rounded-full" />;
  }
  return (
    <View className="size-[40px] rounded-full bg-[#ECECEC] items-center justify-center">
      <Text className="text-[16px] font-bold text-[#8D8D8D] font-urbanist">
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// A muted meta chip: a 12px icon + a short line. Used for an event's location
// and date.
//
// `flexible` lets the chip give up width and ellipsise when the row is too
// narrow. Shrink only, never grow: flexShrink is 0 by default in React Native so
// without it the chip keeps its natural width and runs off the card, but flex-1
// would be worse — it also grows, pushing the date chip out to the far edge on
// every row that fits. Set it on the location (arbitrarily long) and leave it off
// the date, which is short and should never be the part that gets cut.
function Meta({
  icon,
  text,
  flexible = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  flexible?: boolean;
}) {
  return (
    <View
      className={
        flexible ? 'shrink flex-row items-center gap-1' : 'shrink-0 flex-row items-center gap-1'
      }
    >
      <Ionicons name={icon} size={12} color="#8D8D8D" />
      <Text
        className={
          flexible
            ? 'shrink text-[13px] font-semibold text-[#8D8D8D] font-urbanist'
            : 'text-[13px] font-semibold text-[#8D8D8D] font-urbanist'
        }
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>
    </View>
  );
}

function SuggestionRow({
  item,
  onSelect,
}: {
  item: Suggestion;
  onSelect: (label: string) => void;
}) {
  const isEvent = item.dateStart !== undefined || item.location !== undefined;
  const { artistId, venueId, upcomingEventCount } = item;
  const hasProfile = artistId !== undefined || venueId !== undefined;

  // The artist sub-line is the count alone — the genre used to lead it, but the
  // profile pill leaves this column ~100px narrower than an event row and the pair
  // never fit: one or both ended up ellipsised on every real name. 0 is a real
  // answer here (the artist exists, they just have nothing booked), not a missing
  // value. `sublabel` still carries the genre for event rows and the API contract.
  const countLabel =
    upcomingEventCount === undefined
      ? undefined
      : upcomingEventCount === 0
        ? 'No upcoming events'
        : `${upcomingEventCount} upcoming event${upcomingEventCount === 1 ? '' : 's'}`;

  // The search zone reads differently per entity: an artist performs at events, a
  // venue hosts them, and an event row is just its own title.
  const searchLabel =
    artistId !== undefined
      ? `Show events by ${item.label}`
      : venueId !== undefined
        ? `Show events at ${item.label}`
        : `Search for ${item.label}`;

  // Two independent tap targets, not a row with a button inside it: the wrapper is
  // a plain View so each zone owns its own pressed state. Nesting them meant one
  // press dimmed the whole row, which is what hid the fact that there are two
  // destinations. min-h keeps the profile zone at the 48dp tap minimum.
  return (
    <View className="flex-row min-h-[48px]">
      <Pressable
        // Runs the name search — the feed drops the radius filter when a query is
        // present, so this surfaces ALL of the entity's events, near and far.
        onPress={() => onSelect(item.label)}
        accessibilityRole="button"
        accessibilityLabel={searchLabel}
        className="flex-1 flex-row items-center gap-3 active:opacity-60"
      >
        <Avatar uri={item.imageUrl} label={item.label} />
        <View className="flex-1 gap-1">
          <Text
            className="text-[15px] font-medium leading-5 text-[#080808] font-urbanist"
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {isEvent ? (
            <View className="flex-row items-center gap-2">
              {item.location ? (
                <Meta icon="location-outline" text={item.location} flexible />
              ) : null}
              {item.dateStart !== undefined ? (
                <Meta icon="calendar-outline" text={formatEventDate(item.dateStart)} />
              ) : null}
            </View>
          ) : countLabel ? (
            <Text
              className="text-[13px] font-semibold text-[#8D8D8D] font-urbanist"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {countLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {hasProfile ? (
        <>
          {/* hairlineWidth, not 0.5px: at density 1 Android rounds 0.5dp to 0 and the
              divider vanishes entirely. */}
          <View className="my-[10px] bg-[#E0E0E0]" style={{ width: StyleSheet.hairlineWidth }} />
          <Pressable
            // Straight to the profile, labelled in words because the icon alone
            // never read as a second destination. No hitSlop — it would spill into
            // the search zone and blur the split the divider is drawing.
            onPress={() => {
              if (artistId !== undefined) {
                router.push({ pathname: '/(app)/artist/[artistId]', params: { artistId } });
              } else if (venueId !== undefined) {
                router.push({ pathname: '/(app)/venue/[venueId]', params: { venueId } });
              }
            }}
            accessibilityRole="button"
            // Reads the entity name, not the visible "Profile" — otherwise every row
            // in the dropdown announces as the same undifferentiated control.
            accessibilityLabel={`View ${item.label} profile`}
            // Vertical only, so the tap target keeps the full 48dp row height while
            // the pill itself stays inset. Horizontal slop would spill into the
            // search zone and blur the very split this is drawing.
            hitSlop={{ top: 6, bottom: 6 }}
            android_ripple={{ color: '#DDCFFF', borderless: false }}
            // A filled pill, because a bare glyph at the row's right edge reads as an
            // iOS disclosure indicator — "tap anywhere on this row" — which is the
            // opposite of the point. The enclosing shape is what makes it a control.
            // Its own background also bounds the pressed state to the CTA edge.
            className="my-[6px] ml-3 flex-row items-center gap-1 rounded-full bg-[#F1ECFF] px-3 active:bg-[#DDCFFF]"
          >
            {/* Capped tighter than the row's content text: this is chrome, and at
                200% system text an uncapped label balloons the pill and swallows the
                column the genre and count live in. */}
            <Text
              className="text-[13px] font-semibold text-[#662fff] font-urbanist"
              maxFontSizeMultiplier={1.2}
            >
              Profile
            </Text>
            {/* "Opens somewhere else" rather than a direction: a chevron here would
                re-read as row disclosure, and person-* collides with the Profile tab
                glyph in the bottom nav. */}
            <Ionicons name="open-outline" size={13} color="#662fff" />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

/**
 * Autocomplete dropdown for the Discover search box. A white card that floats
 * over the feed (the caller overlays it with a scrim), listing artist, venue and
 * event matches as rich rows (avatar + name + a context line). Events show their
 * location and start time; artists/venues fall back to a muted sub-line.
 *
 * Returns null when there is nothing to show, so the caller can mount it
 * unconditionally while the box is focused.
 */
export function SearchSuggestions({
  artists,
  venues,
  events,
  isLoading,
  onSelect,
}: SearchSuggestionsProps) {
  const items: Suggestion[] = [...artists, ...venues, ...events];
  const hasResults = items.length > 0;

  if (!hasResults && !isLoading) return null;

  return (
    <View
      className="rounded-xl bg-white overflow-hidden"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.16,
        shadowRadius: 2,
        elevation: 4,
      }}
    >
      {isLoading && !hasResults ? (
        <View className="flex-row items-center gap-2 p-4">
          <ActivityIndicator size="small" color="#8D8D8D" />
          <Text className="text-[#8D8D8D] text-[13px] font-urbanist">Searching…</Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 320 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="p-4 gap-4">
            {items.map((item, index) => (
              <SuggestionRow key={`${item.label}-${index}`} item={item} onSelect={onSelect} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
