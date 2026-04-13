import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { EventCategory } from '@CeolX/shared';

import { CategoryPicker } from './CategoryPicker';
import { CollaboratorPicker } from './CollaboratorPicker';
import { CollectionPicker } from './CollectionPicker';
import { InviteArtistPicker } from './InviteArtistPicker';

import { useCollections, useCreateCollection } from '@/hooks/use-collections';
import type { CollaboratorArtist } from '@/hooks/use-event-form';

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  coverImageUri: string | null;
  onPickImage: () => void;
  category: EventCategory | '';
  onCategoryChange: (v: EventCategory) => void;
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
  onCategoryChange,
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
        <CategoryPicker value={category} onChange={onCategoryChange} error={errors.category} />
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

// ─── Collection Picker ────────────────────────────────────────────────────────

function CollectionPicker({
  collectionId,
  onCollectionIdChange,
}: {
  collectionId: string;
  onCollectionIdChange: (v: string) => void;
}) {
  const { data: collections, isLoading } = useCollections();
  const createMutation = useCreateCollection();

  const [visible, setVisible] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const selectedName = collections?.find((c) => c.id === collectionId)?.name;

  const handleSelect = (id: string) => {
    onCollectionIdChange(id);
    setVisible(false);
  };

  const handleClear = () => {
    onCollectionIdChange('');
    setVisible(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createMutation.mutateAsync({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });
    onCollectionIdChange(result.id);
    setNewName('');
    setNewDescription('');
    setShowCreate(false);
    setVisible(false);
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-gray-3 font-urbanist">Collection (optional)</Text>
      <Pressable
        className="flex-row items-center justify-between rounded-lg border border-gray-8 bg-surface px-4 py-3"
        onPress={() => setVisible(true)}
      >
        <Text className={cn('text-sm font-urbanist', selectedName ? 'text-white' : 'text-gray-7')}>
          {selectedName ?? 'Select Collection'}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#8d8d8d" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable className="flex-1 bg-black/60" onPress={() => setVisible(false)} />
        <View className="bg-[#1a1a1a] rounded-t-2xl px-5 pt-4 pb-8 max-h-[70%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-bold text-white font-urbanist">Select Collection</Text>
            <Pressable onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Clear selection */}
            {collectionId && (
              <Pressable className="py-3 border-b border-white/10" onPress={handleClear}>
                <Text className="text-sm text-white/60 font-urbanist">
                  None (remove from collection)
                </Text>
              </Pressable>
            )}

            {/* Existing collections */}
            {isLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator color="#C8FF2F" />
              </View>
            ) : (
              collections?.map((c) => (
                <Pressable
                  key={c.id}
                  className={cn(
                    'py-3 border-b border-white/10 flex-row items-center justify-between',
                    c.id === collectionId && 'bg-white/5'
                  )}
                  onPress={() => handleSelect(c.id)}
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-semibold text-white font-urbanist">{c.name}</Text>
                    <Text className="text-xs text-white/40 font-urbanist">
                      {c.eventCount} event{c.eventCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {c.id === collectionId && <Ionicons name="checkmark" size={18} color="#C8FF2F" />}
                </Pressable>
              ))
            )}

            {/* Create new */}
            {!showCreate ? (
              <Pressable
                className="py-3 flex-row items-center gap-2"
                onPress={() => setShowCreate(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#C8FF2F" />
                <Text className="text-sm font-semibold text-[#C8FF2F] font-urbanist">
                  Create New Collection
                </Text>
              </Pressable>
            ) : (
              <View className="py-3 gap-3">
                <TextInput
                  className="h-10 rounded-lg bg-white/10 px-3 text-white text-sm font-urbanist"
                  placeholder="Collection name"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={100}
                  autoFocus
                />
                <TextInput
                  className="h-16 rounded-lg bg-white/10 px-3 pt-2 text-white text-sm font-urbanist"
                  placeholder="Description (optional)"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newDescription}
                  onChangeText={setNewDescription}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                />
                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 h-10 rounded-lg border border-white/20 items-center justify-center"
                    onPress={() => {
                      setShowCreate(false);
                      setNewName('');
                      setNewDescription('');
                    }}
                  >
                    <Text className="text-sm text-white/60 font-urbanist">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 h-10 rounded-lg bg-[#C8FF2F] items-center justify-center"
                    onPress={handleCreate}
                    disabled={createMutation.isPending || !newName.trim()}
                  >
                    {createMutation.isPending ? (
                      <ActivityIndicator color="#080808" />
                    ) : (
                      <Text className="text-sm font-bold text-black font-urbanist">
                        Create & Select
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
