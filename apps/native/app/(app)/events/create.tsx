import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Container } from '@/components/container';
import { BasicDetailsStep } from '@/components/events/BasicDetailsStep';
import { CategoryPicker } from '@/components/events/CategoryPicker';
import { DateVenueStep } from '@/components/events/DateVenueStep';
import { StepIndicator } from '@/components/events/StepIndicator';
import { TicketAdsStep } from '@/components/events/TicketAdsStep';
import { useEventForm } from '@/hooks/use-event-form';
import { trpc } from '@/utils/trpc';

export default function CreateEventScreen() {
  const router = useRouter();
  const { data: me } = useQuery(trpc.users.me.queryOptions());
  const isVenue = me?.currentRole === 'venue';
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  const form = useEventForm({
    onSuccess: () => {
      Alert.alert('Success', 'Event created successfully!', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
  });

  return (
    <Container>
      <View className="flex-1 px-5 pt-4">
        <Text className="mb-4 text-2xl font-bold text-white">Create New Event</Text>

        <StepIndicator currentStep={form.currentStep as 1 | 2 | 3} />

        <View className="mt-6 flex-1">
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
            />
          )}
        </View>
      </View>

      <CategoryPicker
        visible={showCategoryPicker}
        selected={form.category}
        onSelect={form.setCategory}
        onClose={() => setShowCategoryPicker(false)}
      />
    </Container>
  );
}
