import { cn } from 'heroui-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AD_DESCRIPTION_MAX, AD_TITLE_MAX } from '@CeolX/shared/validators';

import { FieldLabel } from './FieldLabel';

import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';

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
        <FieldLabel
          label="Ticket Price"
          hint="Entry price per ticket in euro. Leave blank or 0 if your event is free."
        />
        <View
          className={cn(
            'flex-row items-center rounded-lg border bg-surface px-3 py-2.5',
            errors.ticketPrice ? 'border-error' : 'border-gray-8'
          )}
        >
          <Text className="mr-1 text-sm text-neutral-400">€</Text>
          <TextInput
            className="flex-1 text-[14px] text-white"
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
        <FieldLabel
          label="Ticket Link"
          hint="External link where fans buy tickets. It opens in an in-app browser from your event page."
        />
        <View
          className={cn(
            'rounded-lg border bg-surface px-3 py-2.5',
            errors.ticketLink ? 'border-error' : 'border-gray-8'
          )}
        >
          <TextInput
            className="text-[14px] text-white"
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
            <FieldLabel
              label="Ad Title (optional)"
              hint="Headline for a promotional pop-up shown to people within 5–15 km of your event. Limited to 100 characters."
            />
            <View
              className={cn(
                'rounded-lg border bg-surface px-3 py-2.5',
                errors.adTitle ? 'border-error' : 'border-gray-8'
              )}
            >
              <TextInput
                className="text-[14px] text-white"
                placeholder="Enter ad title"
                placeholderTextColor="#8d8d8d"
                value={adTitle}
                // Cap natively so the limit also applies to paste, and slice
                // defensively so an over-long paste can never reach state.
                // Mirrors the Ad Description field. (Asana 1215700058851914)
                onChangeText={(text) => onAdTitleChange(text.slice(0, AD_TITLE_MAX))}
                maxLength={AD_TITLE_MAX}
              />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-xs text-neutral-500">
                Show special offers as pop-up notification to people within 5-15 km of your event.
              </Text>
              <CharacterCount
                count={adTitle.length}
                max={AD_TITLE_MAX}
                className="ml-2 text-xs text-neutral-500"
              />
            </View>
            {errors.adTitle && <Text className="text-xs text-error">{errors.adTitle}</Text>}
            <CharacterLimitNote count={adTitle.length} max={AD_TITLE_MAX} />
          </View>

          <View className="gap-1.5">
            <FieldLabel
              label="Ad Description (optional)"
              hint="Short detail for your promotional pop-up. Limited to 50 characters."
            />
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
                // Enforce the cap natively so it also applies to paste (not just
                // keystrokes), and slice defensively so an over-long paste can
                // never reach state and stretch the multiline box / break the
                // layout. (Asana 1215419517221432)
                onChangeText={(text) => onAdDescriptionChange(text.slice(0, AD_DESCRIPTION_MAX))}
                maxLength={AD_DESCRIPTION_MAX}
                multiline
              />
            </View>
            <CharacterCount
              count={adDescription.length}
              max={AD_DESCRIPTION_MAX}
              className="text-right text-xs text-neutral-500"
            />
            {errors.adDescription && (
              <Text className="text-xs text-error">{errors.adDescription}</Text>
            )}
            <CharacterLimitNote count={adDescription.length} max={AD_DESCRIPTION_MAX} />
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
