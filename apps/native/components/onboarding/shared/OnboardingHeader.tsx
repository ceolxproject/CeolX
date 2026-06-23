import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { CeolxLogo } from '@/components/CeolxLogo';

interface OnboardingHeaderProps {
  onLogoutPress: () => void;
}

export function OnboardingHeader({ onLogoutPress }: OnboardingHeaderProps) {
  // Brand-forward first-run header: logout (left), centered logo. No bell.
  return (
    <AppHeader
      bgClassName="bg-[#080808]"
      titleAlign="center"
      titleNode={<CeolxLogo />}
      leadingNode={
        <Pressable
          onPress={onLogoutPress}
          accessibilityRole="button"
          accessibilityLabel="Log out and exit onboarding"
          className="size-6 items-center justify-center"
        >
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </Pressable>
      }
    />
  );
}
