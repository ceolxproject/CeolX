import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { ProfileEventCard } from '@/components/ProfileEventCard';

type ProfileEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: Date | string;
  dateEnd: Date | string | null;
  category: string;
  venueAddress: string | null;
  collectionName?: string | null;
};

type EventsTabProps = {
  upcomingEvents: ProfileEvent[];
  pastEvents: ProfileEvent[];
};

export function EventsTab({ upcomingEvents, pastEvents }: EventsTabProps) {
  if (upcomingEvents.length === 0 && pastEvents.length === 0) {
    return (
      <EmptyState
        variant="no-events"
        title="No events yet"
        subtitle="Events from this profile will appear here."
      />
    );
  }

  return (
    <View className="px-5 gap-4 pb-4">
      {upcomingEvents.length > 0 && (
        <>
          <Text className="text-sm font-semibold text-white/60 font-urbanist uppercase tracking-wide mt-2">
            Upcoming
          </Text>
          {upcomingEvents.map((event) => (
            <ProfileEventCard
              key={event.id}
              id={event.id}
              title={event.title}
              coverImage={event.coverImage}
              dateStart={new Date(event.dateStart).toISOString()}
              dateEnd={event.dateEnd ? new Date(event.dateEnd).toISOString() : null}
              category={event.category}
              venueAddress={event.venueAddress}
              collectionName={event.collectionName}
              onPress={() => router.push(`/(app)/events/${event.id}`)}
            />
          ))}
        </>
      )}

      {pastEvents.length > 0 && (
        <>
          <Text className="text-sm font-semibold text-white/60 font-urbanist uppercase tracking-wide mt-2">
            Past Events
          </Text>
          {pastEvents.map((event) => (
            <ProfileEventCard
              key={event.id}
              id={event.id}
              title={event.title}
              coverImage={event.coverImage}
              dateStart={new Date(event.dateStart).toISOString()}
              dateEnd={event.dateEnd ? new Date(event.dateEnd).toISOString() : null}
              category={event.category}
              venueAddress={event.venueAddress}
              collectionName={event.collectionName}
              onPress={() => router.push(`/(app)/events/${event.id}`)}
            />
          ))}
        </>
      )}
    </View>
  );
}
