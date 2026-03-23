# Task: Video Upload - Mux Direct Upload

## Description

Implement Mux Direct Upload integration for lesson video uploads. This task covers server-side API endpoints for creating upload sessions, client-side chunked upload handling, upload progress tracking, asset ready webhook handling, and storing Mux metadata (mux_asset_id, mux_playback_id). The system supports MP4, MOV, AVI, MKV, and WEBM formats with automatic transcoding via Mux.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`
- External: Mux (Video API, Direct Upload)

## API Endpoints

### POST /api/v1/upload/mux-url

Create a Mux Direct Upload URL for a new video upload session.

**Request Body:**

```json
{
  "courseId": string (optional),
  "lessonId": string (optional),
  "filename": string
}
```

**Response (201 Created):**

```json
{
  "uploadUrl": "https://upload.mux.com/...",
  "uploadId": string,
  "courseId": string (optional),
  "lessonId": string (optional),
  "expiresAt": "ISO8601"
}
```

**Purpose:**

- Provides a signed URL for direct client upload
- Mux handles transcoding and asset creation server-side
- Separate from lesson creation to allow upload before lesson is created

### POST /api/v1/upload/mux-webhook

Webhook endpoint for Mux to notify when video asset is ready.

**Webhook Payload (from Mux):**

```json
{
  "type": "video.asset.ready",
  "data": {
    "id": "mux_asset_id",
    "playback_ids": [
      {
        "id": "mux_playback_id",
        "policy": "public"
      }
    ],
    "duration": 125.5,
    "status": "ready"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "assetId": "mux_asset_id"
}
```

**Purpose:**

- Stores Mux asset metadata in temporary storage (Redis/cache)
- Makes asset ID and playback ID available to lesson creation
- Called by Mux asynchronously after upload processing completes

### GET /api/v1/upload/mux-asset/{uploadId}

Poll for Mux asset metadata after upload completes.

**Response (200 OK, asset ready):**

```json
{
  "ready": true,
  "muxAssetId": "mux_asset_id",
  "muxPlaybackId": "mux_playback_id",
  "duration": 125.5
}
```

**Response (200 OK, still processing):**

```json
{
  "ready": false,
  "uploadId": "upload_id"
}
```

**Response (404 Not Found):**

```json
{
  "error": "Upload not found or expired",
  "uploadId": "upload_id"
}
```

**Purpose:**

- Client polls this endpoint to check if Mux has finished processing
- Returns asset metadata when ready
- Used as fallback if webhook delivery fails

## Requirements

1. **Mux Direct Upload Flow**
   - Server generates upload URL via Mux API: `POST /api/v1/upload/mux-url`
   - Client receives uploadUrl and uploads file directly to Mux
   - Mux processes video (transcoding) asynchronously
   - Mux sends webhook notification when asset ready
   - Server receives webhook, stores asset metadata in cache
   - Client polls endpoint or receives webhook notification to complete lesson creation

2. **Upload Session Creation**
   - Generate unique `uploadId` for tracking
   - Call `POST /video/uploads` via @mux/mux-node SDK
   - Mux returns `url` (upload endpoint)
   - Store upload session with metadata in database or cache
   - Include optional `courseId` and `lessonId` if provided
   - Set expiration: uploads expire after 24 hours (Mux default)

3. **Video Format Support**
   - Supported: MP4, MOV, AVI, MKV, WEBM
   - Mux automatically detects format and transcodes to HLS master
   - File size limit: 2GB per upload
   - Client validates file type before upload

4. **Chunked Upload Handling**
   - Direct Upload SDK handles chunked uploads automatically
   - Client uses @mux/mux-uploader npm package or custom fetch implementation
   - Support pause/resume of upload
   - Display upload progress in real-time
   - Handle network interruptions and retry logic

5. **Webhook Processing**
   - Verify webhook signature using Mux webhook secret
   - Listen for `video.asset.ready` and `video.asset.error_processing` events
   - On asset ready: extract mux_asset_id, mux_playback_id, duration
   - Store in cache (Redis) with key: `mux:asset:{uploadId}`
   - Set cache expiration: 1 hour
   - On error: mark upload as failed, retain error message

6. **Asset Metadata Storage**
   - On lesson creation: retrieve asset metadata from cache using uploadId
   - Store in lesson record: `mux_asset_id`, `mux_playback_id`, `video_duration`
   - Duration stored in seconds (float)
   - Playback ID enables DRM-protected playback via Mux Playback API

7. **Error Handling & Retries**
   - Client retries failed chunks (Mux Direct Upload SDK handles this)
   - If webhook fails, client can poll GET endpoint to check status
   - Log upload failures with error details for debugging
   - Return clear error messages to client

8. **Security**
   - Verify JWT token on upload URL creation endpoint
   - Validate webhook signature with Mux secret
   - Rate limit upload URL creation (1 per second per user)
   - Webhook endpoint public but signature-verified

## Acceptance Criteria

- [ ] POST /api/v1/upload/mux-url creates upload session and returns signed URL
- [ ] Client can upload file to Mux directly using returned URL
- [ ] Mux webhook endpoint receives and verifies asset ready notification
- [ ] Webhook handler extracts mux_asset_id, mux_playback_id, duration correctly
- [ ] Asset metadata stored in cache with correct key and expiration
- [ ] GET /api/v1/upload/mux-asset/{uploadId} returns asset metadata when ready
- [ ] GET endpoint returns "processing" status before webhook notification
- [ ] GET endpoint returns 404 for expired or non-existent uploads
- [ ] Client can upload videos in MP4, MOV, AVI, MKV, WEBM formats
- [ ] Upload progress displayed in UI during client-side upload
- [ ] Pause/resume functionality works for uploads
- [ ] Failed uploads handled with clear error messages
- [ ] Lesson can be created with muxAssetId and muxPlaybackId from upload
- [ ] Webhook signature validation prevents unauthorized requests
- [ ] Rate limiting prevents abuse of upload URL generation

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Blocks**: Course Builder UI (course-builder-ui-masterclass.md, course-builder-ui-lesson.md)
- **External**: Mux Video API, Mux Direct Upload service

## Technical Notes

### Mux SDK Integration

**Server-side (Mux Node SDK):**

```bash
npm install @mux/mux-node
```

**Initialize Mux client:**

```typescript
import Mux from "@mux/mux-node";

const mux = new Mux({
  accessTokenId: process.env.MUX_TOKEN_ID,
  secretKey: process.env.MUX_TOKEN_SECRET,
});
```

### Backend Handler: Create Upload URL

```typescript
export const createMuxUploadUrl = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const body = await readBody(event);

  // Rate limiting (simple in-memory, use Redis in production)
  const rateLimitKey = `upload:${user.id}`;
  const lastUpload = uploadRateLimiter.get(rateLimitKey);
  if (lastUpload && Date.now() - lastUpload < 1000) {
    throw createError({ statusCode: 429, message: "Rate limited" });
  }
  uploadRateLimiter.set(rateLimitKey, Date.now());

  // Create upload via Mux
  const mux = new Mux();
  const upload = await mux.video.uploads.create({
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "auto", // auto transcoding
    },
  });

  // Store upload session in database
  const uploadId = crypto.randomUUID();
  await redis.set(
    `mux:upload:${uploadId}`,
    JSON.stringify({
      id: uploadId,
      muxUploadId: upload.id,
      courseId: body.courseId,
      lessonId: body.lessonId,
      filename: body.filename,
      instructorId: user.id,
      createdAt: new Date().toISOString(),
      status: "uploading",
    }),
    { ex: 86400 } // 24 hour expiration
  );

  setResponseStatus(event, 201);
  return {
    uploadUrl: upload.url,
    uploadId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
});
```

### Webhook Handler: Asset Ready

```typescript
export const handleMuxWebhook = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const signature = getHeader(event, "mux-signature");

  // Verify webhook signature
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!verifyMuxSignature(body, signature, secret)) {
    throw createError({ statusCode: 401, message: "Invalid signature" });
  }

  // Handle asset ready event
  if (body.type === "video.asset.ready") {
    const { id: muxAssetId, playback_ids, duration, status } = body.data;
    const muxPlaybackId = playback_ids[0]?.id;

    if (!muxAssetId || !muxPlaybackId) {
      console.error("Missing asset or playback ID in webhook");
      return { success: false };
    }

    // Store in cache by mux_asset_id
    await redis.set(
      `mux:asset:${muxAssetId}`,
      JSON.stringify({
        muxAssetId,
        muxPlaybackId,
        duration,
        status,
        readyAt: new Date().toISOString(),
      }),
      { ex: 3600 } // 1 hour cache
    );

    console.log(`Mux asset ready: ${muxAssetId}`);
    return { success: true };
  }

  // Handle error event
  if (body.type === "video.asset.error_processing") {
    const { id: muxAssetId } = body.data;
    await redis.set(
      `mux:asset:${muxAssetId}`,
      JSON.stringify({
        muxAssetId,
        status: "error",
        errorMessage: body.data.errors?.[0]?.message || "Unknown error",
        errorAt: new Date().toISOString(),
      }),
      { ex: 3600 }
    );

    console.error(`Mux asset error: ${muxAssetId}`);
    return { success: true };
  }

  return { success: true };
});

