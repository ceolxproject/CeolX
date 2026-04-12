import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useCallback, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { AddArtistModal } from './AddArtistModal';

import { useArtistSearch } from '@/hooks/use-artist-search';

export type SelectedArtist = {
  id: string;
  userId: string;
  name: string;
  image?: string;
};

export type ExternalArtist = {
  name: string;
  email: string;
};

interface CollaboratorFieldProps {
  selectedArtists: SelectedArtist[];
  onArtistsChange: (artists: SelectedArtist[]) => void;
  externalArtists: ExternalArtist[];
  onExternalArtistsChange: (artists: ExternalArtist[]) => void;
  isVenue: boolean;
}

export function CollaboratorField({
  selectedArtists,
  onArtistsChange,
  externalArtists,
  onExternalArtistsChange,
  isVenue,
}: CollaboratorFieldProps) {
  const { query, setQuery, artists, isLoading } = useArtistSearch();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSelect = useCallback(
    (artist: { id: string; userId: string; stageName: string; image: string | null }) => {
      if (selectedArtists.some((a) => a.userId === artist.userId)) return;
      onArtistsChange([
        ...selectedArtists,
        {
          id: artist.id,
          userId: artist.userId,
          name: artist.stageName,
          image: artist.image ?? undefined,
        },
      ]);
      setQuery('');
      setShowDropdown(false);
    },
    [selectedArtists, onArtistsChange, setQuery]
  );

  const handleRemove = useCallback(
    (userId: string) => {
      onArtistsChange(selectedArtists.filter((a) => a.userId !== userId));
    },
    [selectedArtists, onArtistsChange]
  );

  const handleRemoveExternal = useCallback(
    (email: string) => {
      onExternalArtistsChange(externalArtists.filter((a) => a.email !== email));
    },
    [externalArtists, onExternalArtistsChange]
  );

  const handleAddExternal = useCallback(
    (artist: ExternalArtist) => {
      if (externalArtists.some((a) => a.email === artist.email)) return;
      onExternalArtistsChange([...externalArtists, artist]);
      setShowAddModal(false);
    },
    [externalArtists, onExternalArtistsChange]
  );

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-gray-3 font-urbanist">
        Collaborators (optional)
      </Text>

      {/* Search input */}
      <View className="relative">
        <View className="flex-row items-center rounded-lg border border-gray-8 bg-surface px-4 py-3 gap-2">
          <Ionicons name="search-outline" size={16} color="#8d8d8d" />
          <TextInput
            className="flex-1 text-sm text-white font-urbanist"
            placeholder="Search artists to collaborate"
            placeholderTextColor="#8d8d8d"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowDropdown(text.trim().length > 0);
            }}
            onFocus={() => {
              if (query.trim().length > 0) setShowDropdown(true);
            }}
          />
          {isVenue && (
            <Pressable onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle-outline" size={20} color="#C8FF2F" />
            </Pressable>
          )}
        </View>

        {/* Dropdown results */}
        {showDropdown && query.trim().length > 0 && (
          <View className="absolute top-14 left-0 right-0 z-50 rounded-lg border border-gray-8 bg-[#1a1a1a] max-h-52 overflow-hidden">
            {isLoading ? (
              <View className="px-4 py-3">
                <Text className="text-xs text-white/40 font-urbanist">Searching...</Text>
              </View>
            ) : artists.length > 0 ? (
              <>
                {artists.map((artist) => {
                  const isSelected = selectedArtists.some((a) => a.userId === artist.userId);
                  return (
                    <Pressable
                      key={artist.id}
                      onPress={() => handleSelect(artist)}
                      disabled={isSelected}
                      className={cn(
                        'flex-row items-center gap-3 px-4 py-2.5 active:bg-white/5',
                        isSelected && 'opacity-40'
                      )}
                    >
                      {artist.image ? (
                        <Image source={{ uri: artist.image }} className="w-8 h-8 rounded-full" />
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                          <Ionicons name="person" size={14} color="rgba(255,255,255,0.4)" />
                        </View>
                      )}
                      <Text className="text-sm text-white font-urbanist flex-1">
                        {artist.stageName}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color="#C8FF2F" />}
                    </Pressable>
                  );
                })}
                {/* Add external artist option */}
                {isVenue && (
                  <Pressable
                    onPress={() => {
                      setShowDropdown(false);
                      setShowAddModal(true);
                    }}
                    className="flex-row items-center gap-3 px-4 py-2.5 border-t border-gray-8 active:bg-white/5"
                  >
                    <View className="w-8 h-8 rounded-full bg-[#C8FF2F]/10 items-center justify-center">
                      <Ionicons name="add" size={16} color="#C8FF2F" />
                    </View>
                    <Text className="text-sm text-[#C8FF2F] font-urbanist">
                      Invite artist not on CeolX
                    </Text>
                  </Pressable>
                )}
              </>
            ) : (
              <View className="px-4 py-3">
                <Text className="text-xs text-white/40 font-urbanist mb-2">No artists found</Text>
                {isVenue && (
                  <Pressable
                    onPress={() => {
                      setShowDropdown(false);
                      setShowAddModal(true);
                    }}
                    className="flex-row items-center gap-2"
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#C8FF2F" />
                    <Text className="text-xs text-[#C8FF2F] font-urbanist">
                      Invite artist not on CeolX
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Selected artists chips */}
      {(selectedArtists.length > 0 || externalArtists.length > 0) && (
        <View className="flex-row flex-wrap gap-2 mt-1">
          {selectedArtists.map((artist) => (
            <View
              key={artist.userId}
              className="flex-row items-center gap-1.5 bg-white/10 rounded-full pl-1 pr-2 py-1"
            >
              {artist.image ? (
                <Image source={{ uri: artist.image }} className="w-5 h-5 rounded-full" />
              ) : (
                <View className="w-5 h-5 rounded-full bg-white/20 items-center justify-center">
                  <Ionicons name="person" size={10} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <Text className="text-xs text-white font-urbanist">{artist.name}</Text>
              <Pressable onPress={() => handleRemove(artist.userId)} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          ))}
          {externalArtists.map((artist) => (
            <View
              key={artist.email}
              className="flex-row items-center gap-1.5 bg-[#C8FF2F]/10 rounded-full pl-2 pr-2 py-1"
            >
              <Ionicons name="mail-outline" size={10} color="#C8FF2F" />
              <Text className="text-xs text-[#C8FF2F] font-urbanist">{artist.name}</Text>
              <Pressable onPress={() => handleRemoveExternal(artist.email)} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color="rgba(200,255,47,0.5)" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <AddArtistModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onInvite={handleAddExternal}
      />
    </View>
  );
}
