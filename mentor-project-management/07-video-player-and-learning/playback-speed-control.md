# Playback Speed Control

## Description

Implement adjustable video playback speed with preset options (1.0x, 1.25x, 1.5x, 1.75x, 2.0x, 2.5x) for both web and mobile platforms. User speed preference must persist across sessions and be applied automatically to subsequent videos. Speed control appears in player toolbar for easy access.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- `packages/ui-components` (web player wrapper)
- `packages/ui-components-native` (mobile player wrapper)
- Backend: user profile service (persist preferences)

## API Endpoints

- `PATCH /api/users/:userId/preferences` - Save playback speed preference
- `GET /api/users/:userId/preferences` - Fetch user preferences on app load

## Requirements

### 1. Speed Options

Available preset speeds:

- **1.0x** (Normal, default)
- **1.25x** (Slightly faster)
- **1.5x** (Moderately faster)
- **1.75x** (Fast)
- **2.0x** (Double speed)
- **2.5x** (Maximum speed)

Users should NOT be able to enter custom speeds (e.g., 1.15x); only presets allowed.

### 2. Web Player Implementation

- **UI Control**: Speed selector in player toolbar
  - Display as dropdown or button group (design system decision)
  - Show current speed (e.g., "1.5x")
  - List all 6 preset options
  - Click to change speed immediately
  - No confirmation dialog needed
- **Keyboard Shortcut** (optional):
  - `>` key: increase speed to next preset
  - `<` key: decrease speed to previous preset
- **Visual Feedback**:
  - Highlight current speed option
  - Brief toast notification: "Playback speed: 1.5x" (1 second)
  - No interruption to video playback

### 3. Mobile Player Implementation

- **UI Control**: Speed selector in player settings menu
  - Access via settings icon (gear icon) in player controls
  - Menu shows 6 preset options
  - Tap to change speed immediately
  - Return to video view (no overlay)
- **Visual Feedback**:
  - Current speed indicator on settings button
  - Toast notification: "Playback speed: 1.5x" (2 seconds)
  - No video pause/lag during speed change

### 4. Persistent User Preference

- **Storage**: Save to user preferences table in database
  - Table: `user_preferences` or user profile extension
  - Field: `playback_speed` (float value: 1.0, 1.25, 1.5, etc.)
  - Updated on every speed change
- **Load on App Start**:
  - Fetch user preferences when user logs in
  - Apply saved speed to all subsequent videos
  - Fallback to 1.0x if preference not set
- **Real-time Sync**:
  - Speed changes applied immediately in player
  - API call to persist in background (fire-and-forget pattern)
  - No UI blocking while saving

### 5. Cross-Device Consistency

- Each device maintains its own speed preference
- No need for cross-device sync (yet)
- Future enhancement: sync across devices if needed

### 6. Compatibility

- Speed control must work with:
  - HLS adaptive bitrate (no conflict)
  - DRM protection (Widevine/FairPlay/PlayReady)
  - Captions/subtitles (sync maintained)
  - Audio language switching (no conflict)
  - Resume from where left off (speed applied on resume)

## Acceptance Criteria

- [ ] Speed dropdown/selector visible in player toolbar (web)
- [ ] Speed selector accessible in settings menu (mobile)
- [ ] All 6 preset speeds (1.0x - 2.5x) available
- [ ] Click/tap speed option immediately changes playback rate
- [ ] Current speed highlighted/indicated in UI
- [ ] Toast notification shown on speed change
- [ ] Video continues playing without pause during speed change
- [ ] Audio remains in sync at all speeds (no lip-sync issues)
- [ ] Captions remain synced at all speeds
- [ ] Speed preference saved to database on change
- [ ] Saved preference loaded and applied on next app session
- [ ] Speed applied to all videos after user preference set
- [ ] No custom speeds allowed (only presets)
- [ ] Keyboard shortcuts working (web): `>` and `<` keys
- [ ] Speed control works with DRM-protected videos
- [ ] Speed persists through video pause/resume
- [ ] Mobile safe area respected in settings menu
- [ ] Speed controls work in landscape and portrait (mobile)

