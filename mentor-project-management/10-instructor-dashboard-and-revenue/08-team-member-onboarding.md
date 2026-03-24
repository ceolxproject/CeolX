# Team Member Onboarding

## Description

Implement the complete onboarding wizard for team members. Guide invited members through the same onboarding flow as primary instructors: personal details, specialization selection, intro video upload, photo ID verification with consent, portfolio link, and social media links. Collect all information and submit the application to Super Admin for verification before granting full team member access.

## Affected Apps/Packages

- Backend: `hono-api` service
- Frontend: `mentor-web` (Next.js)
- Database: PostgreSQL users, instructors, team_members tables
- File Storage: S3 or similar for photo ID uploads
- Email Service: Postmark for notifications
- Video Hosting: Mux for intro video uploads

## Onboarding Wizard Flow

### Step 1: Personal Details

```
Form Fields:
- First Name (required, max 100 chars)
- Last Name (required, max 100 chars)
- Email (read-only, from invitation)
- Phone Number (optional)
- Bio/About (optional, max 500 chars)

Validation:
- First/last name: alphanumeric + spaces/hyphens, min 2 chars
- Email: valid format (pre-filled from invitation)
- Phone: valid phone number format if provided
- Bio: no HTML/scripts

UI:
- Progress bar: 1 of 5 steps
- Back button (disabled)
- Next button (validates and proceeds)
```

### Step 2: Specialization & Expertise

```
Form Fields:
- Specialization Tags (required, select 1-5 from predefined list)
- Years of Experience (optional, numeric)
- Certifications (optional, text area, max 500 chars)
- Languages Spoken (optional, multi-select)

Predefined Specializations:
- Makeup Artist
- Esthetician
- Dermatology
- Hair Care Specialist
- Nail Technician
- Cosmetics Formulation
- Beauty Photography
- Personal Shopping
- Color Theory
- Other (allow free text)

UI:
- Progress bar: 2 of 5 steps
- Tag selector with visual display
- Back/Next buttons
```

### Step 3: Intro Video

```
Form Fields:
- Intro Video Upload (max 2 minutes, required)
  - Accepted formats: MP4, WebM, MOV
  - Max file size: 500MB
  - Will be uploaded to Mux
- Video Preview (show after upload)

Requirements:
- Video must be less than 2 minutes
- Must be clear and audible
- Instructor introduces themselves, expertise, teaching style
- Recommendation: professional but not required

UI:
- Progress bar: 3 of 5 steps
- Drag-and-drop video upload
- Upload progress indicator
- Video preview player
- Back/Next buttons
```

### Step 4: Identity Verification

```
Form Fields:
- Photo ID Upload (required)
  - Accepted formats: JPEG, PNG, PDF
  - Max file size: 10MB
  - Types: Driver's License, Passport, ID Card
- ID Type Dropdown
- Consent Checkbox (REQUIRED)
  - "I consent to Mentor storing and verifying my identity information"

Requirements:
- ID must be current and valid
- Photo ID upload is encrypted and stored securely
- Admin will manually verify

UI:
- Progress bar: 4 of 5 steps
- Drag-and-drop file upload
- File preview (PDF preview or image display)
- Consent checkbox (must check to proceed)
- Security note: "Your ID is encrypted and only used for verification"
- Back/Next buttons
```

### Step 5: Portfolio & Social Links

```
Form Fields:
- Portfolio URL (optional, max 500 chars)
  - Website, blog, or portfolio site
  - URL validation
- Instagram Handle (optional, max 50 chars)
- TikTok Handle (optional, max 50 chars)
- YouTube Channel (optional, URL)
- LinkedIn Profile (optional, URL)
- Other Social Links (optional, free text, max 500 chars)

UI:
- Progress bar: 5 of 5 steps
- Text inputs with icons for each platform
- URL validation on blur
- Preview how social links will display
- Back button
- Submit button: "Complete Onboarding"
```

### Step 6: Review & Submit

```
Display:
- Summary of all entered information
- Confirmation that application is complete
- Message: "Your application has been submitted for verification.
  Super Admin will review your information within 2-3 business days."
- CTA: "Go to Dashboard" (when Super Admin approves)

Status:
- Team member status: "pending_verification"
- Can view/edit profile but cannot create courses
- Can join team meetings/communication
```

---

## API Endpoints

### POST /onboarding/team-member/step/:stepNumber

**Save onboarding step data**

**Request:**

