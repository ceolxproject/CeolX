import { Text, TextInput, View } from 'react-native';

const BIO_MAX = 50;

interface Step2ProfileDetailsProps {
  bio: string;
  setBio: (v: string) => void;
  errors: Record<string, string>;
  handleBlur: (field: string) => void;
}

export function Step2ProfileDetails({ bio, setBio, errors, handleBlur }: Step2ProfileDetailsProps) {
  return (
    <View className="gap-7">
      <View className="gap-2">
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff', lineHeight: 36 }}>
          Your story
        </Text>
        <Text className="text-base leading-6 text-gray-10">
          Tell fans what makes your sound unique. You can always edit this later.
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-white/80">Short Bio (optional)</Text>
          <Text className="text-base text-gray-10">
            {bio.length}/{BIO_MAX}
          </Text>
        </View>
        <TextInput
          className={`rounded-lg bg-white px-4 py-4 text-base text-black ${errors.bio ? 'border border-error' : ''}`}
          placeholder="Describe yourself..."
          placeholderTextColor="rgba(141,141,141,0.8)"
          value={bio}
          onChangeText={setBio}
          onBlur={() => handleBlur('bio')}
          multiline
          maxLength={BIO_MAX}
          // minHeight (not height) lets the box grow with each new line so the
          // earliest lines stay visible instead of scrolling out of view.
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        {errors.bio ? <Text className="text-xs text-error">{errors.bio}</Text> : null}
      </View>
    </View>
  );
}
