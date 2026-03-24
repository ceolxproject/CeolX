# Task: Course Thumbnail Upload

## Description

Implement image upload and management for course thumbnails. Thumbnails are stored in Cloudflare R2, optimized for web display, and resized to maintain consistent aspect ratio (16:9 recommended). The system handles image validation, optimization, preview generation, and fallback placeholders for courses without thumbnails.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`
- External: Cloudflare R2 (object storage)
- Image processing: Sharp (Node.js image library)

## API Endpoints

### POST /api/v1/courses/{courseId}/thumbnail

Upload and set a course thumbnail image.

**Request (multipart/form-data):**

```
POST /api/v1/courses/{courseId}/thumbnail
Content-Type: multipart/form-data

file: <image binary>
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "thumbnailUrl": "https://cdn.mentor.com/courses/{courseId}/thumbnail.webp",
  "width": 1920,
  "height": 1080,
  "fileSize": 245000,
  "format": "webp",
  "updatedAt": "ISO8601"
}
```

**Error Responses:**

- `400 Bad Request`: No file provided, invalid image format
- `403 Forbidden`: User is not course owner
- `404 Not Found`: Course not found
- `413 Payload Too Large`: File exceeds size limit

### DELETE /api/v1/courses/{courseId}/thumbnail

Remove thumbnail (revert to placeholder).

**Response (200 OK):**

```json
{
  "success": true,
  "courseId": "uuid",
  "message": "Thumbnail removed. Course will use placeholder."
}
```

### GET /api/v1/courses/{courseId}/thumbnail

Redirect to thumbnail image or placeholder.

**Response (302 Found):**
Redirect to thumbnail URL in R2 or default placeholder.

**Response (200 OK, JSON metadata):**
Can also return metadata:

```json
{
  "thumbnailUrl": "https://...",
  "placeholder": false,
  "width": 1920,
  "height": 1080
}
```

## UI Components

### Thumbnail Upload in Course Builder

- Display current thumbnail or placeholder
- Upload button: "Change Thumbnail"
- Drag-and-drop area for image upload
- File picker for selection
- Preview before confirm
- Aspect ratio indicator (16:9)
- File size and dimensions display

### Thumbnail Preview

- Used in:
  - Course builder step 1
  - Course detail page
  - Course listing/discovery
  - Instructor dashboard

## Requirements

1. **Image Format Support**
   - Accepted: JPEG, PNG, WebP
   - Auto-detect format from MIME type
   - Reject other formats (GIF, SVG, etc.)
   - Convert all to WebP for storage (optimal compression)

2. **Image Optimization**
   - Resize to optimal dimensions:
     - Target: 1920 x 1080 (16:9 aspect ratio)
     - Maintain aspect ratio during resize
     - Use padding if necessary to reach 16:9
   - Compress with aggressive settings:
     - WebP quality: 80
     - Progressive JPEG quality: 80
   - Generate thumbnail version: 400 x 225
   - File size limit: 10MB (before optimization)

3. **Aspect Ratio Enforcement**
   - Ensure 16:9 aspect ratio
   - If uploaded image different ratio:
     - Crop to 16:9 (center crop)
     - OR pad with solid color (default: light gray #E5E7EB)
   - Display aspect ratio guide in UI

4. **Storage & CDN**
   - Store in R2: `courses/{courseId}/thumbnail.webp`
   - Also store thumbnail variant: `courses/{courseId}/thumbnail-sm.webp` (400x225)
   - Generate public CDN URL: `https://cdn.mentor.com/courses/{courseId}/thumbnail.webp`
   - Use R2's caching headers: Cache-Control: "public, max-age=86400"

5. **Database Storage**
   - Store thumbnail URL in courses table: `thumbnail_url`
   - Store original filename in metadata (optional)
   - Update `updated_at` timestamp on change

6. **Placeholder**
   - Default placeholder: Generated image with course title and category
   - OR use static fallback image
   - Display when `thumbnail_url` is NULL
   - Include fallback in course API response

