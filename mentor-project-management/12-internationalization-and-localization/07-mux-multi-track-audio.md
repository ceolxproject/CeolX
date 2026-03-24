# Task: Attach Dubbed Audio Tracks to Mux Assets

## Description

Integrate Mux Create Asset Track API to attach dubbed audio tracks (ES, FR, RU) to Mux video assets. Configure track metadata including language codes and user-friendly labels. Enable Mux Player's built-in audio selector UI for viewers to choose dubbed language. Implement fallback to English audio if dubbed version unavailable. Ensure seamless audio switching without buffering or latency.

## Affected Apps/Packages

- `services/mux` (Mux API client)
- `services/dubbing` (Dubbing pipeline integration)
- `packages/video-player` (Player component)
- `apps/web` (Video player pages)
- `apps/mobile` (Mobile video player)

## Requirements

### Mux Track Management

- Create audio tracks for ES, FR, RU dubbed audio
- Set language and label metadata for each track
- Support multiple audio tracks per video asset
- Mux Player displays audio selector dropdown
- User selection persists in player state

### Track Metadata

- **Language Code**: ISO 639-1 format (es, fr, ru)
- **Track Label**: User-friendly name (e.g., "Español (Doblado)", "Français (Doublage)")
- **Primary Track**: Mark English as default/primary
- **Passthrough ID**: Store correlation with dubbing job ID

### Audio Player Integration

- Mux Player UI: Built-in audio track selector
- Audio switch: No video interruption
- Default audio: English (EN) unless user preference
- Persist selection: Store in player preferences
- Analytics: Track audio selection events

### Fallback Strategy

- If dubbed audio unavailable: Use English audio
- If upload pending: Show loading state
- If upload failed: Show error message
- Graceful degradation: Video playable with EN

### Player Customization

- Audio selector position (dropdown location)
- Label format customization
- Disable selector if only EN available
- Show "Loading..." state during upload

## Acceptance Criteria

- [ ] Mux Create Asset Track API integrated
- [ ] Audio tracks created for ES, FR, RU languages
- [ ] Track metadata (language, label) correct
- [ ] Mux Player audio selector functional
- [ ] User can switch audio tracks during playback
- [ ] Audio switching seamless (no buffering)
- [ ] English (EN) set as primary/default track
- [ ] Fallback to EN if dubbed unavailable
- [ ] Audio selection persists in player session
- [ ] Analytics events fired for audio selection
- [ ] Mobile player supports audio selection
- [ ] No video interruption during audio switch
- [ ] Error states handled gracefully
- [ ] Loading states displayed appropriately

## Dependencies

- Dubbing pipeline complete (Task: elevenlabs-dubbing-pipeline.md)
- Mux API configured with valid credentials
- Video player component in place

## Technical Notes

### Mux Create Asset Track API

**services/mux/types.ts:**

```typescript
export interface MuxTrack {
  id: string;
  type: "audio" | "text" | "video";
  language_code?: string;
  name?: string;
  status: "preparing" | "ready" | "errored";
  max_width?: number;
  max_height?: number;
  max_frame_rate?: number;
  max_channels?: number;
  max_channel_layouts?: string[];
  duration?: number;
  passthrough?: string;
}

export interface CreateTrackRequest {
  assetId: string;
  type: "audio" | "text";
  language?: string;
  name?: string;
  url: string;
  passthrough?: string;
}

export interface TrackMetadata {
  language: "en" | "es" | "fr" | "ru";
  label: string;
  isDefault: boolean;
  dubbingJobId?: string;
  uploadedAt: Date;
}
```

**services/mux/client.ts (updated):**

