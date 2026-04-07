import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { EventCard } from './EventCard';

interface EventPreviewCardProps {
  event: {
    id: string;
    title: string;
    category: string;
    dateStart: string; // ISO 8601
    venueAddress?: string;
    coverImageUrl?: string;
  };
}

// Format ISO date to readable string: "Sat, 12 Jul · 8:00 PM"
function formatEventDate(isoString: string): string {
  const date = new Date(isoString);
  return (
    date.toLocaleDateString('en-IE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' · ' +
    date.toLocaleTimeString('en-IE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

export function EventPreviewCard({ event }: EventPreviewCardProps) {
  const router = useRouter();

  return (
    <View className="py-2">
      <EventCard
        title={event.title}
        date={formatEventDate(event.dateStart)}
        venueName={event.venueAddress ?? 'Venue TBA'}
        category={event.category}
        coverImageUri={event.coverImageUrl}
        onPress={() => router.push(`/(app)/(tabs)/map/event/${event.id}`)}
      />
    </View>
  );
}
