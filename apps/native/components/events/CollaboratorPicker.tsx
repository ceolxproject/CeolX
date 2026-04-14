import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import type { ArtistResult } from './ArtistSearchRow';
import { ArtistSearchRow } from './ArtistSearchRow';
import { SelectedChips } from './SelectedChips';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { trpc } from '@/utils/trpc';

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
  const debouncedQuery = useDebouncedValue(query);
  const [selectedArtists, setSelectedArtists] = useState<ArtistResult[]>(
    initialSelectedArtists ?? []
  );
  const [showDropdown, setShowDropdown] = useState(false);

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
            <ArtistSearchRow
              key={artist.id}
              artist={artist}
              onPress={() => addCollaborator(artist)}
            />
          ))}
        </View>
      )}

      {/* Selected collaborator chips */}
      <SelectedChips
        items={selectedArtists.map((a) => ({ key: a.id, label: a.stageName }))}
        onRemove={removeCollaborator}
        variant="purple"
      />

      {error && <Text className="text-xs text-error font-urbanist">{error}</Text>}
    </View>
  );
}
