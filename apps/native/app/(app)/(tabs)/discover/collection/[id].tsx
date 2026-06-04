import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventStatus } from '@CeolX/shared/enums';

import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useCollection } from '@/hooks/use-collections';

/**
 * Read-only public view of a venue's collection, reached via the "See All"
 * button in the "Explore the collection" section of an event detail page.
 *
 * Unlike profile/collection/[id] (the venue owner's management screen), this
 * has no edit/delete chrome and only surfaces ACTIVE events — collections.byId
 * returns events of every status, but draft/removed/archived events must never
 * be shown to the public. (Asana 1215411208753153)
 */
export default function PublicCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: collection, isLoading } = useCollection(id);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-row items-center px-5 h-14">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-bold text-white font-urbanist">Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeEvents = collection.events.filter((e) => e.status === EventStatus.ACTIVE);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header */}
      <View className="flex-row items-center px-5 h-14">
        <Pressable onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-white font-urbanist" numberOfLines={1}>
          {collection.name}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Description */}
        {collection.description ? (
          <Text className="text-sm text-white/60 mb-4 font-urbanist">{collection.description}</Text>
        ) : null}

        {/* Event count */}
        <Text className="text-xs text-white/40 mb-4 font-urbanist">
          {activeEvents.length} event{activeEvents.length !== 1 ? 's' : ''}
        </Text>

        {/* Events list */}
        {activeEvents.length === 0 ? (
          <View className="py-12 items-center">
            <Text className="text-sm text-white/60 text-center font-urbanist">
              No events in this collection yet.
            </Text>
          </View>
        ) : (
          <View className="gap-4 pb-8">
            {activeEvents.map((event) => (
              <ProfileEventCard
                key={event.id}
                id={event.id}
                title={event.title}
                coverImage={event.coverImage}
                dateStart={event.dateStart}
                category={event.category}
                venueAddress={event.venueAddress}
                status={event.status}
                onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
