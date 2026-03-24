# Activity Logs: Mentor-Side Tracking

## Description

Implement comprehensive activity logging for all instructor actions in the Mentor app. Track course creation, editing, publishing, pricing updates, community changes, comment moderation, team management, payout requests, and profile updates. Store detailed information including actor, action, target, timestamp, and before/after snapshots. Provide filterable, sortable views in the Mentor dashboard and export functionality for audit purposes.

## Affected Apps/Packages

- Backend: `hono-api` service
- Frontend: `mentor-web` (Next.js)
- Database: PostgreSQL activity_logs table
- Analytics: Activity reporting and audit trail

## Logging Scope

### Course Management Actions

- `course_created`: New course created
- `course_updated`: Course details modified
- `course_published`: Course made public/live
- `course_unpublished`: Course removed from public
- `course_archived`: Course archived
- `course_deleted`: Course deleted permanently
- `course_section_added`: Section added to course
- `course_video_uploaded`: Video uploaded to course
- `course_video_updated`: Video metadata updated
- `course_video_deleted`: Video deleted from course

### Pricing & Revenue Actions

- `pricing_created`: Course pricing set initially
- `pricing_updated`: Price or terms changed
- `pricing_deleted`: Pricing removed
- `discount_created`: Promotional discount added
- `discount_updated`: Discount modified
- `discount_deleted`: Discount removed
- `revenue_eligibility_changed`: Subscription eligibility changed

### Community & Engagement Actions

- `community_enabled`: Discussion forum enabled
- `community_disabled`: Discussion forum disabled
- `announcement_posted`: Course announcement created
- `announcement_updated`: Announcement edited
- `announcement_deleted`: Announcement deleted

### Moderation Actions

- `comment_approved`: Student comment approved
- `comment_rejected`: Student comment rejected
- `comment_flagged`: Comment flagged for review
- `comment_deleted`: Comment removed
- `student_message_sent`: Message sent to student
- `student_message_deleted`: Message deleted

### Team Management Actions

- `team_member_invited`: Team member invitation sent
- `team_member_accepted`: Invitation accepted
- `team_member_onboarding_completed`: Onboarding finished
- `team_member_removed`: Member removed from team
- `team_member_role_changed`: Role updated
- `team_member_suspended`: Member suspended
- `team_member_reactivated`: Member reactivated

### Payout & Financial Actions

- `payout_requested`: Payout requested
- `payout_approved`: Payout approved
- `payout_completed`: Funds transferred
- `payout_failed`: Payout failed
- `stripe_account_connected`: Stripe Connect account added
- `stripe_account_updated`: Account details updated
- `stripe_account_disconnected`: Account removed

### Profile & Account Actions

- `profile_updated`: Instructor profile modified
- `profile_photo_updated`: Profile photo changed
- `bio_updated`: Bio/description updated
- `social_links_updated`: Social media links changed
- `password_changed`: Password changed
- `email_updated`: Email address changed
- `two_factor_enabled`: 2FA activated
- `two_factor_disabled`: 2FA disabled

---

## Data Model

### activity_logs Table

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instructor reference
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Actor information (who performed the action)
  actor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  actor_email VARCHAR(255),

  -- Action details
  action VARCHAR(64) NOT NULL,
  action_label VARCHAR(255),
  action_category VARCHAR(32),
  -- 'course', 'pricing', 'community', 'moderation', 'team', 'payout', 'profile'

  description TEXT,

  -- Target information (what the action was on)
  target_type VARCHAR(32),
  -- 'course', 'video', 'section', 'comment', 'team_member', 'payout', 'profile'

  target_id UUID,
  target_name VARCHAR(255),
  target_url VARCHAR(512),

  -- Before and after snapshots (for audit trail)
  before_snapshot JSONB,
  after_snapshot JSONB,
  changed_fields JSONB,
  -- Array of changed field names

  -- Context and metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- { courseId, videoId, commentId, teamMemberId, payoutId, ... }

  request_id VARCHAR(64),  -- For tracking request-response pairs
  ip_address INET,
  user_agent VARCHAR(512),
  source VARCHAR(32),  -- 'web', 'api', 'system'

  -- Severity for alerting
  severity VARCHAR(32) DEFAULT 'info',
  -- 'info', 'warning', 'critical'

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Soft delete for compliance
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Constraints
  CONSTRAINT valid_action CHECK (
    action ~ '^[a-z_]+$'
  ),
  CONSTRAINT valid_category CHECK (
    action_category IN ('course', 'pricing', 'community', 'moderation', 'team', 'payout', 'profile', 'system')
  )
);

