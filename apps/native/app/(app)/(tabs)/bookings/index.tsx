import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BookingSummary } from '@CeolX/shared';
import { BookingStatus } from '@CeolX/shared/enums';

import { EmptyRequests } from '@/components/requests/EmptyRequests';
import { RequestCard } from '@/components/requests/RequestCard';
import { SegmentToggle } from '@/components/SegmentToggle';
import { useBookings } from '@/hooks/use-bookings';
import { useUpdateBooking } from '@/hooks/use-update-booking';
import { authClient } from '@/lib/auth-client';

const SEGMENTS = ['Sent', 'Received'];

export default function RequestsScreen() {
  const { data: session } = authClient.useSession();
  const userRole = (session?.user?.currentRole ?? 'spectator') as 'artist' | 'venue';
  const [activeSegment, setActiveSegment] = useState(0);
  const tab = activeSegment === 0 ? 'sent' : 'received';

  const { bookings, isLoading, isFetchingNextPage, isError, hasNextPage, loadMore, refresh } =
    useBookings({ tab });

  const updateBooking = useUpdateBooking();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleUpdate = useCallback(
    async (id: string, status: 'accepted' | 'rejected' | 'cancelled') => {
      setUpdatingId(id);
      try {
        await updateBooking.mutateAsync({ id, status });
      } finally {
        setUpdatingId(null);
      }
    },
    [updateBooking]
  );

  const renderBooking = useCallback(
    ({ item }: { item: BookingSummary }) => (
      <RequestCard
        booking={item}
        userRole={userRole}
        onAccept={() => handleUpdate(item.id, BookingStatus.ACCEPTED)}
        onReject={() => handleUpdate(item.id, BookingStatus.REJECTED)}
        onWithdraw={() => handleUpdate(item.id, BookingStatus.CANCELLED)}
        onCancel={() => handleUpdate(item.id, BookingStatus.CANCELLED)}
        isUpdating={updatingId === item.id}
        className="mx-5 mb-4"
      />
    ),
    [userRole, handleUpdate, updatingId]
  );

  return (
    <SafeAreaView
      className="flex-1 bg-[#080808]"
      style={{ flex: 1, backgroundColor: '#080808' }}
      edges={['top']}
    >
      {/* Header */}
      <View className="px-5 pt-2 pb-3">
        <Text className="text-2xl font-bold text-white font-urbanist">Requests</Text>
      </View>

      {/* Segment toggle */}
      <View className="px-5 mb-4">
        <SegmentToggle segments={SEGMENTS} activeIndex={activeSegment} onPress={setActiveSegment} />
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C8FF2F" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-white/60 text-center text-sm font-urbanist">
            Something went wrong loading requests.
          </Text>
          <Pressable onPress={handleRefresh} className="mt-4 bg-[#C8FF2F] rounded-full px-6 py-2">
            <Text className="text-black font-semibold text-sm font-urbanist">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, backgroundColor: '#080808' }}
          renderItem={renderBooking}
          onEndReached={() => {
            if (hasNextPage) loadMore();
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#C8FF2F" />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#C8FF2F" className="my-6" />
            ) : null
          }
          ListEmptyComponent={<EmptyRequests tab={tab} />}
          contentContainerStyle={{
            flexGrow: 1,
            backgroundColor: '#080808',
            paddingTop: 4,
            paddingBottom: 32,
          }}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
