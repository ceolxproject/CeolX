import { cn } from 'heroui-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

type Props = {
  ticketPrice: string;
  onTicketPriceChange: (v: string) => void;
  ticketLink: string;
  onTicketLinkChange: (v: string) => void;
  adTitle: string;
  onAdTitleChange: (v: string) => void;
  adDescription: string;
  onAdDescriptionChange: (v: string) => void;
  errors: Record<string, string>;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
  isEditing: boolean;
  isVenue?: boolean;
};

const AD_DESC_MAX = 50;

export function TicketAdsStep({
  ticketPrice,
  onTicketPriceChange,
  ticketLink,
  onTicketLinkChange,
  adTitle,
  onAdTitleChange,
  adDescription,
  onAdDescriptionChange,
  errors,
  onSubmit,
  onBack,
  isPending,
  isEditing,
  isVenue,
}: Props) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-10 gap-5"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Ticket Price ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ticket Price</Text>
        <View
          className={cn(
            'flex-row items-center rounded-lg border bg-surface px-3 py-2.5',
            errors.ticketPrice ? 'border-error' : 'border-gray-8'
          )}
        >
          <Text className="mr-1 text-sm text-neutral-400">€</Text>
          <TextInput
            className="flex-1 text-sm text-white"
            placeholder="0.00"
            placeholderTextColor="#8d8d8d"
            keyboardType="numeric"
            value={ticketPrice}
            onChangeText={onTicketPriceChange}
          />
        </View>
        {errors.ticketPrice && <Text className="text-xs text-error">{errors.ticketPrice}</Text>}
      </View>

      {/* ── Ticket Link ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ticket Link</Text>
        <View
          className={cn(
            'rounded-lg border bg-surface px-3 py-2.5',
            errors.ticketLink ? 'border-error' : 'border-gray-8'
          )}
        >
          <TextInput
            className="text-sm text-white"
            placeholder="Paste ticket link here"
            placeholderTextColor="#8d8d8d"
            autoCapitalize="none"
            keyboardType="url"
            value={ticketLink}
            onChangeText={onTicketLinkChange}
          />
        </View>
        {errors.ticketLink && <Text className="text-xs text-error">{errors.ticketLink}</Text>}
      </View>

      {/* ── Ad Title & Description (venue only) ── */}
      {isVenue && (
        <>
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-3">Ad Title (optional)</Text>
            <View
              className={cn(
                'rounded-lg border bg-surface px-3 py-2.5',
                errors.adTitle ? 'border-error' : 'border-gray-8'
              )}
            >
              <TextInput
                className="text-sm text-white"
                placeholder="Enter ad title"
                placeholderTextColor="#8d8d8d"
                value={adTitle}
                onChangeText={onAdTitleChange}
              />
            </View>
            <Text className="text-xs text-neutral-500">
              Show special offers as pop-up notification to people within 5-15 km of your event.
            </Text>
            {errors.adTitle && <Text className="text-xs text-error">{errors.adTitle}</Text>}
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-3">Ad Description (optional)</Text>
            <View
              className={cn(
                'rounded-lg border bg-surface px-3 py-2.5',
                errors.adDescription ? 'border-error' : 'border-gray-8'
              )}
            >
              <TextInput
                className="text-sm text-white"
                placeholder="Describe your ad"
                placeholderTextColor="#8d8d8d"
                value={adDescription}
                onChangeText={(text) => {
                  if (text.length <= AD_DESC_MAX) onAdDescriptionChange(text);
                }}
                multiline
              />
            </View>
            <Text className="text-right text-xs text-neutral-500">
              {adDescription.length}/{AD_DESC_MAX}
            </Text>
            {errors.adDescription && (
              <Text className="text-xs text-error">{errors.adDescription}</Text>
            )}
          </View>
        </>
      )}

      {/* ── Gig Opportunity & Collaborators deferred to M5/M6 ── */}

      {/* ── Buttons ── */}
      <View className="mt-2 flex-row gap-3">
        <Pressable
          className="flex-1 items-center justify-center rounded-lg border border-white py-3"
          onPress={onBack}
          disabled={isPending}
        >
          <Text className="text-base font-semibold text-white">BACK</Text>
        </Pressable>

        <Pressable
          className={cn(
            'flex-1 items-center justify-center rounded-lg bg-[#6C63FF] py-3',
            isPending && 'opacity-50'
          )}
          onPress={onSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {isEditing ? 'SAVE CHANGES' : 'CREATE EVENT'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
