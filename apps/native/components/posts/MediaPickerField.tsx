import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

type PickedAsset = {
  uri: string;
  mimeType?: string | null;
};

type Props = {
  /** The URL/URI to display. CDN url after upload; local uri during pick. */
  mediaUri: string | null;
  /** Called with the local asset when the user picks an image. */
  onPick: (asset: PickedAsset) => void;
  /** Called when the user removes the media. */
  onRemove?: () => void;
  /** Show a spinner overlay while the parent uploads. */
  isUploading?: boolean;
};

/**
 * Dashed-border media picker matching Figma 1-10650.
 * Triggers the OS photo library picker and returns the local asset URI.
 * The parent is responsible for uploading to S3 (see `use-post-image-upload`).
 *
 * Label reads "Upload Image / Video / Audio" per Figma but only images are
 * picker-enabled for now — video and audio land with M10-T1.
 */
export function MediaPickerField({ mediaUri, onPick, onRemove, isUploading }: Props) {
  const handlePick = useCallback(async () => {
    const perm = await requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset?.uri) {
        onPick({ uri: asset.uri, mimeType: asset.mimeType });
      }
    }
  }, [onPick]);

  return (
    <View>
      <Text className="mb-2 text-sm font-bold text-white/80 font-urbanist">Media</Text>

      <Pressable
        onPress={handlePick}
        disabled={isUploading}
        className={
          mediaUri
            ? 'aspect-video overflow-hidden rounded-lg bg-white/10'
            : 'aspect-video items-center justify-center rounded-lg border border-dashed border-[#8D8D8D] bg-[rgba(141,141,141,0.3)]'
        }
      >
        {mediaUri ? (
          <>
            <Image source={{ uri: mediaUri }} className="h-full w-full" resizeMode="cover" />
            {isUploading && (
              <View className="absolute inset-0 items-center justify-center bg-black/50">
                <ActivityIndicator color="#C8FF2F" />
                <Text className="mt-2 text-xs text-white font-urbanist">Uploading…</Text>
              </View>
            )}
            {!isUploading && onRemove && (
              <Pressable
                onPress={onRemove}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            )}
          </>
        ) : (
          <View className="items-center gap-2 px-4">
            <Ionicons name="cloud-upload-outline" size={24} color="#C8FF2F" />
            <Text className="text-sm font-bold text-white/80 font-urbanist">
              Upload Image / Video / Audio
            </Text>
          </View>
        )}
      </Pressable>

      <Text className="mt-2 text-xs font-semibold text-[#8D8D8D] font-urbanist">
        JPG, PNG, MP4, MOV, MP3. Max size: 100MB.
      </Text>
    </View>
  );
}
