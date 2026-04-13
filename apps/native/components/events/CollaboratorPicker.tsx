import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { CollaboratorArtist } from '@/hooks/use-event-form';
import { trpc } from '@/utils/trpc';

type ArtistResult = CollaboratorArtist;

type Props = {
  collaborators: string[];
  onCollaboratorsChange: (ids: string[]) => void;
  /** Full artist objects for already-selected collaborators.
   *  Used to re-seed chips when this component remounts after step navigation. */
  initialSelectedArtists?: ArtistResult[];
  onCollaboratorObjectsChange: (artists: ArtistResult[]) => void;
  isRequired?: boolean;
  error?: string;
};

export function CollaboratorPicker({
  collaborators,
  onCollaboratorsChange,
  initialSelectedArtists,
  onCollaboratorObjectsChange,
  isRequired,
  error,
}: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Seeded from props on every (re)mount so chips survive step navigation.
  const [selectedArtists, setSelectedArtists] = useState<ArtistResult[]>(
    initialSelectedArtists ?? []
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data } = useQuery({
    ...trpc.artists.search.queryOptions({ q: debouncedQuery }),
    enabled: debouncedQuery.length >= 1,
  });

  const results = (data?.artists ?? []).filter((a) => !collaborators.includes(a.id));

  function addCollaborator(artist: ArtistResult) {
    const nextArtists = [...selectedArtists, artist];
    setSelectedArtists(nextArtists);
    onCollaboratorsChange(nextArtists.map((a) => a.id));
    onCollaboratorObjectsChange(nextArtists);
    setQuery('');
    setDebouncedQuery('');
    setShowDropdown(false);
  }

  function removeCollaborator(id: string) {
    const nextArtists = selectedArtists.filter((a) => a.id !== id);
    setSelectedArtists(nextArtists);
    onCollaboratorsChange(nextArtists.map((a) => a.id));
    onCollaboratorObjectsChange(nextArtists);
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-3 font-urbanist">
          Collaborators{isRequired ? ' *' : ' (optional)'}
        </Text>
        <Text className="text-xs text-gray-7 font-urbanist">Confirmed performers</Text>
      </View>

      {/* Search input */}
      <View
        className={`flex-row items-center rounded-lg border bg-surface px-4 py-3 gap-2 ${error ? 'border-error' : 'border-gray-8'}`}
      >
        <Ionicons name="search-outline" size={16} color="#8d8d8d" />
        <TextInput
          className="flex-1 text-sm text-white font-urbanist"
          placeholder="Search artists by name..."
          placeholderTextColor="#8d8d8d"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
        />
      </View>

      {/* Dropdown results */}
      {showDropdown && results.length > 0 && (
        <View className="rounded-lg border border-gray-8 bg-surface overflow-hidden">
          {results.map((artist) => (
            <Pressable
              key={artist.id}
              onPress={() => addCollaborator(artist)}
              className="flex-row items-center gap-3 px-4 py-3 border-b border-gray-8 last:border-b-0 active:bg-white/10"
            >
              {artist.image ? (
                <Image source={{ uri: artist.image }} className="w-8 h-8 rounded-full" />
              ) : (
                <View className="w-8 h-8 rounded-full bg-[#6C63FF]/30 items-center justify-center">
                  <Ionicons name="person" size={14} color="#6C63FF" />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-sm text-white font-urbanist">{artist.stageName}</Text>
                {artist.genre && (
                  <Text className="text-xs text-gray-7 font-urbanist">{artist.genre}</Text>
                )}
              </View>
              <Ionicons name="add-circle-outline" size={20} color="#6C63FF" />
            </Pressable>
          ))}
        </View>
      )}

      {/* Selected collaborator chips */}
      {selectedArtists.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {selectedArtists.map((artist) => (
              <View
                key={artist.id}
                className="flex-row items-center gap-1.5 rounded-full bg-[#6C63FF]/20 px-3 py-1.5 border border-[#6C63FF]/40"
              >
                <Text className="text-xs text-[#6C63FF] font-semibold font-urbanist">
                  {artist.stageName}
                </Text>
                <Pressable onPress={() => removeCollaborator(artist.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color="#6C63FF" />
                </Pressable>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {error && <Text className="text-xs text-error font-urbanist">{error}</Text>}
    </View>
  );
}
