import { Text, View } from 'react-native';

import { FreeAccessNotice } from '@/components/FreeAccessNotice';
import { VenueLinksSection, type VenueLinks } from '@/components/onboarding/VenueLinksSection';

interface Step3SocialMediaProps {
  venueLinks: VenueLinks;
  handleVenueLinkChange: (field: keyof VenueLinks, value: string) => void;
  errors: Record<string, string>;
  submitError: string | null;
}

export function Step3SocialMedia({
  venueLinks,
  handleVenueLinkChange,
  errors,
  submitError,
}: Step3SocialMediaProps) {
  return (
    <View className="gap-7">
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
        Connect your socials
      </Text>

      <VenueLinksSection values={venueLinks} errors={errors} onChange={handleVenueLinkChange} />

      <FreeAccessNotice />

      {submitError ? (
        <View className="rounded-lg bg-error/15 p-3">
          <Text className="text-sm text-error">{submitError}</Text>
        </View>
      ) : null}
    </View>
  );
}