```typescript
import Mux from "@mux/mux-node";

export class MuxClient {
  private mux: Mux;

  constructor() {
    this.mux = new Mux({
      accessTokenId: process.env.MUX_TOKEN_ID!,
      accessTokenSecret: process.env.MUX_TOKEN_SECRET!,
    });
  }

  /**
   * Create audio track on Mux asset
   */
  async createAssetTrack(request: CreateTrackRequest): Promise<MuxTrack> {
    try {
      const { assetId, type, language, name, url, passthrough } = request;

      const track = await this.mux.video.assets.createTrack(assetId, {
        type,
        language_code: language,
        name,
        url,
        passthrough,
      });

      console.log(`Created ${type} track for asset ${assetId}: ${track.id}`);

      return track as MuxTrack;
    } catch (error) {
      console.error("Failed to create track:", error);
      throw error;
    }
  }

  /**
   * List all tracks for asset
   */
  async listAssetTracks(assetId: string): Promise<MuxTrack[]> {
    try {
      const asset = await this.mux.video.assets.retrieve(assetId);
      return (asset.tracks || []) as MuxTrack[];
    } catch (error) {
      console.error("Failed to list tracks:", error);
      throw error;
    }
  }

  /**
   * Get specific track
   */
  async getTrack(assetId: string, trackId: string): Promise<MuxTrack> {
    try {
      const tracks = await this.listAssetTracks(assetId);
      const track = tracks.find((t) => t.id === trackId);

      if (!track) {
        throw new Error(`Track ${trackId} not found`);
      }

      return track;
    } catch (error) {
      console.error("Failed to get track:", error);
      throw error;
    }
  }

  /**
   * Delete track (cleanup if needed)
   */
  async deleteTrack(assetId: string, trackId: string): Promise<void> {
    try {
      // Note: Mux SDK may not have direct delete, check documentation
      console.log(`Deleting track ${trackId} from asset ${assetId}`);
      // await this.mux.video.assets.deleteTrack(assetId, trackId);
    } catch (error) {
      console.error("Failed to delete track:", error);
      throw error;
    }
  }

  /**
   * Update track metadata
   */
  async updateTrackMetadata(
    assetId: string,
    trackId: string,
    metadata: Partial<TrackMetadata>,
  ): Promise<void> {
    try {
      // Store in database as Mux API doesn't support direct metadata update
      await TrackMetadataModel.updateOne(
        { assetId, trackId },
        { $set: metadata },
        { upsert: true },
      );

      console.log(`Updated track metadata: ${assetId}/${trackId}`);
    } catch (error) {
      console.error("Failed to update track metadata:", error);
      throw error;
    }
  }

  /**
   * Get audio tracks available for asset
   */
  async getAudioTracks(assetId: string): Promise<(MuxTrack & TrackMetadata)[]> {
    try {
      const muxTracks = await this.listAssetTracks(assetId);
      const audioTracks = muxTracks.filter((t) => t.type === "audio");

      // Enrich with metadata
      const enriched = await Promise.all(
        audioTracks.map(async (track) => {
          const metadata = await TrackMetadataModel.findOne({
            assetId,
            trackId: track.id,
          });

          return {
            ...track,
            ...(metadata?.toObject() || {}),
          };
        }),
      );

      return enriched;
    } catch (error) {
      console.error("Failed to get audio tracks:", error);
      throw error;
    }
  }
}
```

### Track Creation in Dubbing Pipeline

**services/dubbing/dubbing-pipeline.ts (updated section):**

```typescript
/**
 * Create Mux audio tracks for dubbed audio
 */
static async createMuxAudioTracks(
  videoId: string,
  dubbingLanguages: string[]
): Promise<Record<string, string>> {
  try {
    const video = await VideoModel.findById(videoId);
    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    const muxClient = new MuxClient();
    const trackMap: Record<string, string> = {};

    for (const language of dubbingLanguages) {
      const trackLabel = this.getTrackLabel(language);

      const track = await muxClient.createAssetTrack({
        assetId: video.muxAssetId,
        type: 'audio',
        language: this.getIso639Code(language),
        name: trackLabel,
        url: video.dubbingTracks[language].r2Path, // R2 URL
        passthrough: `dubbed-${language}`,
      });

      trackMap[language] = track.id;

      // Store metadata
      await muxClient.updateTrackMetadata(video.muxAssetId, track.id, {
        language: language as 'en' | 'es' | 'fr' | 'ru',
        label: trackLabel,
        isDefault: false,
        dubbingJobId: video.dubbingJobId,
        uploadedAt: new Date(),
      });

      logger.info(`Created Mux audio track for ${language}: ${track.id}`);
    }

    return trackMap;
  } catch (error) {
    logger.error(`Error creating Mux audio tracks:`, error);
    throw error;
  }
}

private static getTrackLabel(language: string): string {
  const labels: Record<string, string> = {
    en: 'English',
    es: 'Español (Doblado)',
    fr: 'Français (Doublage)',
    ru: 'Русский (Дубляж)',
  };
  return labels[language] || language;
}

private static getIso639Code(language: string): string {
  return language; // 'es', 'fr', 'ru' are ISO 639-1
}
```

