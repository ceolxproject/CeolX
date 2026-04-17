import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPostSchema, updatePostSchema } from '@CeolX/shared/validators';

import { MediaPickerField } from '@/components/posts/MediaPickerField';
import { useCreatePost } from '@/hooks/use-create-post';
import { usePostById } from '@/hooks/use-post-by-id';
import { usePostImageUpload } from '@/hooks/use-post-image-upload';
import { useUpdatePost } from '@/hooks/use-update-post';

const CAPTION_MAX = 500;

type LocalMedia = {
  uri: string;
  mimeType?: string | null;
  /** Already-uploaded CDN url (when editing a post that has media). */
  cdnUrl?: string;
};

export default function CreatePostScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;

  const existing = usePostById(editId ?? null);
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<LocalMedia | null>(null);

  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const { uploadImage, isUploading } = usePostImageUpload();

  // Seed form when editing an existing post.
  useEffect(() => {
    if (!isEditing || !existing.data) return;
    setCaption(existing.data.caption);
    if (existing.data.mediaType === 'image' && existing.data.mediaUrl) {
      setMedia({ uri: existing.data.mediaUrl, cdnUrl: existing.data.mediaUrl });
    } else {
      setMedia(null);
    }
  }, [existing.data, isEditing]);

  const disabled =
    caption.trim().length === 0 || isUploading || createPost.isPending || updatePost.isPending;

  const handlePublish = async () => {
    try {
      // If media was picked locally and not yet uploaded, upload it first.
      let mediaUrl = media?.cdnUrl ?? null;
      if (media && !media.cdnUrl) {
        const { cdnUrl } = await uploadImage({ uri: media.uri, mimeType: media.mimeType });
        mediaUrl = cdnUrl;
      }

      if (isEditing && editId) {
        const input = updatePostSchema.parse({
          id: editId,
          caption: caption.trim(),
          mediaType: mediaUrl ? 'image' : 'text',
          mediaUrl: mediaUrl ?? null,
        });
        await updatePost.mutateAsync(input);
      } else {
        const input = createPostSchema.parse({
          caption: caption.trim(),
          mediaType: mediaUrl ? 'image' : 'text',
          ...(mediaUrl ? { mediaUrl } : {}),
        });
        await createPost.mutateAsync(input);
      }

      router.back();
    } catch (err) {
      Alert.alert('Failed to publish', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }} edges={['top']}>
      <View className="flex-row items-center p-5">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6">
          <Text className="mb-5 text-[28px] font-bold text-white font-urbanist leading-[32px]">
            {isEditing ? 'Edit Post' : 'Create New Post'}
          </Text>

          <View className="mb-5">
            <MediaPickerField
              mediaUri={media?.uri ?? null}
              onPick={(asset) => setMedia({ uri: asset.uri, mimeType: asset.mimeType })}
              onRemove={() => setMedia(null)}
              isUploading={isUploading}
            />
          </View>

          <View className="mb-5">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-sm font-bold text-white/80 font-urbanist">Caption</Text>
              <Text className="text-base font-medium text-[#8D8D8D] font-urbanist">
                {caption.length}/{CAPTION_MAX}
              </Text>
            </View>
            <TextInput
              placeholder="Write a caption..."
              placeholderTextColor="#8D8D8D"
              multiline
              maxLength={CAPTION_MAX}
              value={caption}
              onChangeText={setCaption}
              textAlignVertical="top"
              className="h-[156px] rounded-lg bg-white p-4 text-base font-medium text-black font-urbanist"
            />
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-6">
        <Pressable
          onPress={handlePublish}
          disabled={disabled}
          className={
            disabled
              ? 'h-14 items-center justify-center rounded-full bg-[#6155F5]/50'
              : 'h-14 items-center justify-center rounded-full bg-[#6155F5]'
          }
        >
          {createPost.isPending || updatePost.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-bold uppercase text-white font-inter tracking-wider">
              {isEditing ? 'save changes' : 'publish post'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
