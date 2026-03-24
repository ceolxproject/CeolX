# Mobile Video Player

## Description

Implement a feature-rich video player for HLS playback with DRM (Widevine on Android, FairPlay on iOS), fullscreen landscape orientation, playback speed controls, resume-from-position functionality, background audio policy, and subtitle support. The player must handle both free and premium content securely.

## Affected Apps/Packages

- `apps/mobile/src/screens/lesson/LessonPlayerScreen.tsx` (new)
- `apps/mobile/src/components/video/` (new)
- `packages/shared/src/services/videoService.ts` (new)

## Requirements

### 1. Lesson Player Screen

File: `src/screens/lesson/LessonPlayerScreen.tsx`

Main player wrapper with progress tracking:

```typescript
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Orientation,
  useWindowDimensions,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import ScreenOrientation from 'expo-screen-orientation';
import { videoService, courseService } from '@services';
import VideoPlayer from '@components/video/VideoPlayer';
import LessonControls from '@components/video/LessonControls';
import TranscriptPanel from '@components/video/TranscriptPanel';
import NotesPanel from '@components/video/NotesPanel';

interface LessonWithProgress extends Lesson {
  videoUrl: string;
  videoDrmConfig?: DrmConfig;
  transcript?: Transcript[];
  duration: number;
  userProgress?: {
    position: number;
    completed: boolean;
    completedAt?: string;
  };
}

export function LessonPlayerScreen({
  route,
  navigation,
}: LessonPlayerScreenProps) {
  const { lessonId, courseId, resumePosition = 0 } = route.params;
  const dimensions = useWindowDimensions();

  const [lesson, setLesson] = useState<LessonWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPlaybackSpeed, setSelectedPlaybackSpeed] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(resumePosition);
  const playerRef = useRef<VideoPlayerHandle>(null);
  const isFocused = useIsFocused();

  const screenDimensions = useWindowDimensions();
  const isLandscape = screenDimensions.width > screenDimensions.height;

  // Fetch lesson details
  const fetchLesson = useCallback(async () => {
    setIsLoading(true);
    try {
      const lessonData = await courseService.getLesson(lessonId, courseId);
      const videoUrl = await videoService.getPlaybackUrl(lessonId);
      const drm = await videoService.getDrmConfig(lessonId);
      const transcript = await videoService.getTranscript(lessonId);

      setLesson({
        ...lessonData,
        videoUrl,
        videoDrmConfig: drm,
        transcript,
      });
    } catch (err) {
      setError('Failed to load lesson');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, courseId]);

  // Lock orientation on mount, restore on unmount
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Fetch lesson on focus
  useFocusEffect(
    useCallback(() => {
      fetchLesson();
    }, [fetchLesson])
  );

  // Save progress periodically and on blur
  const saveProgress = useCallback(async () => {
    if (lesson && playerRef.current) {
      const position = await playerRef.current.getCurrentPosition();
      const duration = await playerRef.current.getDuration();
      const isCompleted = (position / duration) >= 0.9; // 90% threshold

      try {
        await courseService.updateLessonProgress({
          lessonId,
          courseId,
          position,
          completed: isCompleted,
        });
      } catch (error) {
        console.error('Failed to save progress', error);
      }
    }
  }, [lesson, lessonId, courseId]);

  // Save progress on interval
  useEffect(() => {
    if (!isFocused) return;

    const interval = setInterval(saveProgress, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [isFocused, saveProgress]);

  // Save progress on blur
  useFocusEffect(
    useCallback(() => {
      return () => {
        saveProgress();
      };
    }, [saveProgress])
  );

  const handlePlaybackSpeedChange = (speed: number) => {
    setSelectedPlaybackSpeed(speed);
    playerRef.current?.setPlaybackRate(speed);
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);

    if (!isFullscreen) {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      );
    } else {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      );
    }
  };

  const handleLessonComplete = async () => {
    try {
      await courseService.updateLessonProgress({
        lessonId,
        courseId,
        position: lesson!.duration,
        completed: true,
      });
      // Show completion overlay
      showCompletionOverlay();
    } catch (error) {
      showError('Failed to mark lesson as complete');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Lesson not found'}</Text>
        <Button
          title="Go Back"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  if (isFullscreen || isLandscape) {
    return (
      <View style={styles.fullscreenContainer}>
        <VideoPlayer
          ref={playerRef}
          source={lesson.videoUrl}
          drmConfig={lesson.videoDrmConfig}
          onPlaybackSpeedChange={handlePlaybackSpeedChange}
          playbackSpeed={selectedPlaybackSpeed}
          onFullscreenToggle={handleFullscreenToggle}
          onError={(error) => setError(error)}
          resumePosition={resumePosition}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Video player */}
      <View style={styles.playerContainer}>
        <VideoPlayer
          ref={playerRef}
          source={lesson.videoUrl}
          drmConfig={lesson.videoDrmConfig}
          onPlaybackSpeedChange={handlePlaybackSpeedChange}
          playbackSpeed={selectedPlaybackSpeed}
          onFullscreenToggle={handleFullscreenToggle}
          onError={(error) => setError(error)}
          resumePosition={resumePosition}
        />
      </View>

      {/* Content tabs */}
      <LessonControls
        lesson={lesson}
        playbackSpeed={selectedPlaybackSpeed}
        onPlaybackSpeedChange={handlePlaybackSpeedChange}
        onTranscriptToggle={() => setShowTranscript(!showTranscript)}
        onNotesToggle={() => setShowNotes(!showNotes)}
        transcriptActive={showTranscript}
        notesActive={showNotes}
      />

      {/* Scrollable content area */}
      <ScrollView style={styles.contentArea}>
        {/* Lesson info */}
        <View style={styles.section}>
          <Text style={styles.title}>{lesson.title}</Text>
          <Text style={styles.module}>Module {lesson.moduleIndex + 1}</Text>
        </View>

        {showTranscript && lesson.transcript && (
          <TranscriptPanel
            transcript={lesson.transcript}
            onTimestampPress={(time) => {
              playerRef.current?.seek(time);
              setShowTranscript(false);
            }}
          />
        )}

        {showNotes && (
          <NotesPanel
            lessonId={lessonId}
            currentPosition={currentPosition}
          />
        )}

        {/* Description */}
        {lesson.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this lesson</Text>
            <Text style={styles.description}>{lesson.description}</Text>
          </View>
        )}

        {/* Resources */}
        {lesson.resources && lesson.resources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resources</Text>
            {lesson.resources.map((resource, index) => (
              <ResourceItem
                key={index}
                resource={resource}
                onPress={() => {
                  Linking.openURL(resource.url);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  playerContainer: {
    backgroundColor: colors.black,
    aspectRatio: 16 / 9,
  },
  contentArea: {
    flex: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  module: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});

export default LessonPlayerScreen;
```

