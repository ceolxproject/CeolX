import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { EventDetailSkeleton } from './EventDetailSkeleton';
import { EventDetailView } from './EventDetailView';

import { AppHeader } from '@/components/AppHeader';
import { useArchiveEvent } from '@/hooks/use-archive-event';
import { useEventById } from '@/hooks/use-event-by-id';
import { useMe } from '@/hooks/use-me';

interface EventDetailScreenProps {
  /**
   * Tab route prefix for related-event navigation. Typed as the exact set of
   * mount points so `${tabEventRoute}/${id}` stays a valid expo-router Href
   * under typedRoutes (a bare string widens to `${string}/${string}`).
   */
  tabEventRoute:
    | '/(app)/(tabs)/discover/event'
    | '/(app)/(tabs)/bookings/event'
    | '/(app)/(tabs)/map/event'
    | '/(app)/(tabs)/profile/event'
    | '/(app)/events';
}

export function EventDetailScreen({ tabEventRoute }: EventDetailScreenProps) {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: me } = useMe();
  const isArtist = me?.currentRole === UserRole.ARTIST;

  const { data: event, isLoading, isError, refetch } = useEventById({ id: eventId ?? '' });

  const isOwner = !!(me?.id && event?.creator.id === me.id);

  const { mutate: archiveEvent } = useArchiveEvent({ onSuccess: () => router.back() });

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  // A failed fetch (e.g. server error) must surface instead of looping the
  // skeleton forever — show a recoverable error state with a retry.
  if (isError || !event) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <AppHeader leading="back" title="Event" bgClassName="bg-background" showBell />
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-base text-white/60 text-center font-urbanist">
            We couldn’t load this event. Please try again.
          </Text>
          <Pressable
            onPress={() => refetch()}
            className="rounded-full bg-green-10 px-6 py-3 active:opacity-90"
            hitSlop={8}
          >
            <Text className="text-xs font-bold uppercase tracking-widest text-black font-urbanist">
              Try again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <EventDetailView
      event={event}
      isArtist={isArtist}
      isOwner={isOwner}
      userId={me?.id}
      onNavigateToEvent={(id) => router.push(`${tabEventRoute}/${id}`)}
      onEdit={() => router.push(`/(app)/events/edit/${event.id}`)}
      onArchive={() => archiveEvent({ id: event.id })}
    />
  );
}
