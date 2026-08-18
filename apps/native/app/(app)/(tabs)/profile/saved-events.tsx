import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { ProfileEventCard } from '@/components/ProfileEventCard';
import { VenueOnHoldEventCard } from '@/components/subscription/VenueOnHoldEventCard';
import { useSavedEvents } from '@/hooks/use-saved-events';

export default function SavedEventsScreen() {
  const { upcomingEvents, pastEvents, isLoading } = useSavedEvents();
  const [showPast, setShowPast] = useState(false);

  /**
   * One renderer for both lists.
   *
   * The upcoming and past lists previously repeated the same sixteen-line ternary with
   * a nine-prop ProfileEventCard written out twice, so a change to one would silently
   * miss the other — and the on-hold branch is exactly the sort of thing that gets
   * added to the list you happen to be looking at.
   *
   * V-03: an on-hold venue's event stays in the saved list, marked, with its detail
   * withheld — the spectator saved it deliberately, and having it silently vanish would
   * read as CeolX losing their plans (D-52).
   */
  const renderSavedEvent = (event: (typeof upcomingEvents)[number]) =>
    event.venueOnHold ? (
      <VenueOnHoldEventCard key={event.id} title={event.title} dateStart={event.dateStart} />
    ) : (
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
        onPress={() => router.push(`/(app)/(tabs)/profile/event/${event.id}`)}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <AppHeader leading="back" title="Saved Events" />

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
            {upcomingEvents.map(renderSavedEvent)}

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
                {showPast && pastEvents.map(renderSavedEvent)}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
