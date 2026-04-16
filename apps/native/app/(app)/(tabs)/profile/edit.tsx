import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMe } from '@/hooks/use-me';
import { useUpdateArtistProfile } from '@/hooks/use-update-artist-profile';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';

export default function EditProfileScreen() {
  const { data: me } = useMe();
  const updateProfile = useUpdateArtistProfile();

  const artistProfile = me?.artistProfile;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');

  // Prefill from existing profile data
  useEffect(() => {
    if (artistProfile) {
      setDisplayName(artistProfile.stageName ?? '');
      setBio(artistProfile.bio ?? '');
      setGenre(artistProfile.genres?.join(', ') ?? '');
      setLocation(artistProfile.location ?? '');
      setInstagram(artistProfile.socialLinks?.INSTAGRAM ?? '');
      setFacebook(artistProfile.socialLinks?.FACEBOOK ?? '');
      setTiktok(artistProfile.socialLinks?.TIKTOK ?? '');
      setYoutube(artistProfile.socialLinks?.YOUTUBE ?? '');
    }
  }, [artistProfile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name is required.');
      return;
    }

    try {
      const genres = genre
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);

      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        genres: genres.length > 0 ? genres : undefined,
        location: location.trim() || undefined,
        socialLinks: {
          INSTAGRAM: instagram.trim() || undefined,
          FACEBOOK: facebook.trim() || undefined,
          TIKTOK: tiktok.trim() || undefined,
          YOUTUBE: youtube.trim() || undefined,
        },
      });

      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-bold text-white font-urbanist">Edit Profile</Text>
          <Pressable onPress={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? (
              <ActivityIndicator color="#C8FF2F" size="small" />
            ) : (
              <Text className="text-sm font-bold text-[#C8FF2F] font-urbanist">Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Profile Image (disabled until M10-T1) */}
          <View className="items-center mb-6">
            <Image
              source={MOCK_PROFILE_IMAGE}
              className="w-[86px] h-[86px] rounded-full bg-surface"
            />
            <Pressable
              className="mt-2"
              onPress={() =>
                Alert.alert('Coming Soon', 'Image upload will be available in a future update.')
              }
            >
              <Text className="text-xs text-[#662FFF] font-semibold font-urbanist">
                Change Photo
              </Text>
            </Pressable>
          </View>

          {/* Display Name */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            Display Name *
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
            placeholder="Your stage name"
            placeholderTextColor="#8d8d8d"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={100}
          />

          {/* Bio */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            Bio
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg px-4 py-3 text-base font-medium text-white mb-1 h-[100px]"
            placeholder="Tell people about yourself"
            placeholderTextColor="#8d8d8d"
            multiline
            numberOfLines={4}
            style={{ textAlignVertical: 'top' }}
            value={bio}
            onChangeText={setBio}
            maxLength={2000}
          />
          <Text className="text-xs text-white/40 mb-4 self-end">{bio.length}/2000</Text>

          {/* Genres */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            Genres
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
            placeholder="e.g. Traditional, Folk, Sean-nós"
            placeholderTextColor="#8d8d8d"
            value={genre}
            onChangeText={setGenre}
          />

          {/* Location */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            Location
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
            placeholder="e.g. Galway, Ireland"
            placeholderTextColor="#8d8d8d"
            value={location}
            onChangeText={setLocation}
            maxLength={255}
          />

          {/* Social Links */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3 mt-2 font-urbanist">
            Social Links
          </Text>

          <SocialLinkInput
            icon="logo-instagram"
            value={instagram}
            onChange={setInstagram}
            placeholder="https://instagram.com/..."
          />
          <SocialLinkInput
            icon="logo-facebook"
            value={facebook}
            onChange={setFacebook}
            placeholder="https://facebook.com/..."
          />
          <SocialLinkInput
            icon="logo-tiktok"
            value={tiktok}
            onChange={setTiktok}
            placeholder="https://tiktok.com/@..."
          />
          <SocialLinkInput
            icon="logo-youtube"
            value={youtube}
            onChange={setYoutube}
            placeholder="https://youtube.com/..."
          />

          {/* Bottom spacer */}
          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SocialLinkInput({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View className="flex-row items-center gap-3 mb-3">
      <View className="w-9 h-9 rounded-full bg-[#333335] items-center justify-center">
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <TextInput
        className="flex-1 bg-[#1C1C1E] rounded-lg h-[44px] px-3 text-sm font-medium text-white"
        placeholder={placeholder}
        placeholderTextColor="#8d8d8d"
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  );
}
