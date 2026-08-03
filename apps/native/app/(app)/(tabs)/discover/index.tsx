import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCategory } from '@CeolX/shared';
import { EVENT_CATEGORIES } from '@CeolX/shared';
import { UserRole } from '@CeolX/shared/enums';

import { AdStack } from '@/components/ads/AdStack';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { EmptyState } from '@/components/EmptyState';
import { FeedEventCard } from '@/components/FeedEventCard';
import { FeedHeader } from '@/components/FeedHeader';
import { FeedLocationSheet } from '@/components/FeedLocationSheet';
import { FilterSheet } from '@/components/FilterSheet';
import type { FilterSection } from '@/components/FilterSheet';
import { FeedPostsList } from '@/components/posts/FeedPostsList';
import { SearchSuggestions } from '@/components/SearchSuggestions';
import { SegmentToggle } from '@/components/SegmentToggle';
import { useLocationOverride } from '@/contexts/location-override-context';
import { useFeedEvents } from '@/hooks/use-feed-events';
import { useFeedPosts } from '@/hooks/use-feed-posts';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { prefetchImageRatios } from '@/hooks/use-image-ratio';
import { useMe } from '@/hooks/use-me';
import { useSearchSuggestions } from '@/hooks/use-search-suggestions';
import { useVenueFallback } from '@/hooks/use-venue-fallback';
import { authClient } from '@/lib/auth-client';
import { nextCollapseProgress } from '@/utils/collapsing-header';
import { resolveFeedLocation, type FeedLocation } from '@/utils/feed-location';

const SEGMENTS = ['Events', 'Posts'];

// One spec for every header collapse/reveal — scroll-driven and tab-switch —
// so the bar settles the same way however it was triggered.
const HEADER_ANIM = { duration: 260, easing: Easing.out(Easing.cubic) } as const;

// Date selection lives on the header's calendar button — the filter sheet is
// category-only.
const FEED_FILTER_SECTIONS: FilterSection[] = [
  { key: 'category', label: 'Category', options: EVENT_CATEGORIES, showIcons: true },
];

