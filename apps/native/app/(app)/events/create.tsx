import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { AppHeader } from '@/components/AppHeader';
import { appToast } from '@/components/AppToast';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { VenuePublishBlockedNotice } from '@/components/subscription/VenueSubscriptionState';
import { useEventForm } from '@/hooks/use-event-form';
import { useMe } from '@/hooks/use-me';
import { useVenueSubscription } from '@/hooks/use-venue-subscription';

export default function CreateEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const isVenue = me?.currentRole === UserRole.VENUE;
  const subscription = useVenueSubscription();
  const [showManualAddress, setShowManualAddress] = useState(false);

  const publishBlocked = isVenue && !subscription.mayPublish;

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

  // The blocked venue is told at the top and chooses to leave — it is never moved for it.
  // Auto-redirecting on mount was rejected (client, 01/09/2026): a screen that opens and
  // instantly throws you elsewhere reads as a crash, and the venue never learns why. So
  // the notice explains, and the tap is the hand-off. Nothing can be lost on the way out,
  // because the form below is locked until the subscription is live.
  const handleActivatePress = () => router.replace('/(app)/(tabs)/profile');

  const handleBackPress = () => {
    Alert.alert('Leave without saving?', 'Your event details will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <AppHeader leading="back" onBack={handleBackPress} title="Create New Event" />

      {/* Above the step indicator, so it is the first thing read on every step rather than
          a surprise above the CREATE EVENT button on the last one. */}
      {publishBlocked && (
        <View className="px-5 pb-3">
          <VenuePublishBlockedNotice surface="event" onPress={handleActivatePress} />
        </View>
      )}

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
      {/* Locked, not hidden, while the subscription is not live: the venue sees the form it
          is about to get, and the notice above is the only live control. `pointerEvents`
          rather than a `disabled` prop on each field — there are two dozen of them across
          three steps, and one missed field is a form that half works. The a11y pair mutes
          the same subtree for screen readers, which opacity alone does not. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, marginTop: 8, opacity: publishBlocked ? 0.4 : 1 }}
        pointerEvents={publishBlocked ? 'none' : 'auto'}
        accessibilityElementsHidden={publishBlocked}
        importantForAccessibility={publishBlocked ? 'no-hide-descendants' : 'auto'}
      >
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
            onToggleManualAddress={() => {
              // Manual address and registered venue are mutually exclusive. Without
              // clearing venueId the link survives the switch invisibly, and the
              // event is held at pending_review for a venue the artist backed out of.
              if (!showManualAddress) form.setVenueId('');
              setShowManualAddress(!showManualAddress);
            }}
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
            ticketCurrency={form.ticketCurrency}
            onTicketCurrencyChange={form.setTicketCurrency}
            ticketLink={form.ticketLink}
            onTicketLinkChange={form.setTicketLink}
            adTitle={form.adTitle}
            onAdTitleChange={form.setAdTitle}
            adDescription={form.adDescription}
            onAdDescriptionChange={form.setAdDescription}
            shareToFeed={form.shareToFeed}
            onShareToFeedChange={form.setShareToFeed}
            errors={form.errors}
            onSubmit={() => void form.handleSubmit()}
            onBack={form.goBack}
            isPending={form.isPending}
            isEditing={false}
            isVenue={isVenue}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
