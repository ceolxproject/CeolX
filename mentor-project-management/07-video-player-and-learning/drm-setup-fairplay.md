# DRM Setup: FairPlay (Safari/iOS)

## Description

Configure Apple FairPlay Streaming (FPS) for video content protection on Safari (macOS/tvOS) and iOS/iPadOS devices. FairPlay is Apple's proprietary DRM solution and is REQUIRED for HD (720p+) playback on iOS and Safari. This task has CRITICAL priority due to the Apple FairPlay Streaming Deployment Package application process, which must be initiated in Week 1 of the project.

## Affected Apps/Packages

- `apps/learner-web` (Next.js, Safari on macOS)
- `apps/learner-mobile` (React Native, iOS)
- Mux platform (FairPlay key server integration)
- Apple FairPlay Streaming deployment package

## API Endpoints

- `POST /api/videos/:videoId/fairplay-key` - Request FairPlay key (Mux integration)
- `GET /api/videos/:videoId/encryption-status` - Check DRM protection status
- License server: Mux FairPlay License Server (Apple-certified)

## Requirements

### 1. Apple FairPlay Streaming Deployment Package Application (CRITICAL - WEEK 1)

**This is a blocking requirement and must be completed in Week 1 to enable iOS deployment.**

- **Application Process**:
  1. Register company with Apple Developer Enterprise Account (if not already done)
  2. Create Apple Developer Business Entity (if needed)
  3. Visit Apple FairPlay Streaming Deployment Package portal
  4. Submit application with:
     - Company information and legal entity details
     - Proof of ownership/authorization
     - Description of intended use (educational platform)
     - Technical architecture overview
     - DRM security commitments
  5. Apple reviews application (typically 2-4 weeks)
  6. Upon approval, receive:
     - FairPlay Streaming Certificate (.der file)
     - Private Key (encrypted, distributed via secure channel)
     - Server Certificate (for key server setup)
     - Key Server Private Key

- **Timeline**:
  - Week 1: Submit application to Apple (CRITICAL)
  - Week 3-4: Receive approval and certificates
  - Week 4: Configure Mux with FairPlay certificates
  - Week 5: Test FairPlay playback on iOS

- **Important Notes**:
  - Apple approval is required before FairPlay videos can be distributed to users
  - Cannot be circumvented; no alternative DRM solution for iOS HD content
  - Must have Apple Developer Enterprise Account (minimum)
  - Application review is manual and may require follow-up documentation

### 2. Mux FairPlay Integration

- Purchase Mux DRM add-on with FairPlay support
- Upload FairPlay certificates to Mux dashboard:
  - FairPlay Streaming Certificate
  - Server Certificate
  - Private Key (encrypted)
- Mux provides FairPlay License Server URL: `https://fps.mux.com/`
- License Server is Apple-certified and maintains security compliance

### 3. Video Encoding for FairPlay

- **Encryption Standard**: HLS Encryption (uses AES-128 CBC mode)
  - Different from Widevine's CBCS
  - Uses per-segment encryption keys
  - IV (initialization vector) included in playlist
- **Key Management**:
  - Mux manages FairPlay key generation and rotation
  - Keys stored in Mux's secure key server
  - Keys encrypted for transmission to iOS/Safari
- **Codec Support**:
  - H.264 (primary, required for iOS compatibility)
  - H.265/HEVC (optional, for newer devices)
  - Dual-codec output recommended

### 4. Certificate Setup & Management

- **FairPlay Streaming Certificate** (.der file):
  - Identifies your app/service to Apple's DRM ecosystem
  - Extracted from X.509 certificate provided by Apple
  - Embedded in player app (iOS) or sent with license request (web)
- **Server Certificate**:
  - Used by license server to decrypt FairPlay key responses
  - Kept private on license server (Mux)
  - Never exposed to client
- **Private Key Management**:
  - Encrypted by Apple with company's passphrase
  - Decrypt using Apple-provided decryption tool
  - Store in Mux's secure vault (not in source code)

### 5. License Server & Key Delivery

- **Mux FairPlay License Server**:
  - Apple-certified key server
  - Compliant with FairPlay Streaming specification
  - Handles key request/response protocol
- **Key Request Flow** (iOS/Safari):
  1. Player detects encrypted HLS stream
  2. Extracts license request from playlist
  3. Generates FairPlay SPC (Server Playback Context)
  4. Sends SPC to license server
  5. License server returns CK (Content Key) encrypted for device
  6. Player decrypts CK using device-specific key
- **Key Expiration**:
  - Typically 24-hour rolling window
  - Keys refresh automatically on playback resume
  - No user action required

