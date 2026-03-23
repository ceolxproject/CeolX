# Task 21: Mux Signed URLs & Video Security

## Description

Implement Mux signed URL generation to secure video delivery and prevent unauthorized access to course video content. All Mux playback URLs (HLS streams, thumbnails, storyboards, DRM licenses) must be cryptographically signed with time-limited tokens generated server-side. This ensures only authenticated, enrolled learners and instructors can access video assets, preventing unauthorized embedding, sharing, or re-distribution.

## Affected Apps/Packages

- **Hono API Backend** (token generation and signing logic)
- **Mux Video API** (video asset management and signing keys)
- **web-learner** (video player integration)
- **web-mentor** (instructor video management and preview)
- **Mobile App** (secure video playback on iOS/Android)
- **Video Player Library** (e.g., Video.js, JW Player with Mux support)
- **Crypto Libraries** (for JWT signing: `jsonwebtoken` or similar)

## API Endpoints

### Generate Playback Token

```
GET /api/v1/videos/:assetId/playback-token
Authorization: Required (Bearer token or session)
Query Parameters:
  - expiryMinutes: number (optional, default: 60, max: 1440)
  - userId: string (optional, extracted from auth context)
Response: 200 OK
{
  "token": "eyJhbGc...",
  "expiresAt": "2025-02-18T15:30:00Z",
  "playbackUrl": "https://image.mux.sh/...",
  "hslUrl": "https://stream.mux.sh/...",
  "thumbnail": "https://image.mux.sh/...",
  "storyboard": "https://image.mux.sh/..."
}
Error: 403 Forbidden
{
  "error": "Unauthorized",
  "message": "User is not enrolled in this course"
}
Error: 404 Not Found
{
  "error": "VideoNotFound",
  "message": "Asset ID does not exist"
}
```

### Get Video Playback Info

```
GET /api/v1/videos/:assetId/playback-info
Authorization: Required
Response: 200 OK
{
  "assetId": "uuid",
  "title": "string",
  "duration": number (seconds),
  "thumbnail": "string (unsigned URL)",
  "hasSignedUrl": boolean,
  "courseId": "uuid",
  "instructorId": "uuid"
}
```

### Refresh Token

```
POST /api/v1/videos/:assetId/refresh-token
Authorization: Required
Request Body: {} (empty)
Response: 200 OK
{
  "token": "eyJhbGc...",
  "expiresAt": "2025-02-18T15:30:00Z"
}
```

## Requirements

### Mux Signing Key Configuration

#### Environment Variables

- `MUX_SIGNING_KEY_ID`: Mux signing key ID (provided by Mux dashboard)
- `MUX_SIGNING_PRIVATE_KEY`: Private key for signing (PEM format, multi-line)
- `MUX_PLAYBACK_RESTRICTION_ENABLED`: boolean (default: true)
- `MUX_TOKEN_EXPIRY_MINUTES`: number (default: 60, max: 1440 — 24 hours)
- `MUX_ALLOWED_DOMAINS`: pipe-separated list of allowed playback domains

#### Key Storage & Rotation

- Store keys in environment variables (never hardcode)
- Implement key rotation mechanism (quarterly)
- Document key rotation procedure in ops runbook
- Verify key expiration dates in monitoring

### Token Generation Logic

#### JWT Structure

- Use JWT (JSON Web Token) format for signed tokens
- Token payload includes:
  ```json
  {
    "iss": "https://example.com",
    "sub": "user-uuid",
    "aud": "mux-playback",
    "exp": 1708274400,
    "iat": 1708270800,
    "mux:playback_restriction": {
      "signed": true
    },
    "videoAssetId": "asset-uuid",
    "courseId": "course-uuid",
    "enrollmentStatus": "active|grace_period"
  }
  ```

#### Token Expiry

- Default expiry: 60 minutes
- Maximum expiry: 1440 minutes (24 hours)
- Minimum expiry: 5 minutes
- Client can request custom expiry (validated server-side)
- Tokens closer to expiry (< 5 minutes) return 401, forcing refresh

#### Signing Algorithm

