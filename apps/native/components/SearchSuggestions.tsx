import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

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

// Circular 42px avatar. Falls back to the label's initial on a muted disc when
// the entity has no uploaded image (most events/venues pre-launch).
function Avatar({ uri, label }: { uri?: string; label: string }) {
  if (uri) {
    return <Image source={{ uri }} className="size-[42px] rounded-full" />;
  }
  return (
    <View className="size-[42px] rounded-full bg-[#ECECEC] items-center justify-center">
      <Text className="text-[16px] font-bold text-[#8D8D8D] font-urbanist">
        {label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// A muted meta chip: a 12px icon + a short line. Used for an event's location
// and date.
function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={12} color="#8D8D8D" />
      <Text className="text-[12px] font-semibold text-[#8D8D8D] font-urbanist" numberOfLines={1}>
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
  const { artistId, venueId } = item;
  const isEntity = artistId !== undefined || venueId !== undefined;

  // Artist/venue rows open the profile directly — the only way to see ALL of an
  // entity's events, since a plain text search stays scoped to the location
  // radius and would hide events outside it. Event rows run the search instead.
  const handlePress = () => {
    if (artistId !== undefined) {
      router.push({ pathname: '/(app)/artist/[artistId]', params: { artistId } });
    } else if (venueId !== undefined) {
      router.push({ pathname: '/(app)/venue/[venueId]', params: { venueId } });
    } else {
      onSelect(item.label);
    }
  };

  return (
    <Pressable onPress={handlePress} className="flex-row items-center gap-3 active:opacity-60">
      <Avatar uri={item.imageUrl} label={item.label} />
      <View className="flex-1 gap-1">
        <Text
          className="text-[16px] font-bold leading-5 text-[#080808] font-urbanist"
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {isEvent ? (
          <View className="flex-row items-center gap-2">
            {item.location ? <Meta icon="location-outline" text={item.location} /> : null}
            {item.dateStart !== undefined ? (
              <Meta icon="calendar-outline" text={formatEventDate(item.dateStart)} />
            ) : null}
          </View>
        ) : item.sublabel ? (
          <Text
            className="text-[12px] font-semibold text-[#8D8D8D] font-urbanist"
            numberOfLines={1}
          >
            {item.sublabel}
          </Text>
        ) : null}
      </View>
      {isEntity ? (
        // Static affordance only — the whole row navigates, so this is not its
        // own tap target (a nested Pressable inside a Pressable is unreliable on
        // RN). The chevron signals the row opens the profile.
        <Ionicons name="chevron-forward" size={18} color="#8D8D8D" />
      ) : null}
    </Pressable>
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
