import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppTabBar, TAB_CONFIG } from '@/components/AppTabBar';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { CategoryPicker } from '@/components/events/CategoryPicker';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventForm } from '@/hooks/use-event-form';
import { trpc } from '@/utils/trpc';

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isVenue = me?.currentRole === 'venue';
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  const form = useEventForm({
    onSuccess: () => {
      Alert.alert('Success', 'Event created successfully!', [
        { text: 'Done', onPress: () => router.replace('/(app)/(tabs)/discover') },
      ]);
    },
    isVenue,
  });

  const handleBackPress = () => {
    Alert.alert('Leave without saving?', 'Your event details will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  // Mock tab bar props so the AppTabBar renders without a tabs navigator context.
  // Pressing a tab replaces the stack with the selected tab route.
  const tabBarState = {
    index: -1,
    routes: TAB_CONFIG.map((t) => ({ key: t.name, name: t.name })),
  };
  const tabBarNavigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => router.replace(`/(app)/(tabs)/${name}` as never),
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-1">
        <Pressable onPress={handleBackPress} hitSlop={8} className="mr-3">
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <Text className="flex-1 text-2xl font-bold text-white">Create New Event</Text>
      </View>

      {/* Artist context banner */}
      {!isVenue && me?.currentRole === 'artist' && (
        <View className="mx-5 mt-2 rounded-lg bg-white/5 px-4 py-3">
          <Text className="text-xs leading-5 text-gray-7 font-urbanist">
            Create events for your own performances — self-organised sessions, independent gigs, or
            shows you've arranged. Pin the location where you'll be performing.
          </Text>
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
            collaborators={form.collaborators}
            onCollaboratorsChange={form.setCollaborators}
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
            showManualAddress={showManualAddress}
            onToggleManualAddress={() => setShowManualAddress(!showManualAddress)}
            errors={form.errors}
            onContinue={form.goNext}
            onBack={form.goBack}
            isVenue={isVenue}
            myVenueAddress={me?.venueAddress}
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
            isEditing={false}
            isVenue={isVenue}
          />
        )}
      </View>

      {/* Bottom tab bar — lets users navigate away without losing the back-stack */}
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
