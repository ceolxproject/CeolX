import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { CeolxLogo } from '@/components/CeolxLogo';

interface OnboardingHeaderProps {
  onLogoutPress: () => void;
}

export function OnboardingHeader({ onLogoutPress }: OnboardingHeaderProps) {
  return (
    <View
      className="flex-row items-center justify-between bg-[#080808] px-5"
      style={{ height: 56 }}
    >
      <Pressable
        onPress={onLogoutPress}
        accessibilityRole="button"
        accessibilityLabel="Log out and exit onboarding"
        className="size-6 items-center justify-center"
      >
        <Ionicons name="log-out-outline" size={24} color="#fff" />
      </Pressable>
      <View className="pointer-events-none absolute left-0 right-0 items-center">
        <CeolxLogo />
      </View>
      <View className="size-6" />
    </View>
  );
}
