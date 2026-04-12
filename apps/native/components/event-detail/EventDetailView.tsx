import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceBetween } from '@CeolX/shared';

import { CategoryBadge } from './CategoryBadge';
import { CollectionEventCard } from './CollectionEventCard';
import { DescriptionSection } from './DescriptionSection';
import { EventDetailHeader } from './EventDetailHeader';
import { EventHeroImage } from './EventHeroImage';
import { EventInfoRow } from './EventInfoRow';
import { HostArtistInfoBox } from './HostArtistInfoBox';
import { LocationMapPreview } from './LocationMapPreview';
import { PerformingArtistCard } from './PerformingArtistCard';
import { SectionDivider } from './SectionDivider';
import { StickyBottomBar } from './StickyBottomBar';

import { useGpsRegion } from '@/hooks/use-gps-region';
import type { EventDetailData } from '@/types/event-detail';
import { trpc } from '@/utils/trpc';

interface EventDetailViewProps {
  event: EventDetailData;
  isArtist: boolean;
  onBack: () => void;
  onNavigateToEvent: (eventId: string) => void;
}

export function EventDetailView({
  event,
  isArtist,
  onBack,
  onNavigateToEvent,
}: EventDetailViewProps) {
  const insets = useSafeAreaInsets();
  const [isSaved, setIsSaved] = useState(event.isSaved);
  const { initialRegion, locationSource } = useGpsRegion();

  const distanceKm = useMemo(() => {
    if (locationSource === 'pending') return undefined;
    return distanceBetween(initialRegion.latitude, initialRegion.longitude, event.lat, event.lng);
  }, [initialRegion.latitude, initialRegion.longitude, event.lat, event.lng, locationSource]);

  const { mutate: save } = useMutation(trpc.events.save.mutationOptions());
  const { mutate: unsave } = useMutation(trpc.events.unsave.mutationOptions());

  const handleToggleSave = () => {
    setIsSaved((prev) => !prev); // optimistic update
    if (isSaved) {
      unsave({ id: event.id }, { onError: () => setIsSaved(true) });
    } else {
      save({ id: event.id }, { onError: () => setIsSaved(false) });
    }
  };

  const handleRequestToPerform = () => {
    // TODO: Navigate to Booking flow (M5) when implemented
    Alert.alert('Coming Soon', 'The booking flow is not yet available. Stay tuned!');
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
    <View className="flex-1 bg-surface-dark" style={{ paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
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

        {/* Main content */}
        <View className="px-4">
          {/* Title */}
          <Text className="text-[28px] font-bold text-white font-sans mt-3 leading-8">
            {event.title}
          </Text>

          {/* Host & Artist info */}
          <HostArtistInfoBox
            creator={event.creator}
            collaborators={event.collaborators}
            onViewAll={event.collaborators.length > 3 ? () => {} : undefined}
          />

          {/* Ticket Price */}
          {event.ticketPrice !== undefined && event.ticketPrice !== null && (
            <Text className="text-white font-sans mt-7">
              <Text className="text-lg text-gray-10">Ticket Price: </Text>
              <Text className="text-xl font-bold">€{(event.ticketPrice / 100).toFixed(0)}</Text>
            </Text>
          )}

          {/* Description */}
          <DescriptionSection description={event.description} />

          {/* Date / Time */}
          <EventInfoRow
            icon="calendar-outline"
            title={formattedDate}
            subtitle={formattedTime}
            actionLabel="Add to calendar"
            onAction={handleAddToCalendar}
            className="mt-7"
          />

          {/* Location */}
          <EventInfoRow
            icon="location-outline"
            title={event.venueAddress?.split(',')[0] ?? 'Venue TBC'}
            subtitle={event.venueAddress ?? `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}
            actionLabel="View map"
            onAction={handleViewMap}
          />
        </View>

        {/* Performing Artists */}
        {event.collaborators.length > 0 && (
          <>
            <SectionDivider className="mx-4" />
            <Text className="text-xl font-bold text-white font-sans px-4 mb-4">
              Performing Artist
            </Text>
            <FlatList
              horizontal
              data={event.collaborators}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PerformingArtistCard artist={item} />}
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
              <Text className="text-xl font-bold text-white font-sans">Explore the collection</Text>
              <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-sans">
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

      {/* Sticky bottom bar */}
      <View style={{ paddingBottom: insets.bottom }}>
        <StickyBottomBar
          ticketPrice={event.ticketPrice ?? undefined}
          isArtist={isArtist}
          isVenueEvent={event.creator.type === 'venue'}
          isSaved={isSaved}
          onToggleSave={handleToggleSave}
          onRequestToPerform={handleRequestToPerform}
        />
      </View>
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
