import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'heroui-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLLECTION_NAME_MAX } from '@CeolX/shared/validators';

import { FieldLabel } from './FieldLabel';

import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';
import { trpc } from '@/utils/trpc';

interface Props {
  collectionId: string;
  onCollectionIdChange: (id: string) => void;
}

export function CollectionPicker({ collectionId, onCollectionIdChange }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');

  const { data: collections = [], isLoading } = useQuery(trpc.collections.list.queryOptions());

  const { mutate: createCollection, isPending } = useMutation(
    trpc.collections.create.mutationOptions({
      onSuccess: (created) => {
        void queryClient.invalidateQueries({ queryKey: [['collections', 'list']] });
        onCollectionIdChange(created.id);
        setShowCreateModal(false);
        setNewName('');
        setNameError('');
      },
    })
  );

  const selected = collections.find((c) => c.id === collectionId);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError('Collection name is required');
      return;
    }
    createCollection({ name: trimmed });
  };

  return (
    <View className="gap-2">
      {/* Label row */}
      <View className="flex-row items-center justify-between">
        <FieldLabel
          label="Collection (optional)"
          hint="Group related events together (e.g. all gigs in one festival) so fans can browse them as a set."
        />
        <Pressable
          onPress={() => {
            setShowDropdown(false);
            setShowCreateModal(true);
          }}
        >
          <Text className="text-xs font-bold text-[#C8FF2F] font-urbanist tracking-wide">
            CREATE NEW
          </Text>
        </Pressable>
      </View>

      {/* Dropdown trigger */}
      <Pressable
        className={cn(
          'flex-row items-center justify-between rounded-lg border bg-surface px-4 py-3',
          showDropdown ? 'border-[#6C63FF]' : 'border-gray-8'
        )}
        onPress={() => setShowDropdown((v) => !v)}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#8d8d8d" />
        ) : (
          <Text
            className={`flex-1 text-sm font-urbanist ${selected ? 'text-white' : 'text-gray-7'}`}
          >
            {selected?.name ?? 'Select Collection'}
          </Text>
        )}
        <Ionicons name={showDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#8d8d8d" />
      </Pressable>

      {/* Inline dropdown list */}
      {showDropdown && (
        <View className="rounded-lg border border-gray-8 bg-surface overflow-hidden">
          {/* Clear selection */}
          <Pressable
            className="px-4 py-3 border-b border-gray-8 active:bg-white/5"
            onPress={() => {
              onCollectionIdChange('');
              setShowDropdown(false);
            }}
          >
            <Text className="text-sm text-gray-7 font-urbanist">None</Text>
          </Pressable>

          {collections.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-gray-7 font-urbanist">
                No collections yet — create one above
              </Text>
            </View>
          ) : (
            collections.map((c) => (
              <Pressable
                key={c.id}
                className={cn(
                  'flex-row items-center justify-between px-4 py-3 active:bg-white/5',
                  c.id === collectionId && 'bg-[#C8FF2F]/10'
                )}
                onPress={() => {
                  onCollectionIdChange(c.id);
                  setShowDropdown(false);
                }}
              >
                <Text
                  className={cn(
                    'flex-1 text-sm font-urbanist',
                    c.id === collectionId ? 'font-bold text-[#C8FF2F]' : 'text-white'
                  )}
                >
                  {c.name}
                </Text>
                {c.id === collectionId && <Ionicons name="checkmark" size={16} color="#C8FF2F" />}
              </Pressable>
            ))
          )}
        </View>
      )}

      {/* Helper text */}
      <Text className="text-xs text-gray-7 font-urbanist">
        Group events together under a Collection (e.g. a festival)
      </Text>

      {/* Create new modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        {/* RN Modal spawns a native window that ignores the activity's
            adjustResize softInputMode, so this bottom-anchored sheet otherwise
            sits behind the keyboard and the name input is hidden. 'padding'
            behavior lifts the sheet above the keyboard on both platforms. NB:
            'height' on Android double-corrects against the window's own
            adjustResize and oscillates into a flicker (asana 1215453204049374),
            so keep this 'padding' on both platforms — same as InviteArtistPicker. */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1 bg-black/60 justify-end"
            onPress={() => setShowCreateModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-[#1B1B1B] rounded-t-2xl px-5 pt-6"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <Text className="text-lg font-bold text-white font-urbanist mb-4">
                Create Collection
              </Text>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-gray-3 font-urbanist">
                  Collection Name
                </Text>
                <CharacterCount
                  count={newName.length}
                  max={COLLECTION_NAME_MAX}
                  className="text-xs text-gray-3 font-urbanist"
                />
              </View>
              <TextInput
                className="rounded-lg border border-gray-8 bg-surface px-4 py-3 text-[14px] text-white font-urbanist"
                placeholder="e.g. Summer Festival 2026"
                placeholderTextColor="#8d8d8d"
                value={newName}
                onChangeText={(v) => {
                  setNewName(v.slice(0, COLLECTION_NAME_MAX));
                  if (nameError) setNameError('');
                }}
                maxLength={COLLECTION_NAME_MAX}
              />
              {nameError ? (
                <Text className="text-xs text-error font-urbanist mt-1">{nameError}</Text>
              ) : null}
              <CharacterLimitNote
                count={newName.length}
                max={COLLECTION_NAME_MAX}
                className="mt-1"
              />

              <View className="flex-row gap-3 mt-5">
                <Pressable
                  className="flex-1 items-center justify-center rounded-xl border border-white py-3 active:opacity-80"
                  onPress={() => {
                    setShowCreateModal(false);
                    setNewName('');
                    setNameError('');
                  }}
                >
                  <Text className="text-sm font-bold text-white font-urbanist">Cancel</Text>
                </Pressable>

                <Pressable
                  className="flex-1 items-center justify-center rounded-xl bg-[#6C63FF] py-3 active:opacity-80"
                  onPress={handleCreate}
                  disabled={isPending}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-sm font-bold text-white font-urbanist">Create</Text>
                  )}
                </Pressable>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
