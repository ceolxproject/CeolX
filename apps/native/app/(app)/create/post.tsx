import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';
import { createPostSchema, POST_CAPTION_MAX, updatePostSchema } from '@CeolX/shared/validators';

import { AppHeader } from '@/components/AppHeader';
import { appToast } from '@/components/AppToast';
import { CharacterCount, CharacterLimitNote } from '@/components/CharacterCount';
import { MediaPickerField } from '@/components/posts/MediaPickerField';
import { VenuePublishBlockedNotice } from '@/components/subscription/VenueSubscriptionState';
import { useCreatePost } from '@/hooks/use-create-post';
import { useMe } from '@/hooks/use-me';
import { useMediaDelete, keyFromCdnUrl } from '@/hooks/use-media-delete';
import { useMediaUpload } from '@/hooks/use-media-upload';
import { usePostById } from '@/hooks/use-post-by-id';
import { useUpdatePost } from '@/hooks/use-update-post';
import { planPostMediaUpdate } from '@/hooks/use-update-post.utils';
import { useVenueSubscription } from '@/hooks/use-venue-subscription';
import { useVideoUpload } from '@/hooks/use-video-upload';

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

  const { data: me } = useMe();
  const isVenue = me?.currentRole === UserRole.VENUE;
  const subscription = useVenueSubscription();

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

  // Seed form when editing an existing post. Both image and video posts carry
  // a ready mediaUrl (S3/CloudFront for images, the Mux HLS .m3u8 for video) —
  // seed either so the creator sees their existing media in the edit screen
  // instead of an empty picker (Asana 1215484454792689). Video is shown
  // read-only: its media is Mux-managed and is never swapped on edit (see
  // planPostMediaUpdate + handlePublish). A still-transcoding video has no
  // mediaUrl yet, so it falls through to the read-only "processing" state.
  useEffect(() => {
    if (!isEditing || !existing.data) return;
    const { caption: existingCaption, mediaType, mediaUrl } = existing.data;
    setCaption(existingCaption);
    if ((mediaType === 'image' || mediaType === 'video') && mediaUrl) {
      setMedia({ uri: mediaUrl, cdnUrl: mediaUrl, kind: mediaType });
    } else {
      setMedia(null);
    }
  }, [existing.data, isEditing]);

  // A video post's media is locked on edit — it can't be removed or replaced,
  // so the picker is presented read-only (no remove button, tapping is inert).
  const isVideoEdit = isEditing && existing.data?.mediaType === 'video';

  // Android-only: a freshly-picked image OR video paints blank until the picker
  // field remounts (same issue as the event cover — see create.tsx and Asana
  // 1215040939202669). Bump a key shortly after new media is picked to force
  // that remount. iOS renders fine, so we skip it there. The video preview is
  // now a live expo-video VideoView (it used to be a static placeholder), so it
  // hits the same freshly-picked-uri bug and needs the remount too.
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android' || !media?.uri) return;
    const timer = setTimeout(() => setMediaRefreshKey((k) => k + 1), 350);
    return () => clearTimeout(timer);
  }, [media?.uri, media?.kind]);

  // Clearing media is just local state — any S3 cleanup of a replaced or
  // removed image happens once the edit is actually saved (see handlePublish).
  // That way, cancelling an edit after removing the image never deletes a file
  // the post still points to.
  const handleRemoveMedia = () => setMedia(null);

  const busy = isPublishing || createPost.isPending || updatePost.isPending;
  const disabled = caption.trim().length === 0 || isUploading || busy;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (isEditing && editId) {
        // Work out what changed about the media: a new image to upload, an
        // existing image removed, or no change. Video media is managed by Mux
        // server-side and is never swapped on edit.
        const plan = planPostMediaUpdate({
          originalMediaType: existing.data?.mediaType,
          originalMediaUrl: existing.data?.mediaUrl,
          currentKind: media?.kind ?? null,
          currentHasCdnUrl: !!media?.cdnUrl,
        });

        const updateInput: Record<string, unknown> = { id: editId, caption: caption.trim() };
        if (plan.action === 'upload' && media) {
          // Freshly-picked image — upload to S3 and point the post at the new URL.
          const { cdnUrl } = await imageUpload.uploadMedia({
            uri: media.uri,
            mimeType: media.mimeType,
            fileSize: media.fileSize ?? null,
          });
          updateInput.mediaType = 'image';
          updateInput.mediaUrl = cdnUrl;
        } else if (plan.action === 'clear') {
          // Image removed — revert the post to text-only.
          updateInput.mediaType = 'text';
          updateInput.mediaUrl = null;
        }

        const input = updatePostSchema.parse(updateInput);
        await updatePost.mutateAsync(input);

        // Best-effort cleanup of the replaced/removed image, after the save
        // succeeds. Fire-and-forget — S3 lifecycle (90-day expiry) is the net.
        if (plan.action !== 'keep' && plan.cleanupUrl) {
          const key = keyFromCdnUrl(plan.cleanupUrl);
          if (key) {
            cleanupAfterDelete({ key }).catch((err) => {
              console.warn('[post] failed to clean up replaced media', err);
            });
          }
        }
      } else if (media?.kind === 'video') {
        // Mux pipeline — get an uploadId, persist that. The webhook fills
        // in playback_id/mediaUrl asynchronously.
        const result = await videoUpload.uploadVideo({
          uri: media.uri,
          fileSize: media.fileSize ?? null,
        });
        // Don't present a failed transcode as a successful post. 'errored' means
        // Mux rejected the upload, so abort instead of persisting a broken post.
        if (result.status === 'errored') {
          throw new Error('Video processing failed. Please try a different video.');
        }
        const input = createPostSchema.parse({
          caption: caption.trim(),
          mediaType: 'video',
          muxUploadId: result.uploadId,
        });
        await createPost.mutateAsync(input);
        // 'pending' = still transcoding at the poll timeout. The webhook will
        // finish it, but tell the user rather than implying it's ready now.
        if (result.status === 'pending') {
          appToast.success(
            'Post published',
            'Your video is still processing and will appear shortly.'
          );
          router.back();
          return;
        }
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
      {/* Without this the multiline caption sits near the bottom of the scroll
          and the keyboard covers it — matches the wrapper used on every other
          form (change-password, events/create). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <AppHeader leading="back" />

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
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
                readOnly={isVideoEdit}
              />
            </View>

            <View className="mb-5">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm font-bold text-white/80 font-urbanist">Caption</Text>
                <CharacterCount
                  count={caption.length}
                  max={POST_CAPTION_MAX}
                  className="text-base font-medium text-[#8D8D8D] font-urbanist"
                />
              </View>
              <TextInput
                placeholder="Write a caption..."
                placeholderTextColor="#8D8D8D"
                multiline
                maxLength={POST_CAPTION_MAX}
                value={caption}
                onChangeText={(text) => setCaption(text.slice(0, POST_CAPTION_MAX))}
                textAlignVertical="top"
                className="h-[156px] rounded-lg bg-white p-4 text-base font-medium text-black font-urbanist"
              />
              <CharacterLimitNote count={caption.length} max={POST_CAPTION_MAX} className="mt-2" />
            </View>
          </View>
        </ScrollView>

        <View className="px-6 pb-6 gap-3">
          {/* V-14: an unpaid venue cannot publish. The server refuses it too
              (assertVenueMayPublish) — this explains why the button is dim, because
              a disabled control with no reason reads as a bug. */}
          {isVenue && !isEditing && !subscription.mayPublish ? <VenuePublishBlockedNotice /> : null}

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
