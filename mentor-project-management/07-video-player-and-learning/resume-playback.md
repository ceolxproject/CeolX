# Resume Playback (Resume from Where Left Off)

## Description

Implement resumable video playback to allow learners to pause a lesson and resume from the exact position on their next visit. This feature works across devices (web and mobile), tracks watch position in real-time, and provides visual feedback (progress bar) showing which segments have been watched. The resume functionality is critical for flexible learning and mobile-first use cases.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- Backend: video progress tracking service
- Database: video progress tracking table

## API Endpoints

- `POST /api/lessons/:lessonId/progress` - Save/update playback position (throttled, called on pause/exit/interval)
- `GET /api/lessons/:lessonId/progress` - Fetch last watched position and segment data
- `PATCH /api/lessons/:lessonId/progress` - Resume from last position (implicit in GET response)

## Requirements

### 1. Playback Position Tracking

- **Save on Events**:
  - Pause event: immediately save current position
  - Exit/back navigation: save position before leaving
  - App backgrounding (mobile): save position
  - Periodic save: every 10 seconds during playback (to handle crashes)
- **Data Stored**:
  - `last_position_seconds`: current video playback position (float)
  - `total_duration_seconds`: video length (set on first load)
  - `watched_segments`: array of {start, end} tuples (segments watched)
  - `last_updated_at`: timestamp of last update
  - `completed`: boolean (true if 90%+ watched)

### 2. Resume on Next Play

- **Load Last Position**: On lesson open, fetch progress data
  - If last_position_seconds exists: immediately seek to that position
  - Show visual indicator: "Resume from [MM:SS]" button above video
  - Allow user to click "Start Over" to reset to beginning
  - Auto-play from resumed position if lesson was previously paused
- **No Interruption**: Resume happens seamlessly without dialog box
  - If user closes app mid-video, next open jumps to saved position
  - If user visits on different device, can resume from latest device

### 3. Progress Bar Visualization

- **Watched Segments**: Show blue highlight on progress bar for watched portions
  - Based on `watched_segments` array
  - Example: user watched 0-5 min, paused, then watched 7-15 min
  - Progress bar shows blue segments at 0-5 and 7-15 min marks
- **Current Position**: White/light indicator shows current playback position
- **Buffered**: Light gray shows buffered ahead of playback
- **Non-Watched**: Dark gray shows unwatched segments
- **Hover Thumbnail**: Show thumbnail preview on progress bar hover (existing feature)

### 4. Watched Segments Calculation

- Track all segments user watches (even if non-contiguous)
- Merge overlapping segments: [0-5, 3-8] → [0-8]
- Example flow:
  1. User plays from 0s, watches until 5m, then pauses
  2. `watched_segments = [{start: 0, end: 300}]`
  3. User resumes at 5m, watches until 10m (skips from 5m to 7m using seek)
  4. `watched_segments = [{start: 0, end: 600}]` (contiguous, merged)
  5. User skips back to 3m, watches until 5m
  6. Already watched, no change

### 5. Cross-Device Sync (Future, Not in Scope for MVP)

- Currently: Each device tracks position independently
- Future: Sync last position across devices (lowest position wins for user continuity)
- MVP: No cross-device sync required

### 6. Completion Tracking Integration

- Progress updates feed into lesson completion logic (90% threshold)
- Calculate watched percentage: `(sum of watched_segments) / total_duration * 100`
- Mark lesson complete when watched% >= 90%
- (Handled separately in lesson-completion-logic.md)

### 7. Network Resilience

- **Offline Support**: Buffer position locally, sync when online
  - Use IndexedDB or AsyncStorage for offline cache
  - Sync on next successful network call
- **Failed API Calls**: Retry with exponential backoff
  - Failed save doesn't interrupt playback
  - Retry background every 10 seconds until success
- **Stale Data**: If network returns older data, use client version
  - Compare `last_updated_at` timestamps
  - Keep most recent version

## Acceptance Criteria

