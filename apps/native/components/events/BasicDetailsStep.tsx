import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { EVENT_DESCRIPTION_MAX, EVENT_TITLE_MAX } from '@CeolX/shared/validators';

import type { ArtistResult } from './ArtistSearchRow';
import { CategoryPicker } from './CategoryPicker';
import { CollectionPicker } from './CollectionPicker';
import { FieldLabel } from './FieldLabel';
import { InviteArtistPicker } from './InviteArtistPicker';

import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';
import { clampFeedRatio, FALLBACK_RATIO, useImageRatio } from '@/hooks/use-image-ratio';

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
  platformInvites: ArtistResult[];
  onPlatformInvitesChange: (artists: ArtistResult[]) => void;
  unregisteredCollaborators: Array<{ name: string; email: string; imageUrl?: string }>;
  onUnregisteredCollaboratorsChange: (
    invites: Array<{ name: string; email: string; imageUrl?: string }>
  ) => void;
  errors: Record<string, string>;
  onContinue: () => void;
  isVenue: boolean;
  /** Current user's id — excluded from the invite search so a creator can't invite themselves. */
  myUserId?: string;
};

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
  myUserId,
}: Props) {
  // Preview the cover at the shape the event screens will use, so the poster
  // the creator approves here is the poster that gets published.
  const naturalCoverRatio = useImageRatio(coverImageUri);
  const coverRatio =
    naturalCoverRatio === null ? FALLBACK_RATIO : clampFeedRatio(naturalCoverRatio);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-10 gap-6"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Event Title ── */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <FieldLabel
            label="Event Title"
            hint="The name of your event as it appears on the map, feed and event page. Keep it short and descriptive."
          />
          <CharacterCount
            count={title.length}
            max={EVENT_TITLE_MAX}
            className="text-xs text-gray-7 font-urbanist"
          />
        </View>
        <TextInput
          className={cn(
            'rounded-lg border bg-surface px-4 py-3 text-[14px] text-white font-urbanist',
            errors.title ? 'border-error' : 'border-gray-8'
          )}
          placeholder="Enter event title"
          placeholderTextColor="#8d8d8d"
          value={title}
          onChangeText={onTitleChange}
          onBlur={onTitleBlur}
          maxLength={EVENT_TITLE_MAX}
        />
        {errors.title && <Text className="text-xs text-error font-urbanist">{errors.title}</Text>}
        <CharacterLimitNote count={title.length} max={EVENT_TITLE_MAX} />
      </View>

      {/* ── Event Banner / Image ── */}
      <View className="gap-2">
        <FieldLabel
          label="Event Banner/Image"
          hint="The cover image shown on your event card and detail page. PNG or JPEG, max 100kb."
        />
        <Pressable onPress={onPickImage}>
          {coverImageUri ? (
            <View style={{ aspectRatio: coverRatio }} className="rounded-xl overflow-hidden">
              {/* The image must be a normal flow child (h-full w-full), NOT
                  absolute inset-0. On Android, an absolutely-positioned <Image>
                  contributes nothing to layout, so when it's revealed inside an
                  already-mounted step (after picking) it attaches before its
                  frame resolves — Fresco requests a 0-sized bitmap and never
                  repaints, so the picked image stayed blank until a full remount
                  (going to step 2 and back). A flow child is measured on
                  insertion, so Fresco gets real bounds immediately. Same pattern
                  as the post MediaPickerField preview. (Asana 1215040939202669) */}
              <Image source={{ uri: coverImageUri }} className="h-full w-full" resizeMode="cover" />
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
          <CharacterCount
            count={description.length}
            max={EVENT_DESCRIPTION_MAX}
            className="text-xs text-gray-7 font-urbanist"
          />
        </View>
        <TextInput
          className={cn(
            'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist min-h-[120px]',
            errors.description ? 'border-error' : 'border-gray-8'
          )}
          placeholder="Describe your event"
          placeholderTextColor="#8d8d8d"
          value={description}
          // Cap natively so the limit also applies to paste, and slice
          // defensively so an over-long paste can never reach state.
          onChangeText={(text) => onDescriptionChange(text.slice(0, EVENT_DESCRIPTION_MAX))}
          onBlur={onDescriptionBlur}
          multiline
          textAlignVertical="top"
          maxLength={EVENT_DESCRIPTION_MAX}
        />
        {errors.description && (
          <Text className="text-xs text-error font-urbanist">{errors.description}</Text>
        )}
        <CharacterLimitNote count={description.length} max={EVENT_DESCRIPTION_MAX} />
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

      {/* ── Invite Artists — Venues invite performers, Artists invite co-artists ── */}
      <InviteArtistPicker
        platformInvites={platformInvites}
        onPlatformInvitesChange={onPlatformInvitesChange}
        unregisteredInvites={unregisteredCollaborators}
        onUnregisteredInvitesChange={onUnregisteredCollaboratorsChange}
        myUserId={myUserId}
      />

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
