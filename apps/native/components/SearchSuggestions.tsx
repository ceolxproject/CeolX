import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

type Suggestion = { label: string; sublabel?: string };

type SuggestionGroup = { title: string; items: Suggestion[] };

type SearchSuggestionsProps = {
  artists: Suggestion[];
  venues: Suggestion[];
  events: Suggestion[];
  isLoading: boolean;
  onSelect: (label: string) => void;
};

/**
 * Grouped autocomplete dropdown for the Discover search box (cmdk-style:
 * uppercase group header + name rows with an optional muted sub-line). Renders
 * inline beneath the search bar. Returns null when there is nothing to show, so
 * the caller can mount it unconditionally while the box is focused.
 */
export function SearchSuggestions({
  artists,
  venues,
  events,
  isLoading,
  onSelect,
}: SearchSuggestionsProps) {
  const groups: SuggestionGroup[] = [
    { title: 'Artists', items: artists },
    { title: 'Venues', items: venues },
    { title: 'Events', items: events },
  ].filter((g) => g.items.length > 0);

  const hasResults = groups.length > 0;

  // Nothing to surface yet (and no spinner to show) → render nothing so the feed
  // below stays put.
  if (!hasResults && !isLoading) return null;

  return (
    <View className="mx-5 mt-2 rounded-2xl bg-[#141414] border border-white/10 overflow-hidden">
      {isLoading && !hasResults ? (
        <View className="flex-row items-center gap-2 px-4 py-3">
          <ActivityIndicator size="small" color="#C8FF2F" />
          <Text className="text-white/40 text-[13px] font-urbanist">Searching…</Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 320 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.title}>
              <Text className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-white/40 font-urbanist uppercase">
                {group.title}
              </Text>
              {group.items.map((item, index) => (
                <Pressable
                  key={`${group.title}-${item.label}-${index}`}
                  onPress={() => onSelect(item.label)}
                  className="px-4 py-2.5 active:bg-white/5"
                >
                  <Text className="text-white text-[15px] font-urbanist" numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.sublabel ? (
                    <Text
                      className="text-white/40 text-[12px] font-urbanist mt-0.5"
                      numberOfLines={1}
                    >
                      {item.sublabel}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
