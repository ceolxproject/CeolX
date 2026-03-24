# Task 22: R2 Signed URLs for Resource Downloads

## Description

Implement secure, time-limited signed URL generation for all resource files stored in Cloudflare R2. All downloadable resources (PDFs, documents, archives, audio, video, images) must be protected from public access and unauthorized sharing. Signed URLs allow authenticated users (learners, instructors, admins) to download resources for a limited time window while preventing direct sharing of S3/R2 bucket URLs. This task ensures intellectual property protection and download audit capability.

## Affected Apps/Packages

- **Hono API Backend** (signed URL generation and authorization logic)
- **Cloudflare R2** (object storage backend with S3-compatible API)
- **web-learner** (resource download for enrolled learners)
- **web-mentor** (instructor resource management and downloads)
- **web-admin** (admin resource access and audit)
- **AWS SDK** (S3-compatible R2 access: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **File Types**: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP, RAR, MP3, WAV, MP4, MOV, PNG, JPG, GIF, WebP

## API Endpoints

### Generate Download URL (Generic Resources)

```
GET /api/v1/resources/:resourceId/download
Authorization: Required (Bearer token or session)
Query Parameters:
  - expiryHours: number (optional, default: 1, max: 24)
Response: 302 Found
Location: https://r2-signed-url-with-token.s3.amazonaws.com/...?X-Amz-Signature=...
Headers:
  Content-Disposition: attachment; filename="resource-name.pdf"
  Cache-Control: no-cache
```

### Get Resource Metadata

```
GET /api/v1/resources/:resourceId/info
Authorization: Required
Response: 200 OK
{
  "resourceId": "uuid",
  "fileName": "Course_Syllabus.pdf",
  "fileSizeBytes": 2048000,
  "fileType": "application/pdf",
  "uploadedBy": {
    "userId": "uuid",
    "name": "Instructor Name"
  },
  "uploadedAt": "2025-02-15T10:00:00Z",
  "courseId": "uuid",
  "lessonId": "uuid (optional)",
  "description": "string",
  "downloadCount": 42,
  "isPublic": false
}
```

### List Course Resources

```
GET /api/v1/courses/:courseId/resources
Authorization: Required
Response: 200 OK
{
  "resources": [
    {
      "resourceId": "uuid",
      "fileName": "string",
      "fileSizeBytes": number,
      "uploadedAt": "ISO8601",
      "description": "string",
      "downloadUrl": "/api/v1/resources/:resourceId/download"
    }
  ],
  "totalCount": number
}
```

### Generate Instructor ID Document URL (Private)

```
GET /api/v1/instructors/:instructorId/id-document/download
Authorization: Required (Admin only)
Query Parameters:
  - expiryHours: number (optional, default: 1, max: 24)
Response: 302 Found
Location: https://r2-signed-url.s3.amazonaws.com/...
Headers:
  Content-Disposition: attachment; filename="id_document.pdf"
```

### Get Course Thumbnail

```
GET /api/v1/courses/:courseId/thumbnail
Authorization: Not Required (Public endpoint)
Response: 302 Found or 200 OK with image data
Location: https://r2-signed-url.s3.amazonaws.com/... (cached, no auth)
OR
[Binary image data]
```

## Requirements

### R2 Configuration & Setup

#### Environment Variables

```
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=mentor-resources
R2_PUBLIC_URL=https://cdn.example.com (optional, for public URLs)
R2_SIGNED_URL_EXPIRY_HOURS=1 (default expiry)
R2_MAX_SIGNED_URL_EXPIRY_HOURS=24 (maximum allowed)
```

#### Bucket Configuration

- Create R2 bucket: `mentor-resources`
- Block all public access (private by default)
- Enable CORS for download endpoints:
  ```json
  {
    "CORSRules": [
      {
        "AllowedOrigins": [
          "https://learner.example.com",
          "https://mentor.example.com"
        ],
        "AllowedMethods": ["GET"],
        "AllowedHeaders": ["*"],
        "MaxAgeSeconds": 3600
      }
    ]
  }
  ```
- Configure lifecycle policies to delete old files after 1 year (configurable)
- Enable versioning for audit trail (optional but recommended)

#### S3-Compatible API Configuration

- Use AWS SDK with R2 endpoint:
  ```
  endpoint: https://{ACCOUNT_ID}.r2.cloudflarestorage.com
  region: auto (or us-west-2)
  accessKeyId: R2_ACCESS_KEY_ID
  secretAccessKey: R2_SECRET_ACCESS_KEY
  ```

### Resource Classification & Authorization

#### Learner Access

- Can download resources for courses they are enrolled in
- Cannot download resources from courses they haven't enrolled
- Grace period access: Learners with active grace periods can still download resources
- Check database:
  ```sql
  SELECT * FROM enrollments
  WHERE user_id = $1
    AND course_id = (SELECT course_id FROM resources WHERE id = $2)
    AND status IN ('active', 'grace_period')
  ```

#### Instructor Access

- Can download their own uploaded resources
- Can download resources from courses they teach (instructor_id match)
- Can only generate signed URLs for their own resources (except admins)
- Check ownership:
  ```sql
  SELECT * FROM resources
  WHERE id = $1
    AND instructor_id = $2
  ```

#### Admin Access

- Can download any resource from any course
- Can download instructor ID documents
- Can audit all resource downloads

#### Public Resources (Course Thumbnails)

- Course thumbnail URLs are public (no authentication required)
- However, still use signed URLs for CDN caching and usage tracking
- Signed URLs prevent direct bucket access
- Short expiry (24 hours) acceptable for public resources

### File Upload & Storage

#### File Naming Convention

- Store with structure: `courses/{courseId}/resources/{resourceId}/{fileName}`
- Example: `courses/abc-123-def/resources/res-456-ghi/Course_Syllabus.pdf`
- For ID documents: `instructors/{instructorId}/id-documents/{documentId}.pdf`
- For thumbnails: `courses/{courseId}/thumbnail.jpg`

#### File Size & Type Restrictions

- Maximum file size: 1 GB
- Allowed file types:
  - Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, ODT, ODS, ODP
  - Archives: ZIP, RAR, 7Z, TAR, GZ
  - Media: MP3, WAV, M4A, OGG, MP4, MOV, AVI, WEBM
  - Images: PNG, JPG, JPEG, GIF, WEBP, SVG
- Validate file type by extension AND MIME type (not just extension)
- Reject executable types: EXE, BAT, COM, SH, PS1, DLL, JAR, APK

#### Virus Scanning (Optional)

- Integrate with ClamAV or VirusTotal for uploaded files
- Scan asynchronously, quarantine suspicious files
- Notify admin of potential threats

### Signed URL Generation

#### URL Signing Process

- Use `@aws-sdk/s3-request-presigner` package
- Generate presigned URLs using AWS SDK v3
- Example code:

  ```typescript
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

  const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `courses/${courseId}/resources/${resourceId}/${fileName}`,
    }),
    { expiresIn: 3600 }, // 1 hour in seconds
  );
  ```

#### URL Properties

- **Expiry**: Default 1 hour, maximum 24 hours
- **Method**: GET only (no PUT, DELETE, POST)
- **Signature**: Includes AWS Signature Version 4
- **Scope**: Specific to file path and bucket
- **Tamper-Proof**: Any modification to URL invalidates signature

### Authorization Checks

#### Download Authorization

1. Verify user is authenticated (valid JWT or session)
2. Extract user ID from token/session
3. Fetch resource metadata (file path, course ID, access level)
4. Check user's enrollment status in course:
   - For learners: Must be enrolled (active or grace_period)
   - For instructors: Must own course or resource
   - For admins: Always allowed
5. If authorized, generate signed URL and redirect (302 Found)
6. If not authorized, return 403 Forbidden

#### ID Document Access (Instructor Documents)

- Only admin role can download instructor ID documents
- ID documents are sensitive and require higher access level than course resources
- Audit log every ID document download with admin ID and timestamp

#### Course Thumbnail Access

- No authorization check required
- Public endpoint accessible to anonymous users
- Still use signed URL to prevent direct bucket access
- Cache signature for 24 hours in CDN

### Rate Limiting & Audit Logging

#### Rate Limiting

- Maximum 50 download URL generations per user per hour
- Limit applies across all resources (total limit, not per-file)
- Rate limit key: `download_url_generation:<userId>`
- Return 429 Too Many Requests when exceeded
- Bypass for admins (no rate limit)

#### Audit Logging

- Log every download URL generation:
  ```json
  {
    "action": "DOWNLOAD_URL_GENERATED",
    "userId": "uuid",
    "resourceId": "uuid",
    "fileName": "string",
    "fileSizeBytes": number,
    "courseId": "uuid",
    "expiryHours": number,
    "timestamp": "ISO8601",
    "ipAddress": "192.168.1.1"
  }
  ```
- Optional: Log actual downloads (track when users click link)
  - Requires tracking pixel or callback when file serves
  - May not be possible with direct R2 downloads

#### Download Tracking

- Maintain count of downloads per resource
- Update `resources.download_count` field
- Useful for analytics and popularity tracking
- Trigger on signed URL generation (not actual download)

### Error Handling

#### Authorization Errors

- **Unauthenticated**: Return 401 Unauthorized
- **Not Enrolled**: Return 403 Forbidden with message "You are not enrolled in this course"
- **Resource Not Found**: Return 404 Not Found
- **Expired Grace Period**: Return 403 Forbidden with message "Your access to this course has expired"

#### File Errors

- **File Deleted from R2**: Return 404 Not Found (catch S3 exception)
- **File Corrupted**: Return 500 Internal Server Error
- **Bucket Access Error**: Return 500 Internal Server Error (never expose AWS credentials)

#### Client Errors

- **Invalid Expiry Hours**: Return 400 Bad Request (expiry must be 1-24 hours)
- **Unsupported File Type**: Return 400 Bad Request

#### Rate Limit Error

- **Too Many Requests**: Return 429 with Retry-After header
  ```
  Retry-After: 3600
  ```

### Special Cases

#### Course Thumbnail Handling

- Stored at: `courses/{courseId}/thumbnail.jpg`
- Public access (no auth required)
- Signed URL still recommended for security
- Serve with Cache-Control: public, max-age=86400 (24 hours)
- Can be cached in CDN (Cloudflare)

#### Instructor ID Documents

- Stored at: `instructors/{instructorId}/id-documents/{documentId}.pdf`
- Admin-only access
- Never expose URL to instructor (admin must keep URL private)
- Audit log every download with admin details
- Short expiry (1 hour maximum)

#### Lesson-Specific Resources

- Resources can be attached to specific lessons within a course
- Learners must be enrolled in course to access lesson resources
- Group resources by lesson for better organization
- Optional: Restrict access to specific lessons (progressive unlock)

### Caching Strategy

#### Server-Side Caching

- Cache signed URLs for authenticated users (short TTL, e.g., 5 minutes)
- Cache-key: `signed_url:<resourceId>:<userId>:<expiryHours>`
- If cached URL is still valid, return cached version
- Reduces R2 API calls and improves response time

#### Client-Side Caching

- Set Cache-Control: no-cache on redirect response
- Browsers may cache redirect response; acceptable since URL expires
- Signed URL cannot be reused after expiry

#### CDN Caching

- Course thumbnails can be cached in Cloudflare CDN (public)
- Cache-Control: public, max-age=86400 for thumbnails
- Private resources: Cache-Control: private (no proxy caching)

### Integration with File Management

#### Upload Workflow

- User selects file in web-mentor or web-admin
- File sent to Hono API endpoint (e.g., POST /api/v1/resources)
- Backend stores file metadata in database (filename, size, course ID, instructor ID)
- Backend uploads file to R2 with S3 API
- Return resource ID to client
- Client stores resource ID for future downloads

#### Download Workflow

- Learner clicks download button in course
- Client calls GET /api/v1/resources/:resourceId/download
- Backend verifies authorization
- Backend generates signed URL
- Backend redirects (302) to signed R2 URL
- Browser downloads file from R2 directly
- R2 returns file with Content-Disposition: attachment header

## Acceptance Criteria

- [ ] Environment variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` are configured
- [ ] R2 bucket is created and all public access is blocked
- [ ] CORS configuration is set in R2 bucket for learner/mentor domains
- [ ] AWS SDK is imported and configured with R2 endpoint
- [ ] Signed URL generation function is implemented in `/src/lib/r2.ts`
- [ ] Default signed URL expiry is 1 hour
- [ ] Maximum signed URL expiry is 24 hours
- [ ] API endpoint `GET /api/v1/resources/:resourceId/download` is implemented
- [ ] Authorization check verifies learner enrollment before generating download URL
- [ ] Authorization check verifies instructor ownership for instructor uploads
- [ ] Authorization check allows admin access to any resource
- [ ] Unauthorized users receive 403 Forbidden response
- [ ] Non-enrolled learners receive 403 Forbidden with enrollment message
- [ ] Resource not found returns 404 Not Found
- [ ] Invalid expiry parameter returns 400 Bad Request
- [ ] Signed URL is generated and returned as 302 redirect (Location header)
- [ ] Signed URL includes AWS Signature Version 4
- [ ] Signed URL works for actual file download from R2
- [ ] Signed URL expires after specified duration (URL no longer works after expiry)
- [ ] Rate limiting is enforced (50 requests per user per hour)
- [ ] Rate limit 429 response includes Retry-After header
- [ ] Audit log entry is created for each URL generation
- [ ] Audit log includes userId, resourceId, fileName, timestamp
- [ ] Resource download count is incremented on URL generation
- [ ] Instructor ID document endpoint restricts access to admin only
- [ ] Course thumbnail endpoint requires no authentication
- [ ] Course thumbnail signed URL works without login
- [ ] GET /api/v1/resources/:resourceId/info returns resource metadata
- [ ] GET /api/v1/courses/:courseId/resources lists all course resources
- [ ] File type validation rejects executable types (EXE, BAT, COM, etc.)
- [ ] File size validation rejects files > 1 GB
- [ ] MIME type validation confirms file type matches extension
- [ ] Integration test: Enrolled learner can download course resource
- [ ] Integration test: Non-enrolled learner cannot download course resource
- [ ] Integration test: Instructor can download their own resource
- [ ] Integration test: Admin can download any resource
- [ ] Integration test: Grace period learner can still download resources
- [ ] Integration test: Grace period expired learner cannot download
- [ ] E2E test: Learner downloads PDF from course resources
- [ ] E2E test: Instructor downloads uploaded document
- [ ] E2E test: Admin downloads instructor ID document
- [ ] Security test: Signed URL is tamper-proof (modification invalidates signature)
- [ ] Security test: Expired URL cannot be used for download
- [ ] Security test: Unauthorized user cannot generate URL for other user's resources
- [ ] Performance test: Signed URL generation completes in <100ms
- [ ] Performance test: 1000 concurrent download requests succeed without R2 rate limiting
- [ ] Documentation: API endpoints documented with examples
- [ ] Documentation: R2 setup instructions included in ops runbook

## Dependencies

### Must Complete Before

- **Task 3: Environment Setup** — R2 credentials and environment variables
- **Task 4: Hono App Scaffolding** — Basic Hono app with middleware
- **Task 7: BetterAuth Integration** — User authentication
- **Task 12: Course Management Core** — Course records
- **Task 13: Enrollment Management** — Enrollment records
- **Task 15: Resource Upload & Management** — File upload to R2

### May Be Blocked By

- Cloudflare R2 account creation and API credentials
- AWS SDK npm package installation

### Blocking Tasks

- Task 23: Course Material Management (depends on resource downloads)
- Task 24: Instructor Resource Upload (depends on signed URLs)

## Technical Notes

### AWS SDK v3 Configuration

- Use modular imports to reduce bundle size:
  ```typescript
  import { S3Client } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import { GetObjectCommand } from "@aws-sdk/client-s3";
  ```
- Install only required packages: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- Configure SDK client once at app startup, reuse for all requests

### R2 vs S3 Compatibility

- R2 uses S3-compatible API, compatible with AWS SDK
- Endpoint URL format: `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`
- Region parameter: use 'auto' or any valid AWS region name
- Authentication: Same AccessKey/SecretKey model as S3
- Signed URL format: Identical to S3 presigned URLs

### Presigned URL Details

- Format: `https://{bucket}.s3.amazonaws.com/{key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Date=...&X-Amz-Expires=...&X-Amz-SignedHeaders=...&X-Amz-Signature=...`
- Each URL is unique and cannot be predicted without secret key
- URL includes request timestamp and expiry, preventing replay attacks
- Signature covers bucket, key, HTTP method, and request parameters

### File Path Organization

- Use consistent naming: `{resource_type}/{owner_id}/{resource_id}/{filename}`
- Examples:
  - `courses/abc-123/resources/res-456/syllabus.pdf`
  - `instructors/instr-789/id-documents/doc-101.pdf`
  - `courses/abc-123/thumbnail.jpg`
- Avoid nested directories that exceed 1000 levels (R2/S3 limitation)

### Error Handling Strategy

- Wrap S3 API calls in try-catch
- Catch specific S3 errors:
  - `NoSuchKey`: File not found (return 404)
  - `NoSuchBucket`: Configuration error (log and return 500)
  - `AccessDenied`: Credential error (log and return 500)
- Log detailed errors server-side, return generic messages to client

### Performance Optimization

- Cache S3Client instance globally (do not create per request)
- Implement connection pooling in SDK
- Use batch operations if generating multiple URLs
- Monitor AWS SDK performance; consider lazy loading if needed

### Security Best Practices

- Never expose R2 bucket URL directly (always use signed URLs)
- Never hardcode credentials (use environment variables)
- Rotate access keys quarterly
- Use separate R2 keys for different environments (dev, staging, prod)
- Monitor access patterns for suspicious activity
- Enable R2 audit logs for compliance

### Testing Strategy

- Unit tests: Test signed URL generation with mock S3Client
- Unit tests: Test authorization logic (enrollment checks, instructor ownership)
- Integration tests: Real R2 bucket (use test bucket, not production)
- Integration tests: Upload file, generate signed URL, verify download works
- Load tests: Generate 1000 URLs concurrently, monitor latency
- Security tests: Verify tampered URLs fail, expired URLs fail

### Debugging Tips

- Use AWS CLI to inspect R2 bucket and file uploads:
  ```bash
  aws s3 ls s3://bucket-name/ --endpoint-url https://{ACCOUNT_ID}.r2.cloudflarestorage.com
  ```
- Log signed URLs in development (mask signature in logs)
- Test signed URLs manually with curl:
  ```bash
  curl -I "https://signed-url-here"
  ```
- Enable CloudFlare Analytics to track R2 usage and costs

### Related Documentation

- Cloudflare R2 Docs: https://developers.cloudflare.com/r2/
- AWS SDK v3 S3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-s3/
- Presigned URLs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
- S3 Signature Version 4: https://docs.aws.amazon.com/AmazonS3/latest/userguide/signing-requests.html
