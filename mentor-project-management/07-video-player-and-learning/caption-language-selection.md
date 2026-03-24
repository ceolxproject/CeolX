# Caption/Subtitle Language Selection

## Description

Implement selectable caption and subtitle tracks for video content in all supported languages (EN, ES, FR, RU). Captions are independently selectable from audio language, allowing learners to watch content in one language with captions in another. Caption language preference is saved per user and applied automatically to subsequent videos. Learners can toggle captions on/off with visual preference persistence.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- Mux platform (caption track delivery via VTT/SRT)
- Backend: user preference service
- Database: user_preferences table (caption_language, captions_enabled fields)

## API Endpoints

- `GET /api/videos/:videoId/captions` - Get available caption tracks
  - Response: `[{ language: "en", name: "English", url: "..." }, ...]`
- `PATCH /api/users/:userId/preferences` - Save caption preferences
  - Request: `{ "caption_language": "es", "captions_enabled": true }`
  - Response: user preferences object
- `GET /api/users/:userId/preferences` - Load user preferences on app start
  - Response: `{ "caption_language": "en", "captions_enabled": true, ... }`

## Requirements

### 1. Caption Generation & Storage

**Mux Caption Tracks**:

- Generated for all videos in 4 languages: EN, ES, FR, RU
- Format: VTT (WebVTT, compatible with HTML5 video)
- Alternative format: SRT (for download/export)
- Source: ElevenLabs dubbing transcript for each language
- Timing: auto-synced to video timeline

**Caption Content**:

- Translated text for each language (not direct transcription)
- Speaker names optional (if video has multiple speakers)
- Timings accurate to 10ms precision
- Include sound descriptions: "[music]", "[applause]" (accessibility)

### 2. Web Player Implementation

**Caption Toggle**:

- "CC" button in Mux Player control bar
- Click to show/hide captions
- Button state: filled (ON) or outline (OFF)
- Persistent state across videos (remember user preference)

**Caption Selector**:

- Dropdown in player settings or separate control
- Options: "Off", "English", "Español", "Français", "Русский"
- Current selection highlighted
- Click to change language (requires captions ON)

**Caption Styling**:

- White text on semi-transparent black background
- Font: sans-serif, readable size (default 16px)
- Auto-scroll synced to playback (if applicable)
- User can adjust font size (small/normal/large)
- Contrast: WCAG AA compliant (accessible)

### 3. Mobile Player Implementation

**Caption Toggle**:

- "CC" button in player controls or settings menu
- Toggle ON/OFF with single tap
- Visual indicator: icon changes state

**Caption Selector**:

- In settings menu alongside audio language
- List of available caption languages
- Radio buttons or checkboxes (only one active)
- Tap to select language

**Caption Display**:

- Positioned below video (safe area)
- Same styling as web (readable, high contrast)
- Auto-adjust position to avoid UI overlays
- Optional: adjustable font size

### 4. User Preference Persistence

**Save Preferences**:

- Fields: `captions_enabled` (boolean), `caption_language` (string)
- On caption toggle: save enabled/disabled state
- On language select: save language preference
- Automatic save (no explicit button needed)
- Fire-and-forget pattern (non-blocking)

**Load Preferences**:

- On app start: fetch user preferences
- Apply saved caption state to all videos
- If `captions_enabled` = true: show captions using saved language
- If `captions_enabled` = false: captions hidden (but available)
- Default: captions enabled with English

### 5. Caption Language Independence

- **Independent Selection**: Captions separate from audio language
- **Use Cases**:
  - English audio + Spanish captions (learn Spanish)
  - Spanish audio + English captions (understand context)
  - French audio + French captions (native speaker)
  - Any combination of 4 languages
- **Both saved separately** in user preferences

### 6. Fallback Handling

- If selected caption language unavailable: fall back to English
- Show message: "English captions not available. Showing English."
- Continue playback without interruption

### 7. Accessibility Features

- **High Contrast**: Light text on dark background (no colored backgrounds)
- **Font Adjustment**: User can increase font size
- **Always Include**: Sound descriptions for deaf/hard of hearing
- **Keyboard Navigation**: Full keyboard control for caption toggle/selection
- **Screen Reader**: Proper ARIA labels for caption controls

### 8. Caption Export

- Download caption track as SRT or VTT file
- Include language name in filename: "lesson-01-es.srt"
- Used for learner note-taking and external tools

## Acceptance Criteria

