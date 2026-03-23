# Mux Player Integration - Mobile (React Native)

## Description

Integrate Mux Player for React Native in the Learner Mobile application to provide video playback with HLS adaptive bitrate streaming, orientation control, background audio handling, and Picture-in-Picture (PiP) support. Mobile player must handle interruptions (calls, notifications) gracefully.

## Affected Apps/Packages

- `apps/learner-mobile` (React Native)
- `packages/ui-components-native` (mobile player wrapper)
- Video library: `react-native-video` with Mux integration OR `mux-player-react-native` (if available)
- Background audio: `react-native-sound` or `expo-av` for audio track management

## API Endpoints

- `POST /api/videos/:videoId/playback-token` - Generate time-limited, user-specific Mux signed playback URL
- `GET /api/videos/:videoId` - Fetch video metadata
- `POST /api/lessons/:lessonId/progress` - Track playback progress

## Requirements

### 1. Video Playback Library

- Primary: `react-native-video` (universal, well-maintained)
  - Install: `npm install react-native-video`
  - Link native modules: `react-native link react-native-video`
  - Or use Expo: `expo install expo-video` (if using Expo)
- Alternative: Mux Player React Native (if officially released)
- HLS stream support via m3u8 manifest
- Signed playback URL generation (same as web)

### 2. Orientation & Layout

- **Portrait Mode**: Video fills top portion (16:9 or video's native ratio), controls/UI below
- **Landscape Mode**: Full-screen video with overlaid controls
- **Lock/Unlock Toggle**: User can lock orientation to current state
  - Use `react-native-orientation-locker` or device orientation API
  - Remember user preference per session
  - Auto-rotate to landscape when user tilts device (if not locked)
- **Safe Area**: Respect notches/dynamic islands on modern devices
- **Status Bar**: Hide during full-screen landscape mode

### 3. Playback Controls

- Play/pause button (centered)
- Seek bar with video duration and current time
- Volume control (hardware buttons + on-screen slider)
- Quality selector (360p/720p/1080p)
- Settings menu: playback speed, subtitle language, audio language
- Close/minimize button to exit full-screen

### 4. Background Audio & Interruptions

- **Interruptions**: Handle call/notification interruptions
  - Auto-pause on incoming call
  - Resume after call ends or user dismisses notification
  - Use `react-native-incall-manager` for audio focus management
- **Background Playback**: Allow audio to continue if user minimizes app (for audio-focused content like lectures)
  - Configure iOS: `AVAudioSession` category to `AVAudioSessionCategoryPlayback`
  - Configure Android: Keep audio focus during app backgrounding
- **Sleep Prevention**: Prevent device sleep while video is playing (screen stays on)

### 5. Picture-in-Picture (PiP)

- iOS: Support for iPadOS multitasking (slide-over/split view)
- Android 8+: Native PiP API support
  - Implement custom PiP button
  - On PiP enter: minimize video to corner
  - On PiP exit: expand to full video view
  - Allow seeking and play/pause in PiP mode
- Fallback: Show "video continues in background" message if PiP unavailable

### 6. Network Robustness

- Handle bandwidth changes gracefully (adaptive bitrate)
- Retry failed chunk downloads with exponential backoff
- Buffer ahead of playback position (2-3x normal speed)
- Show loading spinner during buffering (threshold: 100ms)

## Acceptance Criteria

- [ ] `react-native-video` or Mux Player React Native installed and linked
- [ ] HLS m3u8 playback works on iOS devices
- [ ] HLS m3u8 playback works on Android devices
- [ ] Signed playback URLs generated and validated
- [ ] Adaptive bitrate switching works on mobile networks
- [ ] Video plays in portrait orientation with controls below
- [ ] Full-screen landscape mode fills entire screen
- [ ] Orientation lock/unlock toggle present in player UI
- [ ] User can toggle lock on/off; preference remembered per session
- [ ] Safe area respected on notched devices
- [ ] Incoming call auto-pauses video
- [ ] Audio continues in background (if appropriate)
- [ ] Device doesn't sleep while video playing
- [ ] Quality selector functional (360p/720p/1080p)
- [ ] Playback speed adjustment working
- [ ] PiP mode works on Android 8+ devices
- [ ] Network interruptions handled gracefully with retries
- [ ] Error messages clear and actionable

## Dependencies

- `react-native-video@^6.0.0` (video playback)
- `react-native-orientation-locker` (orientation control)
- `react-native-incall-manager` (call/notification handling)
- `react-native-device-info` (detect capabilities like PiP)
- Design system tokens (colors, typography, spacing)
- Progress tracking API
- Mux Token generation service (backend)

## Technical Notes

### React Native Video Setup

```javascript
import Video from "react-native-video";
import { useDeviceOrientation } from "@react-native-community/hooks";

export const MobileVideoPlayer = ({ videoId, userId }) => {
  const [orientation, setOrientation] = useState("portrait");
  const [isLocked, setIsLocked] = useState(false);
  const [playbackToken, setPlaybackToken] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Generate signed URL
    fetchPlaybackToken(videoId, userId).then(setPlaybackToken);
  }, [videoId, userId]);

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{
          uri: `https://stream.mux.com/${playbackToken}`,
        }}
        style={styles.video}
        controls={true}
        resizeMode="contain"
        onProgress={(data) => {
          trackProgress(lessonId, data.currentTime);
        }}
        onError={(error) => {
          console.error("Video error:", error);
        }}
        onLoad={(data) => {
          // Store total duration
        }}
        paused={isPaused}
        rate={playbackSpeed}
        progressUpdateInterval={5000} // 5 seconds
      />
      <PlayerControls
        onOrientationToggle={() => setIsLocked(!isLocked)}
        isLocked={isLocked}
        onQualityChange={(quality) => {}}
        onSpeedChange={(speed) => setPlaybackSpeed(speed)}
      />
    </View>
  );
};
```

### Orientation Lock Implementation

```javascript
import Orientation from "react-native-orientation-locker";