```http
POST /onboarding/team-member/step/1
Authorization: Bearer {invitation_token}
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1-555-123-4567",
  "bio": "Professional makeup artist with 10 years of experience"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "step": 1,
  "completed": true,
  "nextStep": 2,
  "progressPercentage": 20
}
```

---

### POST /onboarding/team-member/upload-video

**Upload intro video (multipart form data)**

**Request:**

```http
POST /onboarding/team-member/upload-video
Authorization: Bearer {invitation_token}
Content-Type: multipart/form-data

[Binary video file]
```

**Response (200 OK):**

```json
{
  "success": true,
  "videoId": "vid-uuid-123",
  "videoUrl": "https://image.mux.sh/...",
  "duration": 87,
  "uploadedAt": "2024-02-18T10:30:00Z"
}
```

---

### POST /onboarding/team-member/upload-id

**Upload photo ID document**

**Request:**

```http
POST /onboarding/team-member/upload-id
Authorization: Bearer {invitation_token}
Content-Type: multipart/form-data

[Binary ID file]
idType: "driver_license"
consentGiven: true
```

**Response (200 OK):**

```json
{
  "success": true,
  "documentId": "doc-uuid-456",
  "uploadedAt": "2024-02-18T10:32:00Z",
  "message": "ID uploaded and encrypted. Admin will verify within 2-3 business days."
}
```

---

### POST /onboarding/team-member/submit

**Submit complete onboarding application**

**Request:**

```http
POST /onboarding/team-member/submit
Authorization: Bearer {invitation_token}
Content-Type: application/json

{
  "invitationToken": "inv_abc123_xyz789"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "instructorId": "instructor-uuid-123",
  "teamMemberId": "team-member-uuid-456",
  "status": "pending_verification",
  "message": "Your application has been submitted for Super Admin verification.",
  "estimatedReviewTime": "2-3 business days",
  "createdAt": "2024-02-18T10:35:00Z"
}
```

---

### GET /onboarding/team-member/progress

**Get onboarding progress (for auto-save)**

**Request:**

```http
GET /onboarding/team-member/progress
Authorization: Bearer {invitation_token}
```

**Response (200 OK):**

```json
{
  "invitationToken": "inv_abc123_xyz789",
  "completedSteps": [1, 2],
  "currentStep": 3,
  "progressPercentage": 40,
  "savedData": {
    "step1": {
      "firstName": "John",
      "lastName": "Smith",
      "phone": "+1-555-123-4567",
      "bio": "Professional makeup artist"
    },
    "step2": {
      "specializations": ["makeup_artist", "color_theory"],
      "yearsOfExperience": 10
    }
  }
}
```

---

## Data Model

### onboarding_progress Table

```sql
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  team_invitation_id UUID NOT NULL UNIQUE REFERENCES team_invitations(id) ON DELETE CASCADE,

  -- Onboarding session
  invitation_token VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'in_progress',
  -- in_progress, submitted, completed, rejected

  -- Step completion tracking
  step_1_completed BOOLEAN DEFAULT FALSE,
  step_2_completed BOOLEAN DEFAULT FALSE,
  step_3_completed BOOLEAN DEFAULT FALSE,
  step_4_completed BOOLEAN DEFAULT FALSE,
  step_5_completed BOOLEAN DEFAULT FALSE,

  -- Stored data (JSONB for flexibility)
  personal_details JSONB,
  -- { firstName, lastName, phone, bio }

  specialization_details JSONB,
  -- { specializations: [], yearsOfExperience, certifications, languages }

  video_details JSONB,
  -- { videoId, videoUrl, duration, uploadedAt }

  identity_details JSONB,
  -- { documentId, documentUrl, idType, consentGiven, uploadedAt }

  portfolio_details JSONB,
  -- { portfolioUrl, instagram, tiktok, youtube, linkedin, otherLinks }

  -- Timestamps
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_status CHECK (
    status IN ('in_progress', 'submitted', 'completed', 'rejected')
  )
);

CREATE INDEX idx_onboarding_progress_team_invitation_id
  ON onboarding_progress(team_invitation_id);
CREATE INDEX idx_onboarding_progress_status
  ON onboarding_progress(status);
```

### Updated instructors Table