-- Indexes for fast queries
CREATE INDEX idx_activity_logs_instructor_id
  ON activity_logs(instructor_id);
CREATE INDEX idx_activity_logs_team_id
  ON activity_logs(team_id);
CREATE INDEX idx_activity_logs_actor_id
  ON activity_logs(actor_id);
CREATE INDEX idx_activity_logs_action
  ON activity_logs(action);
CREATE INDEX idx_activity_logs_action_category
  ON activity_logs(action_category);
CREATE INDEX idx_activity_logs_target_type
  ON activity_logs(target_type);
CREATE INDEX idx_activity_logs_created_at
  ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_created_at_instructor
  ON activity_logs(instructor_id, created_at DESC);
CREATE INDEX idx_activity_logs_severity
  ON activity_logs(severity);

-- Composite index for common queries
CREATE INDEX idx_activity_logs_instructor_date_action
  ON activity_logs(instructor_id, created_at DESC, action);
```

---

## Logging Implementation

### Core Logging Function

```typescript
import { Request } from "express";

interface LogActivityOptions {
  instructorId: string;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  actionLabel?: string;
  actionCategory:
    | "course"
    | "pricing"
    | "community"
    | "moderation"
    | "team"
    | "payout"
    | "profile";
  targetType?: string;
  targetId?: string;
  targetName?: string;
  targetUrl?: string;
  beforeSnapshot?: Record<string, any>;
  afterSnapshot?: Record<string, any>;
  metadata?: Record<string, any>;
  severity?: "info" | "warning" | "critical";
  req?: Request;
}