### Video Player Component

**packages/video-player/src/MuxPlayer/MuxPlayer.tsx:**

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { useTranslation } from 'react-i18next';
import styles from './MuxPlayer.module.css';

interface AudioTrack {
  id: string;
  language: 'en' | 'es' | 'fr' | 'ru';
  label: string;
  isDefault: boolean;
}

interface MuxPlayerProps {
  videoId: string;
  playbackId: string;
  audioTracks: AudioTrack[];
  defaultAudio?: 'en' | 'es' | 'fr' | 'ru';
  onAudioChange?: (language: string) => void;
  className?: string;
}

export const MuxPlayerComponent: React.FC<MuxPlayerProps> = ({
  videoId,
  playbackId,
  audioTracks,
  defaultAudio = 'en',
  onAudioChange,
  className = '',
}) => {
  const { t } = useTranslation('course');
  const [selectedAudio, setSelectedAudio] = useState(defaultAudio);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = React.useRef<any>(null);

  // Persist audio preference
  useEffect(() => {
    const key = `video-audio-pref-${videoId}`;
    const saved = localStorage.getItem(key);
    if (saved && audioTracks.some(t => t.language === saved)) {
      setSelectedAudio(saved as any);
    }
  }, [videoId, audioTracks]);

  const handleAudioChange = useCallback(
    (language: string) => {
      setIsLoading(true);
      setError(null);

      try {
        setSelectedAudio(language as any);

        // Persist preference
        localStorage.setItem(`video-audio-pref-${videoId}`, language);

        // Call callback
        if (onAudioChange) {
          onAudioChange(language);
        }

        // Track analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'video_audio_selected', {
            videoId,
            language,
          });
        }

        setIsLoading(false);
      } catch (err) {
        setError(`Failed to change audio: ${(err as Error).message}`);
        setIsLoading(false);
      }
    },
    [videoId, onAudioChange]
  );

  const availableAudioTracks = audioTracks.filter(
    t => t.language !== 'en' // EN is default
  );

  // Only show selector if multiple audio options available
  const showAudioSelector = availableAudioTracks.length > 0;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.playerWrapper}>
        <MuxPlayer
          ref={playerRef}
          playbackId={playbackId}
          streamType="on-demand"
          primaryColor="#6366f1"
          secondaryColor="#eef2ff"
          autoPlay="muted"
        />
      </div>

      {showAudioSelector && (
        <div className={styles.audioSelector}>
          <label htmlFor="audio-select" className={styles.label}>
            {t('label.language')}:
          </label>
          <select
            id="audio-select"
            value={selectedAudio}
            onChange={(e) => handleAudioChange(e.target.value)}
            disabled={isLoading}
            className={styles.select}
            aria-label="Select audio language"
          >
            {/* English (default) */}
            <option value="en">English</option>

            {/* Dubbed languages */}
            {availableAudioTracks.map((track) => (
              <option key={track.language} value={track.language}>
                {track.label}
              </option>
            ))}
          </select>

          {isLoading && (
            <span className={styles.loadingSpinner} title="Switching audio..." />
          )}
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
          <button
            onClick={() => {
              setError(null);
              handleAudioChange(selectedAudio);
            }}
            className={styles.retryButton}
          >
            {t('button.retry')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MuxPlayerComponent;
```

**packages/video-player/src/MuxPlayer/MuxPlayer.module.css:**

```css
.container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: #000;
  border-radius: 0.5rem;
  overflow: hidden;
}

.playerWrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #000;
}

.audioSelector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background-color: #1f2937;
  flex-wrap: wrap;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #f3f4f6;
  margin: 0;
}

.select {
  padding: 0.5rem;
  border: 1px solid #4b5563;
  border-radius: 0.375rem;
  background-color: #374151;
  color: #f3f4f6;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.select:hover:not(:disabled) {
  border-color: #6b7280;
}

