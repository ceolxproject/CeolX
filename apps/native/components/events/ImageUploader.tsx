import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { cn } from 'heroui-native';
import { useCallback } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { MAX_BYTES_BY_TYPE } from '@CeolX/shared/validators';

import { appToast } from '@/components/AppToast';
import { clampFeedRatio, useImageRatio } from '@/hooks/use-image-ratio';

// Derived so the copy tracks the real cap instead of drifting from it — the
// previous hardcoded "100kb" was ~100x under the actual limit.
const COVER_MAX_MB = Math.round(MAX_BYTES_BY_TYPE.event_cover / (1024 * 1024));

type Props = {
  imageUri: string | null;
  onImagePicked: (uri: string) => void;
};

export function ImageUploader({ imageUri, onImagePicked }: Props) {
  // Preview at the ratio the event screens will actually use, so what the
  // uploader sees here is what gets published.
  const natural = useImageRatio(imageUri);

  const pickImage = useCallback(async () => {
    const permResult = await requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      appToast.error('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    // No forced crop — see the note in use-event-form's pickCoverImage.
    const pickerResult = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets.length > 0) {
      const uri = pickerResult.assets[0]?.uri;
      if (uri) {
        onImagePicked(uri);
      }
    }
  }, [onImagePicked]);

  return (
    <View>
      <Pressable
        onPress={pickImage}
        style={imageUri && natural !== null ? { aspectRatio: clampFeedRatio(natural) } : undefined}
        className={cn(
          'items-center justify-center overflow-hidden rounded-lg',
          imageUri
            ? natural === null
              ? 'h-48'
              : 'w-full'
            : 'h-36 border border-dashed border-gray-600 bg-white/5'
        )}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center gap-2">
            <Ionicons name="cloud-upload-outline" size={28} color="#C8FF2F" />
            <Text className="text-sm text-white/60">Upload Image</Text>
          </View>
        )}
      </Pressable>
      <Text className="mt-1 text-xs text-white/40">JPG, PNG up to {COVER_MAX_MB}MB.</Text>
    </View>
  );
}
