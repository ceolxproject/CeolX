import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CeolxLogo } from '@/components/CeolxLogo';
import { ProfilePicture } from '@/components/onboarding/ProfilePicture';
import { SocialLinksSection } from '@/components/onboarding/SocialLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { useArtistOnboarding } from '@/hooks/use-artist-onboarding';

const BIO_MAX = 50;

export default function ArtistOnboardingScreen() {
  const { logout } = useAuth();
  const {
    stageName,
    setStageName,
    bio,
    setBio,
    contactEmail,
    setContactEmail,
    socialLinks,
    handleSocialLinkChange,
    profileImageUri,
    imageError,
    errors,
    submitError,
    isPending,
    handlePickImage,
    handleSubmit,
  } = useArtistOnboarding();

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 bg-[#080808]"
          style={{ height: 56 }}
        >
          <Pressable
            onPress={async () => {
              await logout();
              router.replace('/(auth)/sign-in');
            }}
            className="size-6 items-center justify-center"
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </Pressable>
          <View className="absolute left-0 right-0 items-center pointer-events-none">
            <CeolxLogo />
          </View>
          <View className="size-6" />
        </View>

        <ScrollView
          style={{ flex: 1 }}
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
            {imageError ? (
              <Text className="text-xs text-error text-center mt-2 px-4">{imageError}</Text>
            ) : null}
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

            {/* Contact Email */}
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
            <SocialLinksSection
              values={socialLinks}
              errors={errors}
              onChange={handleSocialLinkChange}
            />

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
      </SafeAreaView>
    </View>
  );
}