const toggleOrientationLock = (isCurrentlyLocked) => {
  if (isCurrentlyLocked) {
    Orientation.unlockAllOrientations(); // Auto-rotate enabled
  } else {
    // Lock to current orientation
    const current =
      orientation === "landscape"
        ? Orientation.LANDSCAPE
        : Orientation.PORTRAIT;
    Orientation.lockToOrientation(current);
  }
  setIsLocked(!isCurrentlyLocked);
};
```

### Call Interruption Handling

```javascript
import InCallManager from "react-native-incall-manager";

useEffect(() => {
  const subscription = AppState.addEventListener(
    "change",
    handleAppStateChange
  );

  // Audio interruption listener (Android)
  const onAudioFocusChange = (focusChange) => {
    if (focusChange === InCallManager.AUDIO_FOCUS_LOSS_TRANSIENT) {
      videoRef.current?.pause();
    } else if (focusChange === InCallManager.AUDIO_FOCUS_GAIN) {
      videoRef.current?.play();
    }
  };

  InCallManager.addAudioFocusListener(onAudioFocusChange);

  return () => {
    subscription.remove();
    InCallManager.removeAudioFocusListener();
  };
}, []);

const handleAppStateChange = (nextAppState) => {
  if (nextAppState === "inactive") {
    // Phone call or notification interrupted
    videoRef.current?.pause();
  } else if (nextAppState === "active" && wasPlayingBeforeInterruption) {
    // Resume if user returns
    videoRef.current?.play();
  }
};
```

### Picture-in-Picture (Android)

```javascript
import { usePictureInPicture } from "react-native-pip-android";

const handlePiPToggle = async () => {
  try {
    await PictureInPicture.enter({
      sourceRect: {
        x: 0,
        y: 0,
        width: windowWidth,
        height: windowHeight,
      },
      targetSize: { width: 300, height: 169 }, // 16:9 ratio
    });
  } catch (e) {
    console.error("PiP not supported:", e);
  }
};
```

### Adaptive Bitrate & Network Changes

React Native Video automatically handles HLS bitrate selection. Monitor via:

```javascript
<Video
  onBandwidthUpdate={(bandwidth) => {
    console.log("Available bandwidth:", bandwidth);
    // Log for analytics
  }}
/>
```

### Safe Area & Notches

```javascript
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const SafeVideoContainer = () => {
  const insets = useSafeAreaInsets();

  return <View style={{ paddingTop: insets.top }}>{/* Video player */}</View>;
};
```

### Battery & Sleep Management

```javascript
import { useKeepAwake } from "expo-keep-awake";

export const MobileVideoPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep screen awake while playing
  useEffect(() => {
    if (isPlaying) {
      useKeepAwake();
    }
    return () => {
      // useKeepAwake automatically clears on unmount
    };
  }, [isPlaying]);

  // ... rest of component
};
```

### Custom Controls Component

Create `/packages/ui-components-native/src/VideoPlayer/index.tsx`:

- Accept props: isPlaying, onPlayPause, duration, currentTime, onSeek
- Buttons: play/pause, quality selector, speed control, lock orientation, PiP
- Seek bar with progress indicator
- Time display (currentTime / totalDuration)
- Apply design system colors and typography

### Subtitle & Audio Language Handling

Will be implemented in separate audio/caption language selection tasks. Here, ensure:

- Player can accept `subtitles` prop with array of subtitle tracks
- Player can accept `audioTracks` prop with array of audio streams
- Expose methods to switch tracks: `selectSubtitleTrack()`, `selectAudioTrack()`

### Error Handling

- Playback error: show "Unable to play video" with retry button
- Network error: automatically retry with backoff
- Device memory low: gracefully downgrade quality
- Unsupported format: show "This video format is not supported on your device"
