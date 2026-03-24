# Task: Course Unpublish and Archive

## Description

Implement unpublish and archive functionality for courses. Unpublish removes the course from the catalog but learners retain access. Archive hides the course from all views but learners can still access it. Instructors cannot delete courses, only unpublish or archive. Both actions show impact summary before confirmation and provide notifications to affected learners.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`

## API Endpoints

### POST /api/v1/courses/{courseId}/unpublish

Unpublish a course (remove from catalog, keep learner access).

**Request Body:**

```json
{
  "reason": string (optional, for admin records)
}
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "status": "draft",
  "unpublishedAt": "ISO8601",
  "message": "Course unpublished successfully",
  "impactSummary": {
    "enrollmentCount": 150,
    "learnersNotified": true,
    "catalogRemovalTime": "within 5 minutes"
  }
}
```

**Error Responses:**

- `403 Forbidden`: User is not course owner
- `404 Not Found`: Course not found
- `400 Bad Request`: Course already unpublished

### POST /api/v1/courses/{courseId}/archive

Archive a course (hide from all views, keep learner access).

**Request Body:**

```json
{
  "reason": string (optional),
  "restorableUntil": string (ISO8601, optional)
}
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "status": "archived",
  "archivedAt": "ISO8601",
  "message": "Course archived successfully",
  "impactSummary": {
    "enrollmentCount": 150,
    "learnersNotified": true,
    "restorationAvailable": true,
    "restorableUntil": "ISO8601"
  }
}
```

### POST /api/v1/courses/{courseId}/restore

Restore an archived course to published status.

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "status": "published",
  "restoredAt": "ISO8601",
  "message": "Course restored successfully"
}
```

### GET /api/v1/courses/{courseId}/unpublish-impact

Get impact summary before unpublishing (dry run).

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "currentStatus": "published",
  "impactSummary": {
    "action": "unpublish",
    "enrollmentCount": 150,
    "activeLearnersCount": 45,
    "learnersCompleted": 105,
    "learnersInProgress": 45,
    "willLoseAccess": false,
    "affectedLearners": [],
    "catalogRemovalTime": "5 minutes",
    "learnersCanStillAccess": true,
    "messagesRequired": true
  }
}
```

### GET /api/v1/courses/{courseId}/archive-impact

Get impact summary before archiving.

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "currentStatus": "published",
  "impactSummary": {
    "action": "archive",
    "enrollmentCount": 150,
    "activeLearnersCount": 45,
    "learnersCompleted": 105,
    "learnersInProgress": 45,
    "willLoseAccess": false,
    "learnersCanStillAccess": true,
    "hideFromDashboard": true,
    "hideFromSearch": true,
    "hideFromCategory": true,
    "canRestore": true,
    "restorableUntil": "ISO8601 (30 days from now)"
  }
}
```

## UI Components

### Unpublish Dialog

**Trigger:** Settings → Unpublish Course OR Course detail page → More actions

**Dialog Content:**

1. Title: "Unpublish Course?"
2. Warning: "The course will be removed from the catalog, but existing learners will retain access."
3. Impact Summary Card:
   - Enrollment count: "150 learners have enrolled"
   - Learners in progress: "45 currently learning"
   - Learners completed: "105 have completed"
   - Visibility: "Course will be removed from catalog and search within 5 minutes"
   - Learner access: "Learners can still access and continue learning"
4. Optional: Reason textarea ("Why are you unpublishing?")
5. Notification message preview:
   - "Learners will be notified: 'Your course [Title] has been unpublished. You can still access and complete your coursework.'"
6. Checkbox: "Notify learners" (checked by default)
7. Buttons: [Cancel] [Unpublish] [Learn More]

### Archive Dialog

**Trigger:** Settings → Archive Course OR Course detail page → More actions

**Dialog Content:**

1. Title: "Archive Course?"
2. Explanation: "The course will be hidden from all views but learners can still access it. You can restore it anytime within 30 days."
3. Impact Summary Card:
   - Enrollment count, learner counts, progress counts
   - Visibility: "Hidden from catalog, search, and instructor dashboard"
   - Learner access: "Learners can still access their enrollment"
   - Restoration window: "Restorable until [date]"
