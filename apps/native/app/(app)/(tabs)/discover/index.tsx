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

import type { FeedEvent } from '@CeolX/shared';

import { CategoryFilterChips } from '@/components/CategoryFilterChips';
import { FeedEventCard } from '@/components/FeedEventCard';
import { FeedHeader } from '@/components/FeedHeader';
import { SegmentToggle } from '@/components/SegmentToggle';
import { useFeedEvents } from '@/hooks/use-feed-events';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useSaveEvent } from '@/hooks/use-save-event';
import { authClient } from '@/lib/auth-client';

const SEGMENTS = ['Events', 'Posts'];

export default function DiscoverScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { initialRegion, locationSource } = useGpsRegion();
  const [activeSegment, setActiveSegment] = useState(0);

  const isArtist = session?.user?.currentRole === 'artist';

  const {
    events,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    loadMore,
    refresh,
    category,
    setCategory,
    onSearch,
  } = useFeedEvents({
    lat: initialRegion.latitude,
    lng: initialRegion.longitude,
    enabled: activeSegment === 0,
  });

  const saveEvent = useSaveEvent();
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

  const handleSavePress = useCallback(
    (event: FeedEvent) => {
      saveEvent.mutate({ eventId: event.id, saved: !event.isSaved });
    },
    [saveEvent]
  );

  const locationText =
    locationSource === 'gps'
      ? 'Current Location'
      : locationSource === 'ip'
        ? 'Approximate Location'
        : 'Ireland';

  const renderEvent = useCallback(
    ({ item }: { item: FeedEvent }) => (
      <FeedEventCard
        event={item}
        onPress={() => handleEventPress(item.id)}
        onSavePress={() => handleSavePress(item)}
        isArtist={isArtist}
        className="mx-5 mb-4"
      />
    ),
    [handleEventPress, handleSavePress, isArtist]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#080808]" edges={['top']}>
      <FeedHeader locationText={locationText} />

      {/* Search bar */}
      <View className="px-5 mt-3">
        <View className="flex-row items-center bg-white/10 rounded-full px-4 py-3 gap-3">
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

      {/* Events tab content */}
      {activeSegment === 0 && (
        <>
          <CategoryFilterChips selected={category} onSelect={setCategory} className="mt-4" />

          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#C8FF2F" />
            </View>
          ) : isError ? (
            <View className="flex-1 items-center justify-center px-8">
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
                    No events nearby. Check back soon or search for a specific county.
                  </Text>
                </View>
              }
              contentContainerClassName="pt-4 pb-8"
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
        <View className="flex-1 items-center justify-center">
          <Ionicons name="chatbubbles-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text className="text-white/40 text-center text-sm font-urbanist mt-4">
            Posts coming soon
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
