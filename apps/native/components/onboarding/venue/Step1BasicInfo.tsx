import { Text, TextInput, View } from 'react-native';

import { ProfilePicture } from '@/components/onboarding/ProfilePicture';

interface Step1BasicInfoProps {
  venueName: string;
  setVenueName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  profileImageUri: string | null;
  imageError: string;
  handlePickImage: () => void;
  errors: Record<string, string>;
  handleBlur: (field: string) => void;
}

export function Step1BasicInfo({
  venueName,
  setVenueName,
  contactEmail,
  setContactEmail,
  profileImageUri,
  imageError,
  handlePickImage,
  errors,
  handleBlur,
}: Step1BasicInfoProps) {
  return (
    <View className="gap-7">
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
        About your venue
      </Text>

      <View className="items-center">
        <ProfilePicture
          uri={profileImageUri}
          label="Upload Venue Picture / Logo"
          onPress={handlePickImage}
        />
        {imageError ? (
          <Text className="mt-2 px-4 text-center text-xs text-error">{imageError}</Text>
        ) : null}
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm font-bold text-white/80">Venue Name</Text>
          <View
            className={`h-[52px] justify-center rounded-lg bg-white px-4 ${errors.venueName ? 'border border-error' : ''}`}
          >
            <TextInput
              className="text-base text-black"
              placeholder="Dooagh Film Festival"
              placeholderTextColor="#8d8d8d"
              value={venueName}
              onChangeText={setVenueName}
              onBlur={() => handleBlur('venueName')}
              autoCapitalize="words"
            />
          </View>
          {errors.venueName ? <Text className="text-xs text-error">{errors.venueName}</Text> : null}
        </View>

        <View className="gap-2">
          <Text className="text-sm font-bold text-white/80">Contact Email</Text>
          <View
            className={`h-[52px] justify-center rounded-lg bg-white/60 px-4 ${errors.contactEmail ? 'border border-error' : ''}`}
          >
            <TextInput
              className="text-base text-black/80"
              value={contactEmail}
              onChangeText={setContactEmail}
              onBlur={() => handleBlur('contactEmail')}
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
      </View>
    </View>
  );
}