async function logActivity(options: LogActivityOptions) {
  // 1. Calculate changed fields
  const changedFields =
    options.beforeSnapshot && options.afterSnapshot
      ? Object.keys(options.afterSnapshot).filter(
          (key) => options.beforeSnapshot![key] !== options.afterSnapshot![key],
        )
      : [];

  // 2. Create activity record
  const activity = await db.activity_logs.create({
    instructor_id: options.instructorId,
    actor_id: options.actorId,
    actor_name: options.actorName,
    actor_email: options.actorEmail,
    action: options.action,
    action_label: options.actionLabel || options.action,
    action_category: options.actionCategory,
    target_type: options.targetType,
    target_id: options.targetId,
    target_name: options.targetName,
    target_url: options.targetUrl,
    before_snapshot: options.beforeSnapshot || null,
    after_snapshot: options.afterSnapshot || null,
    changed_fields: changedFields.length > 0 ? changedFields : null,
    metadata: options.metadata || {},
    request_id: options.req?.id || null,
    ip_address: options.req?.ip,
    user_agent: options.req?.headers["user-agent"],
    source: "web",
    severity: options.severity || "info",
    created_at: new Date(),
  });

  // 3. Emit event for real-time updates
  await eventBus.emit("activity.logged", {
    activityId: activity.id,
    instructorId: options.instructorId,
    action: options.action,
    targetType: options.targetType,
  });

  // 4. Alert on critical actions
  if (options.severity === "critical") {
    await notificationService.sendToSuperAdmins({
      type: "critical_instructor_action",
      data: {
        instructorId: options.instructorId,
        action: options.action,
        targetType: options.targetType,
        timestamp: activity.created_at,
      },
    });
  }

  return activity;
}
```

### Course Creation Logging

```typescript
async function createCourse(
  instructorId: string,
  courseData: any,
  req: Request,
) {
  // 1. Create course
  const course = await db.courses.create({
    instructor_id: instructorId,
    ...courseData,
  });

  // 2. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "course_created",
    actionLabel: "Created course",
    actionCategory: "course",
    targetType: "course",
    targetId: course.id,
    targetName: course.title,
    targetUrl: `/courses/${course.slug}`,
    afterSnapshot: {
      title: course.title,
      slug: course.slug,
      description: course.description,
      category: course.category,
      status: course.status,
    },
    metadata: {
      courseId: course.id,
    },
    req,
  });

  return course;
}
```

### Course Publishing Logging

```typescript
async function publishCourse(
  instructorId: string,
  courseId: string,
  req: Request,
) {
  // 1. Get before snapshot
  const beforeCourse = await db.courses.findById(courseId);

  // 2. Update course status
  const updatedCourse = await db.courses.update(courseId, {
    status: "published",
    published_at: new Date(),
  });

  // 3. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "course_published",
    actionLabel: "Published course",
    actionCategory: "course",
    targetType: "course",
    targetId: courseId,
    targetName: beforeCourse.title,
    targetUrl: `/courses/${beforeCourse.slug}`,
    beforeSnapshot: {
      status: beforeCourse.status,
      published_at: beforeCourse.published_at,
    },
    afterSnapshot: {
      status: updatedCourse.status,
      published_at: updatedCourse.published_at,
    },
    metadata: {
      courseId,
    },
    req,
  });

  return updatedCourse;
}
```

### Video Upload Logging

```typescript
async function uploadCourseVideo(
  instructorId: string,
  courseId: string,
  videoFile: Express.Multer.File,
  videoMetadata: any,
  req: Request,
) {
  // 1. Get course
  const course = await db.courses.findById(courseId);

  // 2. Upload to Mux
  const muxVideo = await mux.video.uploads.create({
    ...videoMetadata,
  });

  // 3. Create video record
  const video = await db.videos.create({
    course_id: courseId,
    mux_video_id: muxVideo.asset_id,
    title: videoMetadata.title,
    duration: videoMetadata.duration,
    size: videoFile.size,
  });

  // 4. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "course_video_uploaded",
    actionLabel: "Uploaded video",
    actionCategory: "course",
    targetType: "video",
    targetId: video.id,
    targetName: videoMetadata.title,
    afterSnapshot: {
      title: videoMetadata.title,
      duration: videoMetadata.duration,
      size: videoFile.size,
      mux_video_id: muxVideo.asset_id,
    },
    metadata: {
      courseId,
      videoId: video.id,
      fileSize: videoFile.size,
      muxVideoId: muxVideo.asset_id,
    },
    req,
  });

  return video;
}
```

### Pricing Update Logging

```typescript
async function updateCoursePricing(
  instructorId: string,
  courseId: string,
  newPricing: any,
  req: Request,
) {
  // 1. Get current pricing
  const oldPricing = await db.course_pricing.findOne({ course_id: courseId });

  // 2. Update pricing
  const updatedPricing = await db.course_pricing.update(
    oldPricing.id,
    newPricing,
  );

  // 3. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "pricing_updated",
    actionLabel: "Updated course pricing",
    actionCategory: "pricing",
    targetType: "course",
    targetId: courseId,
    beforeSnapshot: {
      price: oldPricing.price,
      currency: oldPricing.currency,
      subscription_eligible: oldPricing.subscription_eligible,
    },
    afterSnapshot: {
      price: updatedPricing.price,
      currency: updatedPricing.currency,
      subscription_eligible: updatedPricing.subscription_eligible,
    },
    metadata: {
      courseId,
      oldPrice: oldPricing.price,
      newPrice: updatedPricing.price,
    },
    severity: oldPricing.price !== updatedPricing.price ? "warning" : "info",
    req,
  });

  return updatedPricing;
}
```

### Comment Moderation Logging

```typescript
async function approveComment(
  instructorId: string,
  commentId: string,
  req: Request,
) {
  // 1. Get comment
  const comment = await db.comments.findById(commentId);

  // 2. Update status
  const updatedComment = await db.comments.update(commentId, {
    status: "approved",
    moderated_by: instructorId,
    moderated_at: new Date(),
  });

  // 3. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "comment_approved",
    actionLabel: "Approved comment",
    actionCategory: "moderation",
    targetType: "comment",
    targetId: commentId,
    targetName: `Comment by ${comment.author_name}`,
    beforeSnapshot: {
      status: comment.status,
      moderated_by: comment.moderated_by,
    },
    afterSnapshot: {
      status: updatedComment.status,
      moderated_by: updatedComment.moderated_by,
    },
    metadata: {
      courseId: comment.course_id,
      commentId,
      author: comment.author_name,
    },
    req,
  });

  return updatedComment;
}
```

### Team Member Removal Logging

```typescript
async function removeTeamMember(
  instructorId: string,
  teamMemberId: string,
  reason?: string,
  req?: Request,
) {
  // 1. Get team member
  const teamMember = await db.team_members.findById(teamMemberId);
  const memberUser = await db.users.findById(teamMember.user_id);

  // 2. Mark as removed
  const updatedMember = await db.team_members.update(teamMemberId, {
    status: "removed",
    removed_at: new Date(),
  });

  // 3. Revoke access (remove from team)
  // (implementation depends on auth system)

  // 4. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "team_member_removed",
    actionLabel: "Removed team member",
    actionCategory: "team",
    targetType: "team_member",
    targetId: teamMemberId,
    targetName: memberUser.name,
    beforeSnapshot: {
      status: teamMember.status,
      role: teamMember.role,
    },
    afterSnapshot: {
      status: updatedMember.status,
      role: updatedMember.role,
      removed_at: updatedMember.removed_at,
    },
    metadata: {
      teamMemberId,
      memberEmail: memberUser.email,
      removalReason: reason,
    },
    severity: "warning",
    req,
  });

  return updatedMember;
}
```

### Payout Request Logging

```typescript
async function requestPayout(
  instructorId: string,
  amount: number,
  req: Request,
) {
  // 1. Create payout record
  const payout = await db.payouts.create({
    instructor_id: instructorId,
    amount,
    status: "pending",
  });

  // 2. Log activity
  await logActivity({
    instructorId,
    actorId: instructorId,
    action: "payout_requested",
    actionLabel: "Requested payout",
    actionCategory: "payout",
    targetType: "payout",
    targetId: payout.id,
    afterSnapshot: {
      amount,
      status: "pending",
    },
    metadata: {
      payoutId: payout.id,
      amount,
    },
    severity: "info",
    req,
  });

  return payout;
}
```

---

## API Endpoints

### GET /instructor/activity-logs

**List instructor's activity logs**

**Request:**

```http
GET /instructor/activity-logs?limit=50&offset=0&action=course_created&days=30&sortBy=date_desc
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `limit` (optional, default: 50): 1-100 items per page
- `offset` (optional, default: 0): For pagination
- `action` (optional): Filter by action (e.g., "course_created")
- `category` (optional): Filter by category (e.g., "course", "pricing")
- `targetType` (optional): Filter by target type
- `days` (optional, default: 90): Last N days
- `sortBy` (optional, default: "date_desc"): "date_asc", "date_desc"

