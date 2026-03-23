# Instructor Approval Flow

## Description

Implement admin review and approval workflow for instructor applications. Admins view pending applications with profile, portfolio, ID, and sample video. Can approve or reject with feedback. Approved instructors gain mentor role and dashboard access. Rejected applicants receive feedback email. Email and push notifications sent on status change.

## Affected Apps/Packages

- Backend: Hono API (Admin Web App)
- Frontend: Admin Web App (Next.js)
- Email Service: Postmark
- Push Notifications: Firebase Cloud Messaging (optional)

## API Endpoints

### GET /admin/instructor-applications

List pending instructor applications (paginated).

**Query Parameters**:

- `status`: pending_review, approved, rejected (default: pending_review)
- `sort`: submitted_date, reviewed_date (default: submitted_date)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response** (200 OK):

```json
{
  "applications": [
    {
      "id": "app_abc123",
      "userId": "user_xyz789",
      "applicantName": "John Doe",
      "email": "john@example.com",
      "expertise": ["makeup", "skincare"],
      "experienceYears": 5,
      "status": "pending_review",
      "submittedAt": "2024-02-18T10:30:00Z",
      "photoIdUploaded": true,
      "sampleVideoUploaded": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### GET /admin/instructor-applications/{applicationId}

Get full application details with signed URLs for documents.

**Response** (200 OK):

```json
{
  "id": "app_abc123",
  "userId": "user_xyz789",
  "applicant": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "company": "My Studio"
  },
  "expertise": ["makeup", "skincare"],
  "experienceYears": 5,
  "bio": "...",
  "teachingExperience": "...",
  "certifications": "...",
  "portfolio": {
    "website": "https://...",
    "instagram": "@...",
    "youtube": "https://..."
  },
  "documents": {
    "photoId": {
      "url": "https://r2-signed-url.../photo-id",
      "uploadedAt": "2024-02-18T10:30:00Z",
      "expiresAt": "2024-02-25T10:30:00Z"
    },
    "sampleVideo": {
      "url": "https://r2-public-url.../sample-video",
      "uploadedAt": "2024-02-18T10:30:00Z"
    }
  },
  "status": "pending_review",
  "submittedAt": "2024-02-18T10:30:00Z",
  "reviewedAt": null,
  "reviewedBy": null,
  "feedback": null
}
```

### POST /admin/instructor-applications/{applicationId}/approve

Approve instructor application.

**Request Body**:

```json
{
  "feedback": "Excellent application. Welcome to the platform!",
  "notes": "Profile looks professional, video quality is good"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Application approved",
  "applicationId": "app_abc123",
  "user": {
    "id": "user_xyz789",
    "role": "mentor",
    "email": "john@example.com"
  },
  "notificationSent": true
}
```

### POST /admin/instructor-applications/{applicationId}/reject

Reject instructor application with feedback.

**Request Body**:

```json
{
  "feedback": "Sample video quality does not meet platform standards. Please reapply with a higher quality sample.",
  "reason": "poor_sample_quality" // or "insufficient_experience", "incomplete_application", "other"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Application rejected",
  "applicationId": "app_abc123",
  "notificationSent": true
}
```

## Requirements

### Admin Application Dashboard

**Pending Applications List**:

- Table with columns: Applicant Name, Email, Expertise, Experience, Submitted Date, Actions
- Sort options: Newest First, Oldest First, Last Reviewed
- Filter by status: Pending, Approved, Rejected
- Search by name/email
- Pagination (20 per page)
- Quick action buttons: View Details, Approve, Reject

**Application Detail View**:

- Full applicant information
- Expertise areas (listed as tags)
- Experience and bio
- Portfolio links (clickable)
- Embedded video player for sample video
- Photo ID image viewer (requires admin role)
- Teaching experience and certifications
- Action buttons: Approve, Reject, Request More Info

**Review Actions**:

- Approve button: Opens modal with optional feedback
- Reject button: Opens modal with feedback + rejection reason
- Request More Info: Email to applicant asking for clarification

### Approval Process

**On Approval**:

1. Update application status to "approved"
2. Set `reviewedAt` and `reviewedBy` (admin ID)
3. Change user role from learner to "mentor"
4. Send approval email to applicant
5. Send push notification (if available)
6. Log action in audit trail
7. ID file expiration timestamp set (30 days)
8. Applicant gains dashboard access

**Approval Email Template**:

- Subject: "Welcome to Mentor by Mentor!"
- Greeting with applicant name
- "Your application has been approved"
- Instructions to set up instructor profile
- Link to instructor dashboard
- Link to first course creation guide
- Support email

### Rejection Process

**On Rejection**:

1. Update application status to "rejected"
2. Set `reviewedAt`, `reviewedBy`, `feedback`
3. Keep user as learner role (can reapply)
4. Send rejection email with feedback
5. Send push notification
6. Log action in audit trail
7. ID file deleted immediately
8. Delete sample video (cleanup)

**Rejection Email Template**:

- Subject: "About Your Instructor Application"
- Greeting with applicant name
- "Unfortunately, we cannot approve your application at this time"
- Reason (from feedback)
- Suggestions for reapplication
- Option to reapply after improvements
- Support contact
- Review feedback in email body

### Reapplication After Rejection

- User can submit new application after rejection
- No waiting period
- Notify applicant in rejection email: "You may reapply anytime"
- Keep previous application for reference

### Audit Logging

- Log all approval/rejection actions
- Store admin ID, timestamp, decision, feedback
- Searchable audit trail in admin dashboard
- Retention: 2 years minimum

### Push Notifications

- Send notification on approval/rejection
- Title: "Your Instructor Application"
- Body: "Your application has been [approved/rejected]"
- Deep link to application status page
- Optional FCM integration

### Performance Metrics

- Count pending applications
- Average review time
- Approval rate percentage
- Show in admin dashboard summary

## Acceptance Criteria

- [ ] Admin can list pending applications with pagination
- [ ] Applications sorted by submission date
- [ ] Search by applicant name/email works
- [ ] Filtering by status works
- [ ] Detailed application view shows all fields
- [ ] Photo ID image viewable to admin (signed URL)
- [ ] Sample video embedded and playable
- [ ] Portfolio links clickable
- [ ] Approve button changes status and role
- [ ] Rejection requires feedback/reason
- [ ] Approval email sent with instructions
- [ ] Rejection email sent with feedback
- [ ] Approved mentors can access dashboard
- [ ] Rejected applicants can reapply
- [ ] Audit log tracks all actions
- [ ] ID files deleted on rejection
- [ ] ID files expire 30 days after approval
- [ ] Push notification sent on status change
- [ ] Admin can request more information
- [ ] Application timestamps accurate
- [ ] Admin role required to approve/reject

## Dependencies

- Hono API
- Drizzle ORM
- Postmark for email
- Firebase Cloud Messaging (optional)
- Next.js for admin dashboard

## Technical Notes

### Database Schema

```typescript
// Extends instructor_applications table with review fields
// See task 13 for base schema