4. Optional: Reason textarea
5. Notification message preview
6. Checkbox: "Notify learners" (checked by default)
7. Buttons: [Cancel] [Archive] [Learn More]

### Archive Management

- Dashboard section: "Archived Courses"
  - List of archived courses
  - Restoration deadline shown
  - "Restore" button per course
  - "Permanently Delete" button (after 30 days, optional)
- Instructor can filter courses to show archived

### Confirmation Toast

After unpublish/archive:

- "Course unpublished. Course will be removed from catalog within 5 minutes."
- "Course archived. You can restore it until [date]."
- Optional: Link to "View learner messages" or "Send update message"

## Requirements

1. **Unpublish Functionality**
   - Change status from "published" to "draft"
   - Set `unpublished_at` timestamp
   - Remove from course catalog/search within 5 minutes
   - Learners retain access to course
   - Learners can continue learning and complete assignments
   - Learner progress preserved
   - Course becomes editable (can re-publish with changes)
   - Cannot unpublish a draft course

2. **Archive Functionality**
   - Change status to "archived"
   - Set `archived_at` timestamp
   - Remove from all instructor views (dashboard, course list)
   - Remove from learner dashboard (if configured)
   - Remove from search/catalog (immediately)
   - Learners can still access via direct link
   - Learners can still complete coursework
   - Learner progress preserved
   - Restorable for 30 days by default
   - After 30 days: can be permanently deleted (optional)

3. **Delete Prevention**
   - Instructors CANNOT delete courses (API returns 400 or 403)
   - UI does not show delete button (only unpublish/archive)
   - Error message: "Courses cannot be deleted. You can unpublish or archive them instead."
   - Admin may have delete capability (separate permission)

4. **Impact Summary**
   - Show enrollment count
   - Show learner progress breakdown (in progress, completed, not started)
   - Show visibility impact (how/where will course disappear)
   - Show learner access impact (will they lose access? No)
   - Show restoration options (if applicable)
   - Show notification options

5. **Learner Notifications**
   - Send notification to all enrolled learners
   - Message: "Your course [Title] has been [unpublished/archived]."
   - Additional context: "You can still access and complete your coursework."
   - Link: Button to access course
   - Delivery: In-app notification + optional email
   - Opt-out: Some learners may have disabled notifications

6. **Status Transitions**
   - Draft → Published (via publish endpoint)
   - Published → Draft (via unpublish)
   - Published/Draft → Archived (via archive)
   - Archived → Published (via restore)
   - Cannot: Archived → Draft directly (must restore first)

7. **Restoration**
   - Archive restores to "published" status (original state)
   - Available for 30 days by default
   - Can extend deadline (optional)
   - After deadline: archive cannot be restored (data retained or purged per policy)
   - Restore is quick (1-2 seconds)

8. **Authorization**
   - Verify JWT and instructor role
   - Verify user is course owner
   - Return 403 if not authorized

9. **Audit & Logging**
   - Log unpublish/archive actions with timestamp and user
   - Log reason if provided
   - Log restoration actions
   - Optional: Track via audit table

## Acceptance Criteria

- [ ] POST /api/v1/courses/{courseId}/unpublish changes status to "draft"
- [ ] Unpublished course removed from catalog within 5 minutes
- [ ] Learners retain access after unpublish
- [ ] Learners can still complete assignments after unpublish
- [ ] POST /api/v1/courses/{courseId}/archive changes status to "archived"
- [ ] Archived course removed from all views immediately
- [ ] Learners retain access to archived courses
- [ ] Archive is restorable for 30 days
- [ ] POST /api/v1/courses/{courseId}/restore restores archived course
- [ ] Unpublish impact summary shows enrollment count
- [ ] Archive impact summary shows learner counts and restoration deadline
- [ ] Learners notified when course unpublished
- [ ] Learners notified when course archived
- [ ] Notification includes "course can still be accessed" message
- [ ] Unpublish/archive confirmation dialogs show before action
- [ ] Course deletion prevented (no delete button or API endpoint)
- [ ] 403 returned if user not course owner
- [ ] 400 returned if course already unpublished/archived
- [ ] Archived courses listed separately in dashboard
- [ ] Archived courses can be filtered/searched
- [ ] Unpublish/archive actions logged with timestamp

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Publish Validation Flow (publish-validation-flow.md)
- **Related**: Course Discovery (06-course-discovery-and-browsing)
- **Related**: Instructor Dashboard (10-instructor-dashboard-and-revenue)
- **Related**: Learning Progress (07-video-player-and-learning)

