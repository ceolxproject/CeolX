import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EventDetailSkeleton, EventDetailView } from '@/components/event-detail';
import { trpc } from '@/utils/trpc';

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isArtist = me?.currentRole === 'artist';

  const { data: event, isLoading } = useQuery(
    trpc.events.byId.queryOptions({ id: eventId ?? '' }, { enabled: !!eventId })
  );

  if (isLoading || !event) {
    return <EventDetailSkeleton />;
  }

  return (
    <EventDetailView
      event={event}
      isArtist={isArtist}
      onBack={() => router.back()}
      onNavigateToEvent={(id) => router.push(`/(app)/(tabs)/discover/event/${id}`)}
    />
  );
}
