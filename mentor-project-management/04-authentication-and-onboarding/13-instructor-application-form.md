# Instructor Application Form

## Description

Implement instructor signup and application process for Mentor Web App. Users fill detailed application form including expertise areas, portfolio links, sample work uploads, and photo ID verification. Photo ID uploaded to private R2 bucket with signed URLs. Explicit consent screen explains purpose and retention of ID. Submitted applications sent to admin review queue.

## Affected Apps/Packages

- Frontend: Mentor Web App (Next.js)
- Backend: Hono API
- Storage: Cloudflare R2 (private bucket)
- Email Service: Postmark

## API Endpoints

### POST /auth/instructor-application

Submit instructor application.

**Request Body** (multipart/form-data):

```json
{
  "expertise": ["makeup", "skincare", "business"],
  "experience_years": 5,
  "bio": "Professional makeup artist with 5 years experience...",
  "portfolio_link": "https://example.com/portfolio",
  "instagram": "@myinsta",
  "youtube": "https://youtube.com/@channel",
  "certifications": "Professional Makeup Artist Certification",
  "sample_video": <File>,
  "photo_id": <File>,
  "phone": "+1234567890",
  "company": "My Makeup Studio",
  "teaching_experience": "Taught 50+ students online"
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "message": "Application submitted successfully",
  "applicationId": "app_abc123",
  "status": "pending_review",
  "nextSteps": "An admin will review your application within 24 hours"
}
```

**Error Responses**:

- `400 Bad Request`: Missing required fields
- `413 Payload Too Large`: File exceeds size limit
- `415 Unsupported Media Type`: Invalid file type
- `409 Conflict`: User already has pending/approved application

### GET /auth/instructor-application/{applicationId}

Get application details (user can view own, admin can view all).

**Response** (200 OK):

```json
{
  "id": "app_abc123",
  "userId": "user_xyz789",
  "status": "pending_review",
  "expertise": ["makeup", "skincare"],
  "experience_years": 5,
  "bio": "...",
  "portfolio_link": "...",
  "social_media": {
    "instagram": "@myinsta",
    "youtube": "https://youtube.com/@channel"
  },
  "documents": {
    "sample_video": {
      "url": "https://r2-signed-url.example.com/...",
      "uploadedAt": "2024-02-18T10:30:00Z",
      "expiresAt": "2024-02-25T10:30:00Z"
    },
    "photo_id": {
      "url": "https://r2-signed-url.example.com/...",
      "uploadedAt": "2024-02-18T10:30:00Z",
      "expiresAt": "2024-02-25T10:30:00Z"
    }
  },
  "submittedAt": "2024-02-18T10:30:00Z",
  "reviewedAt": null,
  "reviewedBy": null,
  "feedback": null
}
```

## Requirements

### Application Form Fields

**Personal Information** (Required):

- Email: Read-only (from user account)
- Name: Read-only (from user account)
- Phone: Required, E.164 format, min/max validation
- Company/Studio Name: Optional, max 200 chars

**Expertise** (Required):

- Select expertise areas (checkboxes):
  - Makeup Application
  - Skincare & Treatment
  - Hair & Scalp Care
  - Nail Art & Design
  - Beauty Business
  - Social Media & Marketing
  - Professional Makeup
  - Natural & Organic Beauty
  - Fragrance & Perfumery
  - Other
- Minimum 1, maximum 5 selections

**Experience** (Required):

- Years of experience: Number field (0-70)
- Bio/About: Text area, 100-2000 characters
- Teaching experience: Text area, optional, describe past teaching
- Certifications: Text area, optional, list certifications

**Portfolio** (Optional):

- Portfolio link: URL field with validation
- Instagram handle: Optional, format validation
- YouTube channel: Optional, URL validation
- Other website: Optional, URL field

**Sample Work** (Required):

- Upload sample video: mp4/webm, max 500MB
- Upload photo ID: jpg/png, max 5MB
- Explicit consent checkbox (required): "I consent to verification of my identity..."

### Photo ID Upload

**Consent Screen**:

- Explain what ID is needed: "Government-issued ID (passport, driver's license, national ID)"
- Explain purpose: "To verify your identity and ensure instructor credentials"
- Explain retention: "Your ID will be stored securely and deleted 30 days after approval/rejection"
- Explain privacy: "Only visible to admin staff, never shared publicly"
- Checkbox (required): "I have read and understood the above"
- Button: "Upload ID" or "I'll skip for now" (optional)

**ID Upload Process**:

- File picker (jpg/png only)
- Max 5MB
- Upload directly to Cloudflare R2 (server-side upload)
- Store R2 key path, not file content
- Generate signed URL (7-day expiry for admin viewing)
- Mark submission with ID attached or "pending ID"

