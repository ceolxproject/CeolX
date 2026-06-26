import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { cn } from 'heroui-native';
import { useCallback } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { appToast } from '@/components/AppToast';

type Props = {
  imageUri: string | null;
  onImagePicked: (uri: string) => void;
};

export function ImageUploader({ imageUri, onImagePicked }: Props) {
  const pickImage = useCallback(async () => {
    const permResult = await requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      appToast.error('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const pickerResult = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
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
        className={cn(
          'items-center justify-center overflow-hidden rounded-lg',
          imageUri ? 'h-48' : 'h-36 border border-dashed border-gray-600 bg-white/5'
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
      <Text className="mt-1 text-xs text-white/40">
        Image type png or jpeg with a max file size 100kb
      </Text>
    </View>
  );
}
