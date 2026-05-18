import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { UserRole } from '@CeolX/shared/enums';

import { appToast } from '@/components/AppToast';
import { SocialLinkInput } from '@/components/profiles';
import { useMe } from '@/hooks/use-me';
import { useUpdateArtistProfile } from '@/hooks/use-update-artist-profile';
import { useUpdateVenueProfile } from '@/hooks/use-update-venue-profile';
import { MOCK_PROFILE_IMAGE } from '@/utils/mock-images';
import { normalizeOptionalUrl } from '@/utils/normalize-url';
import { getTRPCErrorMessage } from '@/utils/trpc-error';

export default function EditProfileScreen() {
  const { data: me } = useMe();
  const updateArtist = useUpdateArtistProfile();
  const updateVenue = useUpdateVenueProfile();

  const currentRole = me?.currentRole;
  const isVenue = currentRole === UserRole.VENUE;
  const isPending = updateArtist.isPending || updateVenue.isPending;

  // Shared fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Artist-only fields
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');

  // Venue-only fields
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');

  // Social links — artist: INSTAGRAM, FACEBOOK, TIKTOK, YOUTUBE
  //                venue: WEBSITE, INSTAGRAM, FACEBOOK, TWITTER
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');

  // Prefill from existing profile data
  useEffect(() => {
    if (isVenue && me?.venueProfile) {
      const vp = me.venueProfile;
      setDisplayName(vp.venueName ?? '');
      setBio(vp.bio ?? '');
      setAddress(vp.address ?? '');
      setCounty(vp.county ?? '');
      setWebsiteUrl(vp.websiteUrl ?? '');
      setPhone(vp.phone ?? '');
      setWebsite(vp.socialLinks?.WEBSITE ?? '');
      setInstagram(vp.socialLinks?.INSTAGRAM ?? '');
      setFacebook(vp.socialLinks?.FACEBOOK ?? '');
      setTwitter(vp.socialLinks?.TWITTER ?? '');
    } else if (me?.artistProfile) {
      const ap = me.artistProfile;
      setDisplayName(ap.stageName ?? '');
      setBio(ap.bio ?? '');
      setGenre(ap.genres?.join(', ') ?? '');
      setLocation(ap.location ?? '');
      setInstagram(ap.socialLinks?.INSTAGRAM ?? '');
      setFacebook(ap.socialLinks?.FACEBOOK ?? '');
      setTiktok(ap.socialLinks?.TIKTOK ?? '');
      setYoutube(ap.socialLinks?.YOUTUBE ?? '');
    }
  }, [me?.artistProfile, me?.venueProfile, isVenue]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      appToast.warning('Required', `${isVenue ? 'Venue name' : 'Display name'} is required.`);
      return;
    }

    try {
      if (isVenue) {
        await updateVenue.mutateAsync({
          displayName: displayName.trim(),
          bio: bio.trim() || undefined,
          address: address.trim() || undefined,
          county: county.trim() || undefined,
          websiteUrl: normalizeOptionalUrl(websiteUrl),
          phone: phone.trim() || undefined,
          socialLinks: {
            WEBSITE: normalizeOptionalUrl(website),
            INSTAGRAM: normalizeOptionalUrl(instagram),
            FACEBOOK: normalizeOptionalUrl(facebook),
            TWITTER: normalizeOptionalUrl(twitter),
          },
        });
      } else {
        const genres = genre
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);

        await updateArtist.mutateAsync({
          displayName: displayName.trim(),
          bio: bio.trim() || undefined,
          genres: genres.length > 0 ? genres : undefined,
          location: location.trim() || undefined,
          socialLinks: {
            INSTAGRAM: normalizeOptionalUrl(instagram),
            FACEBOOK: normalizeOptionalUrl(facebook),
            TIKTOK: normalizeOptionalUrl(tiktok),
            YOUTUBE: normalizeOptionalUrl(youtube),
          },
        });
      }

      appToast.success('Profile updated', 'Your changes are saved.');
      router.back();
    } catch (err) {
      appToast.error(
        'Update failed',
        getTRPCErrorMessage(
          err,
          {
            BAD_REQUEST: 'Please check the entered values and try again.',
            FORBIDDEN: 'You do not have permission to edit this profile.',
            NOT_FOUND: 'Profile not found. Please complete onboarding first.',
          },
          'Failed to update profile. Please try again.'
        )
      );
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
          <Pressable onPress={handleSave} disabled={isPending}>
            {isPending ? (
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
                appToast.info('Coming soon', 'Image upload will be available in a future update.')
              }
            >
              <Text className="text-xs text-[#662FFF] font-semibold font-urbanist">
                Change Photo
              </Text>
            </Pressable>
          </View>

          {/* Display Name / Venue Name */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            {isVenue ? 'Venue Name' : 'Display Name'} *
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
            placeholder={isVenue ? 'Your venue name' : 'Your stage name'}
            placeholderTextColor="#8d8d8d"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={isVenue ? 150 : 100}
          />

          {/* Bio */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            {isVenue ? 'Description' : 'Bio'}
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg px-4 py-3 text-base font-medium text-white mb-1 h-[100px]"
            placeholder={isVenue ? 'Tell people about your venue' : 'Tell people about yourself'}
            placeholderTextColor="#8d8d8d"
            multiline
            numberOfLines={4}
            style={{ textAlignVertical: 'top' }}
            value={bio}
            onChangeText={setBio}
            maxLength={2000}
          />
          <Text className="text-xs text-white/40 mb-4 self-end">{bio.length}/2000</Text>

          {/* Artist-only: Genres */}
          {!isVenue && (
            <>
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
            </>
          )}

          {/* Venue-only: Address, County, Website, Phone */}
          {isVenue && (
            <>
              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Address
              </Text>
              <TextInput
                className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
                placeholder="e.g. 20 Bridge Street Lower, Dublin 8"
                placeholderTextColor="#8d8d8d"
                value={address}
                onChangeText={setAddress}
                maxLength={255}
              />

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                County
              </Text>
              <TextInput
                className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
                placeholder="e.g. Dublin, Cork, Galway"
                placeholderTextColor="#8d8d8d"
                value={county}
                onChangeText={setCounty}
                maxLength={100}
              />

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Website
              </Text>
              <TextInput
                className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
                placeholder="https://yourvenue.com"
                placeholderTextColor="#8d8d8d"
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Phone
              </Text>
              <TextInput
                className="bg-[#1C1C1E] rounded-lg h-[48px] px-4 text-base font-medium text-white mb-4"
                placeholder="+353 1 234 5678"
                placeholderTextColor="#8d8d8d"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={30}
              />
            </>
          )}

          {/* Social Links */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3 mt-2 font-urbanist">
            Social Links
          </Text>

          {isVenue ? (
            <>
              <SocialLinkInput
                icon="globe-outline"
                value={website}
                onChange={setWebsite}
                placeholder="https://yourvenue.com"
              />
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
                icon="logo-twitter"
                value={twitter}
                onChange={setTwitter}
                placeholder="https://twitter.com/..."
              />
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Bottom spacer */}
          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
