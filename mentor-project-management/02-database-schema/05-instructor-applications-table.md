# Task 5: Instructor Applications Table

## Description

Create the instructor application and verification table to manage the workflow for learners applying to become instructors/mentors. This table tracks applications, approval status, portfolio information, identity verification documents, and admin review history. Instructor applications require identity verification (photo ID) stored securely in R2 Cloudflare storage.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (application endpoints and admin review)
- `apps/web-learner` (instructor application form)
- `apps/web-mentor` (existing mentor dashboards)
- `apps/web-admin` (application review and approval)

## Requirements

### Instructor Applications Table

Create table `instructor_applications`:

| Column                   | Type          | Constraints                      | Description                                           |
| ------------------------ | ------------- | -------------------------------- | ----------------------------------------------------- |
| `id`                     | `UUID`        | PK, Default: `uuid_v7()`         | Unique application identifier                         |
| `user_id`                | `UUID`        | FK → users(id), NOT NULL, UNIQUE | Learner applying to become instructor                 |
| `application_status`     | `VARCHAR(50)` | NOT NULL, DEFAULT: 'pending'     | Enum: pending, approved, rejected, under_review       |
| `expertise_areas`        | `TEXT[]`      | NOT NULL                         | Array of expertise topics/categories                  |
| `bio`                    | `TEXT`        | NOT NULL                         | Instructor bio/introduction (500-2000 chars)          |
| `years_of_experience`    | `INTEGER`     | NULL                             | Years of experience (0-50)                            |
| `portfolio_url`          | `TEXT`        | NULL                             | External URL to portfolio website                     |
| `sample_work_urls`       | `TEXT[]`      | DEFAULT: ARRAY[]::TEXT[]         | Array of URLs to portfolio/sample work                |
| `credentials`            | `JSONB`       | NULL                             | Certifications and credentials (JSON format)          |
| `photo_id_url`           | `TEXT`        | NOT NULL                         | R2 URL to ID photo (private, encrypted)               |
| `id_document_type`       | `VARCHAR(50)` | NOT NULL                         | Enum: passport, drivers_license, national_id          |
| `id_verification_status` | `VARCHAR(50)` | NOT NULL, DEFAULT: 'pending'     | Enum: pending, verified, rejected, resubmit_requested |
| `id_consent_given`       | `BOOLEAN`     | NOT NULL, DEFAULT: FALSE         | User consents to ID verification                      |
| `id_consent_timestamp`   | `TIMESTAMP`   | NULL                             | When consent was given                                |
| `id_consent_ip_address`  | `INET`        | NULL                             | IP address of consent                                 |
| `rejection_reason`       | `TEXT`        | NULL                             | If rejected, reason for rejection                     |
| `admin_feedback`         | `TEXT`        | NULL                             | Detailed feedback from admin reviewer                 |
| `reviewed_by`            | `UUID`        | FK → users(id), NULL             | Admin user who reviewed application                   |
| `reviewed_at`            | `TIMESTAMP`   | NULL                             | When admin reviewed application                       |
| `approved_at`            | `TIMESTAMP`   | NULL                             | When application was approved                         |
| `created_at`             | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`       | Application submission time                           |
| `updated_at`             | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`       | Last update timestamp                                 |
| `submitted_at`           | `TIMESTAMP`   | NULL                             | When application was formally submitted               |

### Unique Constraint for Instructor Applications

- Composite unique index: `(user_id)` where `application_status IN ('pending', 'under_review')` - prevent multiple active applications from same user
- Allow multiple historical applications for audit trail

### Indexes for Instructor Applications Table

- Primary Key: `id`
- Index: `(user_id)` - find user's applications
- Index: `(application_status)` - find pending/approved applications
- Index: `(id_verification_status)` - find applications needing ID verification
- Index: `(reviewed_by)` - find applications reviewed by admin
- Index: `(created_at)` - pagination and analytics
- Index: `(application_status, created_at)` - find pending applications ordered by time
- Partial Index: `(user_id, application_status)` WHERE `application_status IN ('pending', 'under_review')` - active applications

### Credentials JSON Structure

Example format for `credentials` field:

