import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

interface ProfilePictureProps {
  uri: string | null;
  label?: string;
  onPress: () => void;
}

export function ProfilePicture({
  uri,
  label = 'Upload Profile Picture',
  onPress,
}: ProfilePictureProps) {
  return (
    <Pressable onPress={onPress} className="items-center gap-3">
      <View
        className="rounded-full overflow-hidden items-center justify-center"
        style={{ width: 120, height: 120, borderWidth: 2, borderColor: '#C8FF2F' }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 120, height: 120 }} resizeMode="cover" />
        ) : (
          <View
            className="items-center justify-center"
            style={{ width: 120, height: 120, backgroundColor: '#1b1b1b' }}
          >
            <Ionicons name="camera-outline" size={36} color="#C8FF2F" />
          </View>
        )}
      </View>
      <Text
        style={{
          color: '#C8FF2F',
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
