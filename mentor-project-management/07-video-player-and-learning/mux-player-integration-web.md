# Mux Player Integration - Web (Next.js)

## Description

Integrate Mux Player React component in the Learner Web application to provide video playback functionality with HLS adaptive bitrate streaming, custom branding, keyboard shortcuts, and fullscreen support. This is the primary video playback interface for the web platform.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `packages/ui-components` (custom player wrapper)
- Mux Player library: `@mux/mux-player-react`

## API Endpoints

- `POST /api/videos/:videoId/playback-token` - Generate time-limited, user-specific Mux signed playback URL
- `GET /api/videos/:videoId` - Fetch video metadata (title, duration, thumbnail, HLS URL)
- `POST /api/lessons/:lessonId/progress` - Track playback progress (triggered by player events)

## Requirements

### 1. Mux Player Setup

- Install `@mux/mux-player-react@latest` from npm
- Set up Mux account with Mux Player license tier
- Configure Mux Token ID and Token Secret in environment variables
- Support HLS adaptive bitrate (360p, 720p, 1080p streams)
- Implement signed playback URLs with 1-hour expiration (user + IP specific)

### 2. Player Features

- **Playback Controls**: play/pause, seek, volume control, fullscreen
- **Adaptive Bitrate**: automatic quality selection with manual override
- **Keyboard Shortcuts**:
  - Space: play/pause
  - Left/Right arrows: seek ±10 seconds
  - M: mute/unmute
  - F: fullscreen
  - J/L: rewind/forward 10 seconds
  - K: pause immediately
  - Numbers 0-9: jump to 0-90% of video
- **Player Customization**: brand colors from design system, custom logo/watermark optional
- **Thumbnails**: progress bar hover thumbnails (sprite sheet from Mux)
- **Chapter Markers**: display module/section markers on progress bar (if applicable)

### 3. Responsive Design

- 100% width in video container
- Maintain 16:9 aspect ratio or video's native ratio
- Work on desktop (1920x1080 down to 1280x720)
- Tablet support (iPad landscape/portrait)
- Mobile support (fallback to mobile player UI)

### 4. Integration Points

- Embed in lesson detail page within video container
- Display video title and instructor info above player
- Show progress bar with watched segments
- Action buttons below player: notes, transcript, comments, assignments
- Side panel: transcript viewer (synced to playback)

## Acceptance Criteria

- [ ] Mux Player renders without errors in Next.js app
- [ ] HLS stream plays smoothly at 360p/720p/1080p quality levels
- [ ] Adaptive bitrate switching works based on network conditions
- [ ] Signed playback URLs generated and validated on backend
- [ ] All keyboard shortcuts function correctly
- [ ] Fullscreen mode works on desktop and tablet
- [ ] Player customization (colors, logo) applied from design system
- [ ] Progress bar shows watched segments (blue) and unwatched (gray)
- [ ] Player maintains aspect ratio on all screen sizes
- [ ] Playback pause event triggers progress tracking API call
- [ ] Error handling for network failures and invalid tokens
- [ ] Mux analytics/tracking captures playback events for dashboard

## Dependencies

- `@mux/mux-player-react` (Mux Player component)
- `@mux/mux-player/dist/mux-player.css` (player styles)
- Design system tokens (colors, typography, spacing)
- Progress tracking API (lesson progress endpoint)
- Mux Token generation service (backend)

## Technical Notes

### Signed Playback URL Generation

```javascript
// Backend: Generate signed URL with user context
const generateMuxPlaybackToken = async (videoId, userId) => {
  const token = jwt.sign(
    {
      sub: userId,
      aud: "v",
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      allow_regional_ingest: true,
      allow_regional_playback: true,
    },
    MUX_TOKEN_SECRET,
    { algorithm: "HS256" }
  );
  return `${videoId}?token=${token}`;
};

// Frontend: Use signed URL in player
<MuxPlayer
  playbackId={playbackIdWithToken}
  streamType="on-demand"
  primaryColor="#FF6B9D" // Mentor brand color
/>;
```

### Custom Player Wrapper Component

Create `/packages/ui-components/src/MuxPlayerWeb/index.tsx`:

- Accept props: videoId, onProgress, onEnded, initialTime, speed
- Handle signed URL retrieval on mount
- Expose player methods: play(), pause(), seek(), getTime()
- Emit events: onTimeUpdate, onEnded, onError, onQualityChange
- Apply custom styling from design system

### HLS Adaptive Bitrate

Mux automatically delivers HLS with multiple variants:

- Baseline: 360p (800 kbps video + 128 kbps audio)
- Standard: 720p (2500 kbps video + 128 kbps audio)
- High: 1080p (5000 kbps video + 128 kbps audio)
- Player automatically selects based on bandwidth; user can override

### Keyboard Shortcuts Implementation

Implement in custom wrapper component:

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.target.tagName === "INPUT") return; // Ignore if typing

    switch (e.code) {
      case "Space":
        e.preventDefault();
        player.paused ? player.play() : player.pause();
        break;
      case "ArrowLeft":
        player.currentTime -= 10;
        break;
      // ... other shortcuts
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [player]);
```

### Error Handling

- Invalid token: show "Video access expired" message with refresh option
- Network error: show retry button with exponential backoff
- Video not found (404): display user-friendly error message
- DRM protection: handle license server errors gracefully

### Analytics Integration

Track events via Mux SDK:

- `timeupdate` event: throttled to 5-second intervals for progress tracking
- `play` / `pause` events
- `ended` event
- `qualitychange` event: monitor bitrate selection
- `error` event: catch playback failures

### Browser Compatibility

- Chrome/Edge: Widevine DRM ready
- Safari: FairPlay DRM (handled separately in DRM task)
- Firefox: HLS playback without DRM
- Mobile Safari: HLS via video tag
