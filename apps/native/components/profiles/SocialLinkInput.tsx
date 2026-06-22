import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { AppTextField } from '@/components/AppTextField';

type SocialLinkInputProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
};

export function SocialLinkInput({
  icon,
  value,
  onChange,
  placeholder,
  error,
}: SocialLinkInputProps) {
  return (
    <View className="mb-3">
      <View className="flex-row items-center gap-3">
        <View className="w-9 h-9 rounded-full bg-[#333335] items-center justify-center">
          <Ionicons name={icon} size={18} color="#fff" />
        </View>
        <AppTextField
          variant="dark"
          containerClassName="flex-1"
          fieldClassName="h-[44px] px-3"
          className="text-[14px] font-medium"
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          keyboardType="url"
          autoComplete="off"
          textContentType="none"
          importantForAutofill="no"
        />
      </View>
      {error ? (
        <Text className="text-xs text-red-400 mt-1 ml-12 font-urbanist">{error}</Text>
      ) : null}
    </View>
  );
}
