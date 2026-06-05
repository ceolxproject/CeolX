import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';

import { CategoryPicker } from './CategoryPicker';
import { CollectionPicker } from './CollectionPicker';
import { FieldLabel } from './FieldLabel';
import { InviteArtistPicker } from './InviteArtistPicker';

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  /** Validate the title once the user leaves the field (real-time validation). */
  onTitleBlur?: () => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  /** Validate the description once the user leaves the field. */
  onDescriptionBlur?: () => void;
  coverImageUri: string | null;
  onPickImage: () => void;
  onRemoveImage: () => void;
  category: EventCategory | '';
  onCategoryChange: (v: EventCategory) => void;
  collectionId: string;
  onCollectionIdChange: (v: string) => void;
  platformInvites: string[];
  onPlatformInvitesChange: (ids: string[]) => void;
  unregisteredCollaborators: Array<{ name: string; email: string }>;
  onUnregisteredCollaboratorsChange: (invites: Array<{ name: string; email: string }>) => void;
  errors: Record<string, string>;
  onContinue: () => void;
  isVenue: boolean;
};

const MAX_DESCRIPTION_LENGTH = 2000;

export function BasicDetailsStep({
  title,
  onTitleChange,
  onTitleBlur,
  description,
  onDescriptionChange,
  onDescriptionBlur,
  coverImageUri,
  onPickImage,
  onRemoveImage,
  category,
  onCategoryChange,
  collectionId,
  onCollectionIdChange,
  platformInvites,
  onPlatformInvitesChange,
  unregisteredCollaborators,
  onUnregisteredCollaboratorsChange,
  errors,
  onContinue,
  isVenue,
}: Props) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-10 gap-6"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Event Title ── */}
      <View className="gap-2">
        <FieldLabel
          label="Event Title"
          hint="The name of your event as it appears on the map, feed and event page. Keep it short and descriptive."
        />
        <TextInput
          className={cn(
            'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist',
            errors.title ? 'border-error' : 'border-gray-8'
          )}
          placeholder="Enter event title"
          placeholderTextColor="#8d8d8d"
          value={title}
          onChangeText={onTitleChange}
          onBlur={onTitleBlur}
          maxLength={120}
        />
        {errors.title && <Text className="text-xs text-error font-urbanist">{errors.title}</Text>}
      </View>

      {/* ── Event Banner / Image ── */}
      <View className="gap-2">
        <FieldLabel
          label="Event Banner/Image"
          hint="The cover image shown on your event card and detail page. PNG or JPEG, max 100kb."
        />
        <Pressable onPress={onPickImage}>
          {coverImageUri ? (
            <View className="h-44 rounded-xl overflow-hidden">
              {/* Height lives on the wrapper View (uniwind sizes Views reliably).
                  The image MUST be absolute inset-0, not a plain percentage h-full:
                  on Android, RN <Image> sized only by height:'100%' lays out a box
                  but never paints the bitmap (Fresco needs resolved pixel bounds),
                  so the picked image showed blank on Android while fine on iOS.
                  inset-0 pins it to the wrapper's resolved frame — same pattern as
                  EventHeroImage / BaseEventCard. (Asana 1215040939202669) */}
              <Image
                source={{ uri: coverImageUri }}
                className="absolute inset-0 w-full h-full"
                resizeMode="cover"
              />
              {/* Tap the image to replace; tap ✕ to clear. Stops propagation so
                  removing doesn't also re-open the picker. */}
              <Pressable
                onPress={onRemoveImage}
                hitSlop={10}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View
              className={cn(
                'h-44 rounded-xl items-center justify-center gap-2 bg-white/5',
                errors.coverImageUri
                  ? 'border border-error border-dashed'
                  : 'border border-dashed border-gray-8'
              )}
            >
              <Ionicons name="cloud-upload-outline" size={32} color="#8d8d8d" />
              <Text className="text-sm text-gray-7 font-urbanist">Upload Image</Text>
            </View>
          )}
        </Pressable>
        <Text className="text-xs text-gray-7 font-urbanist">
          Image type png or jpeg with a max file size 100kb
        </Text>
        {errors.coverImageUri && (
          <Text className="text-xs text-error font-urbanist">{errors.coverImageUri}</Text>
        )}
      </View>

      {/* ── Event Description ── */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <FieldLabel
            label="Event Description"
            hint="Tell fans what to expect — the acts, the vibe, and any details they should know before they go."
          />
          <Text className="text-xs text-gray-7 font-urbanist">
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </Text>
        </View>
        <TextInput
          className={cn(
            'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist min-h-[120px]',
            errors.description ? 'border-error' : 'border-gray-8'
          )}
          placeholder="Describe your event"
          placeholderTextColor="#8d8d8d"
          value={description}
          onChangeText={(text) => {
            if (text.length <= MAX_DESCRIPTION_LENGTH) {
              onDescriptionChange(text);
            }
          }}
          onBlur={onDescriptionBlur}
          multiline
          textAlignVertical="top"
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        {errors.description && (
          <Text className="text-xs text-error font-urbanist">{errors.description}</Text>
        )}
      </View>

      {/* ── Category ── */}
      <View className="gap-2">
        <FieldLabel
          label="Category"
          hint="Pick the type of event so the right audience can discover it when filtering the map and feed."
        />
        <CategoryPicker value={category} onChange={onCategoryChange} error={errors.category} />
      </View>

      {/* ── Collection (optional) — Venues only ── */}
      {isVenue && (
        <CollectionPicker collectionId={collectionId} onCollectionIdChange={onCollectionIdChange} />
      )}

      {/* ── Invite Artists — Venues only ── */}
      {isVenue && (
        <InviteArtistPicker
          platformInvites={platformInvites}
          onPlatformInvitesChange={onPlatformInvitesChange}
          unregisteredInvites={unregisteredCollaborators}
          onUnregisteredInvitesChange={onUnregisteredCollaboratorsChange}
        />
      )}

      {/* ── Continue Button ── */}
      <Pressable
        onPress={onContinue}
        className="bg-[#6C63FF] rounded-xl py-4 items-center mt-2"
        accessibilityRole="button"
      >
        <Text className="text-white text-base font-bold font-urbanist">CONTINUE</Text>
      </Pressable>
    </ScrollView>
  );
}
