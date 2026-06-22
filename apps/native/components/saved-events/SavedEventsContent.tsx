import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useSavedEvents } from '@/hooks/use-saved-events';

export function SavedEventsContent() {
  const { upcomingEvents, pastEvents, isLoading } = useSavedEvents();
  const [showPast, setShowPast] = useState(false);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#C8FF2F" />
      </View>
    );
  }

  if (upcomingEvents.length === 0 && pastEvents.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="bookmark-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text className="text-base text-white/60 text-center mt-4 font-urbanist">
          You haven't saved any events yet.{'\n'}Tap the bookmark icon on an event to save it.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
      <View className="gap-4 pb-8 pt-2">
        {upcomingEvents.length > 0 && (
          <Text className="text-base font-bold text-white font-urbanist">Upcoming</Text>
        )}
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
            collectionName={event.collectionName}
            onPress={() => router.push(`/(app)/(tabs)/bookings/event/${event.id}`)}
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
                  collectionName={event.collectionName}
                  onPress={() => router.push(`/(app)/(tabs)/bookings/event/${event.id}`)}
                />
              ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}
