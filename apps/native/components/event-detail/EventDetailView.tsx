import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceBetween } from '@CeolX/shared';
import { EventStatus, UserRole } from '@CeolX/shared/enums';

import { CategoryBadge } from './CategoryBadge';
import { CollectionEventCard } from './CollectionEventCard';
import { DescriptionSection } from './DescriptionSection';
import { EventDetailHeader } from './EventDetailHeader';
import { EventHeroImage } from './EventHeroImage';
import { EventInfoRow } from './EventInfoRow';
import { HostArtistInfoBox } from './HostArtistInfoBox';
import { LocationMapPreview } from './LocationMapPreview';
import { OwnerActionBar } from './OwnerActionBar';
import { PerformingArtistCard } from './PerformingArtistCard';
import { SectionDivider } from './SectionDivider';
import { StickyBottomBar } from './StickyBottomBar';

import { useGpsRegion } from '@/hooks/use-gps-region';
import { useRequestToPerform } from '@/hooks/use-request-to-perform';
import { useSaveEvent } from '@/hooks/use-save-event';
import type { EventDetailData } from '@/types/event-detail';

interface EventDetailViewProps {
  event: EventDetailData;
  isArtist: boolean;
  isOwner: boolean;
  userId?: string;
  onBack: () => void;
  onNavigateToEvent: (eventId: string) => void;
  onEdit: () => void;
  onArchive: () => void;
}

