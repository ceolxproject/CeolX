import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { AppTabBar, TAB_CONFIG } from '@/components/AppTabBar';
import { appToast } from '@/components/AppToast';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventForm } from '@/hooks/use-event-form';
import { useMe } from '@/hooks/use-me';

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const isVenue = me?.currentRole === UserRole.VENUE;
  const [showManualAddress, setShowManualAddress] = useState(false);

  const form = useEventForm({
    onSuccess: () => {
      appToast.success('Event created', 'Your event is now live.');
      router.replace('/(app)/(tabs)/discover');
    },
  });

  // Android-only: a freshly-picked cover image paints black until the whole step
  // remounts — leaving step 1 and coming back fixes it, but styling/inset fixes
  // (see commits 93fdd1f, 4ad5751) and remounting just the <Image> do not. So we
  // reproduce that working remount: bump a key on the step shortly after a new
  // image is picked. Typed form data is safe (it lives in useEventForm, not the
  // step), only the scroll position resets. iOS renders fine, so we skip it
  // there. (Asana 1215040939202669)
  const [coverRefreshKey, setCoverRefreshKey] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || !form.coverImageUri) return;
    const timer = setTimeout(() => setCoverRefreshKey((k) => k + 1), 350);
    return () => clearTimeout(timer);
  }, [form.coverImageUri]);

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
    navigate: (name: string) => router.replace(`/(app)/(tabs)/${name}`),
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

      {/* Step indicator */}
      <View className="px-5">
        <StepIndicator currentStep={form.currentStep} />
      </View>

      {/* Form steps */}
      {/* KeyboardAvoidingView matches the onboarding wrapper. Without it,
          the Invite Artist / Collaborator search inputs sit near the bottom
          of the form and the dropdown results below them disappear behind
          the keyboard — the activity's adjustResize alone scrolls the
          focused input into view but doesn't lift the content below it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, marginTop: 8 }}>
        {form.currentStep === 1 && (
          <BasicDetailsStep
            key={coverRefreshKey}
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
            myVenueLat={me?.venueProfile?.lat ?? null}
            myVenueLng={me?.venueProfile?.lng ?? null}
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
      </KeyboardAvoidingView>

      {/* Bottom tab bar — lets users navigate away without losing the back-stack */}
      <AppTabBar
        state={tabBarState as never}
        descriptors={{}}
        navigation={tabBarNavigation as never}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />
    </View>
  );
}