**Response (200 OK):**

```json
{
  "activities": [
    {
      "activityId": "act-uuid-1",
      "action": "course_published",
      "actionLabel": "Published course",
      "actionCategory": "course",
      "targetType": "course",
      "targetName": "Advanced Makeup Techniques",
      "targetUrl": "/courses/advanced-makeup",
      "actor": {
        "id": "instructor-uuid-1",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "timestamp": "2024-02-18T10:30:00Z",
      "changedFields": ["status", "published_at"],
      "beforeSnapshot": {
        "status": "draft",
        "published_at": null
      },
      "afterSnapshot": {
        "status": "published",
        "published_at": "2024-02-18T10:30:00Z"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 245,
    "hasMore": true
  }
}
```

---

### GET /instructor/activity-logs/export

**Export activity logs to CSV**

**Request:**

```http
GET /instructor/activity-logs/export?days=90&format=csv
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `days` (optional, default: 90): Days to include
- `format` (optional): "csv" (default), "json"
- `action` (optional): Filter by action

**Response (200 OK):**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="activity-logs-2024-02-18.csv"

Activity ID,Date,Action,Category,Target Type,Target Name,Actor,Changed Fields
act-uuid-1,2024-02-18T10:30:00Z,course_published,course,course,Advanced Makeup,Jane Doe,status; published_at
act-uuid-2,2024-02-17T14:15:00Z,pricing_updated,pricing,course,Advanced Makeup,Jane Doe,price
```

---

## Frontend Dashboard

### Activity Logs Page

