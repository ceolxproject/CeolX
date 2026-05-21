import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EventCategory } from '@CeolX/shared';
import { EventStatus, UserRole } from '@CeolX/shared/enums';

import { AppTabBar, TAB_CONFIG } from '@/components/AppTabBar';
import { appToast } from '@/components/AppToast';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventById } from '@/hooks/use-event-by-id';
import { useEventForm } from '@/hooks/use-event-form';
import type { CollaboratorArtist } from '@/hooks/use-event-form';
import { useMe } from '@/hooks/use-me';

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const isVenue = me?.currentRole === UserRole.VENUE;
  const [showManualAddress, setShowManualAddress] = useState(false);

  const { data: event, isLoading } = useEventById({ id: eventId });

  const form = useEventForm({
    eventId,
    initialData: event
      ? {
          title: event.title,
          description: event.description,
          coverImageUri: event.coverImage ?? null,
          category: event.category as EventCategory,
          collectionId: event.collectionId ?? '',
          collaborators: event.collaborators.map((c) => c.id),
          collaboratorArtists: event.collaborators.map(
            (c): CollaboratorArtist => ({
              id: c.id,
              stageName: c.stageName,
              genre: c.genre,
              image: c.profileImageUrl ?? null,
            })
          ),
          platformInvites: [],
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
        }
      : undefined,
    onSuccess: () => {
      appToast.success('Event updated', 'Your changes are saved.');
      router.back();
    },
    isVenue,
  });

  const handleBackPress = () => {
    Alert.alert('Leave without saving?', 'Your unsaved changes will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const tabBarState = {
    index: -1,
    routes: TAB_CONFIG.map((t) => ({ key: t.name, name: t.name })),
  };
  const tabBarNavigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => router.replace(`/(app)/(tabs)/${name}`),
  };

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
        <Text className="text-center text-lg text-white">Cannot edit an archived event.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-1">
        <Pressable onPress={handleBackPress} hitSlop={8} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 text-2xl font-bold text-white">Edit Event</Text>
      </View>

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, marginTop: 8 }}
      >
        {form.currentStep === 1 && (
          <BasicDetailsStep
            title={form.title}
            onTitleChange={form.setTitle}
            description={form.description}
            onDescriptionChange={form.setDescription}
            coverImageUri={form.coverImageUri}
            onPickImage={form.pickCoverImage}
            category={form.category}
            onCategoryChange={form.setCategory}
            collectionId={form.collectionId}
            onCollectionIdChange={form.setCollectionId}
            collaborators={form.collaborators}
            onCollaboratorsChange={form.setCollaborators}
            collaboratorArtists={form.collaboratorArtists}
            onCollaboratorArtistsChange={form.setCollaboratorArtists}
            platformInvites={form.platformInvites}
            onPlatformInvitesChange={form.setPlatformInvites}
            unregisteredCollaborators={form.unregisteredCollaborators}
            onUnregisteredCollaboratorsChange={form.setUnregisteredCollaborators}
            errors={form.errors}
            onContinue={form.goNext}
            isVenue={isVenue}
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
            onVenueIdChange={form.setVenueId}
            showManualAddress={showManualAddress}
            onToggleManualAddress={() => setShowManualAddress(!showManualAddress)}
            errors={form.errors}
            onContinue={form.goNext}
            onBack={form.goBack}
            isVenue={isVenue}
            myVenueAddress={me?.venueAddress}
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
            errors={form.errors}
            onSubmit={form.handleSubmit}
            onBack={form.goBack}
            isPending={form.isPending}
            isEditing
            isVenue={isVenue}
          />
        )}
      </KeyboardAvoidingView>

      {/* Bottom tab bar */}
      <AppTabBar
        state={tabBarState as never}
        descriptors={{}}
        navigation={tabBarNavigation as never}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />
    </View>
  );
}