## Dependencies

- Mux Player (web): supports `playbackRate` property
- react-native-video (mobile): supports `rate` property
- User authentication context (fetch userId)
- User preferences API (backend)
- Design system components (dropdown/menu)

## Technical Notes

### Web Implementation (React/Next.js)

```javascript
// /packages/ui-components/src/MuxPlayerWeb/SpeedControl.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePlayer } from "./PlayerContext";

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

export const SpeedControl = () => {
  const { user } = useAuth();
  const { playerRef, playbackSpeed, setPlaybackSpeed } = usePlayer();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Load saved preference on component mount
  useEffect(() => {
    const loadPreference = async () => {
      const prefs = await fetch(`/api/users/${user.id}/preferences`).then((r) =>
        r.json()
      );
      if (prefs.playback_speed) {
        setPlaybackSpeed(prefs.playback_speed);
        if (playerRef.current) {
          playerRef.current.playbackRate = prefs.playback_speed;
        }
      }
    };

    if (user?.id) {
      loadPreference();
    }
  }, [user?.id]);

  const handleSpeedChange = async (newSpeed) => {
    // Update player immediately
    setPlaybackSpeed(newSpeed);
    if (playerRef.current) {
      playerRef.current.playbackRate = newSpeed;
    }

    // Show toast
    setToastMessage(`Playback speed: ${newSpeed}x`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1000);

    // Persist to backend (fire-and-forget)
    fetch(`/api/users/${user.id}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playback_speed: newSpeed }),
    }).catch((err) => console.error("Failed to save speed preference:", err));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ">") {
        const currentIndex = SPEED_OPTIONS.indexOf(playbackSpeed);
        if (currentIndex < SPEED_OPTIONS.length - 1) {
          handleSpeedChange(SPEED_OPTIONS[currentIndex + 1]);
        }
      } else if (e.key === "<") {
        const currentIndex = SPEED_OPTIONS.indexOf(playbackSpeed);
        if (currentIndex > 0) {
          handleSpeedChange(SPEED_OPTIONS[currentIndex - 1]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [playbackSpeed]);

  return (
    <div className="speed-control">
      <select
        value={playbackSpeed}
        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
        className="speed-selector"
      >
        {SPEED_OPTIONS.map((speed) => (
          <option key={speed} value={speed}>
            {speed}x
          </option>
        ))}
      </select>

      {showToast && <div className="toast">{toastMessage}</div>}
    </div>
  );
};
```

### Mobile Implementation (React Native)

```javascript
// /packages/ui-components-native/src/VideoPlayer/SpeedControl.tsx
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useAuth } from "@/context/AuthContext";

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

