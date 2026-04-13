import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';

interface SocialInputProps {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
}

export function SocialInput({ icon, placeholder, value, onChangeText, error }: SocialInputProps) {
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

export interface SocialLinks {
  INSTAGRAM: string;
  FACEBOOK: string;
  TIKTOK: string;
  YOUTUBE: string;
}

interface SocialLinksSectionProps {
  values: SocialLinks;
  errors: Record<string, string>;
  onChange: (field: keyof SocialLinks, value: string) => void;
}

export function SocialLinksSection({ values, errors, onChange }: SocialLinksSectionProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-white/80">Social Links (optional)</Text>
      <SocialInput
        icon="logo-instagram"
        placeholder="https://instagram.com/yourhandle"
        value={values.INSTAGRAM}
        onChangeText={(v) => onChange('INSTAGRAM', v)}
        error={errors['socialLinks.INSTAGRAM']}
      />
      <SocialInput
        icon="logo-facebook"
        placeholder="https://facebook.com/yourpage"
        value={values.FACEBOOK}
        onChangeText={(v) => onChange('FACEBOOK', v)}
        error={errors['socialLinks.FACEBOOK']}
      />
      <SocialInput
        icon="logo-tiktok"
        placeholder="https://tiktok.com/@yourhandle"
        value={values.TIKTOK}
        onChangeText={(v) => onChange('TIKTOK', v)}
        error={errors['socialLinks.TIKTOK']}
      />
      <SocialInput
        icon="logo-youtube"
        placeholder="https://youtube.com/@yourchannel"
        value={values.YOUTUBE}
        onChangeText={(v) => onChange('YOUTUBE', v)}
        error={errors['socialLinks.YOUTUBE']}
      />
      <Text className="text-xs font-semibold text-gray-10">
        Your contact details will only be visible to other Artists and Businesses.
      </Text>
    </View>
  );
}
