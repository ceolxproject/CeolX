import { Text, View } from 'react-native';

import { SocialInput } from './SocialLinksSection';

export interface VenueLinks {
  WEBSITE: string;
  INSTAGRAM: string;
  FACEBOOK: string;
  TWITTER: string;
}

interface VenueLinksSectionProps {
  values: VenueLinks;
  errors: Record<string, string>;
  onChange: (field: keyof VenueLinks, value: string) => void;
}

export function VenueLinksSection({ values, errors, onChange }: VenueLinksSectionProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold text-white/80">Links (optional)</Text>
      <SocialInput
        icon="globe-outline"
        placeholder="https://yourwebsite.ie"
        value={values.WEBSITE}
        onChangeText={(v) => onChange('WEBSITE', v)}
        error={errors['venueLinks.WEBSITE']}
      />
      <SocialInput
        icon="logo-instagram"
        placeholder="https://instagram.com/yourhandle"
        value={values.INSTAGRAM}
        onChangeText={(v) => onChange('INSTAGRAM', v)}
        error={errors['venueLinks.INSTAGRAM']}
      />
      <SocialInput
        icon="logo-facebook"
        placeholder="https://facebook.com/yourpage"
        value={values.FACEBOOK}
        onChangeText={(v) => onChange('FACEBOOK', v)}
        error={errors['venueLinks.FACEBOOK']}
      />
      <SocialInput
        icon="logo-twitter"
        placeholder="https://x.com/yourhandle"
        value={values.TWITTER}
        onChangeText={(v) => onChange('TWITTER', v)}
        error={errors['venueLinks.TWITTER']}
      />
      <Text className="text-xs font-semibold text-gray-10">
        Your links will be visible to artists and other businesses.
      </Text>
    </View>
  );
}