export const SpeedControl = ({ onSpeedChange, currentSpeed }) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      const response = await fetch(`/api/users/${user.id}/preferences`);
      const prefs = await response.json();
      if (prefs.playback_speed) {
        onSpeedChange(prefs.playback_speed);
      }
    };

    if (user?.id) {
      loadPreference();
    }
  }, [user?.id]);

  const handleSpeedChange = async (newSpeed) => {
    // Update player immediately
    onSpeedChange(newSpeed);

    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);

    // Close menu
    setShowMenu(false);

    // Persist to backend
    fetch(`/api/users/${user.id}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playback_speed: newSpeed }),
    }).catch((err) => console.error("Failed to save speed:", err));
  };

  return (
    <View>
      {/* Speed button in player controls */}
      <TouchableOpacity
        onPress={() => setShowMenu(true)}
        style={styles.speedButton}
      >
        <Text style={styles.speedText}>{currentSpeed}x</Text>
      </TouchableOpacity>

      {/* Speed menu modal */}
      <Modal
        visible={showMenu}
        transparent
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Playback Speed</Text>
            {SPEED_OPTIONS.map((speed) => (
              <TouchableOpacity
                key={speed}
                onPress={() => handleSpeedChange(speed)}
                style={[
                  styles.menuItem,
                  currentSpeed === speed && styles.menuItemActive,
                ]}
              >
                <Text style={styles.menuItemText}>{speed}x</Text>
                {currentSpeed === speed && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Toast notification */}
      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Playback speed: {currentSpeed}x</Text>
        </View>
      )}
    </View>
  );
};
```

### Mux Player Speed Property

```javascript
// Mux Player supports playbackRate natively
const playerRef = useRef(null);

const changeSpeed = (newSpeed) => {
  if (playerRef.current) {
    playerRef.current.playbackRate = newSpeed;
    // Mux Player automatically handles:
    // - Audio pitch correction (no chipmunk effect)
    // - Subtitle sync
    // - Buffer adjustment
  }
};
```

### React Native Video Speed

```javascript
import Video from "react-native-video";

const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

<Video
  ref={videoRef}
  source={{ uri: videoUrl }}
  rate={playbackSpeed}
  onProgress={(data) => {
    // Playback position updates correctly at any speed
  }}
/>;
```

### API Endpoint: Save User Preference

```javascript
// Backend: PATCH /api/users/:userId/preferences
app.patch(
  "/api/users/:userId/preferences",
  authenticateToken,
  async (req, res) => {
    const { playback_speed } = req.body;

    // Validate speed
    if (![1.0, 1.25, 1.5, 1.75, 2.0, 2.5].includes(playbackSpeed)) {
      return res.status(400).json({ error: "Invalid speed" });
    }

    // Update user preferences
    await db.query(
      "UPDATE user_preferences SET playback_speed = $1 WHERE user_id = $2",
      [playback_speed, req.params.userId]
    );

    return res.json({ success: true, playback_speed });
  }
);
```

### API Endpoint: Load User Preference

```javascript
// Backend: GET /api/users/:userId/preferences
app.get(
  "/api/users/:userId/preferences",
  authenticateToken,
  async (req, res) => {
    const result = await db.query(
      "SELECT playback_speed FROM user_preferences WHERE user_id = $1",
      [req.params.userId]
    );

    const preferences = result.rows[0] || { playback_speed: 1.0 };
    return res.json(preferences);
  }
);
```

### UI Component Styling (Web)

```css
.speed-control {
  position: relative;
  display: flex;
  align-items: center;
}

.speed-selector {
  padding: 8px 12px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.speed-selector:hover {
  background-color: rgba(0, 0, 0, 0.8);
}

.speed-selector option {
  background-color: #000;
  color: #fff;
}

.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  animation: fadeInOut 1s ease-in-out;
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
```

### UI Component Styling (Mobile)

```javascript
const styles = StyleSheet.create({
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  speedText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: "#2a2a2a",
    paddingBottom: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  menuTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuItemActive: {
    backgroundColor: "rgba(255, 107, 157, 0.2)",
  },
  menuItemText: {
    color: "#fff",
    fontSize: 16,
  },
  checkmark: {
    color: "#FF6B9D",
    fontSize: 18,
    fontWeight: "bold",
  },
  toast: {
    position: "absolute",
    bottom: 100,
    left: "50%",
    transform: [{ translateX: -50 }],
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
  },
});
```

### Testing

**Web**:

1. Open lesson with video
2. Verify speed dropdown visible in player toolbar
3. Click different speed options
4. Verify video plays at correct speed
5. Refresh page; verify speed persists
6. Test keyboard shortcuts (`>` and `<`)
7. Test with captions; verify sync

**Mobile**:

1. Open lesson with video
2. Tap settings icon in player
3. Select different speed options
4. Verify video plays at correct speed
5. Close app and reopen; verify speed persists
6. Test in landscape orientation

### Performance Considerations

- Speed changes should be instant (no buffering)
- No need to rebuffer video when changing speed
- Audio pitch correction handled by codec/browser
- Bandwidth usage unchanged by speed adjustments
