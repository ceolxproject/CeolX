# Task: Resource Upload and Management

## Description

Implement file upload and management system for lesson resources. Resources include downloadable files (PDF, DOC/DOCX, ZIP, MP3, MP4) and external links. Files are stored in Cloudflare R2 with public download URLs generated. This task covers creating, reading, updating, and deleting resources, with CRUD operations and secure file handling.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`
- External: Cloudflare R2 (object storage)

## API Endpoints

### POST /api/v1/courses/{courseId}/lessons/{lessonId}/resources

Upload and create a new resource (file or external link).

**Request (multipart/form-data for files):**

```
POST /api/v1/courses/{courseId}/lessons/{lessonId}/resources
Content-Type: multipart/form-data

file: <binary>
title: string
description: string (optional)
```

**Request (application/json for external links):**

```json
{
  "type": "external_link",
  "title": string,
  "url": string,
  "description": string (optional)
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "courseId": "uuid",
  "type": "pdf" | "doc" | "zip" | "audio" | "video" | "external_link",
  "title": string,
  "description": string | null,
  "filename": string (for files only),
  "fileSize": number (bytes, for files only),
  "url": string,
  "downloadUrl": string (for files only),
  "createdAt": "ISO8601"
}
```

**Error Responses:**

- `400 Bad Request`: Missing title, invalid file type, file too large
- `403 Forbidden`: User is not course owner
- `404 Not Found`: Course or lesson not found
- `413 Payload Too Large`: File exceeds size limit

### GET /api/v1/courses/{courseId}/lessons/{lessonId}/resources

List all resources for a lesson.

**Response (200 OK):**

```json
{
  "resources": [
    {
      "id": "uuid",
      "lessonId": "uuid",
      "type": string,
      "title": string,
      "description": string | null,
      "filename": string | null,
      "fileSize": number | null,
      "url": string,
      "createdAt": "ISO8601"
    }
  ],
  "total": number
}
```

### GET /api/v1/courses/{courseId}/lessons/{lessonId}/resources/{resourceId}

Get a single resource.

**Response (200 OK):**

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "type": string,
  "title": string,
  "description": string | null,
  "filename": string | null,
  "fileSize": number | null,
  "url": string,
  "downloadUrl": string | null,
  "createdAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/lessons/{lessonId}/resources/{resourceId}

Update resource metadata (title, description). File replacement not supported; delete and re-create.

**Request Body:**

```json
{
  "title": string (optional),
  "description": string (optional)
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "type": string,
  "title": string,
  "description": string | null,
  "updatedAt": "ISO8601"
}
```

### DELETE /api/v1/courses/{courseId}/lessons/{lessonId}/resources/{resourceId}

Delete a resource and remove file from R2 storage.

**Response (200 OK):**

```json
{
  "success": true,
  "deletedResourceId": "uuid",
  "fileDeleted": boolean (for R2 files only)
}
```

## Requirements

1. **File Upload**
   - Supported file types: PDF, DOC/DOCX, ZIP, MP3, MP4
   - Auto-detect file type from MIME type
   - Max file size: 500MB per file
   - File stored in R2 with path: `courses/{courseId}/lessons/{lessonId}/resources/{resourceId}.{ext}`
   - Generate public download URL from R2
   - Return file size and filename in response

2. **External Link Support**
   - Type: `external_link`
   - Title required
   - URL required, must be valid HTTP/HTTPS URL
   - Store URL directly (no file upload)
   - Generate public URL pointing to external resource

3. **File Type Detection**
   - PDF: `application/pdf`
   - DOC/DOCX: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - ZIP: `application/zip`
   - MP3: `audio/mpeg`
   - MP4: `video/mp4`
   - Reject all other file types with 400 error

4. **Resource Metadata**
   - `title`: Required, max 200 characters
   - `description`: Optional, max 1000 characters
   - `filename`: Stored original filename
   - `fileSize`: Stored for display purposes
   - `createdAt`: Set on creation
   - `updatedAt`: Set on creation, updated on metadata change

5. **Download URL Generation**
   - Use R2 signed URLs or public bucket access
   - URLs expire if using signed URLs (set expiration: 1 hour for signed)
   - Or use public bucket with stable URLs if configured
   - Return as `downloadUrl` in responses

6. **Authorization**
   - Verify JWT token
   - Verify user is course owner/instructor
   - Return 403 if unauthorized
   - Return 404 if course/lesson not found

7. **Error Handling**
   - Invalid file type: 400 with message "File type not supported"
   - File too large: 413 with message "File exceeds 500MB limit"
   - Missing title: 400 with message "Title is required"
   - Invalid external link URL: 400 with message "Invalid URL"
   - R2 upload failure: log error, return 500

8. **Database Constraints**
   - Foreign key: `lesson_id` references lessons table
   - Index on `(lesson_id, created_at)` for efficient ordering
   - Soft delete option: add `deleted_at` field for audit trail (optional)

## Acceptance Criteria

- [ ] POST endpoint accepts file upload and stores in R2
- [ ] POST endpoint accepts external link URL
- [ ] File type validation prevents unsupported formats
- [ ] File size validation rejects >500MB files
- [ ] Download URL generated and returned for files
- [ ] GET (list) returns all resources for lesson with correct metadata
- [ ] GET (single) returns resource details
- [ ] PUT endpoint updates title and description
- [ ] DELETE endpoint removes file from R2
- [ ] DELETE endpoint removes resource record from database
- [ ] 403 returned if user is not course owner
- [ ] 404 returned if course/lesson not found
- [ ] File path in R2 follows naming convention
- [ ] Resource counts accurate in lesson list
- [ ] Concurrent uploads handled correctly
- [ ] R2 connection and error handling robust

## Dependencies

- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Blocks**: Course Builder UI (course-builder-ui-masterclass.md)

## Technical Notes

### Database Schema

```sql
CREATE TABLE lesson_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  type VARCHAR(50) NOT NULL, -- pdf, doc, zip, audio, video, external_link
  title VARCHAR(200) NOT NULL,
  description TEXT,
  filename VARCHAR(255), -- original filename for file uploads
  file_size INTEGER, -- bytes
  r2_key VARCHAR(500), -- path in R2 storage
  external_url TEXT, -- for external_link type
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP, -- soft delete support

  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  INDEX idx_lesson_resources (lesson_id, created_at)
);
```

### Backend Implementation

**Initialize R2 Client:**

```typescript
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!; // e.g., https://resources.mentor.com
```

**Upload Resource (File):**

```typescript
export const uploadResource = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, lessonId } = event.context.params;

  // Verify ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const formData = await readMultipartFormData(event);
  const file = formData.find((f) => f.name === "file");
  const title = formData.find((f) => f.name === "title")?.data?.toString();
  const description = formData
    .find((f) => f.name === "description")
    ?.data?.toString();

  if (!file || !title) {
    throw createError({ statusCode: 400, message: "File and title required" });
  }

  // Validate file type
  const fileType = detectFileType(file.type, file.filename);
  if (!ALLOWED_FILE_TYPES.includes(fileType)) {
    throw createError({
      statusCode: 400,
      message: "File type not supported. Allowed: PDF, DOC/DOCX, ZIP, MP3, MP4",
    });
  }

  // Validate file size
  const fileSize = file.data.length;
  if (fileSize > 500 * 1024 * 1024) {
    // 500MB
    throw createError({ statusCode: 413, message: "File exceeds 500MB limit" });
  }

  // Generate R2 key
  const resourceId = crypto.randomUUID();
  const ext = getFileExtension(file.filename);
  const r2Key = `courses/${courseId}/lessons/${lessonId}/resources/${resourceId}.${ext}`;

  // Upload to R2
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: file.data,
        ContentType: file.type,
        Metadata: {
          originalFilename: file.filename,
        },
      }),
    );
  } catch (error) {
    console.error("R2 upload failed:", error);
    throw createError({ statusCode: 500, message: "File upload failed" });
  }

  // Generate download URL
  let downloadUrl = `${R2_PUBLIC_URL}/${r2Key}`;
  if (!process.env.CLOUDFLARE_R2_PUBLIC_ENABLED) {
    // Use signed URL if bucket not public
    downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
      }),
      { expiresIn: 3600 }, // 1 hour
    );
  }

  // Create resource record
  const resource = await db
    .insert(lessonResources)
    .values({
      id: resourceId,
      lessonId,
      courseId,
      type: fileType,
      title,
      description: description || null,
      filename: file.filename,
      fileSize,
      r2Key,
      externalUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  setResponseStatus(event, 201);
  return {
    ...resource[0],
    downloadUrl,
  };
});