## Technical Notes

### Database Schema

```sql
-- Extend courses table
ALTER TABLE courses ADD COLUMN unpublished_at TIMESTAMP;
ALTER TABLE courses ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE courses ADD COLUMN archived_until TIMESTAMP; -- Restoration deadline
ALTER TABLE courses ADD COLUMN archive_reason TEXT;

-- Indexes for efficient queries
CREATE INDEX idx_course_status ON courses(status);
CREATE INDEX idx_instructor_courses ON courses(instructor_id, status);
CREATE INDEX idx_archived_courses ON courses(status) WHERE status = 'archived';
CREATE INDEX idx_restorable_archives ON courses(archived_until) WHERE status = 'archived' AND archived_until > NOW();
```

### Backend Handler: Unpublish Course

```typescript
export const unpublishCourse = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  if (course.status !== "published") {
    throw createError({
      statusCode: 400,
      message: "Only published courses can be unpublished",
    });
  }

  // Get impact summary
  const enrollmentCount = await db.query.enrollments.findMany({
    where: (e, { eq }) => eq(e.courseId, courseId),
  });

  // Unpublish
  const now = new Date();
  const unpublished = await db
    .update(courses)
    .set({
      status: "draft",
      unpublishedAt: now,
      updatedAt: now,
    })
    .where(eq(courses.id, courseId))
    .returning();

  // Notify learners (async)
  notifyLearnersOfUnpublish(
    courseId,
    course.title,
    enrollmentCount.map((e) => e.userId),
  ).catch((err) => console.error("Notification failed:", err));

  // Invalidate cache
  await invalidateCourseCache(courseId);

  return {
    courseId,
    status: "draft",
    unpublishedAt: now.toISOString(),
    message: "Course unpublished successfully",
    impactSummary: {
      enrollmentCount: enrollmentCount.length,
      learnersNotified: true,
      catalogRemovalTime: "within 5 minutes",
    },
  };
});

async function notifyLearnersOfUnpublish(
  courseId: string,
  courseTitle: string,
  learnerIds: string[],
) {
  for (const learnerId of learnerIds) {
    // Send in-app notification
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: learnerId,
      type: "course_unpublished",
      title: `${courseTitle} has been unpublished`,
      message: "You can still access and complete your coursework.",
      courseId,
      createdAt: new Date(),
    });

    // Optionally send email (check user notification preferences)
  }
}
```

### Backend Handler: Archive Course

```typescript
export const archiveCourse = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  if (course.status === "archived") {
    throw createError({
      statusCode: 400,
      message: "Course is already archived",
    });
  }

  const enrollmentCount = await db.query.enrollments.findMany({
    where: (e, { eq }) => eq(e.courseId, courseId),
  });

  const now = new Date();
  const restorableUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const archived = await db
    .update(courses)
    .set({
      status: "archived",
      archivedAt: now,
      archivedUntil: restorableUntil,
      updatedAt: now,
    })
    .where(eq(courses.id, courseId))
    .returning();

  // Notify learners
  notifyLearnersOfArchive(
    courseId,
    course.title,
    enrollmentCount.map((e) => e.userId),
  ).catch((err) => console.error("Notification failed:", err));

  // Invalidate cache
  await invalidateCourseCache(courseId);

  return {
    courseId,
    status: "archived",
    archivedAt: now.toISOString(),
    message: "Course archived successfully",
    impactSummary: {
      enrollmentCount: enrollmentCount.length,
      learnersNotified: true,
      restorationAvailable: true,
      restorableUntil: restorableUntil.toISOString(),
    },
  };
});

async function notifyLearnersOfArchive(
  courseId: string,
  courseTitle: string,
  learnerIds: string[],
) {
  for (const learnerId of learnerIds) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: learnerId,
      type: "course_archived",
      title: `${courseTitle} has been archived`,
      message: "You can still access and complete your coursework.",
      courseId,
      createdAt: new Date(),
    });
  }
}
```

