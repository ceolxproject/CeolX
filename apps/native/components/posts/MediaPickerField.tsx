import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync } from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import {
  MAX_BYTES_BY_TYPE,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_SECONDS,
  mediaTooLargeMessage,
  videoTooLongMessage,
} from '@CeolX/shared/validators';

import { appToast } from '@/components/AppToast';
import { clampFeedRatio, useImageRatio } from '@/hooks/use-image-ratio';

const MB = 1024 * 1024;
const IMAGE_MAX_MB = Math.round(MAX_BYTES_BY_TYPE.post_image / MB);
const VIDEO_MAX_MB = Math.round(MAX_VIDEO_BYTES / MB);

/**
 * Looping preview of the picked video. Isolated in its own component so the
 * `useVideoPlayer` hook only runs once a video is actually selected. Shows the
 * real footage (not a blank placeholder) and uses `cover` so the creator sees
 * the same reels-style crop the post will display.
 *
 * Mute is owned by the parent, not held here: the speaker badge has to render
 * above the uploading overlay to stay reachable, and that overlay is a sibling
 * of this component.
 */
function LocalVideoPreview({ uri, muted }: { uri: string; muted: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    // Seed from the current value, not a hard-coded `false` — a re-render that
    // rebuilds the player must not undo the creator's mute.
    p.muted = muted;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

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
  /**
   * Lock the field: no re-pick, no remove. Used when editing a video post —
   * Mux-managed media can't be swapped on edit, so it's shown for reference
   * only (Asana 1215484454792689).
   */
  readOnly?: boolean;
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
  readOnly,
}: Props) {
  // Preview an image at the ratio the feed will use. The old fixed 16:9 preview
  // disagreed with both the feed and the detail screen, so the poster the
  // creator approved was not the poster that got published.
  const natural = useImageRatio(mediaKind === 'image' ? mediaUri : null);
  const imageRatio = natural === null ? null : clampFeedRatio(natural);

  // A just-picked clip plays with sound — the creator is reviewing their own work
  // before publishing and needs to hear it. An existing video opened for editing
  // does not: nothing was picked, so audio nobody asked for would just start.
  // `readOnly` is that distinction (see the prop docs), and it arrives a render
  // late while the post loads, so the default is derived rather than seeded into
  // state; `null` means "creator hasn't decided", not "unmuted".
  const [mutedOverride, setMutedOverride] = useState<boolean | null>(null);
  const previewMuted = mutedOverride ?? readOnly === true;

  const handlePick = useCallback(async () => {
    if (readOnly) return;
    const perm = await requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appToast.error('Permission needed', 'Please allow access to your photo library.');
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

        // Reject oversized media the moment it's picked — before the user
        // writes a caption and taps Publish — so they get a clear reason
        // instead of a cryptic upload failure deep in the publish flow
        // (Asana 1216260009179370). uploadVideo/uploadMedia re-check as
        // defense-in-depth; this is purely for fast, obvious feedback.
        const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_BYTES_BY_TYPE.post_image;
        if (asset.fileSize && asset.fileSize > max) {
          appToast.error(
            kind === 'video' ? 'Video too large' : 'Image too large',
            mediaTooLargeMessage(kind, max)
          );
          return;
        }

        // Same fast-feedback rule as the size guard above. The picker reports
        // duration in ms and omits it for images (and occasionally for a video
        // it can't probe) — an unknown duration is let through rather than
        // blocking a valid pick on a missing field.
        if (
          kind === 'video' &&
          asset.duration &&
          asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000
        ) {
          appToast.error('Video too long', videoTooLongMessage(MAX_VIDEO_DURATION_SECONDS));
          return;
        }

        onPick({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          mediaKind: kind,
        });
      }
    }
  }, [onPick, readOnly]);

  return (
    <View>
      <Text className="mb-2 text-sm font-bold text-white/80 font-urbanist">Media</Text>

      <Pressable
        onPress={handlePick}
        disabled={isUploading || readOnly}
        style={
          mediaUri && mediaKind === 'image' && imageRatio ? { aspectRatio: imageRatio } : undefined
        }
        className={
          mediaUri
            ? mediaKind === 'video'
              ? 'aspect-[4/5] overflow-hidden rounded-lg bg-black'
              : imageRatio
                ? 'overflow-hidden rounded-lg bg-white/10'
                : 'aspect-video overflow-hidden rounded-lg bg-white/10'
            : 'aspect-video items-center justify-center rounded-lg border border-dashed border-[#8D8D8D] bg-[rgba(141,141,141,0.3)]'
        }
      >
        {mediaUri ? (
          <>
            {mediaKind === 'video' ? (
              <LocalVideoPreview uri={mediaUri} muted={previewMuted} />
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
            {/* After the uploading overlay, deliberately: the clip keeps looping
                audibly through a long upload, so muting has to stay reachable.
                Nested Pressable, so the tap doesn't re-open the picker behind it. */}
            {mediaKind === 'video' && (
              <Pressable
                onPress={() => setMutedOverride(!previewMuted)}
                hitSlop={8}
                className="absolute bottom-2 left-2 h-9 w-9 items-center justify-center rounded-full bg-black/55"
                accessibilityRole="button"
                accessibilityLabel={previewMuted ? 'Unmute preview' : 'Mute preview'}
              >
                <Ionicons
                  name={previewMuted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color="#FFFFFF"
                />
              </Pressable>
            )}
            {!isUploading && !readOnly && onRemove && (
              <Pressable
                onPress={onRemove}
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            )}
          </>
        ) : readOnly ? (
          // Locked video being edited but still transcoding — no playable URL
          // yet, so show a non-interactive "processing" state rather than the
          // upload prompt (which would imply the video can be changed).
          <View className="items-center gap-2 px-4">
            <Ionicons name="hourglass-outline" size={24} color="#8D8D8D" />
            <Text className="text-sm font-bold text-white/80 font-urbanist">
              Video is processing…
            </Text>
          </View>
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
        JPG, PNG up to {IMAGE_MAX_MB}MB · MP4, MOV up to {VIDEO_MAX_MB}MB and{' '}
        {MAX_VIDEO_DURATION_SECONDS}s.
      </Text>
    </View>
  );
}
