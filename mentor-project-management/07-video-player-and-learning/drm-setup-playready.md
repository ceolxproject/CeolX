# DRM Setup: PlayReady (Edge/Windows)

## Description

Configure Microsoft PlayReady Digital Rights Management for video content protection on Microsoft Edge (desktop) and Windows-based devices. PlayReady is mandatory for HD (720p+) playback on Microsoft Edge and provides robust content protection with output protection and screen capture prevention. PlayReady is less critical than Widevine and FairPlay but recommended for comprehensive Windows/Edge support.

## Affected Apps/Packages

- `apps/learner-web` (Next.js, Microsoft Edge on Windows)
- Mux platform (PlayReady key server integration)
- License server: Mux PlayReady License Server

## API Endpoints

- `POST /api/videos/:videoId/playready-license` - License server endpoint (Mux)
- `GET /api/videos/:videoId/encryption-status` - Check DRM protection status

## Requirements

### 1. Mux PlayReady Configuration

- Purchase Mux DRM add-on with PlayReady support
- Mux automatically provides PlayReady License Server: `https://playready.mux.com/`
- No separate certificate application required (unlike FairPlay)
- PlayReady account ID provided by Mux (typically `0x00000000` for reference)

### 2. Video Encoding & Encryption

- **Encryption Standard**: PlayReady Standard Encryption (PSE)
  - AES-CBC mode with per-segment or per-sample encryption
  - Compatible with DASH and Smooth Streaming protocols
  - HLS also supported via PlayReady DASH alternate
- **Key Management**:
  - Mux manages key generation and rotation
  - Keys stored securely on Mux servers
  - Keys encrypted for transmission to client
- **Codec Support**:
  - H.264 (primary, required for Edge compatibility)
  - H.265/HEVC (optional, for newer devices)

### 3. License Server Integration

- **Mux PlayReady License Server**:
  - Handles license requests from Edge/Windows devices
  - Validates signed playback URLs
  - Returns encrypted content keys
- **License Request Flow**:
  1. Player detects encrypted content
  2. Generates PlayReady challenge
  3. Sends to license server with authentication token
  4. License server validates token and domain
  5. Returns encrypted keys
  6. Player decrypts keys and begins playback
- **License Expiration**: 24-hour rolling window

### 4. Domain & Content ID Validation

- **Domain Restriction**:
  - Configure allowed domains in Mux PlayReady policy
  - Add: `learner.example.com` (production)
  - Add: `learner-staging.example.com` (staging)
  - License requests from other domains rejected
- **Content ID**:
  - Each video asset has unique content ID
  - License server validates content access per user
  - Mux passes content ID in license response

### 5. Output Protection & Screen Capture Prevention

- **Output Protection**:
  - PlayReady supports HDCP 2.2 negotiation
  - Require HDCP for HD (720p+) content
  - Fall back to SD (360p) if HDCP unavailable
  - Microsoft Edge handles negotiation automatically
- **Screen Capture Prevention**:
  - Protected Media Path (PMP) prevents screen capture
  - Windows restricts OS screenshot during DRM playback
  - Recording software cannot capture encrypted streams
  - Enforcement depends on device Driver Compliance Level

### 6. Browser Compatibility

- **Microsoft Edge**: Full PlayReady support with DASH/HLS
  - Uses EME (Encrypted Media Extensions) API
  - Automatic DRM capability detection
- **Chrome**: PlayReady NOT supported (uses Widevine)
- **Safari**: PlayReady NOT supported (uses FairPlay)
- **Firefox**: Limited/no PlayReady support

### 7. Device Level & Robustness Rules

- **Device Compliance Levels**:
  - SL150: Maximum playback (all resolutions)
  - SL2000: Most Edge devices
  - SL3000: Advanced HDCP 2.2 support
- **Robustness Rules**:
  - Set via Mux: defines minimum device security level required
  - Recommend SL2000+ for HD content
  - SL150 for basic SD content

## Acceptance Criteria

