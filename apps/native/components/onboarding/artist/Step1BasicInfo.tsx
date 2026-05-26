import { Text, TextInput, View } from 'react-native';

import { ProfilePicture } from '@/components/onboarding/ProfilePicture';

interface Step1BasicInfoProps {
  stageName: string;
  setStageName: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  profileImageUri: string | null;
  imageError: string | null;
  handlePickImage: () => void;
  handleRemoveImage: () => void;
  errors: Record<string, string>;
  handleBlur: (field: string) => void;
}

export function Step1BasicInfo({
  stageName,
  setStageName,
  contactEmail,
  setContactEmail,
  profileImageUri,
  imageError,
  handlePickImage,
  handleRemoveImage,
  errors,
  handleBlur,
}: Step1BasicInfoProps) {
  return (
    <View className="gap-7">
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
        Tell us about yourself
      </Text>

      <View className="items-center">
        <ProfilePicture
          uri={profileImageUri}
          onPress={handlePickImage}
          onRemove={handleRemoveImage}
        />
        {imageError ? (
          <Text className="mt-2 px-4 text-center text-xs text-error">{imageError}</Text>
        ) : null}
      </View>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm font-bold text-white/80">Artist / Band Name</Text>
          <View
            className={`h-[52px] justify-center rounded-lg bg-white px-4 ${errors.stageName ? 'border border-error' : ''}`}
          >
            <TextInput
              className="text-base text-black"
              placeholder="Your Stage Name"
              placeholderTextColor="#8d8d8d"
              value={stageName}
              onChangeText={setStageName}
              onBlur={() => handleBlur('stageName')}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
          {errors.stageName ? <Text className="text-xs text-error">{errors.stageName}</Text> : null}
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
              autoCorrect={false}
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
      </View>
    </View>
  );
}