### 2. Video Player Component with DRM

File: `src/components/video/VideoPlayer.tsx`

```typescript
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface DrmConfig {
  type: 'widevine' | 'fairplay';
  licenseUrl: string;
  certificateUrl?: string;
}

interface VideoPlayerProps {
  source: string;
  drmConfig?: DrmConfig;
  onPlaybackSpeedChange?: (speed: number) => void;
  playbackSpeed?: number;
  onFullscreenToggle?: () => void;
  onError?: (error: string) => void;
  resumePosition?: number;
}

export interface VideoPlayerHandle {
  getCurrentPosition: () => Promise<number>;
  getDuration: () => Promise<number>;
  seek: (position: number) => void;
  setPlaybackRate: (rate: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      source,
      drmConfig,
      onPlaybackSpeedChange,
      playbackSpeed = 1.0,
      onFullscreenToggle,
      onError,
      resumePosition = 0,
    },
    ref
  ) => {
    const videoRef = useRef<Video>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(resumePosition);
    const [duration, setDuration] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      async getCurrentPosition() {
        const status = await videoRef.current?.getStatusAsync();
        return status?.positionMillis || 0;
      },
      async getDuration() {
        const status = await videoRef.current?.getStatusAsync();
        return status?.durationMillis || 0;
      },
      seek(position: number) {
        videoRef.current?.seekAsync(position, { toleranceMillisAfter: 100 });
      },
      setPlaybackRate(rate: number) {
        videoRef.current?.setRateAsync(rate, true);
      },
    }));

    // Seek to resume position on mount
    useEffect(() => {
      if (resumePosition > 0) {
        setTimeout(() => {
          videoRef.current?.seekAsync(resumePosition);
        }, 500);
      }
    }, [resumePosition]);

    const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
      if (status.isLoaded) {
        setCurrentTime(status.positionMillis);
        setDuration(status.durationMillis);
        setIsBuffering(status.isBuffering);

        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      } else if (status.error) {
        onError?.(status.error);
      }
    };

    const handlePlayPause = () => {
      if (isPlaying) {
        videoRef.current?.pauseAsync();
      } else {
        videoRef.current?.playAsync();
      }
      setIsPlaying(!isPlaying);
      resetControlsTimeout();
    };

    const handleRewind = () => {
      const newTime = Math.max(0, currentTime - 15000);
      videoRef.current?.seekAsync(newTime);
      resetControlsTimeout();
    };

    const handleForward = () => {
      const newTime = Math.min(duration, currentTime + 15000);
      videoRef.current?.seekAsync(newTime);
      resetControlsTimeout();
    };

    const handleSliderChange = (value: number) => {
      videoRef.current?.seekAsync(value);
      resetControlsTimeout();
    };

    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const videoSourceConfig = {
      uri: source,
      ...(drmConfig && {
        drm: {
          type: Platform.select({
            ios: 'fairplay',
            android: 'widevine',
          }),
          licenseServer: drmConfig.licenseUrl,
          ...(drmConfig.certificateUrl && {
            certificateUrl: drmConfig.certificateUrl,
          }),
        },
      }),
    };

    return (
      <Pressable
        style={styles.container}
        onPress={resetControlsTimeout}
      >
        <Video
          ref={videoRef}
          source={videoSourceConfig}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={false}
          progressUpdateIntervalMillis={500}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          rate={playbackSpeed}
          shouldPlay={false}
        />

        {/* Loading indicator */}
        {isBuffering && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        )}

        {/* Custom controls */}
        {showControls && (
          <View style={styles.controlsOverlay}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Text style={styles.title}>Lesson</Text>
            </View>

            {/* Center controls */}
            <View style={styles.centerControls}>
              <Pressable
                onPress={handleRewind}
                style={styles.controlButton}
              >
                <Ionicons name="play-back" size={40} color={colors.white} />
                <Text style={styles.controlLabel}>15s</Text>
              </Pressable>

              <Pressable
                onPress={handlePlayPause}
                style={styles.playButton}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={50}
                  color={colors.white}
                />
              </Pressable>

              <Pressable
                onPress={handleForward}
                style={styles.controlButton}
              >
                <Ionicons name="play-forward" size={40} color={colors.white} />
                <Text style={styles.controlLabel}>15s</Text>
              </Pressable>
            </View>

            {/* Bottom bar */}
            <View style={styles.bottomBar}>
              {/* Progress slider */}
              <View style={styles.progressContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration}
                  value={currentTime}
                  onValueChange={handleSliderChange}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(255,255,255,0.3)"
                  thumbTintColor={colors.primary}
                />
              </View>

              {/* Time display */}
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {formatTime(currentTime / 1000)}
                </Text>
                <Text style={styles.timeText}>
                  {formatTime(duration / 1000)}
                </Text>
              </View>

              {/* Bottom controls */}
              <View style={styles.bottomControls}>
                <Pressable style={styles.controlButton}>
                  <Ionicons
                    name="settings"
                    size={24}
                    color={colors.white}
                  />
                </Pressable>
                <Pressable
                  onPress={onFullscreenToggle}
                  style={styles.controlButton}
                >
                  <Ionicons
                    name="expand"
                    size={24}
                    color={colors.white}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xl,
  },
  controlButton: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlLabel: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  slider: {
    width: '100%',
    height: 4,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  timeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
});

export default VideoPlayer;
```