```typescript
// pages/activity-logs.tsx
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export default function ActivityLogs() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchActivities();
  }, [filterAction, filterCategory, days]);

  const fetchActivities = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAction) params.append("action", filterAction);
      if (filterCategory) params.append("category", filterCategory);
      params.append("days", days.toString());

      const res = await fetch(`/api/instructor/activity-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
      });

      const data = await res.json();
      setActivities(data.activities);
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const res = await fetch(
      `/api/instructor/activity-logs/export?days=${days}&format=csv`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
      }
    );

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="activity-logs">
      <h1>Activity Log</h1>

      <div className="filters">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="course">Course</option>
          <option value="pricing">Pricing</option>
          <option value="community">Community</option>
          <option value="moderation">Moderation</option>
          <option value="team">Team</option>
          <option value="payout">Payout</option>
          <option value="profile">Profile</option>
        </select>

        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>

        <button onClick={handleExport}>Export as CSV</button>
      </div>

      {loading ? (
        <p>Loading activities...</p>
      ) : (
        <div className="activity-list">
          {activities.map((activity) => (
            <div key={activity.activityId} className="activity-item">
              <div className="activity-header">
                <span className={`badge badge-${activity.actionCategory}`}>
                  {activity.actionCategory}
                </span>
                <h3>{activity.actionLabel}</h3>
                <time>
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                  })}
                </time>
              </div>

              <div className="activity-body">
                {activity.targetName && (
                  <p>
                    <strong>Target:</strong> {activity.targetName}
                  </p>
                )}
                {activity.changedFields && (
                  <p>
                    <strong>Changed:</strong> {activity.changedFields.join(", ")}
                  </p>
                )}
              </div>

              {activity.beforeSnapshot && activity.afterSnapshot && (
                <details className="activity-snapshot">
                  <summary>View details</summary>
                  <div className="before-after">
                    <div>
                      <h4>Before</h4>
                      <pre>{JSON.stringify(activity.beforeSnapshot, null, 2)}</pre>
                    </div>
                    <div>
                      <h4>After</h4>
                      <pre>{JSON.stringify(activity.afterSnapshot, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Requirements

### Logging Coverage

1. Log all course CRUD operations
2. Log pricing changes
3. Log community settings changes
4. Log all moderation actions
5. Log team management actions
6. Log payout requests and completions
7. Log profile updates

### Data Capture

1. Store before/after snapshots for changes
2. Capture changed fields
3. Store IP address and user agent
4. Include request IDs for tracing
5. Store metadata for context

### UI Features

1. Filterable activity log with multiple filters
2. Sortable by date, action, target
3. Paginated results
4. Export to CSV/JSON
5. Before/after comparison view
6. Search functionality

### Performance

1. Index on instructor_id + created_at for fast queries
2. Archive logs older than 2 years
3. Pagination to avoid loading all records

---

## Acceptance Criteria

- [ ] GET /instructor/activity-logs returns paginated activities
- [ ] Activities include: action, actor, target, timestamp, snapshots
- [ ] Filter by action, category, target type works correctly
- [ ] Filter by date range (days parameter) works
- [ ] Sort by date ascending/descending works
- [ ] Changed fields correctly identified and stored
- [ ] Before/after snapshots are accurate
- [ ] GET /instructor/activity-logs/export returns CSV file
- [ ] Export includes all logged activities
- [ ] Export can be filtered by action/category/date
- [ ] Activity dashboard displays activities with timestamps
- [ ] Activity details expandable to show before/after
- [ ] Instructor can only see their own activities (403 for others)
- [ ] Super Admin can view any instructor's activities
- [ ] Activity created for all course CRUD operations
- [ ] Activity created for pricing changes
- [ ] Activity created for team member changes
- [ ] Activity created for payout requests
- [ ] Activity created for profile updates
- [ ] IP address and user agent captured
- [ ] Critical actions flagged with severity "critical"
- [ ] Audit trail is immutable (no updates/deletes)
- [ ] Performance: queries return within 500ms for typical instructor

## Dependencies

- **Milestone**: All other features (courses, pricing, team, payouts, etc.)
- **Database**: activity_logs table with proper indexing
- **Frontend**: Mentor Web dashboard

## Technical Notes

### Automatic Logging with Middleware

```typescript
// Activity logging middleware
app.use(async (c, next) => {
  // Attach logging helper to context
  c.logActivity = (options) => logActivity({
    ...options,
    instructorId: c.state.instructorId,
    req: c.env.req,
  });

  await next();
});

// Usage in route handlers:
app.post("/courses", async (c) => {
  const course = await createCourse(...);
  await c.logActivity({
    action: "course_created",
    // ... rest of options
  });
});
```

### Archive Logs Job

```typescript
// Monthly job to archive old logs
schedule.scheduleJob("0 0 1 * *", async () => {
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);

  await db.activity_logs.updateMany(
    { created_at: { $lt: twoYearsAgo } },
    { is_deleted: true },
  );
});
```

### GDPR Compliance

- When instructor account deleted, mark activity_logs as soft-deleted
- Never permanently delete activity logs (audit trail)
- Provide export functionality for user data
- No PII in snapshots (use IDs instead of names)

### Snapshot Best Practices

- Only store changed fields in snapshots
- Don't store sensitive data (passwords, tokens)
- Use object references (IDs) instead of full objects
- Limit snapshot size (max 5KB)

### Future Enhancements

1. Real-time activity dashboard with websockets
2. Activity analytics (actions by category, day of week, etc.)
3. Anomaly detection (unusual activity patterns)
4. Scheduled activity reports (daily/weekly digest)
5. Team-level activity aggregation
6. Student-facing activity feed (instructor posts/updates)