function detectFileType(mimeType: string, filename: string): string {
  const mimeMap: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "doc",
    "application/zip": "zip",
    "audio/mpeg": "audio",
    "video/mp4": "video",
  };

  return mimeMap[mimeType] || "unknown";
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "bin";
}

const ALLOWED_FILE_TYPES = ["pdf", "doc", "zip", "audio", "video"];
```

**Create External Link Resource:**

```typescript
// In uploadResource handler, also accept JSON body for external links:
if (getHeader(event, "content-type")?.includes("application/json")) {
  const body = await readBody(event);

  if (body.type === "external_link") {
    validateExternalLink(body.url);

    const resource = await db
      .insert(lessonResources)
      .values({
        id: crypto.randomUUID(),
        lessonId,
        courseId,
        type: "external_link",
        title: body.title,
        description: body.description || null,
        filename: null,
        fileSize: null,
        r2Key: null,
        externalUrl: body.url,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    setResponseStatus(event, 201);
    return {
      ...resource[0],
      url: body.url,
    };
  }
}

function validateExternalLink(url: string) {
  try {
    const parsed = new URL(url);
    if (!["http", "https"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw createError({
      statusCode: 400,
      message: "Invalid URL. Must be HTTP or HTTPS.",
    });
  }
}
```

**Delete Resource:**

```typescript
export const deleteResource = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, lessonId, resourceId } = event.context.params;

  // Verify ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Get resource
  const resource = await db.query.lessonResources.findFirst({
    where: (resources, { eq }) => eq(resources.id, resourceId),
  });

  if (!resource) throw createError({ statusCode: 404 });

  // Delete from R2 if file
  let fileDeleted = false;
  if (resource.r2Key) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET,
          Key: resource.r2Key,
        }),
      );
      fileDeleted = true;
    } catch (error) {
      console.error("R2 deletion failed:", error);
      // Continue with DB deletion even if R2 fails
    }
  }

  // Delete resource record
  await db.delete(lessonResources).where(eq(lessonResources.id, resourceId));

  return {
    success: true,
    deletedResourceId: resourceId,
    fileDeleted,
  };
});
```

### Frontend Component: Resource Upload

```typescript
import { useState } from 'react';

