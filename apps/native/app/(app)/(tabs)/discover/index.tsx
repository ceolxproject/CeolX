import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedEventCard } from '@/components/FeedEventCard';
import { FeedFilterSheet } from '@/components/FeedFilterSheet';
import type { FeedFilters } from '@/components/FeedFilterSheet';
import { FeedHeader } from '@/components/FeedHeader';
import { SegmentToggle } from '@/components/SegmentToggle';
import { useFeedEvents } from '@/hooks/use-feed-events';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { authClient } from '@/lib/auth-client';

const SEGMENTS = ['Events', 'Posts'];

export default function DiscoverScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { initialRegion, locationSource } = useGpsRegion();
  const [activeSegment, setActiveSegment] = useState(0);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const isArtist = session?.user?.currentRole === 'artist';

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
    (filters: FeedFilters) => {
      setCategory(filters.category);
      setDateRange(filters.dateRange);
    },
    [setCategory, setDateRange]
  );

  const currentFilters: FeedFilters = { category, dateRange };
  const hasActiveFilters = !!(category || dateRange);

  const locationText =
    locationSource === 'gps'
      ? 'Current Location'
      : locationSource === 'ip'
        ? 'Approximate Location'
        : 'Ireland';

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

      {/* Posts tab content (placeholder) */}
      {activeSegment === 1 && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#080808',
          }}
        >
          <Ionicons name="chatbubbles-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text className="text-white/40 text-center text-sm font-urbanist mt-4">
            Posts coming soon
          </Text>
        </View>
      )}

      <FeedFilterSheet
        visible={filterSheetVisible}
        filters={currentFilters}
        onApply={handleFiltersApply}
        onClose={() => setFilterSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
