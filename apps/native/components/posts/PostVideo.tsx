import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { deriveVideoState } from './PostVideo.utils';

type Props = {
  /** HLS URL written by the Mux webhook once transcoding completes (may be null while pending). */
  mediaUrl: string | null;
  /** 'pending' | 'ready' | 'errored' | null — null on legacy rows before the webhook ran. */
  muxStatus: string | null;
  /** Mux playback id — lets us build the stream + poster URLs even if mediaUrl is unset. */
  muxPlaybackId: string | null;
};

/**
 * Mounts the actual expo-video player. Lives in its own component so the
 * `useVideoPlayer` hook only ever runs with a real URL, and so no player
 * instance exists for cards the user never taps. Autoplays on mount (the user
 * already tapped the poster to get here).
 */
function ReadyVideo({ streamUri }: { streamUri: string }) {
  const player = useVideoPlayer(streamUri, (p) => {
    p.loop = false;
    p.play();
  });

  // A native VideoView has no intrinsic size, so on the new architecture it
  // collapses to 0px tall when handed only `aspect-video` (aspectRatio) with no
  // concrete height — the player mounts and plays but renders nothing. Size a
  // plain wrapper View (Yoga resolves aspect-ratio there) and let the VideoView
  // fill it with an explicit width/height.
  return (
    <View className="mb-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

/** Shared frame so every state keeps the same 16:9 footprint in the feed. */
function VideoFrame({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-3 aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-black/40">
      {children}
    </View>
  );
}

export function PostVideo({ mediaUrl, muxStatus, muxPlaybackId }: Props) {
  const [playing, setPlaying] = useState(false);
  const state = deriveVideoState(mediaUrl, muxStatus, muxPlaybackId);

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

  // ready — once tapped, swap the poster for the live player.
  if (playing) {
    return <ReadyVideo streamUri={state.streamUri} />;
  }

  return (
    <Pressable onPress={() => setPlaying(true)} className="mb-3 w-full">
      <View className="aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-black">
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