- [ ] Mux DRM add-on with PlayReady support enabled
- [ ] Mux PlayReady License Server URL configured
- [ ] Videos encoded with PlayReady encryption
- [ ] License requests successful on Microsoft Edge (Windows 10+)
- [ ] License responses provide encrypted content keys
- [ ] Playback starts without license errors
- [ ] Domain allowlist configured (production + staging)
- [ ] License requests from other domains rejected
- [ ] Signed playback URL token validated
- [ ] HDCP negotiation attempted (output protection)
- [ ] HD content gracefully downgrades if HDCP unavailable
- [ ] Screen recording returns black screen during playback
- [ ] License expiration respected (24-hour rolling)
- [ ] Key rotation seamless without playback interruption
- [ ] Error handling for license denial, network failures
- [ ] Analytics tracking license requests and errors

## Dependencies

- Mux platform with PlayReady DRM add-on
- `@mux/mux-player-react` (web) - handles PlayReady via EME
- Signed playback URL generation (backend)
- Microsoft Edge browser (for testing)

## Technical Notes

### Mux PlayReady Configuration

PlayReady doesn't require a separate deployment package application like FairPlay. Configuration is simpler:

```python
# Pseudo-code: Enable PlayReady in Mux video policy
import requests

response = requests.post(
    'https://api.mux.com/video/v1/assets',
    auth=(MUX_ACCESS_TOKEN, MUX_SECRET_KEY),
    json={
        'input': {
            'url': 's3://mentor-videos/lesson-01.mp4'
        },
        'playback_policy': {
            'type': 'signed',
            'require_signed_urls': True,
            'drm': {
                'type': 'playready',
                'account_id': '0x00000000'  # Reference ID from Mux
            }
        }
    }
)
```

### Web Player Setup

```javascript
import MuxPlayer from "@mux/mux-player-react";

export const EdgeVideoPlayer = ({ videoId, userId }) => {
  const [playbackUrl, setPlaybackUrl] = useState(null);

  useEffect(() => {
    // Generate signed URL with PlayReady license URL
    fetchSignedPlaybackUrl(videoId, userId).then(setPlaybackUrl);
  }, [videoId, userId]);

  return (
    <MuxPlayer
      playbackId={playbackUrl}
      streamType="on-demand"
      primaryColor="#FF6B9D"
      // Mux Player automatically:
      // 1. Detects PlayReady requirement
      // 2. Uses EME (Encrypted Media Extensions) API
      // 3. Generates license request
      // 4. Sends to Mux PlayReady License Server
      // 5. Receives encrypted content keys
      // 6. Decrypts and plays video
    />
  );
};
```

### EME Capability Detection

```javascript
// Check if device supports PlayReady (Edge/Windows)
const checkPlayReadySupport = async () => {
  const videoElement = document.createElement("video");
  const config = [
    {
      initDataTypes: ["cenc"],
      videoCapabilities: [
        {
          contentType: 'video/mp4; codecs="avc1.640028"',
        },
      ],
      keySystemConfiguration: {
        uniqueSessionsRequired: false,
        persistentStateRequired: false,
        distinctiveIdentifierRequired: false,
      },
    },
  ];

  try {
    const keySystemAccess = await navigator.requestMediaKeySystemAccess(
      "com.microsoft.playready",
      config,
    );
    return true; // PlayReady supported
  } catch (e) {
    return false; // PlayReady not supported
  }
};
```

### Encrypted Media Extensions (EME) Flow

```
1. Player detects encrypted video in DASH/HLS manifest
2. Browser queries: navigator.requestMediaKeySystemAccess('com.microsoft.playready')
3. If PlayReady available:
   a. Create MediaKeys for PlayReady
   b. Attach MediaKeys to video element
   c. Listen for 'encrypted' event
4. On encrypted event:
   a. Generate license request challenge
   b. Send challenge to license server
   c. Receive encrypted license (content keys + rights)
   d. Update session with license
5. Browser decrypts license using device key
6. Content keys now available for playback
7. Video decrypted and played
```

### DASH Manifest Example (PlayReady)