// Device-local YYYY-MM-DD. Avoids the UTC day-shift that toISOString() causes
// for users behind/ahead of UTC (it could store "yesterday" for a late pick).
function toLocalYmd(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function parseLocalYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const venueFallback = useVenueFallback();
  const { initialRegion, locationSource, placeLabel } = useGpsRegion(true, venueFallback);
  const [activeSegment, setActiveSegment] = useState(0);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  // The single search box drives whichever segment is active. Kept controlled so
  // we can clear it when switching tabs (Events and Posts search are separate).
  const [searchText, setSearchText] = useState('');
  // Drives the autocomplete dropdown: only visible while the box is focused.
  const [searchFocused, setSearchFocused] = useState(false);
  // A row tap blurs the input; delay hiding so the tap registers first.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Shared with the Map tab — a place pick on either screen syncs to the other.
  const {
    override: locationOverride,
    overrideKind,
    setOverride,
    clearOverride,
  } = useLocationOverride();
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);

  const effectiveLocation = resolveFeedLocation(
    locationOverride,
    initialRegion,
    placeLabel,
    locationSource
  );

  const isArtist = session?.user?.currentRole === UserRole.ARTIST;

  const { data: me } = useMe();

  const feedPosts = useFeedPosts({
    enabled: activeSegment === 1,
    lat: effectiveLocation.lat,
    lng: effectiveLocation.lng,
  });

  const {
    events,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    loadMore,
    refresh,
    onSearch,
    category,
    setCategory,
    date,
    setDate,
  } = useFeedEvents({
    lat: effectiveLocation.lat,
    lng: effectiveLocation.lng,
    enabled: activeSegment === 0,
  });

  const [refreshing, setRefreshing] = useState(false);

  const insets = useSafeAreaInsets();
  // Collapsing header. The whole top block (logo, location, search, tabs, filter
  // chips) is one absolutely-positioned unit that slides fully off the top on
  // scroll-down and returns on scroll-up — reading gets the entire screen. One
  // progress value (0 shown, 1 collapsed) drives it. onLayout feeds back the
  // header height (the feed's top padding) and the search bar's bottom (where the
  // autocomplete card anchors).
  const [headerHeight, setHeaderHeight] = useState(0);
  const [searchBottomY, setSearchBottomY] = useState(0);
  const lastScrollY = useSharedValue(0);
  const collapseProgress = useSharedValue(0);
  const collapseTargetSV = useSharedValue(0);
  const headerHeightSV = useSharedValue(0);
  const insetTop = insets.top;

  // The feed sits behind the header, padded down to clear it at rest.
  const contentPaddingTop = headerHeight + 16;

  const onHeaderLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setHeaderHeight(h);
      headerHeightSV.value = h;
    },
    [headerHeightSV]
  );

  const onSearchLayout = useCallback((e: LayoutChangeEvent) => {
    setSearchBottomY(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const target = nextCollapseProgress(
        y,
        lastScrollY.value,
        headerHeightSV.value,
        collapseTargetSV.value
      );
      // Only kick off a new animation when the target actually flips, so a long
      // scroll doesn't restart the tween on every frame.
      if (target !== collapseTargetSV.value) {
        collapseTargetSV.value = target;
        collapseProgress.value = withTiming(target, HEADER_ANIM);
      }
      lastScrollY.value = y;
    },
  });

  // Hide the whole header off the top of the screen — its own height plus the
  // status-bar inset, so nothing peeks into the status-bar strip when collapsed.
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(headerHeightSV.value + insetTop) * collapseProgress.value }],
  }));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleEventPress = useCallback(
    (eventId: string) => {
      router.push(`/(app)/(tabs)/discover/event/${eventId}`);
    },
    [router]
  );

  // Route keystrokes to the active segment's search. Each hook debounces
  // internally, so we just forward the raw text.
  const postsOnSearch = feedPosts.onSearch;
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (activeSegment === 0) onSearch(text);
      else postsOnSearch(text);
    },
    [activeSegment, onSearch, postsOnSearch]
  );

  // Autocomplete: the Events tab suggests artist/venue/event names, the Posts
  // tab artist/venue only. Disabled until the box is focused and non-empty.
  const suggestScope = activeSegment === 0 ? 'events' : 'posts';
  const suggestions = useSearchSuggestions(searchText, suggestScope, searchFocused);
  const showSuggestions = searchFocused && searchText.trim().length >= 1;
  // Only raise the scrim + floating card when there's actually something to
  // show, so an empty query never darkens the feed behind a missing card.
  const showSuggestionsOverlay = showSuggestions && (suggestions.isLoading || !suggestions.isEmpty);

  // Tapping a suggestion fills the box and runs the active tab's search, the
  // same path as typing it by hand, then dismisses the dropdown.
  const handleSuggestionSelect = useCallback(
    (label: string) => {
      handleSearchChange(label);
      setSearchFocused(false);
      Keyboard.dismiss();
    },
    [handleSearchChange]
  );

  const handleSearchFocus = useCallback(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => setSearchFocused(false), 150);
  }, []);

  // Events and Posts keep independent searches — clear the box and reset both
  // feeds when toggling so a query meant for one tab never leaks into the other.
  const handleSegmentChange = useCallback(
    (index: number) => {
      setActiveSegment(index);
      setSearchText('');
      onSearch('');
      postsOnSearch('');
      // Land the new tab at the top with the header visible.
      lastScrollY.value = 0;
      collapseTargetSV.value = 0;
      collapseProgress.value = withTiming(0, HEADER_ANIM);
    },
    [onSearch, postsOnSearch, lastScrollY, collapseTargetSV, collapseProgress]
  );

  const handleFiltersApply = useCallback(
    (filters: Record<string, string | undefined>) => {
      setCategory(filters.category as EventCategory | undefined);
    },
    [setCategory]
  );

  const currentFilters: Record<string, string | undefined> = { category };
  const hasActiveFilters = !!(category || date);

  const handleDateSelect = useCallback(
    (picked: Date) => {
      setDate(toLocalYmd(picked));
      setDatePickerVisible(false);
    },
    [setDate]
  );

  const handleDateClear = useCallback(() => {
    setDate(undefined);
    setDatePickerVisible(false);
  }, [setDate]);

  const handleLocationConfirm = useCallback(
    (loc: FeedLocation) => {
      // A pick from the sheet is a temporary search — not the saved/default.
      setOverride(loc, 'search');
      setLocationSheetVisible(false);
    },
    [setOverride]
  );

  const locationText = effectiveLocation.label;

  // Event cards size themselves to each poster's ratio, so measure a page of
  // covers as it arrives rather than letting the cards resize under the scroll.
  useEffect(() => {
    prefetchImageRatios(events.map((event) => event.coverImageUrl));
  }, [events]);

  const renderEvent = useCallback(
    ({ item }: { item: (typeof events)[number] }) => (
      <FeedEventCard
        event={item}
        onPress={() => handleEventPress(item.id)}
        isArtist={isArtist}
        className="mx-5 mb-4"
      />
    ),
    [handleEventPress, isArtist]
  );

  return (
    <SafeAreaView
      className="flex-1 bg-[#080808]"
      style={{ flex: 1, backgroundColor: '#080808' }}
      edges={['top']}
    >
      <View className="flex-1 relative" style={{ backgroundColor: '#080808' }}>
        {/* Collapsing header — logo, location, search, tabs and filter chips as
            one unit. Slides fully off the top on scroll-down (its own height +
            the status-bar inset) and returns on scroll-up. Absolute; the feed
            scrolls under it and is padded down by its measured height. */}
        <Animated.View
          onLayout={onHeaderLayout}
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 30,
              backgroundColor: '#080808',
            },
            headerAnimatedStyle,
          ]}
          className="pb-3"
        >
          <FeedHeader
            locationText={locationText}
            locationIsSearch={overrideKind === 'search'}
            onLocationReset={clearOverride}
            onLocationPress={() => setLocationSheetVisible(true)}
            onCalendarPress={() => setDatePickerVisible(true)}
            onFilterPress={() => setFilterSheetVisible(true)}
            onNotificationPress={() => router.push('/notifications')}
            calendarActive={activeSegment === 0 && !!date}
            filterActive={activeSegment === 0 && !!category}
            showEventActions={activeSegment === 0}
            showLocation={activeSegment === 0}
          />

          {/* Search bar */}
          <View className="px-5 mt-3" onLayout={onSearchLayout}>
            <View className="flex-row items-center bg-[rgba(141,141,141,0.2)] rounded-full px-4 py-[7px] gap-3">
              <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.6)" />
              <TextInput
                value={searchText}
                placeholder={
                  activeSegment === 1
                    ? 'Search posts by author or caption'
                    : 'Find Music, Artist, Venue or Event'
                }
                placeholderTextColor="rgba(255,255,255,0.6)"
                className="flex-1 text-[14px] text-white font-urbanist"
                onChangeText={handleSearchChange}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                onSubmitEditing={() => setSearchFocused(false)}
                returnKeyType="search"
              />
              {searchText.length > 0 ? (
                <Pressable
                  onPress={() => handleSearchChange('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Segment toggle */}
          <View className="px-5 mt-4">
            <SegmentToggle
              segments={SEGMENTS}
              activeIndex={activeSegment}
              onPress={handleSegmentChange}
            />
          </View>

          {/* Search result indicator — shows the committed query once the box is
              blurred (typing shows the autocomplete instead). Applies to both tabs. */}
          {searchText.trim().length > 0 && !searchFocused && (
            <View className="px-5 mt-2">
              <Text className="text-[13px] text-white/50 font-urbanist" numberOfLines={1}>
                Showing results for{' '}
                <Text className="text-white/80 font-semibold">“{searchText.trim()}”</Text>
              </Text>
            </View>
          )}

          {/* Active filter indicator */}
          {hasActiveFilters && activeSegment === 0 && (
            <View className="flex-row items-center px-5 mt-3 gap-2">
              {date && (
                <View className="flex-row items-center bg-[#C8FF2F]/20 border border-[#C8FF2F] rounded-full px-3 py-1 gap-1">
                  <Ionicons name="calendar-outline" size={12} color="#C8FF2F" />
                  <Text className="text-[11px] font-semibold text-[#C8FF2F] font-urbanist">
                    {parseLocalYmd(date).toLocaleDateString('en-IE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              )}
              {category && (
                <View className="flex-row items-center bg-[#C8FF2F]/20 border border-[#C8FF2F] rounded-full px-3 py-1 gap-1">
                  <Ionicons name="musical-note-outline" size={12} color="#C8FF2F" />
                  <Text className="text-[11px] font-semibold text-[#C8FF2F] font-urbanist">
                    {category}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  handleFiltersApply({});
                  setDate(undefined);
                }}
              >
                <Text className="text-[11px] text-white/40 font-urbanist underline">Clear</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Events tab content */}
        {activeSegment === 0 && (
          <>
            {isLoading ? (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#080808',
                }}
              >
                <ActivityIndicator size="large" color="#C8FF2F" />
              </View>
            ) : isError ? (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 32,
                  backgroundColor: '#080808',
                }}
              >
                <Text className="text-white/60 text-center text-sm font-urbanist">
                  Something went wrong loading events.
                </Text>
                <Pressable
                  onPress={handleRefresh}
                  className="mt-4 bg-[#C8FF2F] rounded-full px-6 py-2"
                >
                  <Text className="text-black font-semibold text-sm font-urbanist">Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Animated.FlatList
                data={events}
                keyExtractor={(item) => item.id}
                style={{ flex: 1, backgroundColor: '#080808' }}
                renderItem={renderEvent}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                ListHeaderComponent={<AdStack />}
                onEndReached={() => {
                  if (hasNextPage) loadMore();
                }}
                onEndReachedThreshold={0.5}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor="#C8FF2F"
                    progressViewOffset={contentPaddingTop}
                  />
                }
                ListFooterComponent={
                  isFetchingNextPage ? (
                    <ActivityIndicator size="small" color="#C8FF2F" className="my-6" />
                  ) : null
                }
                ListEmptyComponent={
                  // Offers Posts rather than switching tabs on the user's behalf: an
                  // empty Events list is information (wrong location, or filters too
                  // narrow) and silently moving them hides the cause. Same pattern as
                  // MapEmptyStateCard's "Browse all upcoming events". The CTA reuses
                  // handleSegmentChange so it behaves exactly like tapping Posts.
                  <EmptyState
                    variant="no-events"
                    title="No events found"
                    subtitle="Try adjusting your filters or search."
                    cta={{
                      label: 'Browse posts instead',
                      onPress: () => handleSegmentChange(1),
                    }}
                  />
                }
                contentContainerStyle={{
                  flexGrow: 1,
                  backgroundColor: '#080808',
                  paddingTop: contentPaddingTop,
                  paddingBottom: 32,
                }}
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}

        {/* Posts tab content — a real FlatList (not a ScrollView) so videos can
          reels-autoplay as they scroll into view. */}
        {activeSegment === 1 && (
          <FeedPostsList
            posts={feedPosts.posts}
            isLoading={feedPosts.isLoading}
            isFetchingNextPage={feedPosts.isFetchingNextPage}
            isError={feedPosts.isError}
            onRetry={feedPosts.refresh}
            hasNextPage={feedPosts.hasNextPage}
            currentUserId={me?.id ?? null}
            onLoadMore={feedPosts.loadMore}
            refreshing={feedPosts.isFetchingNextPage}
            onRefresh={feedPosts.refresh}
            onScroll={scrollHandler}
            contentPaddingTop={contentPaddingTop}
            emptyMessage={
              searchText.trim()
                ? `No posts match "${searchText.trim()}".`
                : 'No posts yet. Check back soon for updates from artists and venues.'
            }
          />
        )}

        {/* Autocomplete overlay — a dim scrim + floating card anchored to the
            search bar's bottom. Both sit above the header (zIndex > 30) so the
            search box stays bright while everything below it dims. Only shown
            while the box is focused, i.e. when the header is fully visible. */}
        {showSuggestionsOverlay && (
          <>
            <Pressable
              className="absolute left-0 right-0 bottom-0 bg-black/50"
              style={{ top: searchBottomY, zIndex: 31 }}
              onPress={() => {
                setSearchFocused(false);
                Keyboard.dismiss();
              }}
            />
            <View
              className="absolute left-0 right-0 px-5"
              style={{ top: searchBottomY + 4, zIndex: 32 }}
            >
              <SearchSuggestions
                artists={suggestions.artists}
                venues={suggestions.venues}
                events={suggestions.events}
                isLoading={suggestions.isLoading}
                onSelect={handleSuggestionSelect}
              />
            </View>
          </>
        )}
      </View>

      <FilterSheet
        visible={filterSheetVisible}
        filters={currentFilters}
        sections={FEED_FILTER_SECTIONS}
        onApply={handleFiltersApply}
        onClose={() => setFilterSheetVisible(false)}
      />

      <DatePickerSheet
        visible={datePickerVisible}
        value={date ? parseLocalYmd(date) : null}
        minimumDate={new Date()}
        onSelect={handleDateSelect}
        onClear={handleDateClear}
        onClose={() => setDatePickerVisible(false)}
      />

      <FeedLocationSheet
        visible={locationSheetVisible}
        initialLat={effectiveLocation.lat}
        initialLng={effectiveLocation.lng}
        onConfirm={handleLocationConfirm}
        onClose={() => setLocationSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