```sql
-- Add these columns to instructors table (from 04-authentication-and-onboarding)

ALTER TABLE instructors ADD COLUMN (
  -- Team member specific
  is_team_member BOOLEAN DEFAULT FALSE,
  team_id UUID REFERENCES teams(id),

  -- Onboarding
  intro_video_url VARCHAR(512),
  intro_video_mux_id VARCHAR(255),
  photo_id_url VARCHAR(512),
  photo_id_document_id VARCHAR(255),
  portfolio_url VARCHAR(512),
  specialization JSONB,  -- Array of specialization tags
  years_of_experience INT,
  certifications TEXT,
  languages JSONB,  -- Array of language codes

  -- Social links
  social_links JSONB,
  -- { instagram, tiktok, youtube, linkedin, other }

  -- Verification
  phone_number VARCHAR(20),
  bio TEXT,
  verification_status VARCHAR(32) DEFAULT 'unverified',
  -- unverified, pending_verification, verified, rejected

  verified_at TIMESTAMP NULL,
  rejection_reason TEXT NULL
);
```

---

## Implementation Details

### Save Onboarding Step

```typescript
async function saveOnboardingStep(
  invitationToken: string,
  stepNumber: number,
  stepData: Record<string, any>,
) {
  // 1. Find invitation
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  if (!invitation || invitation.status !== "accepted") {
    throw new Error("Invalid invitation");
  }

  // 2. Find or create onboarding progress
  let progress = await db.onboarding_progress.findOne({
    team_invitation_id: invitation.id,
  });

  if (!progress) {
    progress = await db.onboarding_progress.create({
      team_invitation_id: invitation.id,
      invitation_token: invitationToken,
      status: "in_progress",
    });
  }

  // 3. Validate step data
  const validationErrors = validateStep(stepNumber, stepData);
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
  }

  // 4. Save step data to JSONB column
  const updateData = {};
  updateData[`step_${stepNumber}_completed`] = true;

  switch (stepNumber) {
    case 1:
      updateData.personal_details = stepData;
      break;
    case 2:
      updateData.specialization_details = stepData;
      break;
    case 3:
      updateData.video_details = stepData;
      break;
    case 4:
      updateData.identity_details = stepData;
      break;
    case 5:
      updateData.portfolio_details = stepData;
      break;
  }

  updateData.updated_at = new Date();

  await db.onboarding_progress.update(progress.id, updateData);

  // 5. Calculate progress
  const completedSteps = [1, 2, 3, 4, 5].filter(
    (s) => updateData[`step_${s}_completed`],
  ).length;

  return {
    step: stepNumber,
    completed: true,
    nextStep: stepNumber + 1,
    progressPercentage: Math.round((completedSteps / 5) * 100),
  };
}

function validateStep(stepNumber: number, data: Record<string, any>) {
  const errors = [];

  switch (stepNumber) {
    case 1:
      // Personal details validation
      if (!data.firstName || data.firstName.trim().length < 2) {
        errors.push("First name must be at least 2 characters");
      }
      if (!data.lastName || data.lastName.trim().length < 2) {
        errors.push("Last name must be at least 2 characters");
      }
      if (data.phone && !isValidPhoneNumber(data.phone)) {
        errors.push("Invalid phone number");
      }
      if (data.bio && data.bio.length > 500) {
        errors.push("Bio must be under 500 characters");
      }
      break;

    case 2:
      // Specialization validation
      if (
        !Array.isArray(data.specializations) ||
        data.specializations.length === 0
      ) {
        errors.push("Select at least one specialization");
      }
      if (data.specializations.length > 5) {
        errors.push("Select at most 5 specializations");
      }
      if (data.yearsOfExperience && data.yearsOfExperience < 0) {
        errors.push("Years of experience cannot be negative");
      }
      break;

    case 3:
      // Video validation (check in upload endpoint instead)
      if (!data.videoId) {
        errors.push("Video is required");
      }
      break;

    case 4:
      // ID validation
      if (!data.documentId) {
        errors.push("Photo ID is required");
      }
      if (!data.consentGiven) {
        errors.push("Consent is required");
      }
      break;

    case 5:
      // Portfolio validation
      if (data.portfolioUrl && !isValidUrl(data.portfolioUrl)) {
        errors.push("Invalid portfolio URL");
      }
      // Validate social media handles
      break;
  }

  return errors;
}
```

### Upload Intro Video

