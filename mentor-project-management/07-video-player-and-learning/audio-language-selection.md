# Audio Language Selection (Multi-Dub Support)

## Description

Implement multi-language audio track selection for video content. All videos are available in English (EN), Spanish (ES), French (FR), and Russian (RU) via ElevenLabs dubbing with gender-consistent voice casting. Learners can select their preferred audio language using the built-in Mux Player audio selector, and language preference is saved per user and applied to all subsequent videos automatically.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- Mux platform (multi-track HLS delivery)
- Backend: user preference service
- Database: user_preferences table (audio_language field)

## API Endpoints

- `GET /api/videos/:videoId/tracks` - Get available audio/caption tracks for video
- `PATCH /api/users/:userId/preferences` - Save audio language preference
  - Request: `{ "audio_language": "es" }`
  - Response: user preferences object
- `GET /api/users/:userId/preferences` - Load user preferences on app start
  - Response: `{ "audio_language": "en", "caption_language": "en", ... }`

## Requirements

### 1. Video Encoding & Multi-Track Setup

**Mux Video Encoding**:

- All videos encoded with 4 audio tracks (EN, ES, FR, RU)
- Each track uses ElevenLabs-generated dubbed audio
- Voice casting: consistent gender across same speaker roles
  - Instructor voice (main speaker): same person across all languages
  - Secondary characters: gender-matched dubbing
- Video codec: H.264 (primary), H.265/HEVC (optional)
- Audio codec: AAC-LC (compatible with all devices)
- Sample rate: 48 kHz (standard for video)

**HLS Manifest**:

```
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="en",NAME="English",DEFAULT=YES,URI="...
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="es",NAME="Español",URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="fr",NAME="Français",URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="ru",NAME="Русский",URI="..."

#EXT-X-STREAM-INF:...,AUDIO="audio"
segment.m3u8
```

### 2. Mux Player Audio Selector

**Web**:

- Mux Player has built-in audio track selector in player UI
- Dropdown in control bar showing available languages
- Automatic detection of HLS alternate audio tracks
- Click to switch audio language (seamless, no interruption)
- Current audio language displayed

**Mobile**:

- Audio track selector in player settings menu
- List of available languages
- Current language highlighted
- Tap to change (seamless switch)

### 3. User Preference Storage

**Save Preference**:

- On audio language change: API call to save preference
- Field: `audio_language` (values: "en", "es", "fr", "ru")
- Stored per user in database
- Fire-and-forget pattern (no UI blocking)

**Load Preference**:

- On app start/login: fetch user preferences
- Apply saved audio_language to all videos automatically
- If no preference saved: default to "en" (English)
- No need to manually select each video

### 4. Language Display

**Language Selector Labels**:

- EN: "English"
- ES: "Español"
- FR: "Français"
- RU: "Русский"

**Current Language Indicator**:

- Show in player control bar or settings
- Example: "Audio: Español"
- Optional: flag emojis (🇬🇧 🇪🇸 🇫🇷 🇷🇺)

### 5. Fallback Handling

- If video missing audio track in selected language: fall back to English
- Show warning message: "This video is not available in [language]. Playing in English."
- Continue with English audio

### 6. Independent Caption Selection

- Audio language is independent from caption/subtitle language
- Users can select EN audio with ES captions (and vice versa)
- Both preferences saved separately
- (Handled separately in caption-language-selection.md)

## Acceptance Criteria

- [ ] Mux Player audio selector visible in player UI (web)
- [ ] Audio selector present in settings menu (mobile)
- [ ] All 4 languages (EN, ES, FR, RU) available in selector
- [ ] Language labels correct and localized
- [ ] Click/tap language changes audio track
- [ ] Audio switch is seamless (no interruption, no buffer)
- [ ] Current audio language displayed in selector
- [ ] User preference saved to API on language change
- [ ] User preference loaded on app start
- [ ] Saved preference applied to all subsequent videos
- [ ] Default to English if no preference set
- [ ] Audio language independent from caption language
- [ ] Fallback to English if track unavailable
- [ ] Warning message shown on fallback
- [ ] Mobile: audio selector accessible in settings
- [ ] Mobile: language list readable on small screens
- [ ] Performance: language switch within 500ms
- [ ] No duplicate audio tracks in HLS
- [ ] Voice dubbing consistent across languages (gender matching)
- [ ] Audio quality equal across all languages
- [ ] Analytics track language selection per user

