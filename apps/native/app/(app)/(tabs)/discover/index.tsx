import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DateRangeOption, EventCategory } from '@CeolX/shared';
import { DATE_RANGE_LABELS, DATE_RANGE_OPTIONS, EVENT_CATEGORIES } from '@CeolX/shared';
import { UserRole } from '@CeolX/shared/enums';

import { AdStack } from '@/components/ads/AdStack';
import { FeedEventCard } from '@/components/FeedEventCard';
import { FeedHeader } from '@/components/FeedHeader';
import { FilterSheet } from '@/components/FilterSheet';
import type { FilterSection } from '@/components/FilterSheet';
import { PostsList } from '@/components/posts/PostsList';
import { SegmentToggle } from '@/components/SegmentToggle';
import { useFeedEvents } from '@/hooks/use-feed-events';
import { useFeedPosts } from '@/hooks/use-feed-posts';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useMe } from '@/hooks/use-me';
import { authClient } from '@/lib/auth-client';

const SEGMENTS = ['Events', 'Posts'];

const FEED_FILTER_SECTIONS: FilterSection[] = [
  { key: 'dateRange', label: 'When', options: DATE_RANGE_OPTIONS, labels: DATE_RANGE_LABELS },
  { key: 'category', label: 'Category', options: EVENT_CATEGORIES },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { initialRegion, locationSource, placeLabel } = useGpsRegion();
  const [activeSegment, setActiveSegment] = useState(0);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const isArtist = session?.user?.currentRole === UserRole.ARTIST;

  const { data: me } = useMe();

  const feedPosts = useFeedPosts({ enabled: activeSegment === 1 });

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
    dateRange,
    setDateRange,
  } = useFeedEvents({
    lat: initialRegion.latitude,
    lng: initialRegion.longitude,
    enabled: activeSegment === 0,
  });

  const [refreshing, setRefreshing] = useState(false);

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

  const handleFiltersApply = useCallback(
    (filters: Record<string, string | undefined>) => {
      setCategory(filters.category as EventCategory | undefined);
      setDateRange(filters.dateRange as DateRangeOption | undefined);
    },
    [setCategory, setDateRange]
  );

  const currentFilters: Record<string, string | undefined> = { category, dateRange };
  const hasActiveFilters = !!(category || dateRange);

  const locationText =
    placeLabel ??
    (locationSource === 'gps'
      ? 'Current Location'
      : locationSource === 'ip'
        ? 'Approximate Location'
        : 'Ireland');

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
      <FeedHeader
        locationText={locationText}
        onCalendarPress={() => setFilterSheetVisible(true)}
        onFilterPress={() => setFilterSheetVisible(true)}
        onNotificationPress={() => router.push('/notifications')}
      />

      {/* Search bar */}
      <View className="px-5 mt-3">
        <View className="flex-row items-center bg-[rgba(141,141,141,0.2)] rounded-full px-4 py-3 gap-3">
          <Ionicons name="search-outline" size={20} color="rgba(255,255,255,0.6)" />
          <TextInput
            placeholder="Find Music, Artist or Event"
            placeholderTextColor="rgba(255,255,255,0.6)"
            className="flex-1 text-sm text-white font-urbanist"
            onChangeText={onSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Segment toggle */}
      <View className="px-5 mt-4">
        <SegmentToggle segments={SEGMENTS} activeIndex={activeSegment} onPress={setActiveSegment} />
      </View>

      {/* Active filter indicator */}
      {hasActiveFilters && activeSegment === 0 && (
        <View className="flex-row items-center px-5 mt-2 gap-2">
          {dateRange && (
            <View className="flex-row items-center bg-[#C8FF2F]/20 border border-[#C8FF2F] rounded-full px-3 py-1 gap-1">
              <Ionicons name="calendar-outline" size={12} color="#C8FF2F" />
              <Text className="text-[11px] font-semibold text-[#C8FF2F] font-urbanist capitalize">
                {dateRange.replace(/_/g, ' ')}
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
          <Pressable onPress={() => handleFiltersApply({})}>
            <Text className="text-[11px] text-white/40 font-urbanist underline">Clear</Text>
          </Pressable>
        </View>
      )}

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
            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              style={{ flex: 1, backgroundColor: '#080808' }}
              renderItem={renderEvent}
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
                />
              }
              ListFooterComponent={
                isFetchingNextPage ? (
                  <ActivityIndicator size="small" color="#C8FF2F" className="my-6" />
                ) : null
              }
              ListEmptyComponent={
                <View className="items-center justify-center pt-16 px-8">
                  <Ionicons name="musical-notes-outline" size={48} color="rgba(255,255,255,0.2)" />
                  <Text className="text-white/40 text-center text-sm font-urbanist mt-4">
                    No events found. Try adjusting your filters or search.
                  </Text>
                </View>
              }
              contentContainerStyle={{
                flexGrow: 1,
                backgroundColor: '#080808',
                paddingTop: 16,
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

      {/* Posts tab content */}
      {activeSegment === 1 && (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#080808' }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={feedPosts.isFetchingNextPage}
              onRefresh={feedPosts.refresh}
              tintColor="#C8FF2F"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <PostsList
            posts={feedPosts.posts}
            isLoading={feedPosts.isLoading}
            isFetchingNextPage={feedPosts.isFetchingNextPage}
            hasNextPage={feedPosts.hasNextPage}
            currentUserId={me?.id ?? null}
            onLoadMore={feedPosts.loadMore}
            emptyMessage="No posts yet. Check back soon for updates from artists and venues."
          />
        </ScrollView>
      )}

      <FilterSheet
        visible={filterSheetVisible}
        filters={currentFilters}
        sections={FEED_FILTER_SECTIONS}
        variant="dark"
        onApply={handleFiltersApply}
        onClose={() => setFilterSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
