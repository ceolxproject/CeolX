# DRM Setup: Widevine (Chrome/Android)

## Description

Configure Widevine Digital Rights Management (DRM) protection for video content on Chrome (desktop/laptop) and Android devices. Widevine provides robust content protection with MPEG Common Encryption (CBCS), screen capture prevention, and HDCP output protection. All Mux video content must be encrypted with Widevine for content security.

## Affected Apps/Packages

- `apps/learner-web` (Next.js, Chrome/Edge)
- `apps/learner-mobile` (React Native, Android)
- Mux platform (video encoding/delivery)
- License server: integrated with Mux or custom implementation

## API Endpoints

- `POST /api/videos/:videoId/drm-license` - License server endpoint (proxy to Mux License Server)
- `GET /api/videos/:videoId/encryption-status` - Check if video is DRM-protected (admin/debugging)
- `POST /api/drm/widevine/challenge` - Generate Widevine challenge (if custom license server)

## Requirements

### 1. Mux DRM Add-on Configuration

- Purchase/enable Mux DRM add-on for all video assets
- Mux automatically encodes videos with Widevine encryption
- Mux provides License Server URL: `https://licenses.mux.com/`
- Configuration stored in Mux dashboard or via API

### 2. Video Encoding & Encryption

- **Encryption Standard**: MPEG Common Encryption - Clearkey (CBCS)
  - Replaces older CENC (Common Encryption) with better performance
  - Supports variable-length protection (per-sample or per-frame)
  - Compatible with HLS v6+ and DASH
- **Key Rotation**: Automatic per Mux's security policy (typically per asset)
- **Content Key Server**: Mux manages key distribution
- **Codec Support**:
  - H.264 (older devices)
  - H.265/HEVC (if targeting modern devices)
  - VP9 (for better compression)

### 3. License Server Integration

- **Mux License Server URL**: `https://licenses.mux.com/`
- Mux Player automatically routes license requests to license server
- License requests include:
  - Device ID (Widevine client)
  - Challenge (device-generated proof)
  - Proof of authorization (from signed playback URL)
- License responses include:
  - Content keys (encrypted for specific device)
  - License expiration (typically 24 hours)
  - Key expiration policy

### 4. Output Protection & Screen Capture Prevention

- **HDCP Output Protection**:
  - Require HDCP 1.4+ for HD (720p+) content
  - Set via Mux Video Policy during encoding
  - Players must negotiate HDCP handshake with monitor/TV
  - If HDCP unavailable, downgrade to SD (360p) or block playback
- **Screen Capture Prevention**:
  - Enable Widevine L3 (on unencrypted devices) or L1 (hardware TEE)
  - Disable OS-level screenshot during playback
  - Block recording software (screen capture tools)
  - Note: Widevine L3 (software) cannot prevent determined capture; L1 (hardware) much more secure
- **Compositor Security**:
  - Disable OS compositor bypass during playback
  - Force all rendering through GPU DRM path (on supported devices)

### 5. Domain Restriction & Allowlist

- **Mux Domain Allowlist**:
  - Configure in Mux Dashboard → Video Policy → Allowed Domains
  - Add production domain: `learner.example.com`
  - Add staging domain: `learner-staging.example.com`
  - Wildcard not recommended for security
- **License Server Token Validation**:
  - License requests include signed playback URL token
  - License server validates token includes current domain
  - Licenses issued only for requests from allowlisted domains
  - Blocks embedding on unauthorized third-party sites

### 6. Content Policy Configuration

- **Widevine Level**:
  - Prefer L1 (hardware TEE) where available
  - Fall back to L3 (software) on older devices
  - No fallback to unprotected playback
- **Key Expiration**: 24-hour rolling expiration
- **Device Count**: Limit concurrent licenses per user account (optional, for premium tiers)

## Acceptance Criteria

- [ ] Mux DRM add-on enabled for all video assets
- [ ] Mux License Server URL configured in player
- [ ] Video encoding uses CBCS encryption standard
- [ ] License requests successfully reach Mux License Server
- [ ] License responses decrypt content keys on client
- [ ] Playback starts without license errors on Chrome
- [ ] Playback starts without license errors on Android
- [ ] HDCP negotiation attempted (browser console shows status)
- [ ] HD content blocked if HDCP unavailable on unsupported devices
- [ ] Screen capture tools cannot record DRM-protected video
- [ ] Allowed domains configured in Mux (production + staging)
- [ ] License requests rejected from non-allowlisted domains
- [ ] Signed playback URL token validated in license request
- [ ] License server returns correctly encrypted keys per device
- [ ] Key expiration policy enforced (24-hour rolling window)
- [ ] HDCP/L1 preference logged for analytics (device security levels)

## Dependencies

- Mux platform with DRM add-on enabled
- `@mux/mux-player-react` (web) - handles Widevine automatically
- `react-native-video` (mobile) - supports Widevine on Android
- Signed playback URL generation (backend)
- License server integration (Mux or custom proxy)

## Technical Notes

### Mux Video Policy Configuration

Configure in Mux Dashboard or via API:

```bash
# Example: Enable DRM for video asset (via Mux API)
curl -X POST https://api.mux.com/video/v1/assets \
  -u "$MUX_ACCESS_TOKEN:$MUX_SECRET_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "url": "s3://mentor-videos/lesson-01.mp4"
    },
    "playback_policy": {
      "type": "signed",
      "require_signed_urls": true,
      "drm": {
        "type": "widevine"
      }
    },
    "output": [{
      "format": "mp4",
      "width": 1920,
      "height": 1080
    }]
  }'
```

### Web Player Configuration

Mux Player automatically handles Widevine:

```javascript
// In web player component
<MuxPlayer
  playbackId={signedPlaybackUrl}
  streamType="on-demand"
  primaryColor="#FF6B9D"
  // Mux Player automatically:
  // 1. Detects DRM requirement
  // 2. Generates license request
  // 3. Sends to Mux License Server
  // 4. Decrypts content keys
/>
```

### Android (React Native) Configuration

Ensure DRM support:

```javascript
import Video from "react-native-video";

<Video
  source={{
    uri: signedMuxUrl, // e.g., "https://stream.mux.com/ABC123?token=..."
    drm: {
      type: "widevine",
      licenseServer: "https://licenses.mux.com/",
    },
  }}
  // react-native-video automatically:
  // 1. Initializes MediaDrm for Widevine
  // 2. Generates license request
  // 3. Validates certificate
  // 4. Decrypts and plays content
/>;
```

### HDCP Output Protection

```javascript
// Browser API to check HDCP status (limited support)
navigator.mediaSession?.metadata; // Check if protected content

// Mux Player handles HDCP negotiation automatically
// Monitor for quality downgrade if HDCP fails:
<MuxPlayer
  onQualityChange={(quality) => {
    if (quality.height < 720) {
      console.log("Quality downgraded: HDCP unavailable or device unsupported");
    }
  }}
/>;
```

### Screen Capture Prevention

On desktop (web):

- Widevine L3 runs in browser sandbox; screenshot captures encrypted surface
- OS screenshot tools capture black/blank screen during playback
- Hardware-accelerated rendering prevents bypass

On Android:

- Widevine L1 (if device has TEE) uses secure rendering pipeline
- Screenshot API returns blank if DRM content in foreground
- `MediaProjection` API blocked for screen recording during DRM playback

### Domain Allowlist Configuration

Configure in Mux Dashboard:

1. Navigate to Video Policy settings
2. Under "Allowed Domains", add:
   - `learner.example.com` (production)
   - `learner-staging.example.com` (staging)
   - `localhost:3000` (development, only for testing)
3. Save configuration

License server validates incoming requests:

```python
# Conceptual: Mux License Server validation
def validate_license_request(request):
    token = extract_token_from_request(request)
    claims = verify_jwt_token(token, MUX_TOKEN_SECRET)

    # Check if request comes from allowed domain
    origin_domain = extract_domain_from_request(request)
    token_domain = claims.get('domain')

    if origin_domain not in ALLOWED_DOMAINS:
        return error_response('Unauthorized domain')

    if token_domain and token_domain != origin_domain:
        return error_response('Domain mismatch')

    return license_response(content_keys)
```

### Widevine Security Levels

- **L1 (Highest Security)**: Hardware TEE (Trusted Execution Environment)
  - Content decryption happens inside secure processor
  - Strongest protection against screen capture
  - Available on flagship Android devices
- **L2 (Medium Security)**: Hardware video crypto, decryption in main processor
  - Less common, intermediate protection
- **L3 (Software)**: Software decryption in browser/app
  - Weaker protection; determined users can capture
  - Works on all devices with Widevine installed
  - Acceptable for non-premium content

Mux Player defaults to highest available security level on device.

### License Request/Response Flow

```
1. Browser/App detects encrypted content in HLS manifest
2. Device generates Widevine challenge:
   - Includes device certificate
   - Includes content ID
   - Signed with device key
3. Player sends challenge to license server:
   POST https://licenses.mux.com/
   Body: {
     challenge: <base64-encoded-challenge>,
     contentId: <video-id>,
     playbackId: <signed-url-token>
   }
4. License server:
   - Validates token signature
   - Checks allowed domains
   - Verifies user permissions
   - Generates license with content keys
5. License response:
   {
     licenses: [
       {
         key: <encrypted-for-device>,
         keyId: <key-id>,
         expirationTime: <24-hours>,
         protectionScheme: 'cbcs'
       }
     ]
   }
6. Device stores license locally (up to 24 hours)
7. Playback resumes with decrypted keys
```

### Monitoring & Debugging

- Chrome DevTools → Media tab: view DRM license requests/responses
- Android Logcat: search for "MediaDrm" to see license negotiations
- Mux Analytics Dashboard: track DRM license requests, errors, security levels
- Backend logs: validate domain restrictions are working

### Fallback Behavior

- If DRM unavailable: block playback with error message
- If license server unreachable: retry with exponential backoff
- If user not authorized: return 403 from license server
- If device time out of sync: request time synchronization before allowing license

### Cost Considerations

- Mux DRM add-on typically $0.05-0.15 per video viewed
- License server requests counted as part of DRM add-on usage
- Monitor bandwidth usage; DRM adds minimal overhead (~1%)
