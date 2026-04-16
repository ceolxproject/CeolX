import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ProfileEventCard } from '@/components/ProfileEventCard';

type ProfileEvent = {
  id: string;
  title: string;
  coverImage: string | null;
  dateStart: Date | string;
  dateEnd: Date | string | null;
  category: string;
  venueAddress: string | null;
};

type EventsTabProps = {
  upcomingEvents: ProfileEvent[];
  pastEvents: ProfileEvent[];
};

export function EventsTab({ upcomingEvents, pastEvents }: EventsTabProps) {
  if (upcomingEvents.length === 0 && pastEvents.length === 0) {
    return (
      <View className="py-16 items-center">
        <Text className="text-base text-white/60 text-center font-urbanist">No events yet</Text>
      </View>
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
              onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
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
              status="archived"
              onPress={() => router.push(`/(app)/(tabs)/discover/event/${event.id}`)}
            />
          ))}
        </>
      )}
    </View>
  );
}