export const applicationAuditLog = pgTable("application_audit_log", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => instructorApplications.id),
  adminId: text("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(), // 'approved', 'rejected', 'request_more_info'
  feedback: text("feedback"),
  reason: text("reason"), // For rejections
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});
```

### Hono Handlers

**List Applications**:

```typescript
export async function handleListApplications(c: Context) {
  const user = c.get("auth.user");

  // Check admin role
  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const status = c.req.query("status") || "pending_review";
  const search = c.req.query("search");
  const sort = c.req.query("sort") || "submitted_date";

  const offset = (page - 1) * limit;

  // Build query
  let query = db.query.instructorApplications.findMany({
    where: eq(instructorApplications.status, status),
    limit,
    offset,
  });

  if (search) {
    // Search by name or email (need to join with users table)
    // Implementation varies by ORM
  }

  // Sort
  const orderBy =
    sort === "reviewed_date"
      ? desc(instructorApplications.reviewedAt)
      : desc(instructorApplications.submittedAt);

  const applications = await query;
  const total = await db.query.instructorApplications
    .findMany({
      where: eq(instructorApplications.status, status),
    })
    .then((a) => a.length);

  // Fetch user data for each application
  const withUsers = await Promise.all(
    applications.map(async (app) => ({
      ...app,
      applicant: await db.query.users.findFirst({
        where: eq(users.id, app.userId),
      }),
    }))
  );

  return c.json({
    applications: withUsers.map((a) => ({
      id: a.id,
      userId: a.userId,
      applicantName: a.applicant?.name,
      email: a.applicant?.email,
      expertise: a.expertise,
      experienceYears: a.experienceYears,
      status: a.status,
      submittedAt: a.submittedAt,
      photoIdUploaded: !!a.photoIdKey,
      sampleVideoUploaded: !!a.sampleVideoUrl,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
```

**Get Application Details**:

```typescript
export async function handleGetApplicationDetails(c: Context) {
  const user = c.get("auth.user");
  const { applicationId } = c.req.param();

  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const application = await db.query.instructorApplications.findFirst({
    where: eq(instructorApplications.id, applicationId),
  });

  if (!application) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  const applicant = await db.query.users.findFirst({
    where: eq(users.id, application.userId),
  });

  // Get signed URLs for documents
  let photoIdUrl = null;
  if (application.photoIdKey) {
    photoIdUrl = await getSignedUrl(application.photoIdKey);
  }

  return c.json({
    id: application.id,
    userId: application.userId,
    applicant: {
      name: applicant?.name,
      email: applicant?.email,
      phone: application.phone,
      company: application.company,
    },
    expertise: application.expertise,
    experienceYears: application.experienceYears,
    bio: application.bio,
    teachingExperience: application.teachingExperience,
    certifications: application.certifications,
    portfolio: {
      website: application.portfolioLink,
      instagram: application.instagram,
      youtube: application.youtube,
    },
    documents: {
      photoId: photoIdUrl
        ? {
            url: photoIdUrl,
            uploadedAt: application.photoIdConsentedAt,
          }
        : null,
      sampleVideo: application.sampleVideoUrl
        ? {
            url: application.sampleVideoUrl,
            uploadedAt: application.submittedAt,
          }
        : null,
    },
    status: application.status,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    reviewedBy: application.reviewedBy,
    feedback: application.feedback,
  });
}
```

**Approve Application**:

```typescript
export async function handleApproveApplication(c: Context) {
  const user = c.get("auth.user");
  const { applicationId } = c.req.param();
  const { feedback, notes } = await c.req.json();

  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const application = await db.query.instructorApplications.findFirst({
    where: eq(instructorApplications.id, applicationId),
  });

  if (!application) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  // Update application
  await db
    .update(instructorApplications)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: user.id,
      feedback,
    })
    .where(eq(instructorApplications.id, applicationId));

  // Update user role
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, application.userId),
  });

  await db
    .update(users)
    .set({ role: "mentor" })
    .where(eq(users.id, application.userId));

  // Log audit
  await db.insert(applicationAuditLog).values({
    id: crypto.randomUUID(),
    applicationId,
    adminId: user.id,
    action: "approved",
    feedback: notes,
    timestamp: new Date(),
  });

  // Send approval email
  await sendApprovalEmail(targetUser!.email, targetUser!.name);

  // Send push notification
  await sendPushNotification(application.userId, {
    title: "Your Instructor Application",
    body: "Congratulations! Your application has been approved.",
    deepLink: "/instructor/dashboard",
  });

  console.log(`Application approved: ${applicationId} by admin ${user.id}`);

  return c.json({
    success: true,
    message: "Application approved",
    applicationId,
    user: {
      id: application.userId,
      role: "mentor",
      email: targetUser?.email,
    },
    notificationSent: true,
  });
}

async function sendApprovalEmail(email: string, name: string) {
  const client = new Client(process.env.POSTMARK_API_TOKEN!);

  return client.sendEmailWithTemplate({
    From: "hello@example.com",
    To: email,
    TemplateId: 111111, // Approval template ID
    TemplateModel: {
      userName: name.split(" ")[0],
      dashboardLink: "https://teach.example.com/dashboard",
      guideLink: "https://help.example.com/create-first-course",
    },
    Tag: "instructor-approved",
  });
}
```

**Reject Application**:

```typescript
export async function handleRejectApplication(c: Context) {
  const user = c.get("auth.user");
  const { applicationId } = c.req.param();
  const { feedback, reason } = await c.req.json();

  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const application = await db.query.instructorApplications.findFirst({
    where: eq(instructorApplications.id, applicationId),
  });

  if (!application) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  if (!feedback || !reason) {
    return c.json({ error: "MISSING_FEEDBACK" }, 400);
  }

  // Update application
  await db
    .update(instructorApplications)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: user.id,
      feedback,
      photoIdExpiresAt: new Date(), // Immediate deletion
    })
    .where(eq(instructorApplications.id, applicationId));

  // Log audit
  await db.insert(applicationAuditLog).values({
    id: crypto.randomUUID(),
    applicationId,
    adminId: user.id,
    action: "rejected",
    feedback,
    reason,
    timestamp: new Date(),
  });

  // Get applicant
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, application.userId),
  });

  // Delete files
  if (application.photoIdKey) {
    await deleteFromR2(application.photoIdKey);
  }
  if (application.sampleVideoUrl) {
    await deleteFromR2(extractR2Key(application.sampleVideoUrl));
  }

  // Send rejection email
  await sendRejectionEmail(
    targetUser!.email,
    targetUser!.name,
    feedback,
    reason
  );

  // Send push notification
  await sendPushNotification(application.userId, {
    title: "Your Instructor Application",
    body: "We were unable to approve your application. Please check your email for details.",
    deepLink: "/instructor/reapply",
  });

  console.log(`Application rejected: ${applicationId} by admin ${user.id}`);

  return c.json({
    success: true,
    message: "Application rejected",
    applicationId,
    notificationSent: true,
  });
}