### 3. DRM Configuration Service

File: `packages/shared/src/services/videoService.ts`

```typescript
interface DrmLicenseRequest {
  challengeBase64: string;
  licenseUrl: string;
  certificateUrl?: string;
}

export class VideoService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  async getPlaybackUrl(lessonId: string): Promise<string> {
    const { data } = await this.api.get(`/lessons/${lessonId}/playback-url`);
    return data.url;
  }

  async getDrmConfig(lessonId: string): Promise<DrmConfig | null> {
    try {
      const { data } = await this.api.get<DrmConfig>(
        `/lessons/${lessonId}/drm-config`,
      );
      return data;
    } catch (error) {
      // DRM not required for free content
      return null;
    }
  }

  async getTranscript(lessonId: string): Promise<Transcript[]> {
    const { data } = await this.api.get(`/lessons/${lessonId}/transcript`);
    return data.transcripts || [];
  }

  // DRM License Challenge Handler (handled by Expo Video)
  async handleDrmLicenseChallenge(
    challengeBase64: string,
    licenseUrl: string,
  ): Promise<Uint8Array> {
    const response = await this.api.post("/drm/license", {
      challenge: challengeBase64,
    });
    return response.data.license;
  }
}

export const videoService = new VideoService();
```

### 4. Lesson Controls Component

