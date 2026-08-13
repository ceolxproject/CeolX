import { Text, TextInput, View } from 'react-native';

import { BIO_MAX_LENGTH } from '@CeolX/shared/validators';

import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';
import { LocationPicker, type PickedLocation } from '@/components/LocationPicker';

interface Step2ProfileDetailsProps {
  bio: string;
  setBio: (v: string) => void;
  address: string;
  lat: number | null;
  lng: number | null;
  setLocation: (loc: PickedLocation) => void;
  errors: Record<string, string>;
  handleBlur: (field: string) => void;
}

export function Step2ProfileDetails({
  bio,
  setBio,
  address,
  lat,
  lng,
  setLocation,
  errors,
  handleBlur,
}: Step2ProfileDetailsProps) {
  return (
    <View className="gap-7">
      <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
        Where & why
      </Text>

      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-sm font-bold text-white/80">Venue/Festival Location</Text>
          <LocationPicker
            lat={lat}
            lng={lng}
            address={address}
            onChange={setLocation}
            error={errors.lat ?? errors.lng ?? errors.address}
          />
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-white/80">Short Description (optional)</Text>
            <CharacterCount
              count={bio.length}
              max={BIO_MAX_LENGTH}
              className="text-base text-gray-10"
            />
          </View>
          <TextInput
            className={`rounded-lg bg-white px-4 py-4 text-base text-black ${errors.bio ? 'border border-error' : ''}`}
            placeholder="Tell artists about your venue/festival..."
            placeholderTextColor="rgba(141,141,141,0.8)"
            value={bio}
            onChangeText={setBio}
            onBlur={() => handleBlur('bio')}
            multiline
            maxLength={BIO_MAX_LENGTH}
            // minHeight (not height) lets the box grow with each new line so the
            // earliest lines stay visible instead of scrolling out of view.
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          {errors.bio ? <Text className="text-xs text-error">{errors.bio}</Text> : null}
          <CharacterLimitNote count={bio.length} max={BIO_MAX_LENGTH} />
        </View>
      </View>
    </View>
  );
}
