import { useLocalSearchParams, useRouter } from 'expo-router';

import { UserRole } from '@CeolX/shared/enums';

import { EventDetailSkeleton } from './EventDetailSkeleton';
import { EventDetailView } from './EventDetailView';

import { useArchiveEvent } from '@/hooks/use-archive-event';
import { useEventById } from '@/hooks/use-event-by-id';
import { useMe } from '@/hooks/use-me';

interface EventDetailScreenProps {
  /** Tab route prefix for related-event navigation, e.g. "/(app)/(tabs)/discover/event" */
  tabEventRoute: string;
}

export function EventDetailScreen({ tabEventRoute }: EventDetailScreenProps) {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();

  const { data: me } = useMe();
  const isArtist = me?.currentRole === UserRole.ARTIST;

  const { data: event, isLoading } = useEventById({ id: eventId ?? '' });

  const isOwner = !!(me?.id && event?.creator.id === me.id);

  const { mutate: archiveEvent } = useArchiveEvent({ onSuccess: () => router.back() });

  if (isLoading || !event) {
    return <EventDetailSkeleton />;
  }

  return (
    <EventDetailView
      event={event}
      isArtist={isArtist}
      isOwner={isOwner}
      userId={me?.id}
      onBack={() => router.back()}
      onNavigateToEvent={(id) => router.push(`${tabEventRoute}/${id}`)}
      onEdit={() => router.push(`/(app)/events/edit/${event.id}`)}
      onArchive={() => archiveEvent({ id: event.id })}
    />
  );
}