### Backend Handler: Restore Course

```typescript
export const restoreCourse = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(
        eq(courses.id, courseId),
        eq(courses.instructorId, user.id),
        eq(courses.status, "archived"),
      ),
  });

  if (!course) throw createError({ statusCode: 404 });

  if (new Date() > new Date(course.archivedUntil!)) {
    throw createError({
      statusCode: 400,
      message: "Archive restoration period expired",
    });
  }

  const now = new Date();
  const restored = await db
    .update(courses)
    .set({
      status: "published",
      archivedAt: null,
      archivedUntil: null,
      updatedAt: now,
    })
    .where(eq(courses.id, courseId))
    .returning();

  await invalidateCourseCache(courseId);

  return {
    courseId,
    status: "published",
    restoredAt: now.toISOString(),
    message: "Course restored successfully",
  };
});
```

### Frontend Component: Unpublish Dialog

```typescript
import { useState } from 'react';

export function UnpublishDialog({ course, onConfirm, onCancel }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [notifyLearners, setNotifyLearners] = useState(true);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);

  useEffect(() => {
    fetchImpactSummary();
  }, []);

  const fetchImpactSummary = async () => {
    const response = await fetch(`/api/v1/courses/${course.id}/unpublish-impact`);
    const data = await response.json();
    setImpact(data.impactSummary);
  };

  const handleUnpublish = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/courses/${course.id}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined })
      });

      if (!response.ok) throw new Error('Unpublish failed');

      toast.success('Course unpublished. It will be removed from catalog within 5 minutes.');
      onConfirm?.();
    } catch (error) {
      toast.error('Failed to unpublish: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dialog">
      <h2>Unpublish Course?</h2>

      <p className="warning">
        The course will be removed from the catalog, but existing learners will retain access.
      </p>

      {impact && (
        <div className="impact-summary">
          <h3>Course Impact</h3>
          <div className="impact-item">
            <span>Learners Enrolled:</span>
            <strong>{impact.enrollmentCount}</strong>
          </div>
          <div className="impact-item">
            <span>Currently Learning:</span>
            <strong>{impact.learnersInProgress}</strong>
          </div>
          <div className="impact-item">
            <span>Completed:</span>
            <strong>{impact.learnersCompleted}</strong>
          </div>
          <p className="note">Learners can still access and complete their coursework.</p>
        </div>
      )}

      <div className="form-group">
        <label>Reason for unpublishing (optional):</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="E.g., Content needs update..."
          disabled={isLoading}
        />
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={notifyLearners}
          onChange={(e) => setNotifyLearners(e.target.checked)}
          disabled={isLoading}
        />
        Notify learners of unpublish
      </label>

      <div className="notification-preview">
        <p className="preview-label">Learners will receive:</p>
        <div className="preview-message">
          "{course.title}" has been unpublished. You can still access and complete your coursework.
        </div>
      </div>

      <div className="actions">
        <button onClick={onCancel} disabled={isLoading}>Cancel</button>
        <button
          onClick={handleUnpublish}
          className="danger"
          disabled={isLoading}
        >
          {isLoading ? 'Unpublishing...' : 'Unpublish Course'}
        </button>
      </div>
    </div>
  );
}
```

### Testing Checklist

- Unpublish published course → status changes to draft
- Course removed from catalog within 5 minutes
- Learners still have access after unpublish
- Learners can complete assignments after unpublish
- Archive published course → status changes to archived
- Archived course hidden from catalog/search immediately
- Learners still have access to archived courses
- Restore archived course → status changes to published
- Archived course restorable within 30 days
- Archived course not restorable after 30 days
- Impact summary shows correct enrollment count
- Learners notified when course unpublished
- Learners notified when course archived
- Delete prevented (no delete endpoint or button)
- 403 returned if not course owner
- Archived courses listed separately in dashboard
