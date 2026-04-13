import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useSavedEvents } from '@/hooks/use-saved-events';
import { trpc } from '@/utils/trpc';

function SpectatorSavedEvents() {
  const { upcomingEvents, pastEvents, isLoading } = useSavedEvents();
  const [showPast, setShowPast] = useState(false);

  if (isLoading) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator color="#C8FF2F" />
      </View>
    );
  }

  if (upcomingEvents.length === 0 && pastEvents.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Ionicons name="bookmark-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text className="text-lg font-semibold text-white mt-4 mb-2">No saved events yet</Text>
        <Text className="text-sm text-white/60 text-center font-urbanist">
          Tap the heart icon on an event to save it here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
      <View className="gap-4 pb-8">
        {upcomingEvents.map((event) => (
          <ProfileEventCard
            key={event.id}
            id={event.id}
            title={event.title}
            coverImage={event.coverImage}
            dateStart={event.dateStart}
            dateEnd={event.dateEnd}
            category={event.category}
            venueAddress={event.venueAddress}
            onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
          />
        ))}

        {pastEvents.length > 0 && (
          <>
            <Pressable
              className="flex-row items-center justify-between py-2"
              onPress={() => setShowPast(!showPast)}
            >
              <Text className="text-sm font-semibold text-white/60 font-urbanist">
                Past Saved Events ({pastEvents.length})
              </Text>
              <Ionicons
                name={showPast ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="rgba(255,255,255,0.6)"
              />
            </Pressable>
            {showPast &&
              pastEvents.map((event) => (
                <ProfileEventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  coverImage={event.coverImage}
                  dateStart={event.dateStart}
                  dateEnd={event.dateEnd}
                  category={event.category}
                  venueAddress={event.venueAddress}
                  onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
                />
              ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function CreatorBookingsPlaceholder() {
  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-lg font-semibold text-white mb-2">No bookings yet</Text>
      <Text className="text-sm text-white/60 text-center">
        Your artist and venue bookings will appear here
      </Text>
    </View>
  );
}

export default function BookingsScreen() {
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const currentRole = me?.currentRole ?? 'spectator';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4 border-b border-gray-10">
        <Text className="text-2xl font-bold text-white">
          {currentRole === 'spectator' ? 'Bookings' : 'Requests'}
        </Text>
      </View>

      {currentRole === 'spectator' ? <SpectatorSavedEvents /> : <CreatorBookingsPlaceholder />}
    </SafeAreaView>
  );
}
