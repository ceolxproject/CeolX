import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useSavedEvents } from '@/hooks/use-saved-events';

export default function SavedEventsScreen() {
  const { upcomingEvents, pastEvents, isLoading } = useSavedEvents();
  const [showPast, setShowPast] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header */}
      <View className="flex-row items-center px-5 h-14">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text className="text-lg font-bold text-white font-urbanist flex-1">Saved Events</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color="#C8FF2F" />
          </View>
        ) : upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="bookmark-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text className="text-base text-white/60 text-center mt-4 font-urbanist">
              You haven't saved any events yet.{'\n'}Tap the heart icon on an event to save it.
            </Text>
          </View>
        ) : (
          <View className="gap-4 pb-8">
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
