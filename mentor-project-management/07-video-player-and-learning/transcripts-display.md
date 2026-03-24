# Transcripts Display & Search

## Description

Implement transcript viewer for video lessons with real-time synchronization to playback position. Learners can view full transcript alongside or below video, auto-scroll follows current playback time, click any line to seek video to that position, and search transcript text. Transcripts available in all supported languages (EN, ES, FR, RU) from ElevenLabs dubbing.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- `packages/ui-components` (transcript viewer component)
- Backend: transcript storage and search service
- Mux platform (transcript generation/retrieval)

## API Endpoints

- `GET /api/lessons/:lessonId/transcript` - Fetch transcript for lesson
  - Query: `?language=en` (en, es, fr, ru)
  - Returns: Array of transcript lines with timestamps
- `GET /api/lessons/:lessonId/transcript/search` - Search transcript text
  - Query: `?q=query&language=en`
  - Returns: Matching lines with context
- `POST /api/lessons/:lessonId/transcript/download` - Download transcript as SRT/VTT

## Requirements

### 1. Transcript Data Structure

Each transcript line:

```json
{
  "id": "line-001",
  "startTime": 0, // seconds
  "endTime": 5.5, // seconds
  "speaker": "Instructor", // optional
  "text": "Welcome to the beauty basics course...",
  "confidence": 0.98 // OCR/STT confidence (0-1)
}
```

Full transcript:

```json
{
  "lessonId": "uuid",
  "language": "en",
  "title": "Lesson 1: Foundation Basics",
  "totalDuration": 3600,
  "lines": [...]
}
```

### 2. Web Player Implementation

**Layout Options**:

- **Side-by-Side** (desktop): Video on left (60%), transcript on right (40%) in scrollable panel
- **Below Video** (tablet): Video full width, transcript below in collapsible panel
- **Tab-Based** (mobile): Transcript as tab, switch between video and transcript

**Transcript Viewer**:

- Display all lines chronologically
- Current line highlighted (background color)
- Click any line: video seeks to start time of that line
- Display timestamp (MM:SS) to left of each line
- Optional speaker name if available
- Font size adjustable (accessibility)
- Dark/light theme support

### 3. Real-Time Sync

**Auto-Scroll**:

- As video plays, transcript auto-scrolls to current line
- Scroll position follows playback (smooth scroll, not jump)
- Current line stays roughly centered in viewport (if possible)
- Allow manual scroll without breaking auto-follow (pause auto-scroll on user scroll, resume after 3 seconds of no scroll)

**Visual Indicators**:

