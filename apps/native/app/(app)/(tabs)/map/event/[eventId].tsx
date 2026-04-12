import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { EventDetailSkeleton, EventDetailView } from '@/components/event-detail';
import { trpc } from '@/utils/trpc';

export default function MapEventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isArtist = me?.currentRole === 'artist';

  const { data: event, isLoading } = useQuery(
    trpc.events.byId.queryOptions({ id: eventId ?? '' }, { enabled: !!eventId })
  );

  const isOwner = !!(me?.id && event?.creator.id === me.id);

  const { mutate: archiveEvent } = useMutation(
    trpc.events.archive.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [['events', 'byId']] });
        Alert.alert('Archived', 'Your event has been archived.');
        router.back();
      },
    })
  );

  if (isLoading || !event) {
    return <EventDetailSkeleton />;
  }

  return (
    <EventDetailView
      event={event}
      isArtist={isArtist}
      isOwner={isOwner}
      onBack={() => router.back()}
      onNavigateToEvent={(id) => router.push(`/(app)/(tabs)/map/event/${id}`)}
      onEdit={() => router.push(`/(app)/events/edit/${event.id}`)}
      onArchive={() => archiveEvent({ id: event.id })}
    />
  );
}