- [ ] Playback position saved on pause event
- [ ] Playback position saved on exit/navigation
- [ ] Periodic save working every 10 seconds during playback
- [ ] Last position fetched on lesson open
- [ ] Video seeks to last position automatically (no dialog)
- [ ] "Resume from MM:SS" button visible above video
- [ ] "Start Over" button present to reset to beginning
- [ ] Progress bar shows blue segments for watched portions
- [ ] Watched segments merge correctly (no duplicate blue areas)
- [ ] Watched percentage calculated correctly (for 90% completion)
- [ ] Completion marked when 90%+ watched
- [ ] Resume works on subsequent visits to same lesson
- [ ] Position persists across app close/reopen (mobile)
- [ ] Progress bar hover thumbnail still works with segments displayed
- [ ] Network error doesn't interrupt playback or lose position
- [ ] Offline position caching working (if offline support required)
- [ ] Different videos show independent progress per lesson
- [ ] Mobile: position saved on app backgrounding (pause)
- [ ] Web: position saved before browser tab close

## Dependencies

- Mux Player with seek support (web)
- react-native-video with seek support (mobile)
- Video progress tracking API (backend)
- Database: video_progress table with lesson_id, user_id, position_seconds, watched_segments, completed
- IndexedDB/AsyncStorage for offline caching (optional)

## Technical Notes

### Database Schema

```sql
-- Tracks video playback progress per lesson per user
CREATE TABLE video_progress (
  id SERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  last_position_seconds FLOAT DEFAULT 0,
  total_duration_seconds FLOAT,
  watched_segments JSONB DEFAULT '[]', -- Array of {start, end}
  last_updated_at TIMESTAMP DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(lesson_id, user_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index for fast lookups
CREATE INDEX idx_video_progress_user_lesson ON video_progress(user_id, lesson_id);
```

### Data Structure

```javascript
{
  lessonId: "uuid-123",
  userId: "uuid-456",
  lastPositionSeconds: 342.5, // 5:42
  totalDurationSeconds: 3600, // 60 minutes
  watchedSegments: [
    { start: 0, end: 300 },      // 0:00 - 5:00
    { start: 420, end: 900 },    // 7:00 - 15:00
    { start: 1200, end: 1500 }   // 20:00 - 25:00
  ],
  watchedPercentage: 35, // (300 + 480 + 300) / 3600 * 100
  completed: false,
  lastUpdatedAt: "2026-02-18T10:30:00Z"
}
```

### Web Implementation (React/Next.js)

```javascript
// /packages/ui-components/src/MuxPlayerWeb/usePlaybackResume.ts
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const SAVE_INTERVAL_MS = 10000; // Save every 10 seconds
const DEBOUNCE_MS = 1000; // Debounce pause save to 1 second

export const usePlaybackResume = (lessonId, videoId, playerRef) => {
  const { user } = useAuth();
  const [lastPosition, setLastPosition] = useState(0);
  const [watchedSegments, setWatchedSegments] = useState([]);
  const [isResuming, setIsResuming] = useState(true);
  const saveTimeoutRef = useRef(null);
  const segmentStartRef = useRef(0);
  const hasLoadedRef = useRef(false);

  // Fetch initial progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await fetch(
          `/api/lessons/${lessonId}/progress?userId=${user.id}`
        );
        if (!response.ok) throw new Error("Failed to load progress");

        const data = await response.json();
        setLastPosition(data.lastPositionSeconds || 0);
        setWatchedSegments(data.watchedSegments || []);
        setIsResuming(false);
        hasLoadedRef.current = true;

        // Seek to last position if player loaded
        if (playerRef.current && data.lastPositionSeconds > 0) {
          playerRef.current.currentTime = data.lastPositionSeconds;
        }
      } catch (error) {
        console.error("Error loading progress:", error);
        setIsResuming(false);
      }
    };

    if (user?.id && lessonId) {
      loadProgress();
    }
  }, [lessonId, user?.id]);

  // Save progress on pause
  const saveProgress = useCallback(
    (position, segments) => {
      if (!user?.id || !hasLoadedRef.current) return;

      clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/lessons/${lessonId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              lastPositionSeconds: position,
              watchedSegments: segments,
              totalDurationSeconds: playerRef.current?.duration || 0,
            }),
          });
        } catch (error) {
          console.error("Error saving progress:", error);
          // Retry will happen on next event
        }
      }, DEBOUNCE_MS);
    },
    [user?.id, lessonId, playerRef]
  );

  // Track watched segments
  const updateWatchedSegment = useCallback(
    (currentTime) => {
      if (!segmentStartRef.current) {
        segmentStartRef.current = currentTime;
      }

      // On pause, save segment
      const newSegments = mergeSegments([
        ...watchedSegments,
        { start: segmentStartRef.current, end: currentTime },
      ]);
      setWatchedSegments(newSegments);
      segmentStartRef.current = 0;
      saveProgress(currentTime, newSegments);
    },
    [watchedSegments, saveProgress]
  );

  // Handle timeupdate event (periodic)
  const handleTimeUpdate = useCallback(
    (currentTime) => {
      if (!segmentStartRef.current) {
        segmentStartRef.current = currentTime;
      }

      // Periodic save every 10 seconds
      saveProgress(currentTime, watchedSegments);
    },
    [watchedSegments, saveProgress]
  );

  // Handle pause
  const handlePause = useCallback(() => {
    if (playerRef.current) {
      updateWatchedSegment(playerRef.current.currentTime);
    }
  }, [playerRef, updateWatchedSegment]);

  // Handle beforeunload (save before leaving)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (playerRef.current && !playerRef.current.paused) {
        updateWatchedSegment(playerRef.current.currentTime);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [playerRef, updateWatchedSegment]);

  return {
    lastPosition,
    watchedSegments,
    isResuming,
    handleTimeUpdate,
    handlePause,
  };
};

// Helper: Merge overlapping segments
function mergeSegments(segments) {
  if (!segments.length) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or adjacent
      last.end = Math.max(last.end, current.end);
    } else {
      // Non-overlapping
      merged.push(current);
    }
  }

  return merged;
}
```

