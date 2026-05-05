import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { useCallback } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

type PickedAsset = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  /** The picker reports type='image' or 'video' — used to route uploads. */
  mediaKind?: 'image' | 'video';
};

type Props = {
  /** The URL/URI to display. CDN url after upload; local uri during pick. */
  mediaUri: string | null;
  /** What to render — image preview or a video placeholder. */
  mediaKind?: 'image' | 'video';
  /** Called with the local asset when the user picks media. */
  onPick: (asset: PickedAsset) => void;
  /** Called when the user removes the media. */
  onRemove?: () => void;
  /** Show a spinner overlay while the parent uploads. */
  isUploading?: boolean;
  /** 0–1 progress while uploading. */
  progress?: number;
};

/**
 * Dashed-border media picker matching Figma 1-10650.
 * Triggers the OS photo library picker for images + videos and forwards
 * the local asset to the parent. The parent uploads via useMediaUpload
 * (image → s3) or useVideoUpload (video → mux).
 *
 * Audio is V1-deferred — it lands via a separate AudioPickerField using
 * expo-document-picker (expo-image-picker doesn't expose audio).
 */
export function MediaPickerField({
  mediaUri,
  mediaKind,
  onPick,
  onRemove,
  isUploading,
  progress,
}: Props) {
  const handlePick = useCallback(async () => {
    const perm = await requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      // No allowsEditing for videos — iOS forces a trim UI we don't want.
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset?.uri) {
        const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
        onPick({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          mediaKind: kind,
        });
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
            {mediaKind === 'video' ? (
              <View className="h-full w-full items-center justify-center bg-black">
                <Ionicons name="play-circle" size={56} color="#C8FF2F" />
                <Text className="mt-2 text-xs text-white/80 font-urbanist">Video selected</Text>
              </View>
            ) : (
              <Image source={{ uri: mediaUri }} className="h-full w-full" resizeMode="cover" />
            )}
            {isUploading && (
              <View className="absolute inset-0 items-center justify-center bg-black/50">
                <ActivityIndicator color="#C8FF2F" />
                <Text className="mt-2 text-xs text-white font-urbanist">
                  Uploading… {typeof progress === 'number' ? `${Math.round(progress * 100)}%` : ''}
                </Text>
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
              Upload Image or Video
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
