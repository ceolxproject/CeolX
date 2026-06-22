import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';

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
        <TextInput
          className="flex-1 bg-[#1C1C1E] rounded-lg h-[44px] px-3 text-sm font-medium text-white"
          placeholder={placeholder}
          placeholderTextColor="#8d8d8d"
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