**Data Retention**:

- Store ID upload record with expiration date (30 days from decision)
- Scheduled job to delete ID files after expiration
- Keep application record, delete file only
- Log deletion for audit trail

### Sample Video Upload

- Accept mp4, webm formats
- Max 500MB (allow longer samples)
- Upload to R2 with public URL
- Can be embedded in application view
- Optional delete before final submission

### Email Notifications

- Send confirmation email after application submission
- Include application ID and link to view status
- Include estimated review timeline (24-48 hours)
- Template: `instructor-application-submitted`

### Application Status Tracking

- Status values: pending_review, approved, rejected
- Track status changes with timestamps
- Store review feedback for rejections
- Notification on status change

### Frontend Form Implementation

**Form Layout**:

- Multi-step form (3 sections):
  1. Personal & Expertise
  2. Experience & Portfolio
  3. Photo ID Upload & Review
- Progress indicator
- Save as draft (optional)
- Validation on each field

**File Upload Components**:

- Drag-and-drop zones
- File type validation (client-side)
- File size warnings
- Progress bar during upload
- Error handling with retry

**Consent Management**:

- Modal for ID consent (explain purpose/retention)
- Checkbox required before upload
- Store consent timestamp
- Timestamp recorded in application

### Validation Rules

- Phone: E.164 format, valid length
- Bio: 100-2000 characters, no HTML
- Years of experience: 0-70
- URLs: Valid format, accessible (optional check)
- Expertise: At least 1, max 5
- Files: Correct MIME type and size

### Database Schema

```typescript
export const instructorApplications = pgTable("instructor_application", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  status: text("status").notNull().default("pending_review"), // pending_review, approved, rejected
  expertise: jsonb("expertise").notNull(), // Array of expertise IDs
  experienceYears: integer("experience_years").notNull(),
  bio: text("bio").notNull(),
  phone: text("phone").notNull(),
  company: text("company"),
  teachingExperience: text("teaching_experience"),
  certifications: text("certifications"),
  portfolioLink: text("portfolio_link"),
  instagram: text("instagram"),
  youtube: text("youtube"),
  sampleVideoUrl: text("sample_video_url"),
  photoIdKey: text("photo_id_key"), // R2 object key
  photoIdConsentedAt: timestamp("photo_id_consented_at"),
  photoIdExpiresAt: timestamp("photo_id_expires_at"), // 30 days after decision
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  feedback: text("feedback"), // For rejection reason
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const idUploadConsentLog = pgTable("id_upload_consent_log", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  applicationId: text("application_id")
    .notNull()
    .references(() => instructorApplications.id),
  consentedAt: timestamp("consented_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
```

### Hono Handlers

**Submit Application**:

```typescript
export async function handleSubmitApplication(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  // Check if already has application
  const existing = await db.query.instructorApplications.findFirst({
    where: and(
      eq(instructorApplications.userId, user.id),
      inArray(instructorApplications.status, ["pending_review", "approved"])
    ),
  });

  if (existing) {
    return c.json(
      {
        error: "APPLICATION_EXISTS",
        message: "You already have a pending or approved application",
      },
      409
    );
  }

  // Parse form data
  const form = await c.req.parseFormData();
  const expertise = (form.getAll("expertise") || []) as string[];
  const bio = form.get("bio") as string;
  const phone = form.get("phone") as string;

  // Validation
  if (expertise.length === 0 || expertise.length > 5) {
    return c.json({ error: "INVALID_EXPERTISE" }, 400);
  }

  if (!bio || bio.length < 100 || bio.length > 2000) {
    return c.json({ error: "INVALID_BIO" }, 400);
  }

  if (!phone || !isValidPhone(phone)) {
    return c.json({ error: "INVALID_PHONE" }, 400);
  }

  // Handle file uploads
  const sampleVideo = form.get("sample_video") as File;
  const photoId = form.get("photo_id") as File;

  let sampleVideoUrl = null;
  let photoIdKey = null;

  if (sampleVideo) {
    // Upload to R2
    sampleVideoUrl = await uploadToR2(
      sampleVideo,
      `applications/${user.id}/sample-video`
    );
  }

  if (photoId && form.get("photo_id_consented") === "true") {
    // Upload ID to private R2
    photoIdKey = await uploadToPrivateR2(
      photoId,
      `applications/${user.id}/photo-id`
    );

    // Log consent
    await db.insert(idUploadConsentLog).values({
      id: crypto.randomUUID(),
      userId: user.id,
      applicationId: crypto.randomUUID(),
      consentedAt: new Date(),
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    });
  }

  // Create application
  const applicationId = crypto.randomUUID();
  const photoIdExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const application = await db
    .insert(instructorApplications)
    .values({
      id: applicationId,
      userId: user.id,
      expertise,
      experienceYears: parseInt(form.get("experience_years") as string),
      bio,
      phone,
      company: form.get("company"),
      teachingExperience: form.get("teaching_experience"),
      certifications: form.get("certifications"),
      portfolioLink: form.get("portfolio_link"),
      instagram: form.get("instagram"),
      youtube: form.get("youtube"),
      sampleVideoUrl,
      photoIdKey,
      photoIdConsentedAt: photoId ? new Date() : null,
      photoIdExpiresAt: photoId ? photoIdExpiresAt : null,
    })
    .returning();

  // Send confirmation email
  await sendApplicationConfirmationEmail(user.email, user.name, applicationId);

  // Notify admins
  await notifyAdminsOfNewApplication(applicationId);

  console.log(`Instructor application submitted: ${applicationId}`);

  return c.json(
    {
      success: true,
      message: "Application submitted successfully",
      applicationId,
      status: "pending_review",
    },
    201
  );
}
```