```typescript
import { Mux } from "@mux/mux-node";

const mux = new Mux({
  accessTokenId: process.env.MUX_ACCESS_TOKEN_ID,
  accessTokenSecret: process.env.MUX_ACCESS_TOKEN_SECRET,
});

async function uploadIntroVideo(
  invitationToken: string,
  file: Express.Multer.File,
) {
  // 1. Validate file
  const ALLOWED_FORMATS = ["video/mp4", "video/webm", "video/quicktime"];
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

  if (!ALLOWED_FORMATS.includes(file.mimetype)) {
    throw new Error("Invalid video format");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Video file is too large (max 500MB)");
  }

  // 2. Get video duration
  const duration = await getVideoDuration(file.path);

  if (duration > 120) {
    // 2 minutes
    throw new Error("Video must be less than 2 minutes");
  }

  // 3. Upload to Mux
  const uploadUrl = await mux.video.uploads.create({
    new_asset_settings: {
      playback_policy: ["public"],
      encoding_tier: "baseline",
    },
  });

  // Upload file to Mux
  const upload = fs.createReadStream(file.path);
  await uploadToMux(uploadUrl.url, upload);

  // Wait for asset to be ready
  const asset = await waitForAsset(uploadUrl.asset_id);

  // 4. Find onboarding progress
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  const progress = await db.onboarding_progress.findOne({
    team_invitation_id: invitation.id,
  });

  // 5. Save video details
  const videoDetails = {
    videoId: asset.id,
    videoUrl: `https://image.mux.sh/${asset.playback_ids[0].id}`,
    duration,
    uploadedAt: new Date(),
  };

  await db.onboarding_progress.update(progress.id, {
    step_3_completed: true,
    video_details: videoDetails,
  });

  // 6. Clean up temp file
  fs.unlinkSync(file.path);

  return videoDetails;
}
```

### Upload Photo ID

```typescript
import AWS from "aws-sdk";
import crypto from "crypto";

const s3 = new AWS.S3();

async function uploadPhotoId(
  invitationToken: string,
  file: Express.Multer.File,
  idType: string,
  consentGiven: boolean,
) {
  // 1. Validate consent
  if (!consentGiven) {
    throw new Error("Consent is required");
  }

  // 2. Validate file
  const ALLOWED_FORMATS = ["image/jpeg", "image/png", "application/pdf"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  if (!ALLOWED_FORMATS.includes(file.mimetype)) {
    throw new Error("Invalid file format (JPEG, PNG, or PDF only)");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large (max 10MB)");
  }

  // 3. Encrypt file before upload
  const encryptedData = encryptFile(file.buffer);

  // 4. Upload to S3 (encrypted)
  const documentId = `id-${crypto.randomBytes(16).toString("hex")}`;
  const s3Key = `photo-ids/${documentId}/${file.originalname}`;

  await s3
    .upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: encryptedData,
      ServerSideEncryption: "AES256",
      ContentType: file.mimetype,
      Metadata: {
        "original-filename": file.originalname,
        "id-type": idType,
        "uploaded-at": new Date().toISOString(),
      },
    })
    .promise();

  // 5. Find onboarding progress
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  const progress = await db.onboarding_progress.findOne({
    team_invitation_id: invitation.id,
  });

  // 6. Save ID details (don't store actual file, just reference)
  const identityDetails = {
    documentId,
    documentUrl: s3Key,
    idType,
    consentGiven: true,
    uploadedAt: new Date(),
  };

  await db.onboarding_progress.update(progress.id, {
    step_4_completed: true,
    identity_details: identityDetails,
  });

  return {
    documentId,
    uploadedAt: new Date(),
    message:
      "ID uploaded and encrypted. Admin will verify within 2-3 business days.",
  };
}

function encryptFile(buffer: Buffer): Buffer {
  const cipher = crypto.createCipher("aes-256-cbc", process.env.ENCRYPTION_KEY);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}