- [ ] Captions available in all 4 languages (EN, ES, FR, RU)
- [ ] "CC" button visible in player controls (web)
- [ ] "CC" button visible in player controls (mobile)
- [ ] Click/tap "CC" toggles captions on/off
- [ ] Caption language selector present and functional
- [ ] All language options listed with correct names
- [ ] Selecting language changes captions (if enabled)
- [ ] Captions display with correct timing (in-sync with audio)
- [ ] Caption text readable (font size, contrast, positioning)
- [ ] Caption preference saved to API on toggle
- [ ] Caption language preference saved to API on selection
- [ ] Preferences loaded on app start and applied
- [ ] Captions enabled by default
- [ ] Captions OFF state persisted (user can turn off)
- [ ] Caption language independent from audio language
- [ ] Fallback to English if selected language unavailable
- [ ] Fallback message shown
- [ ] Sound descriptions included in captions
- [ ] Font size adjustable (small/normal/large)
- [ ] High contrast styling (WCAG AA)
- [ ] Mobile: captions positioned in safe area
- [ ] Mobile: captions don't overlap player UI
- [ ] Web: keyboard navigation working
- [ ] Web: ARIA labels present for accessibility
- [ ] Performance: captions load within 500ms
- [ ] Caption download working (SRT/VTT export)

## Dependencies

- Mux platform with caption track support
- ElevenLabs for translation/transcription
- Mux Player (web) with native caption support
- react-native-video (mobile) with caption track support
- User preference API
- Database: user_preferences table

## Technical Notes

### Caption Data Generation

```
Workflow:
1. Video uploaded with primary audio (English)
2. Mux auto-generates English captions from audio
3. ElevenLabs translates English captions to ES, FR, RU
4. Captions converted to VTT format with timing
5. VTT files hosted on Mux CDN
6. HLS manifest includes caption tracks
```

Example VTT file:

```
WEBVTT

00:00:00.000 --> 00:00:05.500
Welcome to the beauty basics course.

00:00:05.500 --> 00:00:10.000
Today we'll learn about foundation application.

[SOUND: Soft background music plays]

00:00:10.000 --> 00:00:15.000
Let's start with understanding your skin type.
```

### HLS Manifest with Captions

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6

#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",LANGUAGE="en",NAME="English",DEFAULT=YES,AUTOSELECT=YES,INSTREAMID="CC1"
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",LANGUAGE="es",NAME="Español",AUTOSELECT=YES,INSTREAMID="CC2"
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",LANGUAGE="fr",NAME="Français",AUTOSELECT=YES,INSTREAMID="CC3"
#EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,GROUP-ID="cc",LANGUAGE="ru",NAME="Русский",AUTOSELECT=YES,INSTREAMID="CC4"

#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CLOSED-CAPTIONS="cc"
https://image.mux.com/ABC123/video.m3u8
```

### Web Implementation (React/Next.js)

Mux Player automatically supports captions:

```typescript
import MuxPlayer from '@mux/mux-player-react';

export const VideoPlayer = ({ videoId, userId }) => {
  const [userPreferences, setUserPreferences] = useState({
    captions_enabled: true,
    caption_language: 'en',
  });

  // Load preferences on mount
  useEffect(() => {
    fetch(`/api/users/${userId}/preferences`)
      .then(r => r.json())
      .then(prefs => setUserPreferences(prefs));
  }, [userId]);

  const handleCaptionChange = async (language) => {
    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption_language: language }),
    });

    setUserPreferences(prev => ({ ...prev, caption_language: language }));
  };

  const handleCaptionToggle = async (enabled) => {
    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captions_enabled: enabled }),
    });

    setUserPreferences(prev => ({ ...prev, captions_enabled: enabled }));
  };

  return (
    <MuxPlayer
      playbackId={videoId}
      onCaptionChange={handleCaptionChange}
      onCaptionToggle={handleCaptionToggle}
      defaultCaptionLanguage={userPreferences.caption_language}
      captionsInitiallyVisible={userPreferences.captions_enabled}
      // Mux Player automatically:
      // 1. Detects caption tracks from HLS manifest
      // 2. Displays CC button and selector
      // 3. Handles caption switching
      // 4. Renders captions with proper styling
    />
  );
};
```

### Mobile Implementation (React Native)

```javascript
// /apps/learner-mobile/src/screens/LessonScreen.tsx
import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Modal, Text } from "react-native";
import Video from "react-native-video";

const CAPTION_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
];