async function sendRejectionEmail(
  email: string,
  name: string,
  feedback: string,
  reason: string
) {
  const client = new Client(process.env.POSTMARK_API_TOKEN!);

  const reasonTexts: Record<string, string> = {
    poor_sample_quality:
      "Sample video quality does not meet platform standards",
    insufficient_experience: "Experience does not meet minimum requirements",
    incomplete_application: "Application is incomplete",
    other: "Application does not meet platform guidelines",
  };

  return client.sendEmailWithTemplate({
    From: "hello@example.com",
    To: email,
    TemplateId: 222222, // Rejection template ID
    TemplateModel: {
      userName: name.split(" ")[0],
      reason:
        reasonTexts[reason] || "Application does not meet platform guidelines",
      feedback,
      reapplyLink: "https://teach.example.com/apply",
    },
    Tag: "instructor-rejected",
  });
}
```

### Frontend Admin Dashboard

```typescript
// pages/admin/instructor-applications/index.tsx
'use client';

import { useEffect, useState } from 'react';
import { ApplicationList } from '@/components/admin/ApplicationList';
import { ApplicationDetail } from '@/components/admin/ApplicationDetail';

export default function InstructorApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, [status, page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/instructor-applications?status=${status}&page=${page}`
      );
      const data = await response.json();
      setApplications(data.applications);
      setTotal(data.pagination.total);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="instructor-applications">
      <h1>Instructor Applications</h1>

      {selectedApp ? (
        <ApplicationDetail
          applicationId={selectedApp}
          onBack={() => setSelectedApp(null)}
          onRefresh={fetchApplications}
        />
      ) : (
        <>
          <div className="filters">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <ApplicationList
            applications={applications}
            onSelect={setSelectedApp}
            isLoading={loading}
            page={page}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
```

### Audit Trail

```typescript
// Get audit log for an application
export async function handleGetAuditLog(c: Context) {
  const { applicationId } = c.req.param();
  const user = c.get("auth.user");

  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const logs = await db.query.applicationAuditLog.findMany({
    where: eq(applicationAuditLog.applicationId, applicationId),
    orderBy: desc(applicationAuditLog.timestamp),
  });

  return c.json({ logs });
}
```

### Performance Optimization

- Index on `status` and `submittedAt` for fast queries
- Cache admin dashboard counts (5-minute TTL)
- Lazy load application details
- Paginate results
- Use database cursors for efficient pagination