.select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loadingSpinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #4b5563;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  padding: 0.75rem 1rem;
  background-color: #7f1d1d;
  border: 1px solid #b91c1c;
  border-radius: 0.375rem;
  color: #fee2e2;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retryButton {
  background: none;
  border: none;
  color: #fecaca;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0;
  margin-left: auto;
}

.retryButton:hover {
  text-decoration: none;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .audioSelector {
    flex-direction: column;
    align-items: stretch;
  }

  .label {
    display: block;
    margin-bottom: 0.25rem;
  }

  .select {
    width: 100%;
  }
}
```

### Page Integration

**apps/web/pages/[locale]/courses/[courseId]/lessons/[lessonId].tsx:**

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MuxPlayerComponent } from '@packages/video-player';
import { getAuth } from '@lib/auth';
import { LessonModel, VideoModel } from '@models';
import { MuxClient } from '@services/mux';

interface LessonPageProps {
  lesson: any;
  audioTracks: any[];
}

export default function LessonPage({ lesson, audioTracks }: LessonPageProps) {
  const router = useRouter();
  const { locale } = router.query;

  return (
    <div>
      <h1>{lesson.title}</h1>

      <MuxPlayerComponent
        videoId={lesson.videoId}
        playbackId={lesson.muxPlaybackId}
        audioTracks={audioTracks}
        defaultAudio={(locale as string) || 'en'}
        onAudioChange={(language) => {
          // Track user language preference for this lesson
          console.log(`User selected ${language} audio`);
        }}
      />

      <div>{lesson.description}</div>
    </div>
  );
}

export async function getServerSideProps(context: any) {
  const { courseId, lessonId, locale } = context.params;

  try {
    const lesson = await LessonModel.findById(lessonId);
    if (!lesson) {
      return { notFound: true };
    }

    const video = await VideoModel.findById(lesson.videoId);
    if (!video) {
      return { notFound: true };
    }

    // Get audio tracks from Mux
    const muxClient = new MuxClient();
    const muxTracks = await muxClient.getAudioTracks(video.muxAssetId);

    // Filter and format audio tracks
    const audioTracks = [
      {
        id: 'en',
        language: 'en',
        label: 'English',
        isDefault: true,
      },
      ...muxTracks
        .filter(t => t.type === 'audio')
        .map(t => ({
          id: t.id,
          language: t.language_code,
          label: t.name || t.language_code,
          isDefault: false,
        })),
    ];

    return {
      props: {
        lesson: lesson.toObject(),
        audioTracks,
      },
      revalidate: 3600, // ISR
    };
  } catch (error) {
    console.error('Error loading lesson:', error);
    return { notFound: true };
  }
}
```

### Mobile Player Integration

**apps/mobile/screens/LessonScreen.tsx:**

```typescript
import { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { MuxPlayerComponent } from '@packages/video-player';

interface LessonScreenProps {
  lessonId: string;
  courseId: string;
}

export const LessonScreen: React.FC<LessonScreenProps> = ({
  lessonId,
  courseId,
}) => {
  const [lesson, setLesson] = useState<any>(null);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const response = await fetch(
          `/api/lessons/${lessonId}?tracks=true`
        );
        const data = await response.json();

        setLesson(data.lesson);
        setAudioTracks(data.audioTracks);
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [lessonId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView>
      <MuxPlayerComponent
        videoId={lesson.videoId}
        playbackId={lesson.muxPlaybackId}
        audioTracks={audioTracks}
      />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          {lesson.title}
        </Text>
        <Text>{lesson.description}</Text>
      </View>
    </ScrollView>
  );
};
```

## Implementation Order

1. Set up Mux API client with track creation capability
2. Update dubbing pipeline to create Mux audio tracks
3. Create video player component with audio selector
4. Style player controls and audio selector
5. Implement audio track persistence in localStorage
6. Add analytics event tracking for audio selection
7. Integrate player into lesson pages
8. Test track creation and audio switching
9. Test audio switching during playback
10. Test fallback to EN audio
11. Implement mobile player integration
12. Test on mobile devices
13. Add accessibility features (keyboard nav, ARIA labels)
14. Test error handling and edge cases