### 6. Domain & Entitlement Validation

- **Bundle ID Validation** (iOS):
  - FairPlay License Server validates requesting app's bundle ID
  - Only apps with correct bundle ID receive keys
  - Configure in Mux: `com.example.learner` (production)
  - Configure in Mux: `com.example.learner.staging` (staging)
- **Domain Validation** (Web/Safari):
  - Add to FairPlay policy: `learner.example.com`
  - Add to FairPlay policy: `learner-staging.example.com`
  - Web requests from other domains receive license denial

### 7. Content Protection on iOS

- **Screen Recording Prevention**:
  - FairPlay L1 (hardware TEE on modern iPhones) prevents screen recording
  - `ReplayKit` (Apple's screen recording framework) returns black screen during playback
  - OS-level screenshot during playback not possible with DRM content
- **Airplay Restrictions**:
  - FairPlay supports Airplay mirroring to Apple TV
  - Requires HDCP handshake with destination (Apple TV)
  - Regular mirroring (non-Airplay) blocked for DRM content
- **Passcode/Biometric**:
  - Optional: Require Face ID/Touch ID before playing restricted content
  - Recommended for premium/sensitive courses

## Acceptance Criteria

- [ ] Apple FairPlay Streaming Deployment Package application submitted in Week 1
- [ ] FairPlay certificates received from Apple
- [ ] Mux DRM add-on with FairPlay support purchased/enabled
- [ ] FairPlay certificates uploaded to Mux dashboard
- [ ] Mux FairPlay License Server URL configured in players
- [ ] Videos encoded with HLS encryption (AES-128)
- [ ] HLS manifest includes license server URI
- [ ] License requests successful on Safari (macOS)
- [ ] License requests successful on iOS (iPhone/iPad)
- [ ] FairPlay keys decrypted and playback starts
- [ ] Bundle ID validation working (iOS app)
- [ ] Domain validation working (web)
- [ ] Signed playback URL token validated in license request
- [ ] HD (720p+) content requires FairPlay (cannot play unencrypted on iOS)
- [ ] Screen recording returns black screen during playback
- [ ] License expiration respected (24-hour rolling)
- [ ] Key rotation works seamlessly without interrupting playback
- [ ] Error messages clear if FairPlay unavailable or keys denied

## Dependencies

- Apple FairPlay Streaming Deployment Package (from Apple)
- Mux DRM add-on with FairPlay support
- `@mux/mux-player-react` (web) - handles FairPlay automatically
- `react-native-video` with FairPlay support (iOS)
- Signed playback URL generation (backend)
- AVPlayer framework (iOS native)

## Technical Notes

### Apple FairPlay Streaming Application Portal

- **URL**: https://fps.developer.apple.com/
- **Requirements**:
  - Apple Developer Enterprise Account
  - Legal entity documentation
  - DRM security commitment
  - Technical architecture document
- **Timeline**: 2-4 weeks for approval
- **Renewal**: Certificates valid for 1 year, must reapply annually

### Mux FairPlay Configuration Example

```python
# Pseudo-code: Configure FairPlay in Mux via API
import requests
import base64

# Read FairPlay certificate
with open('fairplay_certificate.der', 'rb') as f:
    cert_data = base64.b64encode(f.read()).decode()

# Update video policy with FairPlay
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
                'type': 'fairplay',
                'certificate': cert_data
            }
        }
    }
)
```

### Web Player (Safari) Setup

```javascript
import MuxPlayer from "@mux/mux-player-react";

export const SafariVideoPlayer = ({ videoId, userId }) => {
  const [playbackUrl, setPlaybackUrl] = useState(null);

  useEffect(() => {
    // Generate signed URL with FairPlay license URL embedded
    fetchSignedPlaybackUrl(videoId, userId).then(setPlaybackUrl);
  }, [videoId, userId]);

  return (
    <MuxPlayer
      playbackId={playbackUrl}
      streamType="on-demand"
      primaryColor="#FF6B9D"
      // Mux Player automatically:
      // 1. Detects FairPlay requirement in HLS manifest
      // 2. Extracts license server URI
      // 3. Generates SPC (Server Playback Context)
      // 4. Sends to Mux FairPlay License Server
      // 5. Receives CK (Content Key) encrypted for device
      // 6. Decrypts and plays video
    />
  );
};
```

### iOS Player (React Native) Setup

```javascript
import Video from "react-native-video";
import { Platform } from "react-native";

export const IOSVideoPlayer = ({ videoId, userId, lessonId }) => {
  const [playbackUrl, setPlaybackUrl] = useState(null);

  useEffect(() => {
    fetchSignedPlaybackUrl(videoId, userId).then(setPlaybackUrl);
  }, [videoId, userId]);

  return (
    <Video
      source={{
        uri: playbackUrl, // HLS manifest with FairPlay encryption
        type: "m3u8",
      }}
      style={styles.video}
      controls={true}
      resizeMode="contain"
      // On iOS, AVPlayer automatically:
      // 1. Parses HLS manifest
      // 2. Extracts EXT-X-KEY tag (license server URI)
      // 3. Generates SPC
      // 4. Requests key from license server
      // 5. Decrypts video with received key
      useNativeControls
      onProgress={(data) => {
        trackProgress(lessonId, data.currentTime);
      }}
      onError={(error) => {
        console.error("FairPlay error:", error);
        // Handle license errors, network issues, etc.
      }}
      progressUpdateInterval={5000}
    />
  );
};
```

### FairPlay License Request/Response

```
# HLS Manifest with FairPlay encryption
#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://licenses.mux.com/fairplay/...",KEYFORMAT="com.apple.streamingkeydelivery",KEYFORMATVERSIONS="1"

#EXTINF:6.006,
segment-0-v1-a1.ts
#EXTINF:6.006,
segment-1-v1-a1.ts
```

**Flow**:

1. Player sees `#EXT-X-KEY` tag with FairPlay `METHOD=SAMPLE-AES`
2. Player generates SPC (Server Playback Context) containing:
   - License challenge from player certificate
   - Asset ID (video ID)
   - Unique per-device identifier
3. SPC sent to license server (via URI in manifest)
4. License server validates:
   - Player certificate authenticity
   - Asset ID accessibility
   - Bundle ID (iOS) or domain (web)
   - Signed token
5. License server returns CK (Content Key) encrypted with device-specific key
6. Player decrypts CK using device TEE
7. CK used to decrypt SAMPLE-AES encrypted video segments

### Bundle ID Configuration (iOS)

In Mux dashboard or API:

```json
{
  "playback_policy": {
    "type": "signed",
    "drm": {
      "type": "fairplay",
      "bundle_ids": ["com.example.learner", "com.example.learner.staging"]
    }
  }
}
```

Only apps with these exact bundle IDs receive FairPlay keys.

### Domain Configuration (Web)

```json
{
  "playback_policy": {
    "type": "signed",
    "drm": {
      "type": "fairplay",
      "allowed_origins": [
        "https://learner.example.com",
        "https://learner-staging.example.com"
      ]
    }
  }
}
```

License requests from other origins rejected.

### Screen Recording Prevention

iOS FairPlay L1 (modern devices):

```swift
// AVPlayer automatically protects content
// No explicit developer action needed
// ReplayKit + screen recording frameworks
// return black/transparent frames during playback
```

### Airplay Compatibility

FairPlay allows Airplay to Apple TV (requires HDCP):

- Regular mirroring: blocked
- Airplay mirroring to Apple TV with HDCP: allowed
- Airplay to non-HDCP devices: blocked/downgraded

### Testing FairPlay

**Safari (macOS) Testing**:

1. Open browser developer tools
2. Play video
3. Check Network tab for license requests to Mux FairPlay server
4. Verify license response received
5. Playback should start without errors

**iOS Testing**:

1. Install app on device
2. Open lesson with FairPlay-protected video
3. Check Xcode Console for license request logs
4. Verify playback starts
5. Try screen recording: should show black screen
6. Try Airplay mirroring to Apple TV with HDCP: should work

### Certificate Renewal

- FairPlay certificates valid for 1 year
- Must reapply to Apple 30 days before expiration
- Mux can update certificates without downtime
- Old certificates supported during transition period

### Fallback Behavior

- If FairPlay unavailable on iOS: show "HD content requires FairPlay" message
- If license server unreachable: retry with exponential backoff
- If bundle ID/domain mismatch: license denied, playback blocked
- If certificate expired: update in Mux, refresh player

### Monitoring & Debugging

- Mux Analytics: track FairPlay license requests, errors, device types
- iOS Xcode Console: search for "AVPlayer" or "FairPlay" logs
- Safari DevTools: Network tab shows license requests
- Check key rotation working smoothly (no playback interruption)

### Cost Considerations

- Apple FairPlay Deployment Package: free (but requires Enterprise Account)
- Mux DRM add-on with FairPlay: typically $0.05-0.15 per view
- Apple developer account renewal: $99/year (regular) or higher (enterprise)
