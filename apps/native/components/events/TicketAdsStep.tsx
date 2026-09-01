import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { TicketCurrency } from '@CeolX/shared';
import { currencySymbol, TICKET_CURRENCIES } from '@CeolX/shared';
import { AD_DESCRIPTION_MAX, AD_TITLE_MAX } from '@CeolX/shared/validators';

import { FieldLabel } from './FieldLabel';

import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';

type Props = {
  ticketPrice: string;
  onTicketPriceChange: (v: string) => void;
  ticketCurrency: TicketCurrency;
  onTicketCurrencyChange: (v: TicketCurrency) => void;
  ticketLink: string;
  onTicketLinkChange: (v: string) => void;
  adTitle: string;
  onAdTitleChange: (v: string) => void;
  adDescription: string;
  onAdDescriptionChange: (v: string) => void;
  shareToFeed: boolean;
  onShareToFeedChange: (v: boolean) => void;
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
  ticketCurrency,
  onTicketCurrencyChange,
  ticketLink,
  onTicketLinkChange,
  adTitle,
  onAdTitleChange,
  adDescription,
  onAdDescriptionChange,
  shareToFeed,
  onShareToFeedChange,
  errors,
  onSubmit,
  onBack,
  isPending,
  isEditing,
  isVenue,
}: Props) {
  const [currencyOpen, setCurrencyOpen] = useState(false);

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
          hint="Entry price per ticket. Pick the currency you sell in. Leave blank or 0 if your event is free."
        />
        <View
          className={cn(
            'flex-row items-center rounded-lg border bg-surface px-3 py-2.5',
            errors.ticketPrice || errors.ticketCurrency ? 'border-error' : 'border-gray-8'
          )}
        >
          {/* Currency trigger — the list opens below the whole row (see next block) */}
          <Pressable
            className="mr-2 flex-row items-center gap-1 border-r border-gray-8 pr-2"
            onPress={() => setCurrencyOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={`Ticket currency, ${ticketCurrency}`}
          >
            <Text className="text-sm text-white">
              {currencySymbol(ticketCurrency)} {ticketCurrency}
            </Text>
            <Ionicons
              name={currencyOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#8d8d8d"
            />
          </Pressable>
          <TextInput
            className="flex-1 text-[14px] text-white"
            placeholder="0.00"
            placeholderTextColor="#8d8d8d"
            keyboardType="numeric"
            value={ticketPrice}
            onChangeText={onTicketPriceChange}
          />
        </View>
        {currencyOpen && (
          <View className="overflow-hidden rounded-lg border border-gray-8 bg-surface">
            {TICKET_CURRENCIES.map((code, index) => (
              <Pressable
                key={code}
                className={cn(
                  'flex-row items-center gap-3 px-4 py-3 active:bg-white/5',
                  index < TICKET_CURRENCIES.length - 1 && 'border-b border-gray-8/40',
                  ticketCurrency === code && 'bg-[#C8FF2F]/10'
                )}
                onPress={() => {
                  onTicketCurrencyChange(code);
                  setCurrencyOpen(false);
                }}
                accessibilityRole="menuitem"
              >
                <Text
                  className={cn(
                    'flex-1 text-sm',
                    ticketCurrency === code ? 'font-bold text-[#C8FF2F]' : 'text-white'
                  )}
                >
                  {currencySymbol(code)} {code}
                </Text>
                {ticketCurrency === code && <Ionicons name="checkmark" size={16} color="#C8FF2F" />}
              </Pressable>
            ))}
          </View>
        )}
        {(errors.ticketPrice || errors.ticketCurrency) && (
          <Text className="text-xs text-error">{errors.ticketPrice || errors.ticketCurrency}</Text>
        )}
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

      {/* ── Share to feed (create only) ── */}
      {!isEditing && (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-white">Share to feed</Text>
            <Text className="text-xs text-neutral-500">
              Also post this to your feed so followers see it. It stays in sync and drops off once
              the event has passed.
            </Text>
          </View>
          <Switch
            value={shareToFeed}
            onValueChange={onShareToFeedChange}
            accessibilityLabel="Share to feed"
            trackColor={{ true: '#6C63FF', false: '#3a3a3a' }}
            thumbColor="#ffffff"
          />
        </View>
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
