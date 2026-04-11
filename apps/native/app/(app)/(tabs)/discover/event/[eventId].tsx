import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EventDetailSkeleton, EventDetailView } from '@/components/event-detail';
import { MOCK_EVENT_DETAIL } from '@/mocks/event-detail';
import { trpc } from '@/utils/trpc';

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isArtist = me?.currentRole === 'artist';

  // TODO: Replace mock data with real API call when events.byId is implemented
  // const { data: event, isLoading } = trpc.events.byId.useQuery({ id: eventId });
  const event = { ...MOCK_EVENT_DETAIL, id: eventId ?? MOCK_EVENT_DETAIL.id };
  const isLoading = false;

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
