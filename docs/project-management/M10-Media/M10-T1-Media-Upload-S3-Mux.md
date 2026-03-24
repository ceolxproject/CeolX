# M10-T1 · Media Upload Pipeline (Images via S3 + CloudFront, Videos via Mux)

| Field          | Value                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M10 — Media                                                                                                          |
| **Status**     | 🔲 To Do                                                                                                             |
| **Depends on** | M1-T2 (DB schema), M1-T3 (Hono API), M4-T1 (event cover images), M6-T1/T2 (profile images), M6-T4 (posts with media) |
| **PRD Ref**    | Section 4.4 (Media Handling — S3 + CloudFront, Mux), Section 10.1 (Tech Stack)                                       |

---

## Description

CeolX requires a robust, efficient media upload pipeline to handle user-generated content: profile images, event cover images, post attachments, and promotional videos. This task implements a two-tier architecture: **images (and audio) upload directly to AWS S3 via presigned URLs**, bypassing the Lambda backend to reduce latency and cost; **videos upload directly to Mux**, which handles transcoding and streaming. CloudFront CDN serves all images with global caching, minimising bandwidth and latency for Irish users. Mux Direct Upload provides a secure, temporary upload endpoint for each video, and webhooks notify the backend when transcoding completes. This task is critical for the launch, as all four personas (Spectator, Artist, Venue, Super Admin) rely on media for visual discovery and engagement.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`        | Presigned S3 URL generation endpoint, Mux upload URL creation endpoint, webhook handler for Mux video.asset.ready events             |
| `apps/mobile`     | Image/video picker UI (expo-image-picker), upload progress display, direct S3/Mux upload client code, error handling and retry logic |
| `packages/shared` | TypeScript interfaces for upload request/response schemas                                                                            |

---

## API Endpoints

### POST /api/v1/upload/presigned

Generate a presigned S3 URL for image upload. Client calls this, receives a temporary S3 URL valid for 5 minutes, then uploads directly to S3.

**Request Body:**

```json
{
  "type": "profile_image | cover_image | post_image | event_cover",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg"
}
```

**Response (200 OK):**

```json
{
  "uploadUrl": "https://s3.eu-west-1.amazonaws.com/ceolx-media?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "publicUrl": "https://cdn.ceolx.ie/events/2026/03/event_123.jpg",
  "key": "events/2026/03/event_123.jpg",
  "expiresIn": 300
}
```

**Error Responses:**

- `400 Bad Request`: `{ "error": "Unsupported file type. Accepted: JPEG, PNG, WebP" }`
- `413 Payload Too Large`: `{ "error": "File exceeds maximum size of 5MB for profile images" }`
- `401 Unauthorized`: User not authenticated

---

### POST /api/v1/upload/mux-url

Create a Mux Direct Upload URL for video upload. Returns a temporary Mux endpoint where the client uploads the video file directly.

**Request Body:**

```json
{
  "fileName": "promo_video.mp4",
  "mimeType": "video/mp4"
}
```

**Response (200 OK):**

```json
{
  "uploadUrl": "https://upload.mux.com/uploads/mux_upload_id_12345",
  "uploadId": "mux_upload_id_12345",
  "expiresIn": 3600
}
```

**Error Responses:**

- `400 Bad Request`: `{ "error": "Unsupported video format. Accepted: MP4, MOV" }`
- `413 Payload Too Large`: `{ "error": "Video exceeds maximum size of 500MB" }`
- `401 Unauthorized`: User not authenticated

---

### POST /api/v1/webhooks/mux

Mux calls this endpoint when video transcoding is complete and the asset is ready for playback. Signature verified using Mux webhook secret.

**Request Body (Mux webhook payload):**

```json
{
  "type": "video.asset.ready",
  "data": {
    "id": "mux_asset_id_abc123",
    "playback_ids": [
      {
        "id": "playback_id_xyz789",
        "policy": "public"
      }
    ],
    "upload_id": "mux_upload_id_12345"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Asset ready and stored"
}
```

---

## Requirements

### Image Upload (S3 + CloudFront)

- R1: Client calls `POST /api/v1/upload/presigned` with image type and MIME type; server returns a presigned S3 URL valid for 5 minutes
- R2: Client validates image size and MIME type locally before requesting presigned URL:
  - Profile images: max 5 MB, JPEG/PNG/WebP
  - Event cover images: max 10 MB, JPEG/PNG/WebP
  - Post images: max 10 MB, JPEG/PNG/WebP
- R3: Client uploads directly to S3 using the presigned URL (PUT request with the image file)
- R4: S3 bucket (`ceolx-media-prod`) configured with:
  - Private access (no public read ACL)
  - Lifecycle policy: delete objects older than 90 days (cleanup for failed uploads)
  - Versioning disabled
  - Server-side encryption (AWS-managed or KMS)
- R5: CloudFront distribution (`cdn.ceolx.ie`) configured with S3 origin using Origin Access Control (OAC), not OAI
  - Allowed methods: GET, HEAD
  - Caching: 30 days for images (Cache-Control: max-age=2592000)
  - Geo-restriction: none (allow all countries)
- R6: CloudFront CDN is the only public-facing distribution; raw S3 URLs never exposed to clients
- R7: Image URLs stored in the database point to CloudFront (e.g., `https://cdn.ceolx.ie/events/2026/03/event_123.jpg`)
- R8: Upload progress shown to user during the PUT request (percentage completion)
- R9: Failed uploads (network error, timeout) show a retry button; user can reattempt without getting a new presigned URL (same URL valid for 5 min)

### Video Upload (Mux Direct Upload)

- R10: Client calls `POST /api/v1/upload/mux-url`; server calls Mux API (`Video.Uploads.create()`) with `new_asset_settings: { playback_policy: ['public'] }`; returns temporary Mux upload URL
- R11: Client validates video size and MIME type locally:
  - Max video: 500 MB, MP4/MOV
  - Max video duration: 10 minutes (estimate from file size; Mux enforces actual duration)
- R12: Client uploads video file directly to Mux endpoint (multipart form POST with file)
- R13: Mux begins transcoding immediately; fires `video.asset.ready` webhook when complete
- R14: Backend endpoint `POST /api/v1/webhooks/mux` receives the ready event, verifies signature using Mux secret (`process.env.MUX_WEBHOOK_SECRET`), and updates the post record with `playback_id`
- R15: Client does NOT wait for Mux webhook; stores the Mux upload ID immediately and polls `GET /api/v1/posts/:id` every 2 seconds until `playback_id` is populated
- R16: Videos served via Mux HLS streaming: `https://stream.mux.com/{playback_id}.m3u8` (adaptive bitrate, ABR)

### Audio Posts

- R17: Audio uploads (from posts with audio) go to S3 (NOT Mux):
  - Max 50 MB, MP3/AAC format
  - Same presigned URL flow as images
  - CloudFront serves audio files

### Client-Side Upload Logic

- R18: Use `expo-image-picker` for image and video selection:
  - Images: `mediaTypes: 'Images'`, `allowsMultiple: false`
  - Videos: `mediaTypes: 'Videos'`, `allowsMultiple: false`
- R19: Before upload, validate size and MIME type locally; show error toast if invalid
- R20: Show upload progress (percentage) while file is being uploaded
- R21: On upload failure, retry button appears; allow 3 retry attempts before showing error
- R22: On upload success, store the returned CDN URL (images) or poll for playback_id (video) and then store in the relevant database field

---

## Acceptance Criteria

- [ ] Presigned S3 URL endpoint returns a valid, working URL; client can PUT image directly to S3
- [ ] CloudFront CDN serves uploaded images at `https://cdn.ceolx.ie/...`; verified with curl
- [ ] All uploaded images accessible via CDN URL within seconds (no 403 errors due to OAC misconfiguration)
- [ ] Event cover, profile image, and post image uploads work end-to-end on iOS and Android
- [ ] Video upload to Mux Direct Upload endpoint works; file reaches Mux servers
- [ ] Mux webhook fires correctly when video transcoding complete; backend stores `playback_id`
- [ ] Client polls for `playback_id` and video becomes playable at HLS URL within 2 minutes of upload
- [ ] Upload progress UI updates smoothly (0–100%) during upload
- [ ] File size validation rejects oversized files with user-friendly error message
- [ ] File type validation rejects unsupported formats
- [ ] Retry logic works on both S3 and Mux uploads; user can reattempt after network failure
- [ ] S3 bucket is completely private; no public read access (verified via AWS IAM Analyzer or manual test)

---

## Dependencies

- **Upstream**: M1-T2 (database schema with posts, events, artist_profiles, venue_profiles tables); M1-T3 (Hono API scaffold with middleware); M6-T4 (posts with media field)
- **Downstream**: All user-facing features that upload media (M4-T1 event creation, M6-T1/T2 profile setup, M6-T4 post creation)
- **External services**: AWS S3, AWS CloudFront CDN, Mux Direct Upload API, Mux webhooks

---

## Technical Notes

### S3 Presigned URL Generation (Hono Endpoint)

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: "eu-west-1" });