```javascript
// Usage in MuxPlayerWeb component
export const MuxPlayerWeb = ({ lessonId, videoId, userId }) => {
  const playerRef = useRef(null);
  const {
    lastPosition,
    watchedSegments,
    isResuming,
    handleTimeUpdate,
    handlePause,
  } = usePlaybackResume(lessonId, videoId, playerRef);

  if (isResuming) {
    return <LoadingSpinner />; // Show while fetching last position
  }

  return (
    <div className="player-container">
      {lastPosition > 0 && (
        <div className="resume-bar">
          <button onClick={() => (playerRef.current.currentTime = 0)}>
            Start Over
          </button>
          <span>Resume from {formatTime(lastPosition)}</span>
          <button onClick={() => playerRef.current.play()}>Resume</button>
        </div>
      )}

      <MuxPlayer
        ref={playerRef}
        playbackId={videoId}
        onTimeUpdate={(e) => handleTimeUpdate(e.target.currentTime)}
        onPause={handlePause}
      />

      <ProgressBar
        watchedSegments={watchedSegments}
        duration={playerRef.current?.duration}
      />
    </div>
  );
};
```

### Mobile Implementation (React Native)

```javascript
// /packages/ui-components-native/src/VideoPlayer/usePlaybackResume.ts
import { useEffect, useRef, useCallback, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/context/AuthContext";

const SAVE_INTERVAL_MS = 10000;
const DEBOUNCE_MS = 1000;

export const usePlaybackResume = (lessonId, videoId) => {
  const { user } = useAuth();
  const [lastPosition, setLastPosition] = useState(0);
  const [watchedSegments, setWatchedSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef(null);
  const segmentStartRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);

  // Load progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const response = await fetch(
          `/api/lessons/${lessonId}/progress?userId=${user.id}`
        );
        if (!response.ok) throw new Error("Failed to load progress");

        const data = await response.json();
        setLastPosition(data.lastPositionSeconds || 0);
        setWatchedSegments(data.watchedSegments || []);
      } catch (error) {
        console.error("Error loading progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id && lessonId) {
      loadProgress();
    }
  }, [lessonId, user?.id]);

  // Save progress (throttled)
  const saveProgress = useCallback(
    (position, segments) => {
      if (!user?.id) return;

      clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/lessons/${lessonId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              lastPositionSeconds: position,
              watchedSegments: segments,
            }),
          });
        } catch (error) {
          console.error("Error saving progress:", error);
        }
      }, DEBOUNCE_MS);
    },
    [user?.id, lessonId]
  );

  // Update watched segment on pause
  const updateWatchedSegment = useCallback(
    (currentTime) => {
      if (!segmentStartRef.current) {
        segmentStartRef.current = currentTime;
      }

      const newSegments = mergeSegments([
        ...watchedSegments,
        { start: segmentStartRef.current, end: currentTime },
      ]);
      setWatchedSegments(newSegments);
      segmentStartRef.current = 0;
      saveProgress(currentTime, newSegments);
    },
    [watchedSegments, saveProgress]
  );

  // Handle app backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        state === "active"
      ) {
        // App came to foreground
        setIsLoading(true); // Reload progress
      } else if (state.match(/inactive|background/)) {
        // App backgrounded, save position
        updateWatchedSegment(playerRef.current?.currentTime || lastPosition);
      }
      appStateRef.current = state;
    });

    return () => subscription?.remove();
  }, [lastPosition, updateWatchedSegment]);

  return {
    lastPosition,
    watchedSegments,
    isLoading,
    updateWatchedSegment,
    saveProgress,
  };
};
```

