import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { createArtistOnboardingSchema } from '@CeolX/shared/validators';

import { CeolxLogo } from '@/components/CeolxLogo';
import { useAuth } from '@/contexts/auth-context';
import { trpc } from '@/utils/trpc';

// ── Constants ────────────────────────────────────────────────────────────────

const BIO_MAX = 50;

// ── Profile picture picker ───────────────────────────────────────────────────

function ProfilePicture({ uri, onPress }: { uri: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="items-center gap-3">
      <View
        className="rounded-full overflow-hidden items-center justify-center"
        style={{ width: 120, height: 120, borderWidth: 2, borderColor: '#C8FF2F' }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 120, height: 120 }} resizeMode="cover" />
        ) : (
          <View
            className="items-center justify-center"
            style={{ width: 120, height: 120, backgroundColor: '#1b1b1b' }}
          >
            <Ionicons name="camera-outline" size={36} color="#C8FF2F" />
          </View>
        )}
      </View>
      <Text
        style={{
          color: '#C8FF2F',
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        Upload Profile Picture
      </Text>
    </Pressable>
  );
}

// ── Social link input ────────────────────────────────────────────────────────

function SocialInput({
  icon,
  placeholder,
  value,
  onChangeText,
  error,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center bg-white rounded-lg h-[52px] px-4 gap-3">
        <Ionicons name={icon} size={20} color="#8d8d8d" />
        <TextInput
          className="flex-1 text-base text-black"
          placeholder={placeholder}
          placeholderTextColor="#8d8d8d"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>
      {error ? <Text className="text-xs text-error">{error}</Text> : null}
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ArtistOnboardingScreen() {
  const { user } = useAuth();

  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { mutateAsync: createArtistProfile, isPending } = useMutation(
    trpc.onboarding.createArtistProfile.mutationOptions()
  );

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    const parsed = createArtistOnboardingSchema.safeParse({
      stageName,
      bio: bio || undefined,
      contactEmail: contactEmail || undefined,
      socialLinks: {
        instagram: instagram || undefined,
        facebook: facebook || undefined,
        tiktok: tiktok || undefined,
        youtube: youtube || undefined,
      },
      // TODO M10: upload image to S3 and pass the CDN URL as profileImageUrl
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      await createArtistProfile(parsed.data);
      router.replace('/(app)/(tabs)/map');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 bg-[#080808]"
            style={{ height: 56 }}
          >
            <Pressable onPress={() => router.replace('/(auth)/sign-in')} className="size-6">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <View className="absolute left-0 right-0 items-center pointer-events-none">
              <CeolxLogo />
            </View>
            <View className="flex-row gap-4">
              <Ionicons name="bookmark-outline" size={23} color="#fff" />
              <Ionicons name="notifications-outline" size={24} color="#fff" />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <Text
              style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}
              className="mb-7"
            >
              Create Artist Profile
            </Text>

            {/* Profile picture */}
            <View className="items-center mb-7">
              <ProfilePicture uri={profileImageUri} onPress={handlePickImage} />
            </View>

            {/* Form fields */}
            <View className="gap-4">
              {/* Artist / Band Name */}
              <View className="gap-2">
                <Text className="text-sm font-bold text-white/80">Artist / Band Name</Text>
                <View
                  className={`bg-white rounded-lg h-[52px] px-4 justify-center ${errors.stageName ? 'border border-error' : ''}`}
                >
                  <TextInput
                    className="text-base text-black"
                    placeholder="Your Stage Name"
                    placeholderTextColor="#8d8d8d"
                    value={stageName}
                    onChangeText={setStageName}
                    autoCapitalize="words"
                  />
                </View>
                {errors.stageName ? (
                  <Text className="text-xs text-error">{errors.stageName}</Text>
                ) : null}
              </View>

              {/* Short Bio */}
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-bold text-white/80">Short Bio</Text>
                  <Text className="text-base text-gray-10">
                    {bio.length}/{BIO_MAX}
                  </Text>
                </View>
                <View
                  className={`bg-white rounded-lg px-4 py-4 ${errors.bio ? 'border border-error' : ''}`}
                  style={{ height: 72 }}
                >
                  <TextInput
                    className="text-base text-black flex-1"
                    placeholder="Describe yourself..."
                    placeholderTextColor="rgba(141,141,141,0.8)"
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    maxLength={BIO_MAX}
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>
                {errors.bio ? <Text className="text-xs text-error">{errors.bio}</Text> : null}
              </View>

              {/* Contact Email — pre-filled, dimmed */}
              <View className="gap-2">
                <Text className="text-sm font-bold text-white/80">Contact Email</Text>
                <View className="bg-white/60 rounded-lg h-[52px] px-4 justify-center">
                  <TextInput
                    className="text-base text-black/80"
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="rgba(0,0,0,0.4)"
                  />
                </View>
                {errors.contactEmail ? (
                  <Text className="text-xs text-error">{errors.contactEmail}</Text>
                ) : null}
                <Text className="text-xs font-semibold text-gray-10">
                  Venue/businesses can contact you on this email
                </Text>
              </View>

              {/* Social Links */}
              <View className="gap-2">
                <Text className="text-sm font-bold text-white/80">Social Links (optional)</Text>
                <SocialInput
                  icon="logo-instagram"
                  placeholder="https://instagram.com/yourhandle"
                  value={instagram}
                  onChangeText={setInstagram}
                  error={errors['socialLinks.instagram']}
                />
                <SocialInput
                  icon="logo-facebook"
                  placeholder="https://facebook.com/yourpage"
                  value={facebook}
                  onChangeText={setFacebook}
                  error={errors['socialLinks.facebook']}
                />
                <SocialInput
                  icon="logo-tiktok"
                  placeholder="https://tiktok.com/@yourhandle"
                  value={tiktok}
                  onChangeText={setTiktok}
                  error={errors['socialLinks.tiktok']}
                />
                <SocialInput
                  icon="logo-youtube"
                  placeholder="https://youtube.com/@yourchannel"
                  value={youtube}
                  onChangeText={setYoutube}
                  error={errors['socialLinks.youtube']}
                />
                <Text className="text-xs font-semibold text-gray-10">
                  Your contact details will only be visible to other Artists and Businesses.
                </Text>
              </View>

              {/* Submit error */}
              {submitError ? (
                <View className="bg-error/15 rounded-lg p-3">
                  <Text className="text-error text-sm">{submitError}</Text>
                </View>
              ) : null}

              {/* CTA */}
              <Pressable
                onPress={handleSubmit}
                disabled={isPending}
                className="rounded-full py-4 items-center justify-center mt-3"
                style={{ backgroundColor: isPending ? '#4d42cc' : '#6155F5' }}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Create Artist Profile
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
