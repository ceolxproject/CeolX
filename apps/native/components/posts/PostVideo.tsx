import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { deriveVideoState } from './PostVideo.utils';

import { setVideoMuted, useVideoMuted } from '@/hooks/use-video-muted';

type Props = {
  /** HLS URL written by the Mux webhook once transcoding completes (may be null while pending). */
  mediaUrl: string | null;
  /** 'pending' | 'ready' | 'errored' | null — null on legacy rows before the webhook ran. */
  muxStatus: string | null;
  /** Mux playback id — lets us build the stream + poster URLs even if mediaUrl is unset. */
  muxPlaybackId: string | null;
  /**
   * Feed viewport flag. `false` → an off-screen feed card, so freeze back to the
   * poster (stops + frees the player). `true` or `undefined` → eligible to play.
   * `undefined` is a surface with no viewport tracking (profile / venue / artist
   * post lists, post detail). Screen focus is checked on top of this either way.
   */
  active?: boolean;
};

/**
 * Mounts the actual expo-video player. Lives in its own component so the
 * `useVideoPlayer` hook only ever runs with a real URL, and so no player instance
 * exists for cards that aren't on screen. `muted` and `paused` are applied live
 * (via effects) so toggling either one doesn't remount and re-buffer.
 */
function ReadyVideo({
  streamUri,
  muted,
  paused,
}: {
  streamUri: string;
  muted: boolean;
  paused: boolean;
}) {
  const player = useVideoPlayer(streamUri, (p) => {
    // Starts itself and repeats forever — a feed video behaves like Instagram or
    // TikTok, not like a media file waiting on a play button.
    p.loop = true;
    p.muted = muted;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);

  // A native VideoView has no intrinsic size, so on the new architecture it
  // collapses to 0px tall when handed only an aspect ratio with no concrete
  // height. Size a plain wrapper View (Yoga resolves aspect-ratio there) and let
  // the VideoView fill it with explicit width/height. `cover` crops the video to
  // fill the portrait frame edge-to-edge (reels-style — no black bars).
  return (
    <View className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-black">
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        // No platform scrubber or buttons, ever. Tap is a mute toggle and the
        // speaker badge is the only chrome.
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

/** Shared frame so every state keeps the same portrait 4:5 footprint in the feed. */
function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-3 aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl bg-black/40">
      {children}
    </View>
  );
}

export function PostVideo({ mediaUrl, muxStatus, muxPlaybackId, active }: Props) {
  // Mute is app-wide (see use-video-muted) so the feed card and the post detail
  // screen can't disagree about it. Pause stays local: only one player is ever
  // alive, so there is no second instance to keep in step.
  const muted = useVideoMuted();
  const [paused, setPaused] = useState(false);

  // Opening a post pushes the detail screen but does NOT unmount the feed card
  // behind it. Without this, both mount a player for the same video: the feed one
  // keeps streaming its own audio, so pausing on the detail screen can't stop the
  // sound. Gating on focus leaves exactly one live player at a time.
  const isFocused = useIsFocused();
  const shouldPlay = isFocused && active !== false;
  const state = deriveVideoState(mediaUrl, muxStatus, muxPlaybackId);

  // Resume playing when the card comes back, rather than returning to a video
  // frozen by a pause the user has long since forgotten about.
  useEffect(() => {
    if (!shouldPlay) setPaused(false);
  }, [shouldPlay]);

  if (state.kind === 'processing') {
    return (
      <VideoFrame>
        <ActivityIndicator color="#C8FF2F" />
        <Text className="mt-2 text-xs text-white/60 font-urbanist">Processing video…</Text>
      </VideoFrame>
    );
  }

  if (state.kind === 'error') {
    return (
      <VideoFrame>
        <Ionicons name="alert-circle-outline" size={28} color="#FF4D6D" />
        <Text className="mt-2 text-xs text-white/60 font-urbanist">Video unavailable</Text>
      </VideoFrame>
    );
  }

  // Off-screen, or on a screen that isn't focused: hold the poster frame and keep
  // no player alive, so nothing streams that nobody is looking at. Deliberately
  // not pressable — the tap falls through to the card's own navigation.
  if (!shouldPlay) {
    return (
      <View className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-xl bg-black">
        {state.poster && (
          <Image source={{ uri: state.poster }} className="h-full w-full" resizeMode="cover" />
        )}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setPaused((prev) => !prev)}
      className="mb-3 w-full"
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play video' : 'Pause video'}
    >
      <ReadyVideo streamUri={state.streamUri} muted={muted} paused={paused} />

      {/* Both controls stay visible the whole time. Tapping the video body also
          pauses (the gesture people already use), but it's an invisible target —
          without these badges nothing tells a first-time user either control
          exists. Nested Pressables, so each one acts alone: the responder system
          hands the touch to the child and the parent's onPress never fires. */}
      <View className="absolute bottom-3 right-3 flex-row gap-2">
        <Pressable
          onPress={() => setPaused((prev) => !prev)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/55"
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Play video' : 'Pause video'}
        >
          <Ionicons name={paused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPress={() => setVideoMuted(!muted)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/55"
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}