const UPLOAD_TYPES = {
  profile_image: {
    maxSize: 5 * 1024 * 1024,
    bucket: "ceolx-media-prod",
    prefix: "profiles",
  },
  cover_image: {
    maxSize: 10 * 1024 * 1024,
    bucket: "ceolx-media-prod",
    prefix: "covers",
  },
  post_image: {
    maxSize: 10 * 1024 * 1024,
    bucket: "ceolx-media-prod",
    prefix: "posts",
  },
  event_cover: {
    maxSize: 10 * 1024 * 1024,
    bucket: "ceolx-media-prod",
    prefix: "events",
  },
};

app.post("/api/v1/upload/presigned", authMiddleware, async (c) => {
  const { type, fileName, mimeType } = await c.req.json();
  const config = UPLOAD_TYPES[type as keyof typeof UPLOAD_TYPES];

  if (!config) {
    return c.json({ error: "Invalid upload type" }, 400);
  }

  const validMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!validMimes.includes(mimeType)) {
    return c.json({ error: "Unsupported MIME type" }, 400);
  }

  // Generate unique key
  const userId = c.get("userId");
  const timestamp = Date.now();
  const key = `${config.prefix}/${userId}/${timestamp}_${fileName}`;

  try {
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      }),
      { expiresIn: 300 }, // 5 minutes
    );

    const publicUrl = `https://cdn.ceolx.ie/${key}`;

    return c.json({
      uploadUrl,
      publicUrl,
      key,
      expiresIn: 300,
    });
  } catch (error) {
    return c.json({ error: "Failed to generate presigned URL" }, 500);
  }
});
```

### Mux Direct Upload Creation (Hono Endpoint)

```typescript
import Mux from "@mux/mux-node";