```

### Submit Onboarding

```typescript
async function submitOnboarding(invitationToken: string) {
  // 1. Find invitation and progress
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  const progress = await db.onboarding_progress.findOne({
    team_invitation_id: invitation.id,
  });

  if (!progress) {
    throw new Error("Onboarding not found");
  }

  // 2. Verify all steps completed
  if (
    !progress.step_1_completed ||
    !progress.step_2_completed ||
    !progress.step_3_completed ||
    !progress.step_4_completed ||
    !progress.step_5_completed
  ) {
    throw new Error("All onboarding steps must be completed");
  }

  // 3. Start transaction
  const transaction = await db.beginTransaction();

  try {
    // 4. Create user account
    const user = await db.users.create(
      {
        email: invitation.invitee_email,
        first_name: progress.personal_details.firstName,
        last_name: progress.personal_details.lastName,
        role: "instructor",
        status: "active",
      },
      transaction,
    );

    // 5. Create instructor record
    const instructor = await db.instructors.create(
      {
        user_id: user.id,
        is_team_member: true,
        team_id: invitation.team_id,
        phone_number: progress.personal_details.phone,
        bio: progress.personal_details.bio,
        intro_video_url: progress.video_details.videoUrl,
        intro_video_mux_id: progress.video_details.videoId,
        photo_id_url: progress.identity_details.documentUrl,
        photo_id_document_id: progress.identity_details.documentId,
        portfolio_url: progress.portfolio_details.portfolioUrl,
        specialization: progress.specialization_details.specializations,
        years_of_experience: progress.specialization_details.yearsOfExperience,
        certifications: progress.specialization_details.certifications,
        languages: progress.specialization_details.languages,
        social_links: progress.portfolio_details,
        verification_status: "pending_verification",
      },
      transaction,
    );

    // 6. Create team member
    const teamMember = await db.team_members.create(
      {
        team_id: invitation.team_id,
        user_id: user.id,
        instructor_id: instructor.id,
        role: "team_member",
        status: "pending_verification",
        onboarding_completed: true,
        onboarding_completed_at: new Date(),
      },
      transaction,
    );

    // 7. Update invitation
    await db.team_invitations.update(
      invitation.id,
      { invitee_id: teamMember.id },
      transaction,
    );

    // 8. Update onboarding progress
    await db.onboarding_progress.update(
      progress.id,
      {
        status: "submitted",
        submitted_at: new Date(),
      },
      transaction,
    );

    // 9. Commit transaction
    await transaction.commit();

    // 10. Send verification request to Super Admins
    await notificationService.sendToSuperAdmins({
      type: "team_member_verification_required",
      data: {
        instructorId: instructor.id,
        instructorName: `${progress.personal_details.firstName} ${progress.personal_details.lastName}`,
        instructorEmail: user.email,
        teamId: invitation.team_id,
        onboardingProgressId: progress.id,
        photoIdDocumentId: progress.identity_details.documentId,
      },
    });

    // 11. Notify inviter
    const inviter = await db.instructors.findById(invitation.inviter_id);
    const inviterUser = await db.users.findById(inviter.user_id);

    await notificationService.send({
      email: inviterUser.email,
      type: "team_member_onboarding_completed",
      data: {
        memberName: `${progress.personal_details.firstName} ${progress.personal_details.lastName}`,
        memberEmail: invitation.invitee_email,
        status: "pending_verification",
      },
    });

    // 12. Emit event
    await eventBus.emit("team.member.onboarding.submitted", {
      invitationId: invitation.id,
      instructorId: instructor.id,
      teamMemberId: teamMember.id,
      email: user.email,
    });

    return {
      success: true,
      instructorId: instructor.id,
      teamMemberId: teamMember.id,
      status: "pending_verification",
      message:
        "Your application has been submitted for Super Admin verification.",
      estimatedReviewTime: "2-3 business days",
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

---

## Frontend Components

### Onboarding Wizard Container

```typescript
// pages/onboarding.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import StepIndicator from "@/components/StepIndicator";
import Step1Personal from "@/components/onboarding/Step1Personal";
import Step2Specialization from "@/components/onboarding/Step2Specialization";
import Step3Video from "@/components/onboarding/Step3Video";
import Step4Identity from "@/components/onboarding/Step4Identity";
import Step5Portfolio from "@/components/onboarding/Step5Portfolio";

export default function OnboardingWizard() {
  const router = useRouter();
  const { token, step: initialStep } = router.query;

  const [currentStep, setCurrentStep] = useState(1);
  const [savedData, setSavedData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialStep) {
      setCurrentStep(parseInt(initialStep));
    }

    // Load saved progress
    loadProgress();
  }, [token]);

  const loadProgress = async () => {
    try {
      const res = await fetch("/api/onboarding/team-member/progress", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSavedData(data.savedData);
      }
    } catch (err) {
      console.error("Failed to load progress:", err);
    }
  };

  const handleStepSubmit = async (stepNumber: number, data: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/onboarding/team-member/step/${stepNumber}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save step");
      }

      setSavedData({
        ...savedData,
        [`step${stepNumber}`]: data,
      });

      if (stepNumber < 5) {
        setCurrentStep(stepNumber + 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/team-member/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invitationToken: token }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit");
      }

      // Redirect to success page
      router.push("/onboarding/complete");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-wizard">
      <StepIndicator currentStep={currentStep} totalSteps={5} />

      <div className="step-content">
        {currentStep === 1 && (
          <Step1Personal
            initialData={savedData.step1}
            onSubmit={(data) => handleStepSubmit(1, data)}
            loading={loading}
            error={error}
          />
        )}
        {currentStep === 2 && (
          <Step2Specialization
            initialData={savedData.step2}
            onSubmit={(data) => handleStepSubmit(2, data)}
            loading={loading}
            error={error}
          />
        )}
        {currentStep === 3 && (
          <Step3Video
            initialData={savedData.step3}
            onSubmit={(data) => handleStepSubmit(3, data)}
            loading={loading}
            error={error}
          />
        )}
        {currentStep === 4 && (
          <Step4Identity
            initialData={savedData.step4}
            onSubmit={(data) => handleStepSubmit(4, data)}
            loading={loading}
            error={error}
          />
        )}
        {currentStep === 5 && (
          <Step5Portfolio
            initialData={savedData.step5}
            onSubmit={(data) => handleStepSubmit(5, data)}
            onFinalSubmit={handleSubmit}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
```

---

## Requirements

### File Uploads

1. Intro video: Max 2 minutes, 500MB, MP4/WebM/MOV
2. Photo ID: Max 10MB, JPEG/PNG/PDF
3. Store encrypted and securely
4. Validate file size and format before upload

### Video Processing

1. Upload to Mux for hosting/streaming
2. Get video duration for validation
3. Generate playable URL for preview
4. Enable playback policy (public)

### Encryption & Security

1. Encrypt photo ID files at rest in S3
2. Use AES-256 encryption
3. Only Super Admin can decrypt for verification
4. Audit log all accesses

### Email Notifications

1. Notify Super Admins when submission complete
2. Notify inviter when team member joins
3. Notify team member when approved/rejected

---

## Acceptance Criteria

- [ ] Onboarding wizard has 5 steps with progress indicator
- [ ] Step 1: Personal details form with validation
- [ ] Step 2: Specialization selector (1-5 tags)
- [ ] Step 3: Intro video upload with duration validation (max 2 min)
- [ ] Step 4: Photo ID upload with consent checkbox
- [ ] Step 5: Portfolio & social links entry
- [ ] All steps can be saved individually (auto-save)
- [ ] Progress is persisted and can be resumed
- [ ] Back button returns to previous step with saved data
- [ ] Video upload shows progress indicator
- [ ] Video preview displays after upload
- [ ] ID upload validates file format and size
- [ ] Consent checkbox must be checked to proceed
- [ ] Security message displayed about ID encryption
- [ ] Submit button creates user, instructor, and team_member records
- [ ] Team member status is pending_verification after submit
- [ ] Super Admin is notified for verification
- [ ] Inviter is notified of completion
- [ ] Email validation prevents invalid addresses
- [ ] Phone number validation (if provided)
- [ ] Bio character limit enforced (500 chars)
- [ ] URL validation for portfolio and social links
- [ ] Video duration validated (under 2 minutes)
- [ ] File size validated on upload
- [ ] Success message shown after submission
- [ ] Onboarding progress can be viewed via GET endpoint

## Dependencies

- **Milestone**: Team Invite Flow (07-team-invite-flow)
- **Milestone**: Authentication (04-authentication-and-onboarding)
- **External Service**: Mux for video hosting
- **External Service**: AWS S3 for file storage
- **External Service**: Postmark for notifications
- **Frontend**: Mentor Web app

## Technical Notes

### Video Processing

```typescript
import ffmpeg from "fluent-ffmpeg";

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      resolve(metadata.format.duration); // seconds
    });
  });
}
```

### File Encryption

Use envelope encryption:

1. Generate data key
2. Encrypt file with data key (AES-256-GCM)
3. Encrypt data key with master key (KMS)
4. Store encrypted file and encrypted data key

### Validation Rules

- Specializations: Predefined list + custom "Other" option
- Languages: ISO 639-1 codes (en, es, fr, etc.)
- URL validation: HTTPS, valid domain, not localhost
- Email: Standard email regex, not disposable domains

### Auto-Save Strategy

- Save on blur for text inputs
- Save on change for selectors
- Debounce video/file uploads
- Load progress on wizard initialization

### Future Enhancements

1. Multi-language onboarding
2. Video recording instead of upload
3. ID verification with OCR
4. Liveness check (facial recognition)
5. Background check integration