// Webhook signature verification
function verifyMuxSignature(
  body: any,
  signature: string,
  secret: string
): boolean {
  const payload = JSON.stringify(body);
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return hash === signature;
}
```

### Poll Endpoint: Get Asset Metadata

```typescript
export const getMuxAsset = defineEventHandler(async (event) => {
  const { uploadId } = event.context.params;

  // Look up by upload ID (from initial upload session)
  const uploadSession = await redis.get(`mux:upload:${uploadId}`);
  if (!uploadSession) {
    throw createError({ statusCode: 404, message: "Upload not found" });
  }

  const session = JSON.parse(uploadSession);
  const muxAssetId = session.muxAssetId;

  // If asset ID not yet available, still processing
  if (!muxAssetId) {
    return { ready: false, uploadId };
  }

  // Try to get asset metadata
  const assetData = await redis.get(`mux:asset:${muxAssetId}`);
  if (!assetData) {
    return { ready: false, uploadId };
  }

  const asset = JSON.parse(assetData);

  // Check if processing completed
  if (asset.status === "error") {
    throw createError({
      statusCode: 400,
      message: `Upload failed: ${asset.errorMessage}`,
    });
  }

  if (asset.status === "ready") {
    return {
      ready: true,
      muxAssetId: asset.muxAssetId,
      muxPlaybackId: asset.muxPlaybackId,
      duration: asset.duration,
    };
  }

  return { ready: false, uploadId };
});
```

### Client-side Upload Implementation

**Using Mux Direct Upload React component:**

```bash
npm install @mux/mux-uploader
```

```typescript
import { MuxUploader } from '@mux/mux-uploader/react';
import { useState } from 'react';

