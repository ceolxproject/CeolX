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
   * May this video play? `true` only where something guarantees it is the one
   * video being watched — the on-screen feed card, or the post detail screen.
   * Everywhere else passes `false`: profile / venue / artist post lists have no
   * viewport tracking and mount every card at once, so autoplaying there means
   * one live HLS stream per video post, all audible together once unmuted.
   * Required rather than optional — a surface that forgets it is the bug.
   * Screen focus is checked on top of this either way.
   */
  active: boolean;
  /**
   * Near the on-screen card, so buffer now and play later. Mounts a player
   * (which is what starts the fetch) but leaves it paused, so preloading never
   * adds a second audible stream. Surfaces without viewport tracking omit it.
   */
  preload?: boolean;
};

/**
 * Mounts the actual expo-video player.
 *
 * Rendered for the playing card AND for cards inside the preload window, because
 * expo-video begins buffering the moment a player is handed a source — it does
 * not wait to be attached to a visible view. That is the whole latency fix: by
 * the time a card scrolls in, its manifest and first segments are already there.
 * A preloaded card is mounted `paused`, so exactly one player is ever audible.
 *
 * `muted` and `paused` are applied live (via effects) so toggling either one
 * doesn't remount and re-buffer.
 */
function ReadyVideo({
  streamUri,
  poster,
  muted,
  paused,
}: {
  streamUri: string;
  poster: string | null;
  muted: boolean;
  paused: boolean;
}) {
  const player = useVideoPlayer(streamUri, (p) => {
    // Repeats forever — a feed video behaves like Instagram or TikTok, not like a
    // media file waiting on a play button. Playback itself is left to the effect
    // below so a preloaded (paused) card never starts by accident.
    p.loop = true;
    p.muted = muted;
    // Start on the first segment instead of filling the default buffer (iOS waits
    // to minimise stalling, Android holds 2s before playing).
    p.bufferOptions = { waitsToMinimizeStalling: false, minBufferForPlayback: 0.5 };
  });

  // Keyed on the source: `useVideoPlayer` rebuilds the player when `streamUri`
  // changes, so a card still on screen when its URL changes gets a fresh, empty
  // player. Without the reset the poster would stay hidden and the black frame
  // this exists to prevent would come straight back.
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  useEffect(() => {
    setHasFirstFrame(false);
  }, [streamUri]);

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
        onFirstFrameRender={() => setHasFirstFrame(true)}
      />

      {/* Covers the player until there is something to show — the buffering gap
          for a card that scrolled in faster than its preload, and the whole time
          for a preloaded card that is not playing yet.

          inset-0, not h-full/w-full: percentage sizing on an absolutely
          positioned child doesn't reliably resolve against an aspect-ratio
          parent, and a 0x0 poster is an invisible one. */}
      {poster && !hasFirstFrame && (
        <Image source={{ uri: poster }} className="absolute inset-0" resizeMode="cover" />
      )}
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

export function PostVideo({ mediaUrl, muxStatus, muxPlaybackId, active, preload }: Props) {
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
  const shouldPlay = isFocused && active;
  // Hold a source — and therefore buffer — for the playing card and for the ones
  // about to arrive. Only `shouldPlay` actually plays.
  const shouldLoad = shouldPlay || (isFocused && preload === true);
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

  // Far from the viewport, on an unfocused screen, or in a list with no viewport
  // tracking at all. Hold the poster and keep no player alive, so nothing streams
  // that nobody is going to look at. Deliberately not pressable: the tap falls
  // through to the card's own navigation, which opens the post detail screen, and
  // that is where it plays.
  if (!shouldLoad) {
    return (
      <View className="mb-3 aspect-[4/5] w-full overflow-hidden rounded-xl bg-black">
        {state.poster && (
          <Image source={{ uri: state.poster }} className="h-full w-full" resizeMode="cover" />
        )}
      </View>
    );
  }

  // Buffering ahead of its turn: the player is alive and filling, but paused and
  // still showing the poster. No controls — this card isn't the one being
  // watched, so a tap belongs to the card's navigation, as above.
  if (!shouldPlay) {
    return (
      <View className="mb-3 w-full">
        <ReadyVideo streamUri={state.streamUri} poster={state.poster} muted={muted} paused />
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
      <ReadyVideo streamUri={state.streamUri} poster={state.poster} muted={muted} paused={paused} />

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