```xml
<?xml version="1.0" encoding="utf-8"?>
<MPD>
  <Period>
    <AdaptationSet>
      <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011">
        <PlayReady>
          <pro>...</pro> <!-- PlayReady header -->
        </PlayReady>
      </ContentProtection>
      <Representation>
        <BaseURL>segment.mp4</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

### Domain Allowlist Configuration

Configure in Mux PlayReady policy:

```json
{
  "playback_policy": {
    "type": "signed",
    "drm": {
      "type": "playready",
      "allowed_origins": [
        "https://learner.example.com",
        "https://learner-staging.example.com"
      ]
    }
  }
}
```

License server validates origin header on incoming requests.

### HDCP Output Protection

```javascript
// Monitor for HDCP status changes
const videoElement = document.querySelector("video");

videoElement.addEventListener("hdcpChange", (event) => {
  console.log("HDCP status:", event.hdcpVersion); // '1.4', '2.0', '2.2', etc.

  if (!event.hdcpVersion && currentQuality > 720) {
    console.log("HDCP lost, downgrading quality");
    // Trigger quality downgrade
  }
});
```

### Protected Media Path (PMP)

PlayReady on Windows uses Protected Media Path:

- Media Playback Engine (MFE) runs in protected process
- Content decryption in kernel-level protected resource
- Screen capture APIs return black frames during playback
- Windows Driver Model enforces compliance

### Robustness Rules Configuration

```json
{
  "playback_policy": {
    "drm": {
      "type": "playready",
      "robustness_level": "SL2000"
    }
  }
}
```

Robustness levels:

- **SL150**: Minimum (older/non-compliant devices)
- **SL2000**: Standard (most Edge devices, Windows 10+)
- **SL3000**: Advanced (HDCP 2.2, newest devices)

### License Request/Response

```
# License Request (to Mux PlayReady License Server)
POST /license
Content-Type: application/vnd.ms-playready.initiator+xml

<?xml version="1.0" encoding="utf-8"?>
<PlayReadyInitiator xmlns="http://schemas.microsoft.com/PlayReady/2009/03/PlayReadyInitiator">
  <LicenseChallenge>
    <Challenge>Base64EncodedChallenge</Challenge>
    ...
  </LicenseChallenge>
</PlayReadyInitiator>

# License Response (from license server)
<?xml version="1.0"?>
<PlayReadyResponse xmlns="http://schemas.microsoft.com/PlayReady/2009/03/PlayReadyResponse">
  <License>Base64EncodedLicense</License>
</PlayReadyResponse>
```

### Error Handling

```javascript
videoElement.addEventListener("error", (event) => {
  const error = event.target.error;

  switch (error.code) {
    case error.MEDIA_ERR_NETWORK:
      console.error("Network error: license server unreachable");
      break;
    case error.MEDIA_ERR_UNKNOWN:
      console.error("Unknown error: likely DRM/license issue");
      break;
  }

  // Show user-friendly message
  showErrorMessage("Unable to play video. Please try again.");
});
```

### Testing PlayReady

1. Open Microsoft Edge on Windows 10/11
2. Navigate to lesson with PlayReady-protected video
3. Open Developer Tools → Network tab
4. Search for requests to `playready.mux.com`
5. Verify license request and response
6. Check video plays without errors
7. Try to screenshot during playback: should be black
8. Monitor console for any DRM-related warnings

### Browser Compatibility Table

| Browser | Widevine | FairPlay | PlayReady |
| ------- | -------- | -------- | --------- |
| Chrome  | ✓        | ✗        | ✗         |
| Edge    | ✗        | ✗        | ✓         |
| Safari  | ✗        | ✓        | ✗         |
| Firefox | ✗        | ✗        | ✗         |

### Monitoring & Analytics

Track in Mux Analytics:

- PlayReady license requests per day
- Successful vs. failed license attempts
- Device compliance levels
- HDCP availability status
- Error types and frequencies

### Cost Considerations

- Mux DRM add-on with PlayReady: typically $0.05-0.15 per view
- Lower cost than Widevine/FairPlay due to simpler infrastructure
- No separate certification/approval needed (unlike FairPlay)

### Fallback Strategy

If PlayReady unavailable on Edge:

1. Show "HD content requires PlayReady" message
2. Offer SD (360p) unprotected stream as alternative
3. Log error for debugging
4. Suggest browser update or troubleshooting steps