File: `src/components/video/LessonControls.tsx`

```typescript
interface LessonControlsProps {
  lesson: Lesson;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  onTranscriptToggle: () => void;
  onNotesToggle: () => void;
  transcriptActive: boolean;
  notesActive: boolean;
}

export function LessonControls({
  lesson,
  playbackSpeed,
  onPlaybackSpeedChange,
  onTranscriptToggle,
  onNotesToggle,
  transcriptActive,
  notesActive,
}: LessonControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <View style={styles.container}>
      <Pressable
        style={[
          styles.controlButton,
          transcriptActive && styles.controlButtonActive,
        ]}
        onPress={onTranscriptToggle}
      >
        <Ionicons
          name="document-text"
          size={20}
          color={transcriptActive ? colors.primary : colors.text}
        />
        <Text
          style={[
            styles.buttonLabel,
            transcriptActive && styles.buttonLabelActive,
          ]}
        >
          Transcript
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.controlButton,
          notesActive && styles.controlButtonActive,
        ]}
        onPress={onNotesToggle}
      >
        <Ionicons
          name="pencil"
          size={20}
          color={notesActive ? colors.primary : colors.text}
        />
        <Text
          style={[
            styles.buttonLabel,
            notesActive && styles.buttonLabelActive,
          ]}
        >
          Notes
        </Text>
      </Pressable>

      <Pressable
        style={styles.controlButton}
        onPress={() => setShowSpeedMenu(!showSpeedMenu)}
      >
        <Ionicons name="speed" size={20} color={colors.text} />
        <Text style={styles.buttonLabel}>{playbackSpeed}x</Text>
      </Pressable>

      {showSpeedMenu && (
        <View style={styles.speedMenu}>
          {SPEED_OPTIONS.map((speed) => (
            <Pressable
              key={speed}
              style={[
                styles.speedOption,
                speed === playbackSpeed && styles.speedOptionActive,
              ]}
              onPress={() => {
                onPlaybackSpeedChange(speed);
                setShowSpeedMenu(false);
              }}
            >
              <Text
                style={[
                  styles.speedText,
                  speed === playbackSpeed && styles.speedTextActive,
                ]}
              >
                {speed}x
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  controlButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  buttonLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  buttonLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  speedMenu: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    zIndex: 100,
  },
  speedOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  speedText: {
    fontSize: 14,
    color: colors.text,
  },
  speedTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
});
```

## Acceptance Criteria

- [ ] HLS video playback works on iOS and Android
- [ ] Widevine DRM working on Android devices
- [ ] FairPlay DRM working on iOS devices
- [ ] Player controls: play/pause, seek, volume, fullscreen
- [ ] Playback speed options (0.5x - 2x) working
- [ ] Fullscreen orientation lock (landscape)
- [ ] Resume from saved position on app restart
- [ ] Progress saved every 30 seconds during playback
- [ ] 90% completion threshold marks lesson complete
- [ ] Transcript synchronized with video position
- [ ] Notes attachable with timestamps
- [ ] Subtitles display correctly (if available)
- [ ] Background audio policy respected (stops on notification)
- [ ] Buffering state indicated with spinner
- [ ] Seek operations smooth (<1s)
- [ ] No crashes on DRM license errors
- [ ] Memory usage reasonable during playback
- [ ] Accessibility: audio descriptions, keyboard navigation

## Dependencies

- expo-av (video playback)
- expo-screen-orientation (fullscreen)
- react-native-video (alternative with more DRM options)
- @react-native-community/slider

## Technical Notes

### DRM Implementation

- Android: Widevine L1 license request via Mux API
- iOS: FairPlay certificate loading and license server communication
- Implement license caching to reduce server calls
- Handle license expiration gracefully

### HLS Playlist

Mux provides HLS manifest with DRM:

```
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
https://image.mux.com/[PLAYBACK_ID]/playlist.m3u8?token=[JWT_TOKEN]
```

### Performance

- Preload video when detail screen loads
- Use progressive HLS (adaptive bitrate)
- Implement buffer strategy: buffer 60s ahead, 30s behind

### Background Audio

Configure AVAudioSession:

```typescript
await Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
});
```

### Offline Support (Future)

- Download HLS variant before going offline
- Store DRM licenses locally (if allowed by DRM policy)
- Support offline playback on iOS if DRM permits
