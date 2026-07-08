import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCategory } from '@CeolX/shared';
import { EventStatus, UserRole } from '@CeolX/shared/enums';

import { AppHeader } from '@/components/AppHeader';
import { appToast } from '@/components/AppToast';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventById } from '@/hooks/use-event-by-id';
import { useEventForm } from '@/hooks/use-event-form';
import { useMe } from '@/hooks/use-me';

/** The fully-loaded event — the form is only mounted once this exists. */
type LoadedEvent = NonNullable<ReturnType<typeof useEventById>['data']>;

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { data: event, isLoading } = useEventById({ id: eventId });

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#C8FF2F" />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-5">
        <Text className="text-lg text-white">Event not found</Text>
      </View>
    );
  }

  if (event.status === EventStatus.ARCHIVED) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-5">
        <Text className="text-center text-lg text-white">Cannot edit a deleted event.</Text>
      </View>
    );
  }

  // The form reads `initialData` exactly once, at mount, via useState
  // initializers. Mounting it only here — after the event has loaded — is what
  // guarantees those initializers see real values. (Rendering the form while
  // the query was still loading seeded every field from `undefined`, so the
  // form stayed empty until the cache made a reopen resolve synchronously.)
  return <EditEventForm event={event} eventId={eventId} />;
}

function EditEventForm({ event, eventId }: { event: LoadedEvent; eventId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const isVenue = me?.currentRole === UserRole.VENUE;
  const [showManualAddress, setShowManualAddress] = useState(false);

  const form = useEventForm({
    eventId,
    initialData: {
      title: event.title,
      description: event.description,
      coverImageUri: event.coverImage ?? null,
      category: event.category as EventCategory,
      collectionId: event.collectionId ?? '',
      // Previously-invited platform artists whose invite is still pending —
      // seeded so the venue/organiser can see and manage them. Accepted
      // performers are shown in the event-detail Performers section instead, not
      // re-managed here. (Asana 1215912673233456)
      platformInvites: event.platformInvites ?? [],
      unregisteredCollaborators: event.unregisteredCollaborators ?? [],
      dateStart: new Date(event.dateStart),
      dateEnd: event.dateEnd ? new Date(event.dateEnd) : null,
      startTime: new Date(event.dateStart),
      endTime: event.dateEnd ? new Date(event.dateEnd) : null,
      lat: event.lat,
      lng: event.lng,
      venueAddress: event.venueAddress ?? '',
      venueId: event.venueId ?? '',
      ticketPrice: event.ticketPrice ? String(event.ticketPrice / 100) : '',
      ticketLink: event.ticketLink ?? '',
      ticketQuantity: '',
      adTitle: event.adTitle ?? '',
      adDescription: event.adDescription ?? '',
    },
    onSuccess: () => {
      appToast.success('Event updated', 'Your changes are saved.');
      router.back();
    },
  });

  const handleBackPress = () => {
    Alert.alert('Leave without saving?', 'Your unsaved changes will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <AppHeader leading="back" onBack={handleBackPress} title="Edit Event" />

      {event.status === EventStatus.REMOVED && event.removalReason && (
        <View className="mx-5 mb-3 rounded-lg bg-red-900/30 px-4 py-3">
          <Text className="mb-1 text-sm font-semibold text-red-400">
            This event was removed by admin
          </Text>
          <Text className="text-sm text-red-300">{event.removalReason}</Text>
          <Text className="mt-1 text-xs text-white/60">Edit and save to resubmit as active.</Text>
        </View>
      )}

      {/* Step indicator */}
      <View className="px-5">
        <StepIndicator currentStep={form.currentStep} />
      </View>

      {/* Form steps */}
      {/* See create.tsx for why this KeyboardAvoidingView matters — the search
          inputs inside Collaborator/InviteArtist pickers otherwise lose their
          dropdown results behind the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, marginTop: 8 }}>
        {form.currentStep === 1 && (
          <BasicDetailsStep
            title={form.title}
            onTitleChange={form.setTitle}
            onTitleBlur={() => form.handleBlur('title')}
            description={form.description}
            onDescriptionChange={form.setDescription}
            onDescriptionBlur={() => form.handleBlur('description')}
            coverImageUri={form.coverImageUri}
            onPickImage={form.pickCoverImage}
            onRemoveImage={() => form.setCoverImageUri(null)}
            category={form.category}
            onCategoryChange={form.setCategory}
            collectionId={form.collectionId}
            onCollectionIdChange={form.setCollectionId}
            platformInvites={form.platformInvites}
            onPlatformInvitesChange={form.setPlatformInvites}
            unregisteredCollaborators={form.unregisteredCollaborators}
            onUnregisteredCollaboratorsChange={form.setUnregisteredCollaborators}
            errors={form.errors}
            onContinue={form.goNext}
            isVenue={isVenue}
            myUserId={me?.id}
          />
        )}

        {form.currentStep === 2 && (
          <DateVenueStep
            dateStart={form.dateStart}
            onDateStartChange={form.setDateStart}
            startTime={form.startTime}
            onStartTimeChange={form.setStartTime}
            endTime={form.endTime}
            onEndTimeChange={form.setEndTime}
            lat={form.lat}
            lng={form.lng}
            onLocationChange={(lat, lng) => {
              form.setLat(lat);
              form.setLng(lng);
            }}
            venueAddress={form.venueAddress}
            onVenueAddressChange={form.setVenueAddress}
            venueId={form.venueId}
            onVenueIdChange={form.setVenueId}
            showManualAddress={showManualAddress}
            onToggleManualAddress={() => setShowManualAddress(!showManualAddress)}
            errors={form.errors}
            onContinue={form.goNext}
            onBack={form.goBack}
            isVenue={isVenue}
            myVenueAddress={me?.venueAddress}
            myVenueLat={me?.venueProfile?.lat ?? null}
            myVenueLng={me?.venueProfile?.lng ?? null}
            isEditing
          />
        )}

        {form.currentStep === 3 && (
          <TicketAdsStep
            ticketPrice={form.ticketPrice}
            onTicketPriceChange={form.setTicketPrice}
            ticketLink={form.ticketLink}
            onTicketLinkChange={form.setTicketLink}
            adTitle={form.adTitle}
            onAdTitleChange={form.setAdTitle}
            adDescription={form.adDescription}
            onAdDescriptionChange={form.setAdDescription}
            shareToFeed={form.shareToFeed}
            onShareToFeedChange={form.setShareToFeed}
            errors={form.errors}
            onSubmit={form.handleSubmit}
            onBack={form.goBack}
            isPending={form.isPending}
            isEditing
            isVenue={isVenue}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