### Frontend Form Component

```typescript
// components/InstructorApplicationForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  expertise: z.array(z.string()).min(1).max(5),
  experience_years: z.number().min(0).max(70),
  bio: z.string().min(100).max(2000),
  phone: z.string().regex(/^\+\d{1,14}$/),
  company: z.string().optional(),
  portfolio_link: z.string().url().optional().or(z.literal('')),
  instagram: z.string().optional(),
  youtube: z.string().url().optional().or(z.literal('')),
  sample_video: z.instanceof(File).optional(),
  photo_id: z.instanceof(File).optional(),
  photo_id_consented: z.boolean(),
});

export function InstructorApplicationForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      expertise: [],
      experience_years: 0,
      photo_id_consented: false,
    },
  });

  const expertise = watch('expertise');

  const onSubmit = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (key === 'expertise') {
          data[key].forEach((e: string) => formData.append('expertise', e));
        } else if (data[key] instanceof File) {
          formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      });

      const response = await fetch('/api/auth/instructor-application', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      // Success
      window.location.href = '/instructor/application-submitted';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="application-form">
      {step === 1 && (
        <div className="step">
          <h2>Personal & Expertise</h2>

          <div className="field-group">
            <label>Expertise Areas (select 1-5)*</label>
            {['makeup', 'skincare', 'hair', 'nails', 'business', 'marketing', 'professional', 'natural', 'fragrance', 'other'].map(area => (
              <label key={area}>
                <input
                  type="checkbox"
                  value={area}
                  {...register('expertise')}
                />
                {area}
              </label>
            ))}
            {errors.expertise && <span className="error">{errors.expertise.message}</span>}
          </div>

          <div className="field-group">
            <label>Years of Experience*</label>
            <input
              type="number"
              min="0"
              max="70"
              {...register('experience_years', { valueAsNumber: true })}
            />
            {errors.experience_years && <span className="error">{errors.experience_years.message}</span>}
          </div>

          <div className="field-group">
            <label>Bio (100-2000 characters)*</label>
            <textarea
              {...register('bio')}
              placeholder="Tell us about your experience and background..."
            />
            {errors.bio && <span className="error">{errors.bio.message}</span>}
          </div>

          <div className="field-group">
            <label>Phone Number*</label>
            <input
              type="tel"
              placeholder="+1234567890"
              {...register('phone')}
            />
            {errors.phone && <span className="error">{errors.phone.message}</span>}
          </div>

          <div className="actions">
            <button type="button" onClick={() => setStep(2)} className="btn-primary">
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="step">
          <h2>Experience & Portfolio</h2>

          <div className="field-group">
            <label>Company/Studio Name</label>
            <input
              type="text"
              placeholder="Your company name"
              {...register('company')}
            />
          </div>

          <div className="field-group">
            <label>Teaching Experience</label>
            <textarea
              placeholder="Describe any previous teaching experience"
              {...register('teaching_experience')}
            />
          </div>

          <div className="field-group">
            <label>Certifications</label>
            <textarea
              placeholder="List any relevant certifications"
              {...register('certifications')}
            />
          </div>

          <div className="field-group">
            <label>Portfolio Link</label>
            <input
              type="url"
              placeholder="https://..."
              {...register('portfolio_link')}
            />
          </div>

          <div className="field-group">
            <label>Instagram</label>
            <input
              type="text"
              placeholder="@handle"
              {...register('instagram')}
            />
          </div>

          <div className="field-group">
            <label>YouTube Channel</label>
            <input
              type="url"
              placeholder="https://youtube.com/..."
              {...register('youtube')}
            />
          </div>

          <div className="actions">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">
              Back
            </button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary">
              Next
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step">
          <h2>Documents & Verification</h2>

          <div className="field-group">
            <label>Sample Video (mp4/webm, max 500MB)</label>
            <input
              type="file"
              accept="video/mp4,video/webm"
              {...register('sample_video')}
            />
            <small>Upload a sample video of your teaching or work</small>
          </div>

          <div className="field-group">
            <label>Photo ID (jpg/png, max 5MB)*</label>
            <button
              type="button"
              onClick={() => setShowConsentModal(true)}
              className="btn-secondary"
            >
              Upload Photo ID
            </button>
            {watch('photo_id') && <small>✓ ID uploaded</small>}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="actions">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary">
              Back
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}

      {showConsentModal && (
        <IDConsentModal
          onConsent={() => {
            setValue('photo_id_consented', true);
            setShowConsentModal(false);
          }}
          onCancel={() => setShowConsentModal(false)}
        />
      )}
    </form>
  );
}

// components/IDConsentModal.tsx
export function IDConsentModal({ onConsent, onCancel }) {
  const [consentChecked, setConsentChecked] = useState(false);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Photo ID Verification</h2>

        <div className="consent-content">
          <h3>What ID is needed?</h3>
          <p>We accept government-issued ID (passport, driver's license, national ID)</p>

          <h3>Why do we need this?</h3>
          <p>To verify your identity and ensure instructor credentials</p>

          <h3>How is my ID protected?</h3>
          <ul>
            <li>Your ID is stored securely in encrypted storage</li>
            <li>Only admin staff can view it</li>
            <li>Never shared publicly or with other users</li>
            <li>Deleted 30 days after application decision</li>
          </ul>

          <label>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            I have read and understood the above
          </label>
        </div>

        <div className="actions">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConsent}
            disabled={!consentChecked}
            className="btn-primary"
          >
            Proceed to Upload
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Instructor application form has 3 sections
- [ ] Expertise selection required (1-5 options)
- [ ] Years of experience field (0-70 range)
- [ ] Bio text area (100-2000 chars)
- [ ] Phone field validates E.164 format
- [ ] Optional portfolio, social media links
- [ ] Sample video upload (mp4/webm, 500MB max)
- [ ] Photo ID upload (jpg/png, 5MB max)
- [ ] Explicit consent modal before ID upload
- [ ] Consent timestamp recorded in database
- [ ] Photo ID stored in private R2 bucket
- [ ] Signed URLs generated for admin viewing
- [ ] ID files expire 30 days after decision
- [ ] Application status tracked (pending, approved, rejected)
- [ ] Confirmation email sent after submission
- [ ] Admin notified of new applications
- [ ] User can view application status
- [ ] File validation (client and server)
- [ ] POST /auth/instructor-application works end-to-end
- [ ] Prevents duplicate pending applications
- [ ] Provides estimated review timeline

## Dependencies

- Next.js and React
- react-hook-form for form management
- zod for validation
- cloudflare (R2) for storage
- postmark for email
- Drizzle ORM for database

## Technical Notes

### R2 Configuration

```typescript
// packages/storage/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
});

