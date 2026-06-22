import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ArtistResult } from './ArtistSearchRow';
import { ArtistSearchRow } from './ArtistSearchRow';
import { FieldLabel } from './FieldLabel';
import type { ChipItem } from './SelectedChips';
import { SelectedChips } from './SelectedChips';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { trpc } from '@/utils/trpc';

type UnregisteredInvite = {
  name: string;
  email: string;
};

type Props = {
  platformInvites: ArtistResult[];
  onPlatformInvitesChange: (artists: ArtistResult[]) => void;
  unregisteredInvites: UnregisteredInvite[];
  onUnregisteredInvitesChange: (invites: UnregisteredInvite[]) => void;
  /** Current user's id — hidden from results so an artist can't invite themselves. */
  myUserId?: string;
};

export function InviteArtistPicker({
  platformInvites,
  onPlatformInvitesChange,
  unregisteredInvites,
  onUnregisteredInvitesChange,
  myUserId,
}: Props) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteErrors, setInviteErrors] = useState<{ name?: string; email?: string }>({});

  const { data } = useQuery({
    ...trpc.artists.search.queryOptions({ q: debouncedQuery }),
    enabled: debouncedQuery.length >= 1,
  });

  // Hide already-invited artists and the creator themselves. artists.search
  // returns id = artist_profiles.user_id, which matches the current user's id.
  const results = (data?.artists ?? []).filter(
    (a) => !platformInvites.some((p) => p.id === a.id) && a.id !== myUserId
  );

  function addPlatformInvite(artist: ArtistResult) {
    // Skip if already invited — the search list filters these out, but guard
    // anyway so a stale tap can't push a duplicate into the lifted state.
    if (platformInvites.some((p) => p.id === artist.id)) return;
    onPlatformInvitesChange([...platformInvites, artist]);
    setQuery('');
    setShowDropdown(false);
  }

  function removePlatformInvite(id: string) {
    onPlatformInvitesChange(platformInvites.filter((a) => a.id !== id));
  }

  function removeUnregisteredInvite(email: string) {
    onUnregisteredInvitesChange(unregisteredInvites.filter((i) => i.email !== email));
  }

  function handleSendInvite() {
    const errors: { name?: string; email?: string } = {};
    if (!inviteName.trim()) errors.name = 'Name is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!inviteEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(inviteEmail.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }

    onUnregisteredInvitesChange([
      ...unregisteredInvites,
      { name: inviteName.trim(), email: inviteEmail.trim() },
    ]);
    setInviteName('');
    setInviteEmail('');
    setInviteErrors({});
    setShowInviteModal(false);
  }

  const inviteChips = useMemo<ChipItem[]>(() => {
    const platform = platformInvites.map((a) => ({
      key: `platform:${a.id}`,
      label: a.stageName,
      icon: 'paper-plane-outline' as const,
    }));
    const unregistered = unregisteredInvites.map((i) => ({
      key: `unreg:${i.email}`,
      label: i.name,
      icon: 'mail-outline' as const,
    }));
    return [...platform, ...unregistered];
  }, [platformInvites, unregisteredInvites]);

  function handleChipRemove(key: string) {
    if (key.startsWith('platform:')) {
      removePlatformInvite(key.replace('platform:', ''));
    } else if (key.startsWith('unreg:')) {
      removeUnregisteredInvite(key.replace('unreg:', ''));
    }
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <FieldLabel
          label="Invite Artists (optional)"
          hint="Send a performance invite to platform artists or someone outside the platform (by name + email). They appear once they accept."
        />
        <Text className="text-xs text-gray-7 font-urbanist">Platform or outside</Text>
      </View>

      {/* Search input + results.

          The results render as an overlay anchored to the TOP of the input
          (bottom: '100%') rather than below it. The input is kept just above
          the keyboard by the form's keyboard-avoiding behaviour, so a list
          rendered below would fall behind the keyboard. Floating it upward
          keeps the matches visible above the keyboard while typing, and the
          absolute position means it never pushes the input down. */}
      <View style={{ position: 'relative' }}>
        <View className="flex-row items-center rounded-lg border border-gray-8 bg-surface px-4 py-3 gap-2">
          <Ionicons name="mail-outline" size={16} color="#8d8d8d" />
          <TextInput
            className="flex-1 text-[14px] text-white font-urbanist"
            placeholder="Search artists to invite..."
            placeholderTextColor="#8d8d8d"
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
        </View>

        {showDropdown && (results.length > 0 || query.length > 0) && (
          <View
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 4,
              maxHeight: 260,
              zIndex: 50,
              elevation: 8,
            }}
            className="rounded-lg border border-gray-8 bg-surface overflow-hidden"
          >
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((artist) => (
                <ArtistSearchRow
                  key={artist.id}
                  artist={artist}
                  onPress={() => addPlatformInvite(artist)}
                  actionIcon="paper-plane-outline"
                  actionIconColor="#8d8d8d"
                />
              ))}

              {/* Invite outside-platform artist */}
              <Pressable
                onPress={() => {
                  setShowDropdown(false);
                  setShowInviteModal(true);
                }}
                className="flex-row items-center gap-3 px-4 py-3 active:bg-white/10"
              >
                <View className="w-8 h-8 rounded-full bg-[#6C63FF]/20 items-center justify-center">
                  <Ionicons name="person-add-outline" size={14} color="#6C63FF" />
                </View>
                <Text className="text-sm font-semibold text-[#6C63FF] font-urbanist">
                  Invite Artist
                </Text>
                <Text className="text-xs text-gray-7 font-urbanist">(not on platform)</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Invite chips */}
      <SelectedChips items={inviteChips} onRemove={handleChipRemove} variant="neutral" />

      {/* Invite outside-platform modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteModal(false)}
      >
        {/* RN Modal creates a native window that ignores the activity's
            adjustResize softInputMode, so the centered dialog otherwise stays
            anchored to the full screen with the keyboard covering the email
            input. Padding behavior works inside the modal on both platforms. */}
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable
            className="flex-1 bg-black/60 items-center justify-center px-5"
            onPress={() => setShowInviteModal(false)}
          >
            <Pressable
              className="w-full rounded-2xl bg-[#1a1a1a] border border-gray-8 p-5 gap-4"
              onPress={() => {}}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-white font-urbanist">Invite Artist</Text>
                <Pressable onPress={() => setShowInviteModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={20} color="#8d8d8d" />
                </Pressable>
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-3 font-urbanist">Name *</Text>
                <TextInput
                  className={`rounded-lg border bg-surface px-4 py-3 text-[14px] text-white font-urbanist ${inviteErrors.name ? 'border-error' : 'border-gray-8'}`}
                  placeholder="Artist name"
                  placeholderTextColor="#8d8d8d"
                  value={inviteName}
                  onChangeText={setInviteName}
                />
                {inviteErrors.name && (
                  <Text className="text-xs text-error font-urbanist">{inviteErrors.name}</Text>
                )}
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-gray-3 font-urbanist">Email *</Text>
                <TextInput
                  className={`rounded-lg border bg-surface px-4 py-3 text-[14px] text-white font-urbanist ${inviteErrors.email ? 'border-error' : 'border-gray-8'}`}
                  placeholder="artist@example.com"
                  placeholderTextColor="#8d8d8d"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {inviteErrors.email && (
                  <Text className="text-xs text-error font-urbanist">{inviteErrors.email}</Text>
                )}
              </View>

              <Pressable
                onPress={handleSendInvite}
                className="bg-[#6C63FF] rounded-xl py-3.5 items-center"
              >
                <Text className="text-white text-sm font-bold font-urbanist">Send Invite</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
