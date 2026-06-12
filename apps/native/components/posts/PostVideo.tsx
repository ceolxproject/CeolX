import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { deriveVideoState } from './PostVideo.utils';

type Props = {
  /** HLS URL written by the Mux webhook once transcoding completes (may be null while pending). */
  mediaUrl: string | null;
  /** 'pending' | 'ready' | 'errored' | null — null on legacy rows before the webhook ran. */
  muxStatus: string | null;
  /** Mux playback id — lets us build the stream + poster URLs even if mediaUrl is unset. */
  muxPlaybackId: string | null;
  /**
   * Feed viewport flag. `true` → this is the on-screen card, so muted autoplay.
   * `false` → an off-screen feed card, so freeze back to the poster (stops + frees
   * the player). `undefined` → a surface with no viewport tracking (profile / venue
   * / artist post lists), where we fall back to plain tap-to-play.
   */
  active?: boolean;
  /** Detail screen — always plays with sound + full controls, no viewport gating. */
  expanded?: boolean;
};

/**
 * Mounts the actual expo-video player. Lives in its own component so the
 * `useVideoPlayer` hook only ever runs with a real URL, and so no player
 * instance exists for cards that aren't on screen. `muted` / `loop` are applied
 * live (via effects) so unmuting an autoplaying card doesn't remount + re-buffer.
 */
function ReadyVideo({
  streamUri,
  muted,
  loop,
  nativeControls,
}: {
  streamUri: string;
  muted: boolean;
  loop: boolean;
  nativeControls: boolean;
}) {
  const player = useVideoPlayer(streamUri, (p) => {
    p.loop = loop;
    p.muted = muted;
    p.play();
  });

  // Toggle mute / loop on the live instance rather than recreating the player,
  // so tapping an autoplaying feed card to unmute keeps playback going.
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    player.loop = loop;
  }, [loop, player]);

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
        nativeControls={nativeControls}
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

export function PostVideo({ mediaUrl, muxStatus, muxPlaybackId, active, expanded }: Props) {
  // `playing` = the user has explicitly tapped to play (with sound + controls).
  // It drives tap-to-play on surfaces without viewport tracking and the
  // tap-to-unmute on an autoplaying feed card.
  const [playing, setPlaying] = useState(false);
  const state = deriveVideoState(mediaUrl, muxStatus, muxPlaybackId);

  // When a feed card scrolls out of view (active explicitly false), tear the
  // player back down to the poster so it stops and stops drinking battery/data.
  // `active === undefined` (non-feed surfaces) is left alone — tap-to-play sticks.
  useEffect(() => {
    if (active === false) setPlaying(false);
  }, [active]);

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

  // ready. Two ways a player mounts:
  //   - sound mode: detail screen, or the user tapped → play with sound + controls.
  //   - muted autoplay: this is the active (on-screen) feed card → loop muted.
  const soundMode = expanded || playing;
  const mutedAutoplay = !soundMode && active === true;

  if (soundMode || mutedAutoplay) {
    return (
      // Keep the wrapper identical across muted-autoplay → unmute so ReadyVideo
      // stays mounted (no re-buffer). Tap only does anything while muted.
      <Pressable
        onPress={mutedAutoplay ? () => setPlaying(true) : undefined}
        className="mb-3 w-full"
      >
        <ReadyVideo
          streamUri={state.streamUri}
          muted={mutedAutoplay}
          loop={mutedAutoplay}
          nativeControls={!mutedAutoplay}
        />
        {mutedAutoplay && (
          <View className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-black/55">
            <Ionicons name="volume-mute" size={18} color="#FFFFFF" />
          </View>
        )}
      </Pressable>
    );
  }

  // Idle poster — tap to play (with sound). Used on non-feed surfaces and as the
  // frozen state for off-screen feed cards.
  return (
    <Pressable onPress={() => setPlaying(true)} className="mb-3 w-full">
      <View className="aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
        {state.poster && (
          <Image
            source={{ uri: state.poster }}
            className="absolute h-full w-full"
            resizeMode="cover"
          />
        )}
        <View className="h-14 w-14 items-center justify-center rounded-full bg-black/55">
          <Ionicons name="play" size={28} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}
