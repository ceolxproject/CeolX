import { Text, View } from 'react-native';

import { SocialLinksSection, type SocialLinks } from '@/components/onboarding/SocialLinksSection';

interface Step3SocialMediaProps {
  socialLinks: SocialLinks;
  handleSocialLinkChange: (field: keyof SocialLinks, value: string) => void;
  errors: Record<string, string>;
  submitError: string;
}

export function Step3SocialMedia({
  socialLinks,
  handleSocialLinkChange,
  errors,
  submitError,
}: Step3SocialMediaProps) {
  return (
    <View className="gap-7">
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
        Connect your socials
      </Text>

      <SocialLinksSection values={socialLinks} errors={errors} onChange={handleSocialLinkChange} />

      {submitError ? (
        <View className="rounded-lg bg-error/15 p-3">
          <Text className="text-sm text-error">{submitError}</Text>
        </View>
      ) : null}
    </View>
  );
}
