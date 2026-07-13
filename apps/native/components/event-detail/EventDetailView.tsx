import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceBetween, isEventPast } from '@CeolX/shared';
import { EventStatus, UserRole } from '@CeolX/shared/enums';

import { CollectionEventCard } from './CollectionEventCard';
import { DescriptionSection } from './DescriptionSection';
import { EventDetailHeader } from './EventDetailHeader';
import { EventHeroImage } from './EventHeroImage';
import { EventInfoRow } from './EventInfoRow';
import { HostArtistInfoBox } from './HostArtistInfoBox';
import { LocationMapPreview } from './LocationMapPreview';
import { OfferBlock } from './OfferBlock';
import { OwnerActionBar } from './OwnerActionBar';
import { PerformingArtistCard } from './PerformingArtistCard';
import { SectionDivider } from './SectionDivider';
import { StickyBottomBar } from './StickyBottomBar';

import { appToast } from '@/components/AppToast';
import {
  addEventToDeviceCalendar,
  CALENDAR_NO_SYNCED_ACCOUNT,
  CALENDAR_PERMISSION_DENIED,
} from '@/hooks/use-add-to-calendar';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useRequestToPerform } from '@/hooks/use-request-to-perform';
import { useSaveHandler } from '@/hooks/use-save-handler';
import { useShareEvent } from '@/hooks/use-share-event';
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
  const scrollRef = useRef<ScrollView>(null);
  // Y offset of the "Performing Artist" section within the scroll content, so
  // the Host/Artist box's "VIEW ALL" can jump straight to the per-artist cards.
  const [artistSectionY, setArtistSectionY] = useState(0);
  // Derive the bookmark straight from the query cache (not a one-time useState
  // snapshot): `useSaveEvent` patches the byId cache optimistically, so re-opening
  // a saved event always reflects the true state instead of a stale `false`.
  const isSaved = event.isSaved;
  const { initialRegion, locationSource } = useGpsRegion();
  const { onToggleSave: handleToggleSave } = useSaveHandler(event);
  const shareEvent = useShareEvent();
  const { requestToPerform, isRequesting } = useRequestToPerform();

  const distanceKm = useMemo(() => {
    if (locationSource === 'pending') return undefined;
    return distanceBetween(initialRegion.latitude, initialRegion.longitude, event.lat, event.lng);
  }, [initialRegion.latitude, initialRegion.longitude, event.lat, event.lng, locationSource]);

  const isCollaborator = useMemo(
    () => !!userId && event.collaborators.some((c) => c.id === userId),
    [userId, event.collaborators]
  );

  const handleShare = () => {
    void shareEvent(event.id, event.title, formatDetailDate(event.dateStart));
  };

  const handleRequestToPerform = () => {
    requestToPerform(event.id);
  };

  // flag stop duplicate calendar entries from repeated taps
  const calendarLock = useRef(false);
  const [calendarAdded, setCalendarAdded] = useState(false);

  const handleAddToCalendar = async () => {
    if (calendarLock.current || calendarAdded) return;
    calendarLock.current = true;

    const start = new Date(event.dateStart);
    const end = event.dateEnd
      ? new Date(event.dateEnd)
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);

    try {
      await addEventToDeviceCalendar({
        title: event.title,
        startDate: start,
        endDate: end,
        notes: event.description.slice(0, 200),
        location: event.venueAddress ?? `${event.lat},${event.lng}`,
      });
      appToast.success('Added to calendar');
      setCalendarAdded(true);
    } catch (err) {
      if (err instanceof Error && err.message === CALENDAR_PERMISSION_DENIED) {
        appToast.error(
          'Calendar access needed',
          'Enable calendar permission in Settings to add events.'
        );
      } else if (err instanceof Error && err.message === CALENDAR_NO_SYNCED_ACCOUNT) {
        appToast.error(
          'No synced calendar found',
          Platform.OS === 'android'
            ? 'Add a Google account in your phone’s Calendar settings, then try again.'
            : 'Set up a calendar account in Settings, then try again.'
        );
      } else {
        appToast.error('Could not add to calendar', 'Please try again.');
      }
    } finally {
      calendarLock.current = false;
    }
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
      {/* Fixed header — stays pinned while the hero + details scroll beneath it. */}
      <EventDetailHeader
        onBack={onBack}
        title={event.title}
        isSaved={isSaved}
        onToggleSave={handleToggleSave}
        onShare={handleShare}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Hero Image with category + attendee badges */}
        <EventHeroImage
          coverImageUrl={event.coverImageUrl ?? undefined}
          category={event.category}
          collectionName={event.collection?.name}
          attendeeCount={event.attendeeCount}
        />

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
            onViewAll={
              event.collaborators.length > 3
                ? () => scrollRef.current?.scrollTo({ y: artistSectionY, animated: true })
                : undefined
            }
            onPressCreator={(creator) => {
              if (creator.type === UserRole.ARTIST) {
                router.push(`/(app)/artist/${creator.id}`);
              } else if (creator.type === UserRole.VENUE) {
                router.push(`/(app)/venue/${creator.id}`);
              }
            }}
            onPressArtist={(artistId) => {
              router.push(`/(app)/artist/${artistId}`);
            }}
          />

          {/* Key facts — when / where / how much, grouped above the description
              so the essentials are scannable before any long prose. */}
          <View className="gap-4">
            <EventInfoRow
              icon="calendar-outline"
              title={formattedDate}
              subtitle={formattedTime}
              actionLabel={calendarAdded ? 'Added' : 'Add to calendar'}
              onAction={handleAddToCalendar}
              actionDisabled={calendarAdded}
            />

            {/* Location */}
            <EventInfoRow
              icon="location-outline"
              title={event.venueAddress?.split(',')[0] ?? 'Venue TBC'}
              subtitle={event.venueAddress ?? `${event.lat.toFixed(4)}, ${event.lng.toFixed(4)}`}
              actionLabel="Get Directions"
              onAction={handleViewMap}
              onTitlePress={
                event.venueUserId
                  ? () => router.push(`/(app)/venue/${event.venueUserId}`)
                  : undefined
              }
            />

            {/* Ticket price — info-only row (booking lives in the sticky bar) */}
            {event.ticketPrice !== undefined && event.ticketPrice !== null && (
              <EventInfoRow
                icon="pricetag-outline"
                title={event.ticketPrice > 0 ? `€${(event.ticketPrice / 100).toFixed(0)}` : 'Free'}
                subtitle="Ticket price"
              />
            )}
          </View>

          {/* Description */}
          <DescriptionSection description={event.description} />
        </View>

        {/* Offers — only this event's own ad, if it has one */}
        <OfferBlock
          adTitle={event.adTitle}
          adDescription={event.adDescription}
          eventTitle={event.title}
          coverImage={event.coverImageUrl ?? null}
        />

        {/* Performing Artists */}
        {event.collaborators.length > 0 && (
          <View onLayout={(e) => setArtistSectionY(e.nativeEvent.layout.y)}>
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
                  // External invitees have no profile to open — render a
                  // non-tappable card by leaving onPress undefined.
                  onPress={
                    item.isExternal ? undefined : () => router.push(`/(app)/artist/${item.id}`)
                  }
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              scrollEnabled={event.collaborators.length > 2}
            />
          </View>
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
              {event.collectionId ? (
                <Pressable
                  onPress={() =>
                    router.push(`/(app)/(tabs)/discover/collection/${event.collectionId}`)
                  }
                  hitSlop={8}
                >
                  <Text className="text-xs font-bold text-green-10 tracking-wider uppercase font-urbanist">
                    see all
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <FlatList
              horizontal
              data={event.relatedEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CollectionEventCard
                  event={item}
                  collectionName={event.collection?.name}
                  onPress={() => onNavigateToEvent(item.id)}
                />
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
          eventId={event.id}
          ticketPrice={event.ticketPrice}
          ticketLink={event.ticketLink}
          isArtist={isArtist}
          isOwner={isOwner}
          isVenueEvent={event.creator.type === UserRole.VENUE}
          isCollaborator={isCollaborator}
          isRequesting={isRequesting}
          hasExistingRequest={event.viewerHasPendingRequest}
          isPastEvent={isEventPast(event.dateStart)}
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