7. **Error Handling**
   - Invalid file type: 400 with message "Unsupported image format"
   - File too large: 413 with message "File exceeds 10MB limit"
   - Image processing error: 500 with log
   - R2 upload failure: retry with exponential backoff, then 500

8. **Authorization**
   - Verify JWT token
   - Verify user is course owner
   - Return 403 if unauthorized

## Acceptance Criteria

- [ ] POST endpoint accepts JPEG, PNG, WebP image uploads
- [ ] Image validated and optimized before storage
- [ ] Image resized to 1920x1080 (16:9 aspect ratio)
- [ ] Aspect ratio enforced (padding or cropping as needed)
- [ ] Optimized WebP file generated and stored in R2
- [ ] Thumbnail variant (400x225) also generated and stored
- [ ] Public CDN URL returned in response
- [ ] Thumbnail URL stored in courses table
- [ ] DELETE endpoint removes thumbnail and reverts to placeholder
- [ ] Placeholder displays for courses without thumbnails
- [ ] Upload progress shown in UI during upload
- [ ] Preview displays before confirming upload
- [ ] Aspect ratio guide displayed in UI
- [ ] File size and dimensions displayed after upload
- [ ] 403 returned if user not course owner
- [ ] 404 returned if course not found
- [ ] Concurrent uploads handled correctly

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Related**: Course Builder UI (course-builder-ui-masterclass.md)
- **Related**: Course Discovery (06-course-discovery-and-browsing)

## Technical Notes

### Image Processing Setup

**Install dependencies:**

```bash
npm install sharp
```

**Initialize R2 and Sharp:**

```typescript
import Sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
```

### Backend Handler: Upload Thumbnail

```typescript
export const uploadThumbnail = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const formData = await readMultipartFormData(event);
  const file = formData.find((f) => f.name === "file");

  if (!file) {
    throw createError({ statusCode: 400, message: "Image file required" });
  }

  // Validate file type
  const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validMimeTypes.includes(file.type)) {
    throw createError({
      statusCode: 400,
      message: "Unsupported image format. Use JPEG, PNG, or WebP.",
    });
  }

  // Validate file size
  if (file.data.length > 10 * 1024 * 1024) {
    // 10MB
    throw createError({ statusCode: 413, message: "File exceeds 10MB limit" });
  }

  try {
    // Process image: resize, optimize, convert to WebP
    const optimized = await Sharp(file.data)
      .resize(1920, 1080, {
        fit: "cover", // Center crop to 16:9
        position: "center",
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Generate thumbnail variant
    const thumbnail = await Sharp(file.data)
      .resize(400, 225, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 80 })
      .toBuffer();

    // Get image metadata
    const metadata = await Sharp(optimized).metadata();

    // Upload to R2
    const mainKey = `courses/${courseId}/thumbnail.webp`;
    const thumbKey = `courses/${courseId}/thumbnail-sm.webp`;

    await Promise.all([
      s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: mainKey,
          Body: optimized,
          ContentType: "image/webp",
          CacheControl: "public, max-age=86400",
        }),
      ),
      s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: thumbKey,
          Body: thumbnail,
          ContentType: "image/webp",
          CacheControl: "public, max-age=86400",
        }),
      ),
    ]);

    // Update course record
    const thumbnailUrl = `${R2_PUBLIC_URL}/${mainKey}`;
    await db
      .update(courses)
      .set({
        thumbnailUrl,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId));

    return {
      courseId,
      thumbnailUrl,
      width: metadata.width,
      height: metadata.height,
      fileSize: optimized.length,
      format: "webp",
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Thumbnail processing error:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to process image",
    });
  }
});
```

### Backend Handler: Delete Thumbnail

