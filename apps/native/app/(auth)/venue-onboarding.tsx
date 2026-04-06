import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CeolxLogo } from '@/components/CeolxLogo';
import { ProfilePicture } from '@/components/onboarding/ProfilePicture';
import { VenueLinksSection } from '@/components/onboarding/VenueLinksSection';
import { useAuth } from '@/contexts/auth-context';
import { useVenueOnboarding } from '@/hooks/use-venue-onboarding';

export default function VenueOnboardingScreen() {
  const { logout } = useAuth();
  const {
    venueName, setVenueName,
    bio, setBio, BIO_MAX,
    address, setAddress,
    contactEmail, setContactEmail,
    venueLinks, handleVenueLinkChange,
    profileImageUri,
    imageError,
    errors, submitError, isPending,
    handlePickImage, handleSubmit,
  } = useVenueOnboarding();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 bg-[#080808]"
          style={{ height: 56 }}
        >
          <Pressable onPress={handleLogout} className="size-6 items-center justify-center">
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
            Create Venue Profile
          </Text>

          {/* Profile picture */}
          <View className="items-center mb-7">
            <ProfilePicture
              uri={profileImageUri}
              label="Upload Venue Picture / Logo"
              onPress={handlePickImage}
            />
            {imageError ? (
              <Text className="text-xs text-error text-center mt-2 px-4">{imageError}</Text>
            ) : null}
          </View>

          {/* Form fields */}
          <View className="gap-4">
            {/* Venue Name */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-white/80">Venue Name</Text>
              <View
                className={`bg-white rounded-lg h-[52px] px-4 justify-center ${errors.venueName ? 'border border-error' : ''}`}
              >
                <TextInput
                  className="text-base text-black"
                  placeholder="Dooagh Film Festival"
                  placeholderTextColor="#8d8d8d"
                  value={venueName}
                  onChangeText={setVenueName}
                  autoCapitalize="words"
                />
              </View>
              {errors.venueName ? (
                <Text className="text-xs text-error">{errors.venueName}</Text>
              ) : null}
            </View>

            {/* Short Description */}
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-white/80">Short Description</Text>
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
                  placeholder="Describe your business..."
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

            {/* Venue Location */}
            <View className="gap-2">
              <Text className="text-sm font-bold text-white/80">Venue Location</Text>
              <View
                className={`bg-white rounded-lg h-[52px] px-4 flex-row items-center ${errors.address ? 'border border-error' : ''}`}
              >
                <TextInput
                  className="text-base text-black flex-1"
                  placeholder="Choose your location"
                  placeholderTextColor="#8d8d8d"
                  value={address}
                  onChangeText={setAddress}
                  autoCapitalize="words"
                />
                <Ionicons name="location-outline" size={20} color="#C8FF2F" />
              </View>
              {errors.address ? (
                <Text className="text-xs text-error">{errors.address}</Text>
              ) : null}
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
                Artists can contact you on this email
              </Text>
            </View>

            {/* Venue Links */}
            <VenueLinksSection
              values={venueLinks}
              errors={errors}
              onChange={handleVenueLinkChange}
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
                  Create Venue Profile
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
