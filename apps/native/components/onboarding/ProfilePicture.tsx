import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

interface ProfilePictureProps {
  uri: string | null;
  label?: string;
  onPress: () => void;
  /** When provided and an image is set, shows a ✕ badge to clear it. */
  onRemove?: () => void;
}

export function ProfilePicture({
  uri,
  label = 'Upload Profile Picture',
  onPress,
  onRemove,
}: ProfilePictureProps) {
  return (
    <View className="items-center gap-3">
      {/* Avatar is its own Pressable so the remove badge below doesn't sit
          inside its touch target — tapping the avatar always (re)opens the
          picker; tapping ✕ only clears. */}
      <View style={{ width: 120, height: 120 }}>
        <Pressable
          onPress={onPress}
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
        </Pressable>
        {uri && onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            className="absolute right-0 top-0 h-8 w-8 items-center justify-center rounded-full bg-black/70"
          >
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onPress}>
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
    </View>
  );
}