## Dependencies

- Mux platform with multi-track audio support
- ElevenLabs dubbing service (audio generation)
- Mux Player (both web and mobile with audio track support)
- User preference API
- Database: user_preferences table

## Technical Notes

### ElevenLabs Dubbing Integration

```
Workflow:
1. Upload original video to ElevenLabs
2. ElevenLabs analyzes: speaker count, gender, tone, language
3. Generate dubs for ES, FR, RU (EN is source)
4. Download dubbed video files
5. Re-encode with Mux including all audio tracks
6. Publish HLS manifest with alternate audio tracks
```

Configuration:

- Voice consistency: same speaker ID across languages
- Gender matching: ensure secondary speakers match original
- Accent/dialect: standard accents (no regional variations)

### Mux Player Web Implementation

Mux Player automatically handles audio track selection:

```javascript
import MuxPlayer from "@mux/mux-player-react";

export const VideoPlayer = ({ videoId, userId }) => {
  const [userPreferences, setUserPreferences] = useState({
    audio_language: "en",
  });

  // Load user preferences on mount
  useEffect(() => {
    fetch(`/api/users/${userId}/preferences`)
      .then((r) => r.json())
      .then((prefs) => setUserPreferences(prefs));
  }, [userId]);

  const handleAudioTrackChange = async (language) => {
    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_language: language }),
    });
  };

  return (
    <MuxPlayer
      playbackId={videoId}
      onAudioTrackChange={handleAudioTrackChange}
      defaultAudioLanguage={userPreferences.audio_language}
      // Mux Player automatically:
      // 1. Detects available audio tracks from HLS manifest
      // 2. Displays audio selector in controls
      // 3. Allows seamless switching
    />
  );
};
```

Note: Mux Player handles audio track detection and switching automatically. No custom implementation needed.

### Mobile Implementation (React Native)

```javascript
// /apps/learner-mobile/src/screens/LessonScreen.tsx
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Modal, Text } from "react-native";
import Video from "react-native-video";

export const LessonScreen = ({ lessonId, userId }) => {
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showAudioSelector, setShowAudioSelector] = useState(false);
  const videoRef = useRef(null);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      const response = await fetch(`/api/users/${userId}/preferences`);
      const prefs = await response.json();
      setSelectedLanguage(prefs.audio_language || "en");
    };

    loadPreferences();
  }, [userId]);

  // Fetch available audio tracks
  useEffect(() => {
    const fetchTracks = async () => {
      const response = await fetch(`/api/videos/${videoId}/tracks`);
      const data = await response.json();
      setAudioTracks(data.audioTracks);
    };

    fetchTracks();
  }, [videoId]);

  const handleAudioLanguageChange = async (language) => {
    setSelectedLanguage(language);

    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_language: language }),
    });

    setShowAudioSelector(false);

    // Switch audio track in video player
    if (videoRef.current) {
      const trackIndex = audioTracks.findIndex((t) => t.language === language);
      videoRef.current.selectTrack("audio", trackIndex);
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        selectedAudioTrack={{ type: "language", value: selectedLanguage }}
        // ... other props
      />

      {/* Settings Button in Player Controls */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => setShowAudioSelector(true)}
      >
        <Text>Settings</Text>
      </TouchableOpacity>

      {/* Audio Language Selector Modal */}
      <Modal visible={showAudioSelector} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Audio Language</Text>
            {audioTracks.map((track) => (
              <TouchableOpacity
                key={track.language}
                style={[
                  styles.languageOption,
                  selectedLanguage === track.language && styles.selected,
                ]}
                onPress={() => handleAudioLanguageChange(track.language)}
              >
                <Text style={styles.languageLabel}>{track.name}</Text>
                {selectedLanguage === track.language && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
};
```

