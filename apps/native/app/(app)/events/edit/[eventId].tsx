import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTabBar, TAB_CONFIG } from '@/components/AppTabBar';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { CategoryPicker } from '@/components/events/CategoryPicker';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventForm } from '@/hooks/use-event-form';
import { trpc } from '@/utils/trpc';

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isVenue = me?.currentRole === 'venue';
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  const { data: event, isLoading } = useQuery(trpc.events.byId.queryOptions({ id: eventId }));

  const form = useEventForm({
    eventId,
    initialData: event
      ? {
          title: event.title,
          description: event.description,
          coverImageUri: event.coverImage,
          category: event.category,
          collectionId: event.collectionId,
          dateStart: new Date(event.dateStart),
          startTime: new Date(event.dateStart),
          endTime: event.dateEnd ? new Date(event.dateEnd) : null,
          lat: event.lat ? parseFloat(event.lat) : null,
          lng: event.lng ? parseFloat(event.lng) : null,
          venueAddress: event.venueAddress ?? '',
          venueId: event.venueId ?? null,
          ticketPrice: event.ticketPrice ? String(event.ticketPrice / 100) : '',
          ticketLink: event.ticketLink ?? '',
          adTitle: event.adTitle ?? '',
          adDescription: event.adDescription ?? '',
        }
      : undefined,
    onSuccess: () => {
      Alert.alert('Success', 'Event updated successfully!', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
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
    navigate: (name: string) => router.replace(`/(app)/(tabs)/${name}` as never),
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

  if (event.status === 'archived') {
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

      {event.status === 'removed' && event.removalReason && (
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
        <StepIndicator currentStep={form.currentStep as 1 | 2 | 3} />
      </View>

      {/* Form steps */}
      <View className="flex-1 mt-2">
        {form.currentStep === 1 && (
          <BasicDetailsStep
            title={form.title}
            onTitleChange={form.setTitle}
            description={form.description}
            onDescriptionChange={form.setDescription}
            coverImageUri={form.coverImageUri}
            onPickImage={() => {}}
            category={form.category}
            onCategoryChange={form.setCategory}
            onCategoryPress={() => setShowCategoryPicker(true)}
            collectionId={form.collectionId}
            onCollectionIdChange={form.setCollectionId}
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
      </View>

      {/* Bottom tab bar */}
      <AppTabBar state={tabBarState} descriptors={{}} navigation={tabBarNavigation} />

      <CategoryPicker
        visible={showCategoryPicker}
        selected={form.category}
        onSelect={form.setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />
    </View>
  );
}
