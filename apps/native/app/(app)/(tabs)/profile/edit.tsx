import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';
import { BIO_MAX_LENGTH, socialLinksSchema, venueLinksSchema } from '@CeolX/shared/validators';

import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { appToast } from '@/components/AppToast';
import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';
import { LocationPicker, type PickedLocation } from '@/components/LocationPicker';
import { ProfilePicture } from '@/components/onboarding/ProfilePicture';
import { SocialLinkInput } from '@/components/profiles';
import { useMe } from '@/hooks/use-me';
import { keyFromCdnUrl, useMediaDelete } from '@/hooks/use-media-delete';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { useUpdateArtistProfile } from '@/hooks/use-update-artist-profile';
import { useUpdateVenueProfile } from '@/hooks/use-update-venue-profile';
import { pickSquarePhoto, requestPhotoLibraryPermission } from '@/utils/image-picker';
import { normalizeOptionalUrl } from '@/utils/normalize-url';
import { getTRPCErrorMessage } from '@/utils/trpc-error';

export default function EditProfileScreen() {
  const { data: me } = useMe();
  const updateArtist = useUpdateArtistProfile();
  const updateVenue = useUpdateVenueProfile();
  const { uploadMedia, isUploading: isImageUploading } = useMediaUpload('profile_image');
  const { deleteS3Object } = useMediaDelete();

  const currentRole = me?.currentRole;
  const isVenue = currentRole === UserRole.VENUE;
  const isPending = updateArtist.isPending || updateVenue.isPending || isImageUploading;

  // Shared fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');

  // Profile image. `imageUri` is what's shown — either the existing CDN url or
  // a freshly-picked local file uri. `originalImageUrl` is the persisted url we
  // diff against to decide upload vs. remove vs. no-change, and to clean up the
  // old S3 object on replace. `imageTouched` gates all three so an untouched
  // image is left exactly as-is on save.
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageTouched, setImageTouched] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Per-field URL validation errors, keyed by `socialLinks.<PLATFORM>` so they
  // line up with the inputs below. Mirrors the inline errors the onboarding
  // wizard shows; the actual save is still guarded by the shared schema on the
  // server.
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Artist-only fields
  const [genre, setGenre] = useState('');
  const [location, setLocation] = useState('');

  // Venue-only fields. lat/lng come from the map pin; address is the derived label.
  const [address, setAddress] = useState('');
  const [venueLat, setVenueLat] = useState<number | null>(null);
  const [venueLng, setVenueLng] = useState<number | null>(null);
  const [county, setCounty] = useState('');
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
      setOriginalImageUrl(vp.profileImageUrl ?? null);
      setImageUri(vp.profileImageUrl ?? null);
      setAddress(vp.address ?? '');
      setVenueLat(vp.lat ?? null);
      setVenueLng(vp.lng ?? null);
      setCounty(vp.county ?? '');
      setPhone(vp.phone ?? '');
      setWebsite(vp.socialLinks?.WEBSITE ?? '');
      setInstagram(vp.socialLinks?.INSTAGRAM ?? '');
      setFacebook(vp.socialLinks?.FACEBOOK ?? '');
      setTwitter(vp.socialLinks?.TWITTER ?? '');
    } else if (me?.artistProfile) {
      const ap = me.artistProfile;
      setDisplayName(ap.stageName ?? '');
      setBio(ap.bio ?? '');
      setOriginalImageUrl(ap.profileImageUrl ?? null);
      setImageUri(ap.profileImageUrl ?? null);
      setGenre(ap.genres?.join(', ') ?? '');
      setLocation(ap.location ?? '');
      setInstagram(ap.socialLinks?.INSTAGRAM ?? '');
      setFacebook(ap.socialLinks?.FACEBOOK ?? '');
      setTiktok(ap.socialLinks?.TIKTOK ?? '');
      setYoutube(ap.socialLinks?.YOUTUBE ?? '');
    }
  }, [me?.artistProfile, me?.venueProfile, isVenue]);

  const handlePickImage = async () => {
    setImageError(null);
    try {
      const permission = await requestPhotoLibraryPermission();
      if (!permission.granted) {
        setImageError(
          permission.canAskAgain
            ? 'Photo library access is required to change your picture.'
            : 'Photo access is disabled. Enable it in Settings > CeolX.'
        );
        return;
      }
      const uri = await pickSquarePhoto();
      if (uri) {
        setImageUri(uri);
        setImageTouched(true);
      }
    } catch {
      setImageError("Couldn't open the photo library. Please try again.");
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setImageTouched(true);
    setImageError(null);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      appToast.warning('Required', `${isVenue ? 'Venue name' : 'Display name'} is required.`);
      return;
    }

    // Validate the URL fields up front so an invalid link shows inline (and we
    // don't upload an image only to have the save bounce). Reuses the shared
    // social-link schema for the rule and messages; the venue Website field is
    // checked with the same real-domain rule.
    const fieldErrors: Record<string, string> = {};
    const linksResult = (isVenue ? venueLinksSchema : socialLinksSchema).safeParse(
      isVenue
        ? {
            WEBSITE: normalizeOptionalUrl(website),
            INSTAGRAM: normalizeOptionalUrl(instagram),
            FACEBOOK: normalizeOptionalUrl(facebook),
            TWITTER: normalizeOptionalUrl(twitter),
          }
        : {
            INSTAGRAM: normalizeOptionalUrl(instagram),
            FACEBOOK: normalizeOptionalUrl(facebook),
            TIKTOK: normalizeOptionalUrl(tiktok),
            YOUTUBE: normalizeOptionalUrl(youtube),
          }
    );
    if (!linksResult.success) {
      for (const issue of linksResult.error.issues) {
        fieldErrors[`socialLinks.${issue.path.join('.')}`] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      appToast.warning('Check your links', 'Please fix the highlighted fields and try again.');
      return;
    }
    setErrors({});

    // Resolve the image change first so a failed upload aborts before we write
    // the rest of the profile. undefined => leave unchanged; null => clear;
    // string => the new CDN url to persist.
    let profileImageUrl: string | null | undefined;
    if (imageTouched) {
      if (imageUri && imageUri !== originalImageUrl) {
        try {
          const { cdnUrl } = await uploadMedia({ uri: imageUri });
          profileImageUrl = cdnUrl;
        } catch (err) {
          setImageError(err instanceof Error ? err.message : 'Image upload failed');
          return;
        }
      } else if (!imageUri) {
        profileImageUrl = null;
      }
    }

    try {
      if (isVenue) {
        await updateVenue.mutateAsync({
          displayName: displayName.trim(),
          bio: bio.trim() || undefined,
          address: address.trim() || undefined,
          lat: venueLat ?? undefined,
          lng: venueLng ?? undefined,
          county: county.trim() || undefined,
          phone: phone.trim() || undefined,
          profileImageUrl,
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
          profileImageUrl,
          socialLinks: {
            INSTAGRAM: normalizeOptionalUrl(instagram),
            FACEBOOK: normalizeOptionalUrl(facebook),
            TIKTOK: normalizeOptionalUrl(tiktok),
            YOUTUBE: normalizeOptionalUrl(youtube),
          },
        });
      }

      // Best-effort: drop the previous S3 object once the new url (or the
      // cleared state) is persisted. Orphan cleanup only — never block the
      // save on it, and only when the image actually changed.
      if (imageTouched && originalImageUrl && originalImageUrl !== imageUri) {
        const key = keyFromCdnUrl(originalImageUrl);
        if (key) {
          try {
            await deleteS3Object(key);
          } catch {
            // S3 lifecycle expiry is the safety net; ignore delete failures.
          }
        }
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
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <AppHeader
          leading="back"
          title="Edit Profile"
          trailingAccessory={
            <Pressable onPress={handleSave} disabled={isPending} hitSlop={8}>
              {isPending ? (
                <ActivityIndicator color="#C8FF2F" size="small" />
              ) : (
                <Text className="text-sm font-bold text-[#C8FF2F] font-urbanist">Save</Text>
              )}
            </Pressable>
          }
        />

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Profile Image */}
          <View className="items-center mb-6">
            <ProfilePicture
              uri={imageUri}
              label={imageUri ? 'Change Photo' : 'Upload Profile Picture'}
              onPress={handlePickImage}
              onRemove={handleRemoveImage}
            />
            {imageError ? (
              <Text className="mt-2 text-xs text-red-400 font-urbanist text-center">
                {imageError}
              </Text>
            ) : null}
          </View>

          {/* Display Name / Venue Name */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            {isVenue ? 'Venue Name' : 'Display Name'} *
          </Text>
          <AppTextField
            variant="dark"
            containerClassName="mb-4"
            placeholder={isVenue ? 'Your venue name' : 'Your stage name'}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={isVenue ? 150 : 100}
          />

          {/* Bio */}
          <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
            {isVenue ? 'Description' : 'Bio'}
          </Text>
          <TextInput
            className="bg-[#1C1C1E] rounded-lg px-4 py-3 text-base font-medium text-white mb-1 min-h-[100px]"
            placeholder={isVenue ? 'Tell people about your venue' : 'Tell people about yourself'}
            placeholderTextColor="#8d8d8d"
            multiline
            numberOfLines={4}
            // minHeight (not height) lets the box grow as the user adds lines.
            style={{ textAlignVertical: 'top' }}
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX_LENGTH}
          />
          <CharacterCount
            count={bio.length}
            max={BIO_MAX_LENGTH}
            className="text-xs text-white/40 self-end mb-1"
          />
          <CharacterLimitNote count={bio.length} max={BIO_MAX_LENGTH} className="self-end mb-4" />

          {/* Artist-only: Genres */}
          {!isVenue && (
            <>
              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Genres
              </Text>
              <AppTextField
                variant="dark"
                containerClassName="mb-4"
                placeholder="e.g. Traditional, Folk, Sean-nós"
                value={genre}
                onChangeText={setGenre}
              />

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Location
              </Text>
              <AppTextField
                variant="dark"
                containerClassName="mb-4"
                placeholder="e.g. Galway, Ireland"
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
                Venue Location
              </Text>
              <View className="mb-4">
                <LocationPicker
                  lat={venueLat}
                  lng={venueLng}
                  address={address}
                  onChange={(loc: PickedLocation) => {
                    setVenueLat(loc.lat);
                    setVenueLng(loc.lng);
                    setAddress(loc.address);
                  }}
                />
              </View>

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                County
              </Text>
              <AppTextField
                variant="dark"
                containerClassName="mb-4"
                placeholder="e.g. Dublin, Cork, Galway"
                value={county}
                onChangeText={setCounty}
                maxLength={100}
              />

              <Text className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1.5 font-urbanist">
                Phone
              </Text>
              <AppTextField
                variant="dark"
                containerClassName="mb-4"
                placeholder="+353 1 234 5678"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
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
                error={errors['socialLinks.WEBSITE']}
              />
              <SocialLinkInput
                icon="logo-instagram"
                value={instagram}
                onChange={setInstagram}
                placeholder="https://instagram.com/..."
                error={errors['socialLinks.INSTAGRAM']}
              />
              <SocialLinkInput
                icon="logo-facebook"
                value={facebook}
                onChange={setFacebook}
                placeholder="https://facebook.com/..."
                error={errors['socialLinks.FACEBOOK']}
              />
              <SocialLinkInput
                icon="logo-twitter"
                value={twitter}
                onChange={setTwitter}
                placeholder="https://twitter.com/..."
                error={errors['socialLinks.TWITTER']}
              />
            </>
          ) : (
            <>
              <SocialLinkInput
                icon="logo-instagram"
                value={instagram}
                onChange={setInstagram}
                placeholder="https://instagram.com/..."
                error={errors['socialLinks.INSTAGRAM']}
              />
              <SocialLinkInput
                icon="logo-facebook"
                value={facebook}
                onChange={setFacebook}
                placeholder="https://facebook.com/..."
                error={errors['socialLinks.FACEBOOK']}
              />
              <SocialLinkInput
                icon="logo-tiktok"
                value={tiktok}
                onChange={setTiktok}
                placeholder="https://tiktok.com/@..."
                error={errors['socialLinks.TIKTOK']}
              />
              <SocialLinkInput
                icon="logo-youtube"
                value={youtube}
                onChange={setYoutube}
                placeholder="https://youtube.com/..."
                error={errors['socialLinks.YOUTUBE']}
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