### Backend API: Fetch Audio Tracks

```typescript
// Backend: GET /api/videos/:videoId/tracks
app.get("/videos/:videoId/tracks", async (req, res) => {
  const { videoId } = req.params;

  try {
    // Fetch from Mux API
    const response = await fetch(
      `https://api.mux.com/video/v1/assets/${muxAssetId}/tracks`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${MUX_ACCESS_TOKEN}:${MUX_SECRET}`).toString("base64")}`,
        },
      },
    );

    const data = await response.json();

    // Parse audio tracks
    const audioTracks = data.data
      .filter((track) => track.type === "audio")
      .map((track) => ({
        id: track.id,
        language: track.language_code, // e.g., "en", "es"
        name: languageNames[track.language_code],
        uri: track.uri,
      }));

    return res.json({ audioTracks });
  } catch (error) {
    console.error("Error fetching tracks:", error);
    return res.status(500).json({ error: "Failed to fetch tracks" });
  }
});

const languageNames = {
  en: "English",
  es: "Español",
  fr: "Français",
  ru: "Русский",
};
```

### Backend API: Save Audio Preference

```typescript
// Backend: PATCH /api/users/:userId/preferences
app.patch("/users/:userId/preferences", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { audio_language } = req.body;
  const currentUserId = req.user.id;

  // Verify user is editing their own preferences
  if (userId !== currentUserId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Validate language
  const validLanguages = ["en", "es", "fr", "ru"];
  if (audio_language && !validLanguages.includes(audio_language)) {
    return res.status(400).json({ error: "Invalid language" });
  }

  try {
    const result = await db.query(
      `INSERT INTO user_preferences (user_id, audio_language)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET audio_language = $2
       RETURNING *`,
      [userId, audio_language || "en"],
    );

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating preferences:", error);
    return res.status(500).json({ error: "Failed to update preferences" });
  }
});
```

### Database Schema

```sql
-- Add to user_preferences table
ALTER TABLE user_preferences ADD COLUMN audio_language VARCHAR(5) DEFAULT 'en';

-- Validate only valid languages
ALTER TABLE user_preferences ADD CONSTRAINT valid_audio_language
  CHECK (audio_language IN ('en', 'es', 'fr', 'ru'));
```

### HLS Manifest Example

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6

#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="en",NAME="English",DEFAULT=YES,AUTOSELECT=YES,URI="https://image.mux.com/ABC123/audio/en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="es",NAME="Español",AUTOSELECT=YES,URI="https://image.mux.com/ABC123/audio/es.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,URI="https://image.mux.com/ABC123/audio/fr.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",LANGUAGE="ru",NAME="Русский",AUTOSELECT=YES,URI="https://image.mux.com/ABC123/audio/ru.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,AUDIO="audio"
https://image.mux.com/ABC123/video.m3u8
```

### Testing

1. **Web Testing**:
   - Open video in Mux Player
   - Verify audio selector visible in controls
   - Select different language
   - Verify audio switches without interruption
   - Refresh page, verify previously selected language loads
   - Check user preferences saved in database

2. **Mobile Testing**:
   - Open video in React Native player
   - Access settings menu
   - Select different audio language
   - Verify audio switches
   - Close and reopen app: should remember preference

3. **Multi-Video Testing**:
   - Select language in video 1
   - Switch to video 2: should auto-play with selected language
   - Change language in video 2
   - Go back to video 1: should remember per-user preference

4. **Fallback Testing**:
   - If video missing language track
   - Should show fallback warning
   - Should play English audio
   - Should not break playback

### Analytics

Track audio language selection:

```javascript
analytics.track("audio_language_changed", {
  videoId,
  language,
  userId,
  previousLanguage,
  timestamp,
});
```

Monitor:

- Most popular languages
- Language selection patterns per user/course
- Fallback frequency (if any languages missing)