```json
{
  "certifications": [
    {
      "name": "Google Digital Marketing Certification",
      "issuer": "Google",
      "date_obtained": "2023-06-15",
      "credential_url": "https://..."
    },
    {
      "name": "Advanced CSS Specialization",
      "issuer": "Coursera",
      "date_obtained": "2022-12-20"
    }
  ],
  "degrees": [
    {
      "degree_type": "Bachelor of Arts",
      "field": "Computer Science",
      "institution": "University of Example",
      "graduation_date": "2020-05-15"
    }
  ]
}
```

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'under_review');
CREATE TYPE id_verification_status AS ENUM ('pending', 'verified', 'rejected', 'resubmit_requested');
CREATE TYPE id_document_type AS ENUM ('passport', 'drivers_license', 'national_id');
```

### Drizzle Schema Definition

In `packages/db/src/schema/instructor.ts`:

- Define `instructorApplications` table with all columns
- Create relation: instructorApplications → users (many-to-one for applicant)
- Create relation: instructorApplications → users (many-to-one for reviewer, via reviewed_by)
- Export relations for type-safe queries

## Database Tables

### instructor_applications

- **Purpose**: Track instructor application workflow and verification
- **Row estimate**: ~10K-100K applications (annual, varies by platform growth)
- **Retention**: Keep all applications (approved/rejected) for audit trail
- **Key relationships**: N:1 with users (applicant), N:1 with users (reviewer)

## Acceptance Criteria

- [ ] `instructor_applications` table created with all required columns
- [ ] `application_status` enum prevents invalid statuses
- [ ] `id_verification_status` enum tracks verification progress
- [ ] `id_document_type` enum validates ID document type
- [ ] `photo_id_url` column stores R2 secure URLs (private objects)
- [ ] `id_consent_given` and `id_consent_timestamp` track consent separately
- [ ] `id_consent_ip_address` captured for audit trail
- [ ] Foreign key constraints to users table (applicant and reviewer)
- [ ] Unique constraint prevents multiple concurrent active applications
- [ ] All timestamp columns use UTC timezone
- [ ] `expertise_areas` array can store 5-20 topics
- [ ] `sample_work_urls` array can store up to 10 URLs
- [ ] `credentials` JSONB supports nested certifications and degrees
- [ ] Partial index on active applications (pending, under_review)
- [ ] Application cannot be approved without ID verification
- [ ] Test data with pending, approved, and rejected applications
- [ ] Migration file generated and runnable

## Dependencies

- Task 02: Users and Profiles Tables (must be completed)
- Task 01: Drizzle ORM Setup and Configuration
- R2 Cloudflare integration for photo_id_url storage
- BetterAuth user creation system

## Technical Notes

### ID Document Upload and Storage

- Photo IDs uploaded to R2 with encryption at rest
- Store only R2 URL in database, not file content
- R2 bucket path format: `https://r2-bucket.example.com/instructor-applications/{user_id}/photo_id.{ext}`
- Implement encryption for sensitive ID documents in R2
- Set object retention policy to prevent accidental deletion (7-year compliance)
- Never download or display ID photos in admin UI; provide audit-only access

### Consent and Privacy Compliance

- `id_consent_given` must be TRUE before ID verification
- Capture explicit consent with timestamp and IP address
- Store consent records in separate consent audit table (see Task 14)
- Cannot process ID verification without explicit consent
- Allow users to revoke consent (soft delete application)

### Application Workflow States

1. **pending** - User fills form but hasn't submitted
2. **under_review** - Admin is evaluating application
3. **approved** - Instructor verified and approved, can create courses
4. **rejected** - Application denied, user can reapply

### ID Verification Process

1. User selects ID type (passport, driver's license, national ID)
2. Uploads photo of ID to form
3. Application status: pending
4. Admin reviewer checks photo_id in R2
5. Admin sets id_verification_status: verified, rejected, or resubmit_requested
6. If verified, application can be approved
7. If rejected/resubmit, provide reason in admin_feedback

### Expertise Areas Storage

- Use PostgreSQL text array (TEXT[])
- Examples: 'Makeup', 'Skincare', 'Nail Art', 'Color Theory', 'Business'
- Should map to course categories in database
- Can have 5-20 expertise areas per application

### Credentials Verification

- `credentials` JSONB field is optional (users might not have formal credentials)
- Admin can view but doesn't necessarily require verification
- Support multiple certifications and degrees
- Include URLs for online credentials (Credly, Coursera, etc.)

### Portfolio Strategy

- `portfolio_url` is link to external portfolio (optional)
- `sample_work_urls` can be direct links to work samples
- Examples: Instagram profiles, portfolio sites, YouTube channels, Behance, etc.
- Do not store portfolio content in database; link externally

### Rejection and Reapplication

- When rejected, set `rejection_reason` with specific explanation
- Set `admin_feedback` with constructive feedback for improvement
- Allow users to reapply after 30 days (enforce in application logic)
- Maintain audit trail of all applications for same user
- Don't delete rejected applications; keep for compliance

### ID Verification Resubmission

- If ID photo is unclear or rejected, set `id_verification_status` to 'resubmit_requested'
- User receives notification and can upload new photo
- Don't increment photo_id_url; maintain version history in R2

### Admin Review Workflow

- Query applications with `application_status = 'pending'` ordered by `created_at`
- Admin views application details and photo_id_url in private S3 viewer
- Admin makes decision: approve, reject, or request resubmit
- Update `reviewed_by`, `reviewed_at`, and status fields
- Notify user of decision via email

### Compliance and Data Protection

- ID document images are PII; handle with care
- Store in encrypted R2 bucket with access logging
- Implement audit logs for who accessed ID documents
- Comply with identity verification regulations (KYC/AML if applicable)
- Consider data retention policies (when to delete old applications)
- Support data deletion requests (GDPR: right to be forgotten)

### Query Patterns

```typescript
// Find pending applications (admin review queue)
db.select()
  .from(instructorApplications)
  .where(eq(instructorApplications.applicationStatus, "pending"))
  .orderBy(asc(instructorApplications.createdAt));

// Find applications needing ID verification
db.select()
  .from(instructorApplications)
  .where(eq(instructorApplications.idVerificationStatus, "pending"));

// Find user's application history
db.select()
  .from(instructorApplications)
  .where(eq(instructorApplications.userId, userId))
  .orderBy(desc(instructorApplications.createdAt));
```

### Testing Considerations

- Test application creation without ID document (should fail validation)
- Test ID document upload to R2 and URL storage
- Test consent tracking (user rejects, then accepts)
- Test approval flow with ID verification
- Test rejection with feedback message
- Test reapplication after rejection (prevent spam)
- Test concurrent applications (unique constraint)
- Test admin reviewer assignment

### Performance Notes

- Partial index on active applications enables fast admin review queue
- Index on `(application_status, created_at)` for sorted queries
- Consider materialized view for admin dashboard stats
- Archive old applications to separate table after 2 years (optional)

### Notifications Integration

- Send email when application status changes (pending → under_review → approved/rejected)
- Admin gets notified when new applications arrive
- Include direct link to admin review interface in notification
- Allow users to appeal rejected applications (separate workflow)
