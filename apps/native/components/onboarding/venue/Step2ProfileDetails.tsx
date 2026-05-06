import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput, View } from 'react-native';

const BIO_MAX = 50;

interface Step2ProfileDetailsProps {
  bio: string;
  setBio: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  errors: Record<string, string>;
  handleBlur: (field: string) => void;
}

export function Step2ProfileDetails({
  bio,
  setBio,
  address,
  setAddress,
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
          <Text className="text-sm font-bold text-white/80">Venue Location</Text>
          <View
            className={`h-[52px] flex-row items-center rounded-lg bg-white px-4 ${errors.address ? 'border border-error' : ''}`}
          >
            <TextInput
              className="flex-1 text-base text-black"
              placeholder="Choose your location"
              placeholderTextColor="#8d8d8d"
              value={address}
              onChangeText={setAddress}
              onBlur={() => handleBlur('address')}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Ionicons name="location-outline" size={20} color="#C8FF2F" />
          </View>
          {errors.address ? <Text className="text-xs text-error">{errors.address}</Text> : null}
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-white/80">Short Description (optional)</Text>
            <Text className="text-base text-gray-10">
              {bio.length}/{BIO_MAX}
            </Text>
          </View>
          <View
            className={`rounded-lg bg-white px-4 py-4 ${errors.bio ? 'border border-error' : ''}`}
            style={{ height: 72 }}
          >
            <TextInput
              className="flex-1 text-base text-black"
              placeholder="Describe your business..."
              placeholderTextColor="rgba(141,141,141,0.8)"
              value={bio}
              onChangeText={setBio}
              onBlur={() => handleBlur('bio')}
              multiline
              maxLength={BIO_MAX}
              style={{ textAlignVertical: 'top' }}
            />
          </View>
          {errors.bio ? <Text className="text-xs text-error">{errors.bio}</Text> : null}
        </View>
      </View>
    </View>
  );
}