- **Current Line**: Solid background color (#F0F0F0 or theme color)
- **Past Lines**: Normal text (slightly grayed out optional)
- **Future Lines**: Normal text
- **On-Hover**: Highlight hover state, show cursor pointer

### 4. Search Functionality

**Search Bar**:

- Text input above transcript with "Search" button
- Real-time search as user types (debounced 300ms)
- Clear button to reset search

**Search Results**:

- Highlight matching text within lines (yellow/orange background)
- Show context: "...previous words [MATCH] next words..."
- Show result count: "3 of 5 matches"
- Navigation: Previous/Next buttons to jump between matches
- Clicked match: scroll transcript to that line AND seek video to start time

**Case-Insensitive**: Search ignores case

### 5. Language Selection

- **Language Selector** in transcript header (dropdown)
- Options: EN, ES, FR, RU (or whatever languages are dubbed)
- Changing language reloads transcript
- Show loading spinner while fetching
- Remember user's language preference (save to user preferences)

### 6. Transcript Accessibility

- **Download Option**: Users can download transcript as SRT or VTT file
- **Copy Button**: Copy text of selected line(s)
- **Font Size Control**: Adjust transcript font size (+/- buttons)
- **High Contrast**: Dark mode support for readability
- **Screen Reader**: Semantic HTML for accessibility

## Acceptance Criteria

- [ ] Transcript fetched and displayed on lesson open
- [ ] All transcript lines show with timestamps (MM:SS format)
- [ ] Speaker names displayed (if available)
- [ ] Click transcript line seeks video to that line's start time
- [ ] Auto-scroll follows playback position in real-time
- [ ] Current line highlighted with distinct background
- [ ] Auto-scroll pauses during manual user scroll (3 second debounce)
- [ ] Auto-scroll resumes when user stops scrolling
- [ ] Search bar functional with real-time results
- [ ] Search highlights matching text in yellow
- [ ] Search navigation (previous/next) works
- [ ] Search results show context around match
- [ ] Language dropdown present and functional
- [ ] Changing language reloads transcript
- [ ] Language preference saved to user profile
- [ ] Transcript visible on desktop (side-by-side layout)
- [ ] Transcript visible on tablet (below video)
- [ ] Transcript accessible as tab on mobile
- [ ] Dark/light theme styling consistent
- [ ] Download transcript as SRT or VTT file
- [ ] Font size adjustment working
- [ ] Text selection/copy functional
- [ ] Performance: Search completes within 200ms
- [ ] Mobile: Safe area respected in transcript panel

## Dependencies

- Mux platform (transcript generation)
- Mux API to retrieve transcripts
- React/Next.js (web player)
- React Native (mobile player)
- Design system (colors, typography, spacing)
- User preferences API (save language preference)

## Technical Notes

### Transcript Data from Mux

Mux automatically generates transcripts during video encoding:

```
GET https://api.mux.com/video/v1/assets/{ASSET_ID}/tracks
```

Returns VTT files with timing info. Parse into structured format:

```javascript
const parseVTT = (vttText) => {
  const lines = [];
  const pattern =
    /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})\n(.*?)(?=\n\n|$)/gs;
  let match;

  while ((match = pattern.exec(vttText)) !== null) {
    lines.push({
      startTime: parseTime(match[1]),
      endTime: parseTime(match[2]),
      text: match[3].trim(),
    });
  }

  return lines;
};

function parseTime(timeStr) {
  const [hours, minutes, secondsMs] = timeStr.split(":");
  const [seconds, ms] = secondsMs.split(".");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(ms) / 1000
  );
}
```

### Web Component: Transcript Viewer

```typescript
// /packages/ui-components/src/TranscriptViewer/index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './TranscriptViewer.module.css';

interface TranscriptLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

interface TranscriptViewerProps {
  lessonId: string;
  currentTime: number;
  onSeek: (time: number) => void;
  duration: number;
}

export const TranscriptViewer = ({
  lessonId,
  currentTime,
  onSeek,
  duration,
}: TranscriptViewerProps) => {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [language, setLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement>(null);

  // Fetch transcript on mount and language change
  useEffect(() => {
    const fetchTranscript = async () => {
      const response = await fetch(
        `/api/lessons/${lessonId}/transcript?language=${language}`
      );
      const data = await response.json();
      setTranscript(data.lines);
    };

    fetchTranscript();
  }, [lessonId, language]);

  // Save language preference
  useEffect(() => {
    fetch(`/api/users/me/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript_language: language }),
    }).catch(console.error);
  }, [language]);

  // Find current line based on playback time
  const currentLineIndex = transcript.findIndex(
    (line) => currentTime >= line.startTime && currentTime < line.endTime
  );

  // Auto-scroll to current line
  useEffect(() => {
    if (autoScroll && currentLineRef.current && !isScrolling) {
      currentLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex, autoScroll, isScrolling]);

  // Handle manual scroll
  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 3000);
  }, []);

  // Search transcript
  useEffect(() => {
    if (!searchQuery) {
      setSearchMatches([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = transcript
      .map((line, idx) => (line.text.toLowerCase().includes(query) ? idx : -1))
      .filter((idx) => idx !== -1);

    setSearchMatches(matches);
    setCurrentMatchIndex(0);

    if (matches.length > 0) {
      // Scroll to first match
      const firstMatch = matches[0];
      const matchElement = document.getElementById(`transcript-line-${firstMatch}`);
      matchElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchQuery, transcript]);

  // Navigate search results
  const goToNextMatch = () => {
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    const matchLineIdx = searchMatches[nextIndex];
    const matchElement = document.getElementById(`transcript-line-${matchLineIdx}`);
    matchElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const goToPreviousMatch = () => {
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    const matchLineIdx = searchMatches[prevIndex];
    const matchElement = document.getElementById(`transcript-line-${matchLineIdx}`);
    matchElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Highlight search matches in text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) =>
      regex.test(part) ? (
        <mark key={idx} className={styles.searchHighlight}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.languageSelector}>
          <label>Language:</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="ru">Русский</option>
          </select>
        </div>

        <div className={styles.fontSizeControl}>
          <button onClick={() => setFontSize(Math.max(12, fontSize - 2))}>
            A-
          </button>
          <span>{fontSize}px</span>
          <button onClick={() => setFontSize(Math.min(24, fontSize + 2))}>
            A+
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        {searchMatches.length > 0 && (
          <div className={styles.searchNav}>
            <button onClick={goToPreviousMatch} title="Previous match">
              ←
            </button>
            <span>
              {currentMatchIndex + 1} of {searchMatches.length}
            </span>
            <button onClick={goToNextMatch} title="Next match">
              →
            </button>
          </div>
        )}
      </div>

      {/* Transcript Lines */}
      <div
        ref={scrollContainerRef}
        className={styles.transcript}
        onScroll={handleScroll}
        style={{ fontSize: `${fontSize}px` }}
      >
        {transcript.map((line, idx) => (
          <div
            key={line.id}
            id={`transcript-line-${idx}`}
            ref={idx === currentLineIndex ? currentLineRef : null}
            className={`
              ${styles.line}
              ${idx === currentLineIndex ? styles.currentLine : ''}
              ${searchMatches.includes(idx) ? styles.searchResult : ''}
            `}
            onClick={() => onSeek(line.startTime)}
          >
            <span className={styles.timestamp}>{formatTime(line.startTime)}</span>
            {line.speaker && <span className={styles.speaker}>{line.speaker}:</span>}
            <span className={styles.text}>{highlightText(line.text, searchQuery)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
```

### Styling

```css
/* /packages/ui-components/src/TranscriptViewer/TranscriptViewer.module.css */
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-left: 1px solid #eee;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.languageSelector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.languageSelector label {
  font-size: 14px;
  font-weight: 500;
}

.languageSelector select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.fontSizeControl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fontSizeControl button {
  padding: 4px 8px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.fontSizeControl button:hover {
  background: #e0e0e0;
}

.searchBox {
  padding: 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.searchInput {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.searchNav {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.searchNav button {
  padding: 4px 8px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
}

.transcript {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.line {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.line:hover {
  background: #f5f5f5;
}

.currentLine {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
  padding-left: 8px;
}

.searchResult {
  background: #fafafa;
  border-left: 4px solid #ffeb3b;
  padding-left: 8px;
}

.timestamp {
  min-width: 60px;
  color: #999;
  font-weight: 500;
  font-size: 0.9em;
  text-align: right;
}

.speaker {
  font-weight: 600;
  color: #666;
  min-width: 100px;
}

.text {
  flex: 1;
  color: #333;
  line-height: 1.5;
}

.searchHighlight {
  background: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .container {
    border-left: none;
    border-top: 1px solid #eee;
  }

  .header {
    flex-direction: column;
    gap: 12px;
  }

  .line {
    flex-direction: column;
    gap: 4px;
  }

  .speaker {
    min-width: auto;
  }
}
```

### Backend: Transcript API

```typescript
// Backend: GET /api/lessons/:lessonId/transcript
app.get("/lessons/:lessonId/transcript", async (req, res) => {
  const { lessonId } = req.params;
  const { language = "en" } = req.query;

  try {
    // Get lesson and video ID
    const lessonResult = await db.query(
      "SELECT video_id FROM lessons WHERE id = $1",
      [lessonId],
    );

    const videoId = lessonResult.rows[0]?.video_id;
    if (!videoId) return res.status(404).json({ error: "Lesson not found" });

    // Fetch transcript from Mux
    const muxAssetId = await getMuxAssetId(videoId);
    const vttUrl = `https://image.mux.com/${muxAssetId}/storyboard.vtt`;

    // Cache in database
    let cachedTranscript = await db.query(
      "SELECT transcript_data FROM transcripts WHERE lesson_id = $1 AND language = $2",
      [lessonId, language],
    );

    if (cachedTranscript.rows.length === 0) {
      // Fetch from Mux
      const response = await fetch(vttUrl);
      const vttText = await response.text();
      const lines = parseVTT(vttText);

      // Cache it
      await db.query(
        "INSERT INTO transcripts (lesson_id, language, transcript_data) VALUES ($1, $2, $3)",
        [lessonId, language, JSON.stringify(lines)],
      );

      return res.json({
        lessonId,
        language,
        lines,
      });
    }

    return res.json({
      lessonId,
      language,
      lines: JSON.parse(cachedTranscript.rows[0].transcript_data),
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    return res.status(500).json({ error: "Failed to fetch transcript" });
  }
});
```

### Mobile Implementation (React Native)

```javascript
// /apps/learner-mobile/src/components/TranscriptViewer.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

export const MobileTranscriptViewer = ({ lessonId, currentTime, onSeek }) => {
  const [transcript, setTranscript] = useState([]);
  const [language, setLanguage] = useState("en");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);

  // Find current line
  const currentLineIndex = transcript.findIndex(
    (line) => currentTime >= line.startTime && currentTime < line.endTime,
  );

  return (
    <View style={styles.container}>
      {/* Language Selector */}
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search transcript..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Transcript Lines */}
      <ScrollView ref={scrollRef} style={styles.transcript}>
        {transcript.map((line, idx) => (
          <TouchableOpacity
            key={line.id}
            style={[
              styles.line,
              idx === currentLineIndex && styles.currentLine,
            ]}
            onPress={() => onSeek(line.startTime)}
          >
            <Text style={styles.timestamp}>{formatTime(line.startTime)}</Text>
            <Text style={styles.text}>{line.text}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchInput: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    fontSize: 14,
  },
  transcript: {
    flex: 1,
  },
  line: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  currentLine: {
    backgroundColor: "#fff3e0",
  },
  timestamp: {
    minWidth: 50,
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
});
```