export async function uploadToPrivateR2(
  file: File,
  key: string
): Promise<string> {
  const buffer = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_PRIVATE_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  });

  const response = await r2Client.send(command);
  return key; // Return key, not URL
}

export async function getSignedUrl(
  key: string,
  expirationSeconds = 604800 // 7 days
): Promise<string> {
  // Generate pre-signed URL for admin access
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_PRIVATE_BUCKET!,
    Key: key,
  });

  const url = await getSignedUrl(r2Client, command, {
    expiresIn: expirationSeconds,
  });
  return url;
}
```

### Cleanup Job for ID Files

```typescript
import cron from "node-cron";

// Run daily at 3 AM
cron.schedule("0 3 * * *", async () => {
  const expiredIds = await db.query.instructorApplications.findMany({
    where: lt(instructorApplications.photoIdExpiresAt, new Date()),
  });

  for (const app of expiredIds) {
    if (app.photoIdKey) {
      // Delete from R2
      await deleteFromR2(app.photoIdKey);

      // Clear reference
      await db
        .update(instructorApplications)
        .set({ photoIdKey: null })
        .where(eq(instructorApplications.id, app.id));

      console.log(`Deleted ID file for application: ${app.id}`);
    }
  }
});

async function deleteFromR2(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_PRIVATE_BUCKET!,
    Key: key,
  });

  await r2Client.send(command);
}
```