const mux = new Mux({
  accessTokenId: process.env.MUX_ACCESS_TOKEN_ID,
  accessTokenSecret: process.env.MUX_ACCESS_TOKEN_SECRET,
});

app.post("/api/v1/upload/mux-url", authMiddleware, async (c) => {
  const { fileName, mimeType } = await c.req.json();

  const validMimes = ["video/mp4", "video/quicktime"];
  if (!validMimes.includes(mimeType)) {
    return c.json({ error: "Unsupported video format" }, 400);
  }

  try {
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    return c.json({
      uploadUrl: upload.url,
      uploadId: upload.id,
      expiresIn: 3600,
    });
  } catch (error) {
    return c.json({ error: "Failed to create Mux upload" }, 500);
  }
});
```

### Mux Webhook Handler (Hono Endpoint)

```typescript
import crypto from "crypto";

app.post("/api/v1/webhooks/mux", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("mux-signature");
  const timestamp = c.req.header("mux-request-id");

  // Verify Mux signature
  const secret = process.env.MUX_WEBHOOK_SECRET!;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  if (signature !== expectedSignature) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const payload = JSON.parse(body);

  if (payload.type === "video.asset.ready") {
    const { upload_id, data } = payload;
    const playbackId = data.playback_ids[0]?.id;

    if (!playbackId) {
      return c.json({ error: "No playback ID" }, 400);
    }

    // Find the post by upload_id and update with playback_id
    await db
      .update(posts)
      .set({ muxPlaybackId: playbackId, muxAssetId: data.id })
      .where(eq(posts.muxUploadId, upload_id));

    return c.json({ success: true, message: "Asset ready and stored" });
  }

  return c.json({ success: true });
});
```

### Mobile Upload Client (React Native)

```typescript
import * as ImagePicker from "expo-image-picker";
import {
  uploadImageToS3,
  uploadVideoToMux,
  pollForPlaybackId,
} from "@/lib/uploads";

