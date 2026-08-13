import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';

import { STAGE_NAME_MAX } from '@CeolX/shared/validators';

import { AppTextField } from '@/components/AppTextField';
import { ProfilePicture } from '@/components/onboarding/ProfilePicture';
import { UsernameField } from '@/components/onboarding/UsernameField';
import type { UsernameStatus } from '@/hooks/use-username-field';

interface Step1BasicInfoProps {
  stageName: string;
  setStageName: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
  usernameStatus: UsernameStatus;
  usernameError: string | null;
  /** Locked to the account email — shown read-only, never edited here. */
  contactEmail: string;
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
  username,
  setUsername,
  usernameStatus,
  usernameError,
  contactEmail,
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
          <AppTextField
            variant="light"
            placeholder="Enter your artist or band name"
            value={stageName}
            onChangeText={setStageName}
            onBlur={() => handleBlur('stageName')}
            autoCapitalize="words"
            autoCorrect={false}
            error={errors.stageName}
            maxLength={STAGE_NAME_MAX}
          />
        </View>

        <UsernameField
          value={username}
          onChangeText={setUsername}
          status={usernameStatus}
          error={usernameError}
        />

        <View className="gap-2">
          <Text className="text-sm font-bold text-white/80">Contact Email</Text>
          {/* Locked to the verified account email — venues reach you here, and
              it can't be changed during onboarding. */}
          <View className="h-[52px] flex-row items-center justify-between rounded-lg bg-[#e4e4e4] px-4">
            <TextInput
              className="flex-1 text-[16px] text-black/50"
              value={contactEmail}
              editable={false}
              selectTextOnFocus={false}
            />
            <Ionicons name="lock-closed" size={16} color="#8d8d8d" />
          </View>
          <Text className="text-xs font-semibold text-gray-10">
            Your account email — venues and festivals contact you here. It can't be changed.
          </Text>
        </View>
      </View>
    </View>
  );
}