export function VideoUploadForm({ onSuccess }: Props) {
  const [uploadId, setUploadId] = useState<string>();
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string>();

  const handleStartUpload = async (file: File) => {
    try {
      // Get upload URL from server
      const response = await fetch('/api/v1/upload/mux-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name })
      });

      if (!response.ok) throw new Error('Failed to create upload');
      const { uploadUrl, uploadId: id } = await response.json();

      setUploadId(id);
      setIsPolling(true);

      // Start polling for asset ready
      const pollInterval = setInterval(async () => {
        const pollRes = await fetch(`/api/v1/upload/mux-asset/${id}`);
        const pollData = await pollRes.json();

        if (pollData.ready) {
          clearInterval(pollInterval);
          setIsPolling(false);
          onSuccess({
            muxAssetId: pollData.muxAssetId,
            muxPlaybackId: pollData.muxPlaybackId,
            duration: pollData.duration
          });
        }
      }, 2000); // Poll every 2 seconds

      return uploadUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      throw err;
    }
  };

  return (
    <div>
      <MuxUploader
        endpoint={handleStartUpload}
        onSuccess={() => {}}
      />
      {isPolling && <p>Processing video...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

**Or with custom fetch implementation:**

```typescript
async function uploadToMux(
  file: File,
  uploadUrl: string,
  onProgress: (percent: number) => void
) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const chunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append("file", chunk);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: chunk,
      headers: {
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
      },
    });

    if (!response.ok) throw new Error("Chunk upload failed");

    onProgress(Math.round(((i + 1) / chunks) * 100));
  }
}
```

### Environment Variables

```
MUX_TOKEN_ID=your_token_id
MUX_TOKEN_SECRET=your_token_secret
MUX_WEBHOOK_SECRET=your_webhook_secret
```

### Webhook Configuration (Mux Dashboard)

1. Go to Settings > Webhooks
2. Create webhook with event type: `video.asset.ready`, `video.asset.error_processing`
3. Set webhook URL: `https://api.mentor.example.com/api/v1/upload/mux-webhook`
4. Note webhook signing secret for verification

### Performance Considerations

- Use Redis for caching upload sessions and asset metadata
- Set appropriate cache expiration times
- Implement exponential backoff for polling
- Use chunked uploads for files > 100MB to avoid timeouts
- Monitor Mux API rate limits (1000 requests/minute default)

### Testing Checklist

- Create upload session → returns valid URL
- Upload test video in MP4 format → success
- Upload test video in MOV, AVI, MKV, WEBM formats → all succeed
- Mux webhook delivers asset ready notification
- Webhook signature verification rejects invalid signatures
- Poll endpoint returns processing status initially
- Poll endpoint returns asset metadata after webhook
- Poll endpoint returns 404 for expired uploads
- Lesson creation with muxAssetId → stores video metadata
- Video duration populated correctly from Mux