async function handleImageUpload(uploadType: "profile_image" | "event_cover") {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultiple: false,
  });

  if (!result.canceled) {
    const asset = result.assets[0];

    // Validate size
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      showErrorToast("File exceeds 10MB limit");
      return;
    }

    setUploadProgress(0);

    try {
      // Get presigned URL
      const { uploadUrl, publicUrl } = await api.post("/upload/presigned", {
        type: uploadType,
        fileName: asset.filename || "image.jpg",
        mimeType: asset.mimeType || "image/jpeg",
      });

      // Upload directly to S3
      await uploadImageToS3(uploadUrl, asset.uri, (progress) => {
        setUploadProgress(Math.round(progress * 100));
      });

      // Save URL to database
      await saveProfileImage(publicUrl);
      showSuccessToast("Image uploaded");
    } catch (error) {
      showErrorToast("Upload failed. Retry?");
    }
  }
}

async function handleVideoUpload() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsMultiple: false,
  });

  if (!result.canceled) {
    const asset = result.assets[0];

    // Validate size
    if (asset.fileSize && asset.fileSize > 500 * 1024 * 1024) {
      showErrorToast("Video exceeds 500MB limit");
      return;
    }

    setUploadProgress(0);

    try {
      // Get Mux upload URL
      const { uploadUrl, uploadId } = await api.post("/upload/mux-url", {
        fileName: asset.filename || "video.mp4",
        mimeType: asset.mimeType || "video/mp4",
      });

      // Upload directly to Mux
      await uploadVideoToMux(uploadUrl, asset.uri, (progress) => {
        setUploadProgress(Math.round(progress * 100));
      });

      // Poll for playback_id
      const playbackId = await pollForPlaybackId(postId, uploadId);

      showSuccessToast("Video uploaded and transcoding");
    } catch (error) {
      showErrorToast("Upload failed. Retry?");
    }
  }
}
```

---

## Common Gotchas

- **OAC vs OAI**: Origin Access Control (OAC) is the newer, recommended method. If using the older Origin Access Identity (OAI), CloudFront may not be able to access the S3 origin. Always use OAC in new setups.

- **Presigned URL expiry**: 5 minutes is short but sufficient for mobile uploads. If users experience timeouts, check network latency. Don't increase expiry beyond 15 minutes (security risk).

- **CloudFront caching stale images**: When a user uploads a new profile image with the same file name, CloudFront may serve the old cached version. Use cache-busting via query string (e.g., `?v=timestamp`) or unique file names (recommended: use timestamp in key).

- **Mux webhook delays**: Transcoding can take 30 seconds to 2 minutes depending on file size and Mux load. Client polling is safe; don't wait indefinitely.

- **S3 CORS**: If presigned URLs are cross-origin, ensure S3 CORS policy allows PUT from mobile origin. For Expo apps, check if CORS headers are needed.

- **Stripe Key Format**: Don't confuse S3 keys with URLs. Keys are stored in the DB; URLs are derived for CDN serving.

- **Audio via S3 not Mux**: Audio posts use S3 presigned URLs (same as images), NOT Mux. Mux is video-only in CeolX V1.