export function EventDetailView({
  event,
  isArtist,
  isOwner,
  userId,
  onBack,
  onNavigateToEvent,
  onEdit,
  onArchive,
}: EventDetailViewProps) {
  const insets = useSafeAreaInsets();
  const [isSaved, setIsSaved] = useState(event.isSaved);
  const { initialRegion, locationSource } = useGpsRegion();
  const { mutate: saveEvent } = useSaveEvent();
  const { requestToPerform, isRequesting, hasRequested } = useRequestToPerform();

  const distanceKm = useMemo(() => {
    if (locationSource === 'pending') return undefined;
    return distanceBetween(initialRegion.latitude, initialRegion.longitude, event.lat, event.lng);
  }, [initialRegion.latitude, initialRegion.longitude, event.lat, event.lng, locationSource]);

  const isCollaborator = useMemo(
    () => !!userId && event.collaborators.some((c) => c.id === userId),
    [userId, event.collaborators]
  );

  const handleToggleSave = () => {
    const newSaved = !isSaved;
    setIsSaved(newSaved); // optimistic update
    saveEvent({ eventId: event.id, saved: newSaved }, { onError: () => setIsSaved(isSaved) });
  };

  const handleRequestToPerform = () => {
    requestToPerform(event.id);
  };

  const handleAddToCalendar = () => {
    const start = new Date(event.dateStart);
    const end = event.dateEnd
      ? new Date(event.dateEnd)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const startISO = start.toISOString().replace(/-|:|\.\d{3}/g, '');
    const endISO = end.toISOString().replace(/-|:|\.\d{3}/g, '');
    const location = event.venueAddress ?? `${event.lat},${event.lng}`;

    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startISO}/${endISO}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(event.description.slice(0, 200))}`;
    void Linking.openURL(url);
  };

  const handleViewMap = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${event.lat},${event.lng}`,
      android: `google.navigation:q=${event.lat},${event.lng}`,
    });
    if (url) void Linking.openURL(url);
  };

  const formattedDate = formatDetailDate(event.dateStart);
  const formattedTime = formatDetailTime(event.dateStart, event.dateEnd ?? undefined);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Header */}
        <EventDetailHeader onBack={onBack} isSaved={isSaved} onToggleSave={handleToggleSave} />

        {/* Hero Image */}
        <EventHeroImage
          coverImageUrl={event.coverImageUrl ?? undefined}
          attendeeCount={event.attendeeCount}
        />

        {/* Category badge overlapping image */}
        <CategoryBadge category={event.category} className="ml-4 -mt-6 z-10" />

        {/* Removal reason banner — visible to owner when admin removed */}
        {isOwner && event.status === EventStatus.REMOVED && event.removalReason && (
          <View className="mx-4 mt-3 rounded-lg bg-red-900/30 px-4 py-3">
            <Text className="mb-1 text-sm font-semibold text-red-400 font-urbanist">
              This event was removed by admin
            </Text>
            <Text className="text-sm text-red-300 font-urbanist">{event.removalReason}</Text>
            <Text className="mt-1 text-xs text-white/60 font-urbanist">
              Edit and save to resubmit as active.
            </Text>
          </View>
        )}

        {/* Main content */}
        <View className="px-4 gap-7">
          {/* Title */}
          <Text className="text-[28px] font-bold text-white font-urbanist mt-3 leading-8">
            {event.title}
          </Text>

          {/* Host & Artist info */}
          <HostArtistInfoBox
            creator={event.creator}
            collaborators={event.collaborators}
            onViewAll={event.collaborators.length > 3 ? () => {} : undefined}
            onPressCreator={(creator) => {
              if (creator.type === UserRole.ARTIST) {
                router.push(`/(app)/(tabs)/map/artist/${creator.id}`);
              } else if (creator.type === UserRole.VENUE) {
                router.push(`/(app)/(tabs)/map/venue/${creator.id}`);
              }
            }}
            onPressArtist={(artistId) => {
              router.push(`/(app)/(tabs)/map/artist/${artistId}`);
            }}
          />

          {/* Ticket Price */}
          {event.ticketPrice !== undefined && event.ticketPrice !== null && (
            <Text className="text-white font-urbanist">
              <Text className="text-lg text-gray-7">Ticket Price: </Text>
              <Text className="text-xl font-bold">€{(event.ticketPrice / 100).toFixed(0)}</Text>
            </Text>
          )}

          {/* Description */}
          <DescriptionSection description={event.description} />

          {/* Date / Time */}
          <View className="gap-4">
            <EventInfoRow
              icon="calendar-outline"
              title={formattedDate}
              subtitle={formattedTime}
              actionLabel="Add to calendar"
              onAction={handleAddToCalendar}
            />

            {/* Location */}
            <EventInfoRow
              icon="location-outline"
              title={event.venueAddress?.split(',')[0] ?? 'Venue TBC'}
              subtitle={event.venueAddress ?? `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}
              actionLabel="View map"
              onAction={handleViewMap}
              onTitlePress={
                event.venueUserId
                  ? () => router.push(`/(app)/(tabs)/map/venue/${event.venueUserId}`)
                  : undefined
              }
            />
          </View>
        </View>

        {/* Performing Artists */}
        {event.collaborators.length > 0 && (
          <>
            <SectionDivider className="mx-4" />
            <Text className="text-xl font-bold text-white font-urbanist px-4 mb-4">
              Performing Artist
            </Text>
            <FlatList
              horizontal
              data={event.collaborators}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PerformingArtistCard
                  artist={item}
                  onPress={() => router.push(`/(app)/(tabs)/map/artist/${item.id}`)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              scrollEnabled={event.collaborators.length > 2}
            />
          </>
        )}

        {/* Location Map */}
        <SectionDivider className="mx-4" />
        <View className="px-4">
          <LocationMapPreview
            lat={event.lat}
            lng={event.lng}
            venueAddress={event.venueAddress ?? undefined}
            distanceKm={distanceKm}
          />
        </View>

        {/* Explore the collection */}
        {event.relatedEvents.length > 0 && (
          <>
            <SectionDivider className="mx-4" />
            <View className="flex-row items-center justify-between px-4 mb-4">
              <Text className="text-xl font-bold text-white font-urbanist">
                Explore the collection
              </Text>
              <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-urbanist">
                see all
              </Text>
            </View>
            <FlatList
              horizontal
              data={event.relatedEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CollectionEventCard event={item} onPress={() => onNavigateToEvent(item.id)} />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            />
          </>
        )}
      </ScrollView>

      {/* Bottom action bar — sits flush above the tab bar via flex layout */}
      {isOwner ? (
        <OwnerActionBar eventStatus={event.status} onEdit={onEdit} onArchive={onArchive} />
      ) : (
        <StickyBottomBar
          ticketPrice={event.ticketPrice}
          ticketLink={event.ticketLink}
          isArtist={isArtist}
          isOwner={isOwner}
          isVenueEvent={event.creator.type === UserRole.VENUE}
          isCollaborator={isCollaborator}
          isRequesting={isRequesting}
          hasExistingRequest={hasRequested}
          onRequestToPerform={handleRequestToPerform}
        />
      )}
    </View>
  );
}

function formatDetailDate(dateStart: string): string {
  const d = new Date(dateStart);
  return d.toLocaleDateString('en-IE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDetailTime(dateStart: string, dateEnd?: string): string {
  const start = new Date(dateStart);
  const startTime = start.toLocaleTimeString('en-IE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (dateEnd) {
    const end = new Date(dateEnd);
    const endTime = end.toLocaleTimeString('en-IE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${startTime} - ${endTime}`;
  }

  return startTime;
}
