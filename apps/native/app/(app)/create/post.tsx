import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createPostSchema, updatePostSchema } from '@CeolX/shared/validators';

import { appToast } from '@/components/AppToast';
import { MediaPickerField } from '@/components/posts/MediaPickerField';
import { useCreatePost } from '@/hooks/use-create-post';
import { useMediaDelete, keyFromCdnUrl } from '@/hooks/use-media-delete';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { usePostById } from '@/hooks/use-post-by-id';
import { useUpdatePost } from '@/hooks/use-update-post';
import { useVideoUpload } from '@/hooks/use-video-upload';

const CAPTION_MAX = 500;

type LocalMedia = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  kind: 'image' | 'video';
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
  const imageUpload = useMediaUpload('post_image');
  const videoUpload = useVideoUpload();
  const { cleanupAfterDelete } = useMediaDelete();

  const isUploading = imageUpload.isUploading || videoUpload.isUploading;
  const progress = imageUpload.isUploading ? imageUpload.progress : videoUpload.progress;

  // Covers the whole publish flow (upload + mutation), so the button shows a
  // spinner the instant it's tapped instead of only once the mutation fires.
  const [isPublishing, setIsPublishing] = useState(false);

  // Seed form when editing an existing post.
  useEffect(() => {
    if (!isEditing || !existing.data) return;
    setCaption(existing.data.caption);
    if (existing.data.mediaType === 'image' && existing.data.mediaUrl) {
      setMedia({ uri: existing.data.mediaUrl, cdnUrl: existing.data.mediaUrl, kind: 'image' });
    } else {
      setMedia(null);
    }
  }, [existing.data, isEditing]);

  // Android-only: a freshly-picked image paints black until the picker field
  // remounts (same issue as the event cover — see create.tsx and Asana
  // 1215040939202669). Bump a key shortly after a new image is picked to force
  // that remount. iOS renders fine, so we skip it there. Videos render a static
  // placeholder, not an <Image>, so they don't need it.
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || media?.kind !== 'image' || !media.uri) return;
    const timer = setTimeout(() => setMediaRefreshKey((k) => k + 1), 350);
    return () => clearTimeout(timer);
  }, [media?.uri, media?.kind]);

  const handleRemoveMedia = async () => {
    // If the existing media is already in S3, delete it now so the bucket
    // doesn't accumulate orphans. Best-effort — log and move on if it fails.
    if (media?.cdnUrl) {
      const key = keyFromCdnUrl(media.cdnUrl);
      if (key) {
        try {
          await cleanupAfterDelete({ key });
        } catch (err) {
          console.warn('[post] failed to clean up replaced media', err);
        }
      }
    }
    setMedia(null);
  };

  const busy = isPublishing || createPost.isPending || updatePost.isPending;
  const disabled = caption.trim().length === 0 || isUploading || busy;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (isEditing && editId) {
        // Editing only updates caption (video mediaUrl is server-managed,
        // and we don't currently support swapping media on edit).
        const input = updatePostSchema.parse({ id: editId, caption: caption.trim() });
        await updatePost.mutateAsync(input);
      } else if (media?.kind === 'video') {
        // Mux pipeline — get an uploadId, persist that. The webhook fills
        // in playback_id/mediaUrl asynchronously.
        const result = await videoUpload.uploadVideo({
          uri: media.uri,
          fileSize: media.fileSize ?? null,
        });
        const input = createPostSchema.parse({
          caption: caption.trim(),
          mediaType: 'video',
          muxUploadId: result.uploadId,
        });
        await createPost.mutateAsync(input);
      } else if (media) {
        // Image post — s3 upload, persist CDN URL.
        const { cdnUrl } = await imageUpload.uploadMedia({
          uri: media.uri,
          mimeType: media.mimeType,
          fileSize: media.fileSize ?? null,
        });
        const input = createPostSchema.parse({
          caption: caption.trim(),
          mediaType: 'image',
          mediaUrl: cdnUrl,
        });
        await createPost.mutateAsync(input);
      } else {
        const input = createPostSchema.parse({ caption: caption.trim(), mediaType: 'text' });
        await createPost.mutateAsync(input);
      }

      appToast.success(isEditing ? 'Post updated' : 'Post published');
      router.back();
    } catch (err) {
      appToast.error('Failed to publish', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsPublishing(false);
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
              key={mediaRefreshKey}
              mediaUri={media?.uri ?? null}
              mediaKind={media?.kind}
              onPick={(asset) =>
                setMedia({
                  uri: asset.uri,
                  mimeType: asset.mimeType,
                  fileSize: asset.fileSize,
                  kind: asset.mediaKind ?? 'image',
                })
              }
              onRemove={handleRemoveMedia}
              isUploading={isUploading}
              progress={progress}
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
          {busy ? (
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