export function ResourceUploadForm({ lessonId, courseId, onSuccess }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'link'>('file');

  const handleFileUpload = async (file: File, title: string, description?: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      if (description) formData.append('description', description);

      const response = await fetch(
        `/api/v1/courses/${courseId}/lessons/${lessonId}/resources`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const resource = await response.json();
      setResources([...resources, resource]);
      onSuccess?.();
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async (url: string, title: string, description?: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(
        `/api/v1/courses/${courseId}/lessons/${lessonId}/resources`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'external_link',
            url,
            title,
            description
          })
        }
      );

      if (!response.ok) throw new Error('Failed to add link');

      const resource = await response.json();
      setResources([...resources, resource]);
      onSuccess?.();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!confirm('Delete this resource?')) return;

    try {
      await fetch(
        `/api/v1/courses/${courseId}/lessons/${lessonId}/resources/${resourceId}`,
        { method: 'DELETE' }
      );
      setResources(resources.filter(r => r.id !== resourceId));
    } catch (error) {
      alert('Failed to delete resource');
    }
  };

  return (
    <div className="resource-upload">
      <div className="upload-type">
        <button onClick={() => setUploadType('file')} className={uploadType === 'file' ? 'active' : ''}>
          Upload File
        </button>
        <button onClick={() => setUploadType('link')} className={uploadType === 'link' ? 'active' : ''}>
          Add Link
        </button>
      </div>

      {uploadType === 'file' && (
        <FileUploadArea onUpload={handleFileUpload} />
      )}

      {uploadType === 'link' && (
        <LinkInputForm onSubmit={handleAddLink} />
      )}

      <div className="resources-list">
        {resources.map(resource => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            onDelete={() => handleDelete(resource.id)}
          />
        ))}
      </div>

      {isUploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Environment Variables

```
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret
CLOUDFLARE_R2_BUCKET=mentor-resources
CLOUDFLARE_R2_PUBLIC_URL=https://resources.mentor.com
CLOUDFLARE_R2_PUBLIC_ENABLED=true
```

### Testing Checklist

- Upload PDF file → stored in R2, record created
- Upload DOC, DOCX, ZIP, MP3, MP4 → all succeed
- Upload unsupported file type → 400 error
- Upload >500MB file → 413 error
- Add external link → record created, URL stored
- Delete file → removed from R2 and DB
- Delete link → removed from DB
- Download URL accessible and returns correct file
- Resource metadata displays correctly