export const LessonScreen = ({ videoId, userId }) => {
  const [captionLanguage, setCaptionLanguage] = useState("en");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [showCaptionSelector, setShowCaptionSelector] = useState(false);
  const videoRef = useRef(null);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      const response = await fetch(`/api/users/${userId}/preferences`);
      const prefs = await response.json();
      setCaptionLanguage(prefs.caption_language || "en");
      setCaptionsEnabled(prefs.captions_enabled !== false);
    };

    loadPreferences();
  }, [userId]);

  const handleCaptionToggle = async () => {
    const newState = !captionsEnabled;
    setCaptionsEnabled(newState);

    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captions_enabled: newState }),
    });
  };

  const handleLanguageChange = async (language) => {
    setCaptionLanguage(language);

    // Save preference
    await fetch(`/api/users/${userId}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption_language: language }),
    });

    setShowCaptionSelector(false);
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        textTracks={[
          {
            language: captionLanguage,
            type: "application/x-subrip",
            uri: `https://cdn.example.com/captions/${videoId}-${captionLanguage}.vtt`,
          },
        ]}
        selectedTextTrack={
          captionsEnabled
            ? { type: "language", value: captionLanguage }
            : { type: "disabled" }
        }
        // ... other props
      />

      {/* CC Button in Player Controls */}
      <TouchableOpacity
        style={[styles.ccBtn, captionsEnabled && styles.ccBtnActive]}
        onPress={handleCaptionToggle}
      >
        <Text style={styles.ccBtnText}>CC</Text>
      </TouchableOpacity>

      {/* Caption Selector Button */}
      {captionsEnabled && (
        <TouchableOpacity
          style={styles.captionLangBtn}
          onPress={() => setShowCaptionSelector(true)}
        >
          <Text>
            {CAPTION_LANGUAGES.find((l) => l.code === captionLanguage)?.name}
          </Text>
        </TouchableOpacity>
      )}

      {/* Caption Language Selector Modal */}
      <Modal visible={showCaptionSelector} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Captions</Text>
            {CAPTION_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  captionLanguage === lang.code && styles.selected,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
              >
                <Text style={styles.languageLabel}>{lang.name}</Text>
                {captionLanguage === lang.code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowCaptionSelector(false)}
            >
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  ccBtn: {
    position: "absolute",
    bottom: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  ccBtnActive: {
    backgroundColor: "#FF6B9D",
    borderColor: "#FF6B9D",
  },
  ccBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  // ... more styles
});
```

### Backend API: Fetch Captions

```typescript
// Backend: GET /api/videos/:videoId/captions
app.get("/videos/:videoId/captions", async (req, res) => {
  const { videoId } = req.params;

  try {
    // Fetch from Mux API
    const muxAssetId = await getMuxAssetId(videoId);
    const response = await fetch(
      `https://api.mux.com/video/v1/assets/${muxAssetId}/tracks`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${MUX_ACCESS_TOKEN}:${MUX_SECRET}`).toString("base64")}`,
        },
      },
    );

    const data = await response.json();

    // Parse caption tracks
    const captions = data.data
      .filter((track) => track.type === "text")
      .map((track) => ({
        language: track.language_code,
        name: captionLanguageNames[track.language_code],
        url: track.uri,
      }));

    return res.json(captions);
  } catch (error) {
    console.error("Error fetching captions:", error);
    return res.status(500).json({ error: "Failed to fetch captions" });
  }
});

const captionLanguageNames = {
  en: "English",
  es: "Español",
  fr: "Français",
  ru: "Русский",
};
```

### Backend API: Save Caption Preferences

```typescript
// Backend: PATCH /api/users/:userId/preferences
app.patch("/users/:userId/preferences", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { caption_language, captions_enabled } = req.body;
  const currentUserId = req.user.id;

  if (userId !== currentUserId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const validLanguages = ["en", "es", "fr", "ru"];
  if (caption_language && !validLanguages.includes(caption_language)) {
    return res.status(400).json({ error: "Invalid caption language" });
  }

  try {
    const result = await db.query(
      `INSERT INTO user_preferences (user_id, caption_language, captions_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET
         caption_language = COALESCE($2, user_preferences.caption_language),
         captions_enabled = COALESCE($3, user_preferences.captions_enabled)
       RETURNING *`,
      [
        userId,
        caption_language || null,
        captions_enabled !== undefined ? captions_enabled : null,
      ],
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
ALTER TABLE user_preferences ADD COLUMN caption_language VARCHAR(5) DEFAULT 'en';
ALTER TABLE user_preferences ADD COLUMN captions_enabled BOOLEAN DEFAULT TRUE;

-- Validate captions_enabled is boolean
ALTER TABLE user_preferences ADD CONSTRAINT valid_caption_language
  CHECK (caption_language IN ('en', 'es', 'fr', 'ru'));
```

### Caption Styling (Web)

```css
/* Custom caption styling */
video::cue {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 16px;
  font-family: sans-serif;
  line-height: 1.2;
  text-align: center;
  padding: 4px 8px;
}

/* High contrast for accessibility */
video::cue {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 1);
}

/* Safe area positioning */
@media (max-width: 768px) {
  video::cue {
    font-size: 14px;
    bottom: 50px; /* Avoid overlapping player controls */
  }
}
```

### Testing

1. **Web Testing**:
   - Verify all 4 caption languages available
   - Select different languages, verify captions change
   - Toggle CC off, verify captions hidden
   - Refresh page, verify preferences persist
   - Check sound descriptions included in captions

2. **Mobile Testing**:
   - Access CC button in player
   - Toggle on/off
   - Open caption language selector
   - Change language and verify
   - Close and reopen app: preferences persist

3. **Timing Testing**:
   - Verify captions in-sync with audio
   - Check lip-sync on multi-speaker videos
   - Verify timing consistency across languages

4. **Accessibility Testing**:
   - Test with screen reader
   - Verify keyboard navigation (desktop)
   - Check contrast ratios (WCAG AA)
   - Test font size adjustment

5. **Fallback Testing**:
   - If caption track unavailable, should fall back to English
   - Verify warning message shown
   - Playback continues without interruption