```typescript
export const deleteThumbnail = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  if (!course.thumbnailUrl) {
    return {
      success: true,
      courseId,
      message: "No thumbnail to delete",
    };
  }

  // Extract R2 key from URL
  const r2Key = course.thumbnailUrl
    .replace(R2_PUBLIC_URL, "")
    .replace(/^\//, "");

  try {
    // Delete main and thumbnail variants
    await Promise.all([
      s3Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
        }),
      ),
      s3Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key.replace("thumbnail.webp", "thumbnail-sm.webp"),
        }),
      ),
    ]);
  } catch (error) {
    console.error("R2 deletion error:", error);
    // Continue with DB update even if R2 fails
  }

  // Clear thumbnail URL from database
  await db
    .update(courses)
    .set({
      thumbnailUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(courses.id, courseId));

  return {
    success: true,
    courseId,
    message: "Thumbnail removed. Course will use placeholder.",
  };
});
```

### Frontend Component: Thumbnail Upload

```typescript
import { useState } from 'react';
import Image from 'next/image';

export function ThumbnailUpload({ courseId, currentThumbnail }: Props) {
  const [preview, setPreview] = useState<string | null>(currentThumbnail || null);
  const [isUploading, setIsUploading] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleFileSelect = (file: File) => {
    // Validate file
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please use JPEG, PNG, or WebP format');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds 10MB limit');
      return;
    }

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setPreview(src);

      // Get dimensions
      const img = new Image();
      img.onload = () => {
        setDimensions({ width: img.width, height: img.height });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/courses/${courseId}/thumbnail`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setPreview(result.thumbnailUrl);
      setDimensions({ width: result.width, height: result.height });
    } catch (error) {
      alert('Failed to upload thumbnail: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove thumbnail?')) return;

    try {
      const response = await fetch(`/api/v1/courses/${courseId}/thumbnail`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Delete failed');

      setPreview(null);
      setDimensions(null);
    } catch (error) {
      alert('Failed to delete thumbnail: ' + error.message);
    }
  };

  return (
    <div className="thumbnail-upload">
      <div className="preview-container">
        {preview ? (
          <div className="preview">
            <Image
              src={preview}
              alt="Course thumbnail"
              width={400}
              height={225}
              style={{ objectFit: 'cover' }}
            />
            {dimensions && (
              <p className="dimensions">
                {dimensions.width} x {dimensions.height}
              </p>
            )}
            <button onClick={handleDelete} disabled={isUploading}>
              Remove Thumbnail
            </button>
          </div>
        ) : (
          <div className="placeholder">
            <div className="aspect-ratio-guide">16:9</div>
            <p>No thumbnail uploaded</p>
          </div>
        )}
      </div>

      <div className="upload-area">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
          disabled={isUploading}
        />
        <p>Recommended: 1920 x 1080 (16:9 aspect ratio)</p>
        <p>Max file size: 10MB</p>
        {isUploading && <p>Uploading...</p>}
      </div>

      {preview && !currentThumbnail && (
        <button
          onClick={() => {
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (input.files?.[0]) {
              handleUpload(input.files[0]);
            }
          }}
          className="primary"
          disabled={isUploading}
        >
          Save Thumbnail
        </button>
      )}
    </div>
  );
}
```

### Placeholder Generation (Optional)

For dynamic placeholders without thumbnails:

```typescript
async function generatePlaceholder(
  courseTitle: string,
  category: string,
): Promise<Buffer> {
  const svg = `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#E5E7EB"/>
      <text x="960" y="500" font-size="48" text-anchor="middle" fill="#374151">
        ${courseTitle}
      </text>
      <text x="960" y="600" font-size="32" text-anchor="middle" fill="#6B7280">
        ${category}
      </text>
    </svg>
  `;

  return Sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}
```

### Environment Variables

```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret
CLOUDFLARE_R2_BUCKET=mentor-assets
CLOUDFLARE_R2_PUBLIC_URL=https://cdn.mentor.com
```

### Testing Checklist

- Upload JPEG image → stored in R2, resized to 1920x1080
- Upload PNG image → converted to WebP
- Upload >10MB file → 413 error
- Upload unsupported format → 400 error
- Delete thumbnail → reverts to placeholder
- Thumbnail URL accessible and loads correctly
- Thumbnail preview displays during upload
- Aspect ratio maintained (16:9)
- Both main (1920x1080) and thumbnail (400x225) variants stored
- Concurrent uploads handled correctly
