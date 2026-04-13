import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { EventCategory } from '@CeolX/shared';
import { CATEGORY_LABELS } from '@CeolX/shared';

import { CollaboratorPicker } from './CollaboratorPicker';
import { CollectionPicker } from './CollectionPicker';
import { InviteArtistPicker } from './InviteArtistPicker';

import type { CollaboratorArtist } from '@/hooks/use-event-form';

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  coverImageUri: string | null;
  onPickImage: () => void;
  category: EventCategory | '';
  onCategoryChange: (v: EventCategory | '') => void;
  onCategoryPress: () => void;
  collectionId: string;
  onCollectionIdChange: (v: string) => void;
  collaborators: string[];
  onCollaboratorsChange: (ids: string[]) => void;
  collaboratorArtists: CollaboratorArtist[];
  onCollaboratorArtistsChange: (artists: CollaboratorArtist[]) => void;
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
  description,
  onDescriptionChange,
  coverImageUri,
  onPickImage,
  category,
  onCategoryChange: _onCategoryChange,
  onCategoryPress,
  collectionId,
  onCollectionIdChange,
  collaborators,
  onCollaboratorsChange,
  collaboratorArtists,
  onCollaboratorArtistsChange,
  platformInvites,
  onPlatformInvitesChange,
  unregisteredCollaborators,
  onUnregisteredCollaboratorsChange,
  errors,
  onContinue,
  isVenue,
}: Props) {
  const categoryLabel = category && CATEGORY_LABELS[category] ? CATEGORY_LABELS[category] : null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-10 gap-6"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Event Title ── */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-gray-3 font-urbanist">Event Title</Text>
        <TextInput
          className={cn(
            'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist',
            errors.title ? 'border-error' : 'border-gray-8'
          )}
          placeholder="Enter event title"
          placeholderTextColor="#8d8d8d"
          value={title}
          onChangeText={onTitleChange}
          maxLength={120}
        />
        {errors.title && <Text className="text-xs text-error font-urbanist">{errors.title}</Text>}
      </View>

      {/* ── Event Banner / Image ── */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-gray-3 font-urbanist">Event Banner/Image</Text>
        <Pressable onPress={onPickImage}>
          {coverImageUri ? (
            <View className="rounded-xl overflow-hidden">
              <Image
                source={{ uri: coverImageUri }}
                className="w-full h-44 rounded-xl"
                resizeMode="cover"
              />
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
          <Text className="text-sm font-semibold text-gray-3 font-urbanist">Event Description</Text>
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
        <Text className="text-sm font-semibold text-gray-3 font-urbanist">Category</Text>
        <Pressable
          onPress={onCategoryPress}
          className={cn(
            'flex-row items-center justify-between rounded-lg border bg-surface px-4 py-3',
            errors.category ? 'border-error' : 'border-gray-8'
          )}
        >
          <Text
            className={cn('text-sm font-urbanist', categoryLabel ? 'text-white' : 'text-gray-7')}
          >
            {categoryLabel ?? 'Select Category'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#8d8d8d" />
        </Pressable>
        {errors.category && (
          <Text className="text-xs text-error font-urbanist">{errors.category}</Text>
        )}
      </View>

      {/* ── Collection (optional) — Venues only ── */}
      {isVenue && (
        <CollectionPicker collectionId={collectionId} onCollectionIdChange={onCollectionIdChange} />
      )}

      {/* ── Collaborators + Invite Artists — Venues only ── */}
      {isVenue && (
        <>
          <CollaboratorPicker
            collaborators={collaborators}
            onCollaboratorsChange={onCollaboratorsChange}
            initialSelectedArtists={collaboratorArtists}
            onCollaboratorObjectsChange={onCollaboratorArtistsChange}
            isRequired
            error={errors.collaborators}
          />

          <InviteArtistPicker
            platformInvites={platformInvites}
            onPlatformInvitesChange={onPlatformInvitesChange}
            unregisteredInvites={unregisteredCollaborators}
            onUnregisteredInvitesChange={onUnregisteredCollaboratorsChange}
          />
        </>
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