### Backend API: Save Progress

```javascript
// Backend: POST /api/lessons/:lessonId/progress
app.post(
  "/api/lessons/:lessonId/progress",
  authenticateToken,
  async (req, res) => {
    const { lastPositionSeconds, watchedSegments, totalDurationSeconds } =
      req.body;
    const { lessonId } = req.params;
    const userId = req.user.id;

    try {
      // Upsert progress record
      const result = await db.query(
        `
      INSERT INTO video_progress (lesson_id, user_id, last_position_seconds, watched_segments, total_duration_seconds, last_updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (lesson_id, user_id)
      DO UPDATE SET
        last_position_seconds = $3,
        watched_segments = $4,
        total_duration_seconds = $5,
        last_updated_at = NOW()
      RETURNING *;
      `,
        [
          lessonId,
          userId,
          lastPositionSeconds,
          JSON.stringify(watchedSegments),
          totalDurationSeconds,
        ]
      );

      return res.json(result.rows[0]);
    } catch (error) {
      console.error("Error saving progress:", error);
      return res.status(500).json({ error: "Failed to save progress" });
    }
  }
);
```

### Backend API: Get Progress

```javascript
// Backend: GET /api/lessons/:lessonId/progress
app.get(
  "/api/lessons/:lessonId/progress",
  authenticateToken,
  async (req, res) => {
    const { lessonId } = req.params;
    const userId = req.user.id;

    try {
      const result = await db.query(
        `
      SELECT * FROM video_progress
      WHERE lesson_id = $1 AND user_id = $2
      `,
        [lessonId, userId]
      );

      const progress = result.rows[0] || {
        lastPositionSeconds: 0,
        watchedSegments: [],
        totalDurationSeconds: 0,
        completed: false,
      };

      // Parse JSON
      progress.watchedSegments = JSON.parse(progress.watched_segments || "[]");

      return res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      return res.status(500).json({ error: "Failed to load progress" });
    }
  }
);
```

### Progress Bar Component

```javascript
// ProgressBar with watched segments visualization
export const ProgressBar = ({ duration, watchedSegments, currentTime }) => {
  if (!duration) return null;

  const segments = watchedSegments.map((seg) => ({
    start: (seg.start / duration) * 100,
    end: (seg.end / duration) * 100,
  }));

  return (
    <div className="progress-bar">
      {/* Background (unwatched) */}
      <div className="progress-background" style={{ width: "100%" }} />

      {/* Watched segments (blue) */}
      {segments.map((seg, idx) => (
        <div
          key={idx}
          className="progress-watched"
          style={{
            left: seg.start + "%",
            width: seg.end - seg.start + "%",
          }}
        />
      ))}

      {/* Current position (white) */}
      <div
        className="progress-current"
        style={{
          left: (currentTime / duration) * 100 + "%",
        }}
      />
    </div>
  );
};
```

### Styling

```css
.progress-bar {
  position: relative;
  height: 4px;
  width: 100%;
  background-color: #444;
  cursor: pointer;
  border-radius: 2px;
}

.progress-background {
  position: absolute;
  height: 100%;
  background-color: #666;
}

.progress-watched {
  position: absolute;
  height: 100%;
  background-color: #4caf50;
  opacity: 0.7;
}

.progress-current {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #fff;
  border-radius: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
}

.resume-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 14px;
  margin-bottom: 12px;
  border-radius: 4px;
}

.resume-bar button {
  padding: 6px 12px;
  background-color: #ff6b9d;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
```

### Testing

1. Play video, pause at 5 minutes
2. Close lesson
3. Reopen lesson: should resume at 5 minutes with "Resume from 5:00" button
4. Verify progress bar shows blue segment from 0-5 min
5. Resume playback, watch until 15 min, pause
6. Reopen: resume at 15 min, progress bar shows 0-15 min in blue
7. Refresh page: position persists
8. Mobile: close app while playing, reopen: should resume