- Use RS256 (RSA Signature with SHA-256)
- Private key must be PEM-encoded (PKCS#8 format)
- Public key can be published for client-side verification (optional)

### Authorization Checks

#### Learner Access

- User must have active enrollment in the course
- Enrollment status can be "active" or "grace_period" (after instructor deactivation)
- Check enrollment status in database:
  ```sql
  SELECT * FROM enrollments
  WHERE user_id = $1
    AND course_id = (SELECT course_id FROM videos WHERE asset_id = $2)
    AND status IN ('active', 'grace_period')
  ```
- If enrollment has grace period active and end date has passed, deny access
- Return 403 Forbidden if user is not enrolled

#### Instructor Access

- Instructor who owns the course can always generate tokens (for preview/testing)
- Admin can generate tokens for any video
- Check role-based access:
  ```sql
  SELECT * FROM instructors WHERE user_id = $1 AND id = (
    SELECT instructor_id FROM courses WHERE id = $2
  )
  ```

#### Mobile App Access

- Tokens must work from mobile app origins (identify via custom header or user-agent)
- Do not restrict mobile tokens differently from web tokens
- Support refresh token flow for mobile (tokens expire, must be refreshed)

### Domain Restriction (Mux Feature)

#### Allowed Playback Domains

- Configure allowed domains where signed URLs can be used:
  - `https://learner.example.com` (web learner app)
  - `https://mentor.example.com` (web mentor app)
  - Mobile app domain/scheme (if applicable)
- Mux will reject playback requests from other domains even with valid token

#### Configuration

- Set `playback_restriction` field in Mux playback policy:
  ```json
  "playback_restriction": {
    "signed": true,
    "domains": [
      "learner.example.com",
      "mentor.example.com"
    ]
  }
  ```

### URL Types & Signing

#### HLS Streaming URLs

- Primary playback format for adaptive bitrate streaming
- Example unsigned URL: `https://stream.mux.sh/v/<playbackId>.m3u8`
- Must be signed before delivery to client
- Signed URL includes token as query parameter: `?token=<signed-jwt>`

#### Thumbnail URLs

- Static poster/thumbnail image for video preview
- Can be generated for public use (no signing required if domain-restricted)
- Signed variant available for additional security:
  - `https://image.mux.sh/v/<playbackId>/thumbnail.jpg?token=<signed-jwt>`
- Common dimensions: 640x360, 1280x720, 1920x1080

#### Storyboard URLs

- Sprite image containing multiple thumbnails for seek-ahead preview
- URL format: `https://image.mux.sh/v/<playbackId>/storyboard.vtt?token=<signed-jwt>`
- VTT file references individual sprite locations

#### DRM License URLs (if applicable)

- For protected content (DASH-WIDEVINE or HLS-FAIRPLAY):
  - License request URLs must also be signed
  - Mux handles DRM signing automatically if playback policy includes DRM

### Rate Limiting

#### Token Generation Rate Limit

- Maximum 100 token requests per user per hour
- Limit applies per video asset (not per endpoint)
- Return 429 Too Many Requests when exceeded
- Rate limit key: `token_request:<userId>:<assetId>`
- Store in Redis with expiry of 1 hour

#### Token Refresh Rate Limit

- Maximum 20 refresh requests per token per hour
- Prevent brute-force token refresh attacks
- Return 429 Too Many Requests when exceeded

### Error Handling

#### Token Generation Failures

- **Unauthorized Enrollment**: Return 403 with message "User is not enrolled in this course"
- **Video Not Found**: Return 404 with message "Video asset not found"
- **Signing Error**: Return 500 with generic message "Unable to generate token"
  - Log detailed error for debugging (never expose to client)
- **Invalid Expiry**: Return 400 with message "Expiry must be between 5 and 1440 minutes"
- **Rate Limited**: Return 429 with Retry-After header

#### Client-Side Handling

- Web player should handle token expiry and automatically refresh
- If refresh fails, display error message to user
- Mobile app should display "Video unavailable" if token cannot be obtained

### Caching Strategy

#### Token Caching (Not Recommended)

- Tokens should NOT be cached long-term
- Server-side caching: Cache enrollment status (5-minute TTL) to avoid N+1 queries
- Client-side: Browser will cache successful responses, but tokens are short-lived

#### URL Caching

- Signed URLs can be cached for their token duration
- If token is refreshed, old URL is invalid
- Include Cache-Control header: `Cache-Control: private, max-age=3600` (1 hour)

### Monitoring & Security

#### Security Monitoring

- Log all token generation requests with user ID, asset ID, timestamp
- Alert on unusual patterns:
  - Single user generating >50 tokens in 5 minutes
  - Tokens generated for videos not in user's enrolled courses
  - Tokens requested from unexpected IP ranges
- Implement intrusion detection rules

#### Key Rotation Monitoring

- Monitor signing key expiration dates
- Alert 30 days before key expiration
- Implement automated key rotation if possible

#### Token Validation Monitoring

- Log all failed token validation attempts
- Track common failure reasons (expired, invalid signature, wrong audience)
- Alert if validation failure rate exceeds 5%

### Integration with Video Player

#### Web Player Integration

```javascript
// Example: Fetching signed URL and initializing player
const response = await fetch(`/api/v1/videos/${assetId}/playback-token`, {
  headers: { Authorization: `Bearer ${authToken}` },
});
const { token, hlsUrl } = await response.json();

// Pass signed URL to video player
const player = new VideoJS({
  sources: [
    {
      src: hlsUrl, // Already contains signed token
      type: "application/x-mpegURL",
    },
  ],
});
```

#### Mobile Integration

- iOS: Use AVPlayer with URL containing signed token
- Android: Use ExoPlayer with URL containing signed token
- Both platforms: Handle token refresh on 401 response

## Acceptance Criteria

- [ ] Environment variables `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` are configured in `.env.example`
- [ ] Signing key is stored securely (never logged, never exposed in error messages)
- [ ] Token generation endpoint `/api/v1/videos/:assetId/playback-token` is implemented
- [ ] JWT tokens are generated with RS256 algorithm
- [ ] Token payload includes correct fields (iss, sub, aud, exp, iat, videoAssetId, courseId)
- [ ] Token expiry defaults to 60 minutes and respects custom expiry parameter (5-1440 range)
- [ ] Authorization check verifies user is enrolled in the course
- [ ] Enrollment check includes active and grace_period statuses
- [ ] Grace period expiry is enforced (expired grace periods deny access)
- [ ] Instructor access is allowed (course owner can generate tokens for their videos)
- [ ] Admin access is allowed (super-admin can generate tokens for any video)
- [ ] Unauthorized users receive 403 Forbidden response
- [ ] Video not found returns 404 Not Found
- [ ] Invalid expiry parameter returns 400 Bad Request
- [ ] HLS streaming URL is returned in signed format (includes token)
- [ ] Thumbnail URL is available and optionally signed
- [ ] Storyboard URL is available and signed
- [ ] Rate limiting is enforced (100 requests per user per hour)
- [ ] Rate limit 429 response includes Retry-After header
- [ ] Token refresh endpoint `/api/v1/videos/:assetId/refresh-token` works correctly
- [ ] Refresh token returns new token with updated expiry
- [ ] Signed URLs are validated by Mux (playback succeeds with signed token)
- [ ] Unsigned/expired tokens are rejected by Mux (playback fails with 401)
- [ ] Domain restriction is configured in Mux playback policy
- [ ] Tokens work from learner.example.com origin
- [ ] Tokens work from mentor.example.com origin
- [ ] Tokens work from mobile app (if origin is configured)
- [ ] Tokens fail from unauthorized domains (security test)
- [ ] Unit tests verify JWT signing and validation
- [ ] Unit tests verify authorization checks (enrolled, instructor, admin)
- [ ] Integration test: Learner generates token, plays video successfully
- [ ] Integration test: Non-enrolled user receives 403 Forbidden
- [ ] Integration test: Expired token returns 401, refresh succeeds
- [ ] E2E test: Video plays from web-learner app using signed token
- [ ] E2E test: Video plays from web-mentor app (instructor preview)
- [ ] Security test: Tampered token is rejected by Mux
- [ ] Security test: Tokens from unauthorized domains fail
- [ ] Monitoring: Token generation requests are logged
- [ ] Monitoring: Failed token validation is tracked and alerted
- [ ] Documentation: API endpoint is documented with request/response examples

## Dependencies

### Must Complete Before

- **Task 4: Hono App Scaffolding** — Basic Hono app with authentication middleware
- **Task 7: BetterAuth Integration** — User authentication and session management
- **Task 12: Course Management Core** — Course ownership and course-user relationships
- **Task 13: Enrollment Management** — Enrollment records and status tracking
- **Task 15: Video Upload & Storage (Mux)** — Mux account, API credentials, video assets

### May Be Blocked By

- Mux account setup and API key provisioning
- Video player library decision and integration

### Blocking Tasks

- Task 22: Video Player UI/UX (depends on signed URL generation)
- Task 25: Adaptive Learning (uses video playback data)

## Technical Notes

### Implementation Approach

- Create utility function `generateMuxSignedToken()` in `/src/lib/mux.ts`
- Create endpoint handler in `/src/api/videos.ts` for token generation
- Use `jsonwebtoken` npm package for JWT signing
- Store signing logic separately from authorization logic (single responsibility)

### JWT Signing Example

```typescript
import jwt from "jsonwebtoken";

function generateMuxSignedToken(
  assetId: string,
  userId: string,
  courseId: string,
  expiryMinutes: number = 60
): string {
  const payload = {
    iss: "https://example.com",
    sub: userId,
    aud: "mux-playback",
    mux: {
      playback_restriction: {
        signed: true,
      },
    },
    videoAssetId: assetId,
    courseId: courseId,
  };

  return jwt.sign(payload, process.env.MUX_SIGNING_PRIVATE_KEY!, {
    algorithm: "RS256",
    expiresIn: `${expiryMinutes}m`,
    keyid: process.env.MUX_SIGNING_KEY_ID,
  });
}
```

### Mux API Integration

- Use Mux Node.js SDK: `npm install mux-node`
- Fetch signed playback URL from Mux using generated token
- Example:

  ```typescript
  import Mux from "mux-node";

  const mux = new Mux({
    token_id: process.env.MUX_TOKEN_ID,
    token_secret: process.env.MUX_TOKEN_SECRET,
  });
  const playbackUrl = await mux.Video.PlaybackIDs.get(assetId, playbackIdId);
  ```

### Token Refresh Strategy

- Old token remains valid until expiry (short-lived anyway, max 24 hours)
- New token issued independently (no token revocation list needed)
- Client should detect 401 response and automatically refresh
- Implement exponential backoff on token refresh failures

### Testing with Mux Sandbox

- Create test video asset in Mux test environment
- Generate sample signed tokens for testing
- Verify token validation in test player without real video

### Performance Considerations

- JWT signing is CPU-intensive; keep RSA key in memory
- Token generation should complete in <50ms
- Use Redis for enrollment caching to avoid repeated database queries
- Batch cache warming for frequently accessed videos

### Security Best Practices

- Never log full tokens (log only first/last 8 characters if necessary for debugging)
- Use HTTPS for all endpoints (non-negotiable)
- Rotate signing keys quarterly
- Monitor for token leakage (if token appears in logs, rotate immediately)
- Implement token blacklist if needed (e.g., if user is banned, revoke their tokens)

### Debugging Tips

- Use jwt.io to inspect token payload (paste token to verify claims)
- Mux provides test playback URLs that work without signing (for comparison)
- Check Mux Dashboard for video asset details, playback IDs, and signing key info
- Enable verbose logging during development to track token generation flow

### Related Documentation

- Mux Signed URLs: https://docs.mux.com/guides/video/secure-playback
- JWT Introduction: https://jwt.io/
- Node.js JWT Signing: https://github.com/auth0/node-jsonwebtoken
- Video.js Hls Plugin: https://videojs.com/
