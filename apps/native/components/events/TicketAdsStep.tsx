import { cn } from 'heroui-native';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { CheckboxField } from '@/components/CheckboxField';

type Props = {
  ticketPrice: string;
  onTicketPriceChange: (v: string) => void;
  ticketLink: string;
  onTicketLinkChange: (v: string) => void;
  ticketQuantity: string;
  onTicketQuantityChange: (v: string) => void;
  adTitle: string;
  onAdTitleChange: (v: string) => void;
  adDescription: string;
  onAdDescriptionChange: (v: string) => void;
  isGigOpportunity: boolean;
  onIsGigOpportunityChange: (v: boolean) => void;
  isVenue: boolean;
  errors: Record<string, string>;
  onSubmit: () => void;
  onBack: () => void;
  isPending: boolean;
  isEditing: boolean;
};

const AD_DESC_MAX = 50;

export function TicketAdsStep({
  ticketPrice,
  onTicketPriceChange,
  ticketLink,
  onTicketLinkChange,
  ticketQuantity,
  onTicketQuantityChange,
  adTitle,
  onAdTitleChange,
  adDescription,
  onAdDescriptionChange,
  isGigOpportunity,
  onIsGigOpportunityChange,
  isVenue,
  errors,
  onSubmit,
  onBack,
  isPending,
  isEditing,
}: Props) {
  return (
    <View className="gap-5">
      {/* ── Ticket Price ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ticket Price</Text>
        <View
          className={cn(
            'flex-row items-center rounded-lg border px-3 py-2.5 bg-surface',
            errors.ticketPrice ? 'border-error' : 'border-gray-8'
          )}
        >
          <Text className="text-sm text-neutral-400 mr-1">€</Text>
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
            'rounded-lg border px-3 py-2.5 bg-surface',
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

      {/* ── Ticket Quantity ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ticket Quantity</Text>
        <View
          className={cn(
            'rounded-lg border px-3 py-2.5 bg-surface',
            errors.ticketQuantity ? 'border-error' : 'border-gray-8'
          )}
        >
          <TextInput
            className="text-sm text-white"
            placeholder="Total No. of Tickets"
            placeholderTextColor="#8d8d8d"
            keyboardType="numeric"
            value={ticketQuantity}
            onChangeText={onTicketQuantityChange}
          />
        </View>
        {errors.ticketQuantity && (
          <Text className="text-xs text-error">{errors.ticketQuantity}</Text>
        )}
      </View>

      {/* ── Ad Title ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ad Title (optional)</Text>
        <View
          className={cn(
            'rounded-lg border px-3 py-2.5 bg-surface',
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

      {/* ── Ad Description ── */}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-gray-3">Ad Description (optional)</Text>
        <View
          className={cn(
            'rounded-lg border px-3 py-2.5 bg-surface',
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
        <Text className="text-xs text-neutral-500 text-right">
          {adDescription.length}/{AD_DESC_MAX}
        </Text>
        {errors.adDescription && <Text className="text-xs text-error">{errors.adDescription}</Text>}
      </View>

      {/* ── Gig Opportunity (Venue only) ── */}
      {isVenue && (
        <CheckboxField
          checked={isGigOpportunity}
          onChange={onIsGigOpportunityChange}
          label="Mark as Gig Opportunity (visible to artists only)"
        />
      )}

      {/* ── Buttons ── */}
      <View className="flex-row gap-3 mt-2">
        <Pressable
          className="flex-1 items-center justify-center rounded-lg border border-white py-3"
          onPress={onBack}
          disabled={isPending}
        >
          <Text className="text-white font-semibold text-base">BACK</Text>
        </Pressable>

        <Pressable
          className={cn(
            'flex-1 items-center justify-center rounded-lg bg-blue-10 py-3',
            isPending && 'opacity-50'
          )}
          onPress={onSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {isEditing ? 'SAVE CHANGES' : 'CREATE EVENT'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
