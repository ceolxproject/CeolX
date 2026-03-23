# Lesson Completion Logic

## Description

Define and implement the rules for marking lessons, modules, and courses as complete. A lesson is automatically marked complete when the user watches 90% or more of the video. Modules complete when all contained lessons are complete. Courses complete when all lessons across all modules are complete. Handle edge cases like video replacements and learner rollback.

## Affected Apps/Packages

- Backend: progress tracking service (`apps/api`)
- `packages/types` (TypeScript types for completion)
- Database layer (PostgreSQL)
- Admin panel (course management, video editing)

## API Endpoints

- `POST /api/lessons/:lessonId/progress` - Track video progress (triggers completion logic)
- `GET /api/lessons/:lessonId/completion` - Get lesson completion status
- `GET /api/modules/:moduleId/completion` - Get module completion status
- `GET /api/courses/:courseId/completion` - Get course completion status
- `PATCH /api/lessons/:lessonId/video` - Replace video (admin task)
- `POST /api/admin/reset-progress` - Bulk reset learner progress (admin task)

## Requirements

### 1. Lesson Completion Rules

- **Completion Trigger**: When watched_percentage >= 90% of total video duration
- **Completion is Permanent**: Once a lesson is marked complete for a user, it remains complete (timestamp immutable)
- **No Re-completion Needed**: Watching 100% doesn't re-mark if already at 90%+
- **Completion Timestamp**: Set to the exact moment watched% crosses 90% threshold
- **Status States**:
  - **Not Started**: watched_percentage = 0
  - **In Progress**: 0 < watched_percentage < 90
  - **Complete**: watched_percentage >= 90, completed = true, completed_at set

### 2. Module Completion Rules

- **Completion Trigger**: ALL lessons in module marked complete
- **Automatic Calculation**: On any lesson completion, recalculate module status
- **Completion Percentage**: (completed_lessons / total_lessons) \* 100
- **Module Status**:
  - **0% Complete**: No lessons complete
  - **Partial**: Some lessons complete (0% < completion% < 100%)
  - **100% Complete**: All lessons complete, module marked complete

### 3. Course Completion Rules

- **Completion Trigger**: ALL lessons across ALL modules marked complete
- **Completion Percentage**: (completed_lessons / total_lessons) \* 100
- **Status Display**:
  - Dashboard shows "XX% Complete"
  - When 100%: "Completed on [date]" with completion badge
- **Trigger Celebration**: When completed == true AND completionPercentage == 100%
  - Redirect to congratulations page
  - Show shareable link
  - Mark in "My Courses" as completed with badge

### 4. Watched Percentage Calculation

- **Formula**: `(sum of watched_segments) / total_duration_seconds * 100`
- **Watched Segments**: Non-overlapping time ranges user actually viewed
  - Example: [0-300s, 420-900s, 1200-1500s] means user watched 1080 of 3600 seconds = 30%
- **Precision**: Calculate to 1 decimal place (e.g., 89.9%, 90.1%)
- **Edge Cases**:
  - Video duration changes (re-encoding): recalculate based on NEW duration
  - User seeks beyond video length: capped at total_duration
  - Partial segment at end: included if user reached final segment

### 5. Video Replacement Handling

When instructor replaces video in a lesson (e.g., fixes encoding, updates content):

- **New Video**:
  - New duration may differ from old video
  - Assume old watched% translates proportionally: `new_watched_percentage = (old_watched_seconds / old_duration) * new_duration`
  - If result >= 90%, keep completed status
  - If result < 90%, reset to incomplete but preserve old position % for resume
  - Update total_duration to new value
- **Scenario Example**:
  - Old video: 60 minutes, user watched 90% (54 minutes)
  - New video: 45 minutes
  - New watched%: (54 / 60) \* 45 = 40.5% (reset to incomplete)
  - User resumes from 40.5% position, needs to watch additional 49.5% to re-complete

- **Notification to Learners**:
  - Email: "Video updated in [course]/[lesson], your progress was preserved"
  - Show in-app banner: "This video has been updated. You can resume from where you left off."

### 6. Rollback & Admin Reset

**Admin Actions** (super-admin panel):

- **Reset Single Learner**: Clear all progress for user in course
  - Delete all video_progress records for learner in course
  - Reset lesson_completion, module_completion, course_completion
  - Send notification: "Your progress in [course] has been reset. You can restart."
- **Bulk Reset**: Reset progress for group of learners (e.g., incorrect completions)
  - Select learners + courses
  - Batch delete via transaction
  - Send bulk notification
- **Mark as Complete (Exemption)**: Admin manually mark lesson/course complete
  - Set completion status and timestamp to NOW()
  - Log action: "Admin [name] marked [learner] complete"
  - Notify learner: "Your completion in [lesson] was verified by instructor"

### 7. Re-enrollments & Duplicate Completions

- **Same Course, Second Enrollment**:
  - New enrollment = fresh progress tracking (separate record)
  - Previous completion preserved in history
  - Learner starts from 0% again
  - Can complete again in new enrollment
- **Prevent Duplicate Rewards**:
  - Certificate/badge logic checks: (learner_id, course_id, completion_timestamp)
  - Only first completion grants reward
  - Subsequent completions increment completion_count but no new rewards

## Acceptance Criteria

- [ ] Lesson marked complete when watched% >= 90%
- [ ] Completion timestamp set on crossing 90% threshold
- [ ] Completion status immutable once set (doesn't reset if user reaches 100%)
- [ ] Module completion requires ALL lessons complete
- [ ] Module completion percentage calculated correctly
- [ ] Course completion requires ALL lessons complete
- [ ] Course completion trigger celebration page
- [ ] Watched percentage calculated from merged segments
- [ ] Video replacement proportionally recalculates watched%
- [ ] If new video duration results in < 90%: reset to incomplete
- [ ] If new video duration results in >= 90%: keep completed status
- [ ] Learners notified of video replacement via email/in-app
- [ ] Admin can reset learner progress (single/bulk)
- [ ] Admin reset creates audit log entry
- [ ] Admin can manually mark lesson/course complete
- [ ] Manual completion logs "marked by admin" in history
- [ ] Re-enrollments treated as separate progress tracks
- [ ] Duplicate completions don't award duplicate certificates
- [ ] Completion counts tracked (lessons_completed_count for user profile)

## Dependencies

- Progress tracking API (lesson progress endpoint)
- Queue system (async module/course recalculation)
- Admin panel (video replacement, bulk reset)
- Notification system (email, in-app)
- Audit logging system

## Technical Notes

### Database Schema Extensions

```sql
-- Add to video_progress table
ALTER TABLE video_progress ADD COLUMN completion_event_logged BOOLEAN DEFAULT FALSE;

-- Lesson completion history (audit trail)
CREATE TABLE lesson_completion_history (
  id SERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action VARCHAR(50), -- 'auto-completed', 'admin-marked', 'reset', 'video-replacement-kept'
  watched_percentage_at_completion FLOAT,
  completed_at TIMESTAMP NOT NULL,
  completed_by_admin BOOLEAN DEFAULT FALSE,
  admin_user_id UUID, -- If admin-marked
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

-- Video replacement log
CREATE TABLE video_replacement_log (
  id SERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  old_video_id UUID,
  new_video_id UUID,
  old_duration_seconds FLOAT,
  new_duration_seconds FLOAT,
  replaced_by_admin_id UUID NOT NULL,
  replaced_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (old_video_id) REFERENCES videos(id),
  FOREIGN KEY (new_video_id) REFERENCES videos(id),
  FOREIGN KEY (replaced_by_admin_id) REFERENCES users(id)
);

-- Course completion attempts (for duplicate detection)
CREATE TABLE course_completion_attempts (
  id SERIAL PRIMARY KEY,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  enrollment_id UUID NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  watched_percentage FLOAT,
  certificate_awarded BOOLEAN DEFAULT FALSE,
  attempt_number INT,
  UNIQUE(enrollment_id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
);
```

### Lesson Completion Logic Implementation

```typescript
// /services/completion-service.ts
import { db } from "../db";
import { progressQueue } from "../queue";

const COMPLETION_THRESHOLD = 90; // 90% watched

export async function updateLessonCompletion(
  lessonId: string,
  userId: string,
  watchedPercentage: number,
  duration: number
): Promise<{ completed: boolean; completionTimestamp: Date | null }> {
  // Get current state
  const currentResult = await db.query(
    "SELECT completed, completed_at FROM video_progress WHERE lesson_id = $1 AND user_id = $2",
    [lessonId, userId]
  );
  const current = currentResult.rows[0];

  const wasCompleted = current?.completed || false;
  const isNowCompleted = watchedPercentage >= COMPLETION_THRESHOLD;
  const justCrossedThreshold = !wasCompleted && isNowCompleted;

  // Update in database
  const result = await db.query(
    `
    UPDATE video_progress
    SET
      watched_percentage = $3,
      completed = $4,
      completed_at = CASE
        WHEN $4 AND $5 THEN NOW()
        WHEN $4 THEN completed_at
        ELSE NULL
      END,
      last_updated_at = NOW()
    WHERE lesson_id = $1 AND user_id = $2
    RETURNING *;
    `,
    [
      lessonId,
      userId,
      watchedPercentage,
      isNowCompleted,
      justCrossedThreshold, // Only set completed_at if just crossed
    ]
  );

  const progress = result.rows[0];

  // Log completion event
  if (justCrossedThreshold) {
    await db.query(
      `
      INSERT INTO lesson_completion_history
        (lesson_id, user_id, action, watched_percentage_at_completion, completed_at, completed_by_admin)
      VALUES ($1, $2, $3, $4, NOW(), FALSE)
      `,
      [lessonId, userId, "auto-completed", watchedPercentage]
    );

    // Queue module/course recalculation
    await progressQueue.add(
      "recalculate-module-completion",
      { lessonId, userId },
      { priority: 1 }
    );
  }

  return {
    completed: isNowCompleted,
    completionTimestamp: progress.completed_at,
  };
}

export async function replaceVideoAndRecalculate(
  lessonId: string,
  oldVideoId: string,
  newVideoId: string,
  adminUserId: string,
  newDurationSeconds: number
): Promise<{ affectedLearners: number }> {
  // Get old video duration
  const oldVideoResult = await db.query(
    "SELECT duration_seconds FROM videos WHERE id = $1",
    [oldVideoId]
  );
  const oldDuration = oldVideoResult.rows[0]?.duration_seconds;

  // Find all learners with progress on old video
  const learnersResult = await db.query(
    `
    SELECT DISTINCT user_id, last_position_seconds, watched_percentage, completed, completed_at
    FROM video_progress
    WHERE lesson_id = $1
    `,
    [lessonId]
  );

  const learners = learnersResult.rows;
  let affectedLearners = 0;

  // Recalculate progress for each learner
  for (const learner of learners) {
    // Calculate proportional watched percentage for new duration
    const watchedSeconds = (learner.watched_percentage / 100) * oldDuration;
    const newWatchedPercentage = (watchedSeconds / newDurationSeconds) * 100;
    const wasCompleted = learner.completed;
    const isNowCompleted = newWatchedPercentage >= COMPLETION_THRESHOLD;
    const lostCompletion = wasCompleted && !isNowCompleted;

    // Update progress
    await db.query(
      `
      UPDATE video_progress
      SET
        watched_percentage = $3,
        total_duration_seconds = $4,
        completed = $5,
        completed_at = CASE
          WHEN $6 AND NOT $5 THEN NULL -- Lost completion
          ELSE completed_at
        END,
        last_updated_at = NOW()
      WHERE lesson_id = $1 AND user_id = $2
      `,
      [
        lessonId,
        learner.user_id,
        newWatchedPercentage,
        newDurationSeconds,
        isNowCompleted,
        lostCompletion,
      ]
    );

    // If lost completion, update history
    if (lostCompletion) {
      await db.query(
        `
        INSERT INTO lesson_completion_history
          (lesson_id, user_id, action, watched_percentage_at_completion, completed_at, completed_by_admin)
        VALUES ($1, $2, $3, $4, NOW(), FALSE)
        `,
        [
          lessonId,
          learner.user_id,
          "video-replacement-reset",
          newWatchedPercentage,
        ]
      );
    }

    affectedLearners++;
  }

  // Log video replacement
  await db.query(
    `
    INSERT INTO video_replacement_log
      (lesson_id, old_video_id, new_video_id, old_duration_seconds, new_duration_seconds, replaced_by_admin_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      lessonId,
      oldVideoId,
      newVideoId,
      oldDuration,
      newDurationSeconds,
      adminUserId,
    ]
  );

  // Notify learners
  await notifyLearnersVideoReplaced(lessonId, affectedLearners);

  // Recalculate module/course completion for affected learners
  for (const learner of learners) {
    await progressQueue.add(
      "recalculate-module-completion",
      { lessonId, userId: learner.user_id },
      { priority: 1 }
    );
  }

  return { affectedLearners };
}

export async function adminMarkComplete(
  lessonId: string,
  userId: string,
  adminUserId: string
): Promise<void> {
  // Mark completed
  await db.query(
    `
    UPDATE video_progress
    SET completed = TRUE, completed_at = NOW(), last_updated_at = NOW()
    WHERE lesson_id = $1 AND user_id = $2
    `,
    [lessonId, userId]
  );

  // Log action
  await db.query(
    `
    INSERT INTO lesson_completion_history
      (lesson_id, user_id, action, completed_at, completed_by_admin, admin_user_id)
    VALUES ($1, $2, $3, NOW(), TRUE, $4)
    `,
    [lessonId, userId, "admin-marked", adminUserId]
  );

  // Queue module/course recalculation
  await progressQueue.add(
    "recalculate-module-completion",
    { lessonId, userId },
    { priority: 1 }
  );

  // Notify learner
  await sendNotification(userId, {
    type: "lesson-completion-verified",
    lessonId,
    message: `Your completion in this lesson has been verified by an instructor.`,
  });
}
```

### Module Completion Calculation

```typescript
// /jobs/recalculate-module-completion.ts
import { Job } from "bull";

export const recalculateModuleCompletionJob = async (job: Job) => {
  const { lessonId, userId } = job.data;

  // Find the module containing this lesson
  const moduleResult = await db.query(
    `
    SELECT m.id FROM modules m
    JOIN lessons l ON l.module_id = m.id
    WHERE l.id = $1
    `,
    [lessonId]
  );

  const moduleId = moduleResult.rows[0]?.id;
  if (!moduleId) return;

  // Get all lessons in module
  const lessonsResult = await db.query(
    "SELECT id FROM lessons WHERE module_id = $1",
    [moduleId]
  );
  const lessonIds = lessonsResult.rows.map((r) => r.id);

  // Calculate completion
  const completedResult = await db.query(
    `
    SELECT COUNT(*) as count FROM video_progress
    WHERE lesson_id = ANY($1) AND user_id = $2 AND completed = TRUE
    `,
    [lessonIds, userId]
  );

  const completedLessons = parseInt(completedResult.rows[0].count);
  const totalLessons = lessonIds.length;
  const completionPercentage = (completedLessons / totalLessons) * 100;
  const isModuleCompleted = completionPercentage === 100;

  // Update module completion
  await db.query(
    `
    INSERT INTO module_completion
      (module_id, user_id, total_lessons, completed_lessons, completion_percentage, completed, completed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (module_id, user_id)
    DO UPDATE SET
      total_lessons = $3,
      completed_lessons = $4,
      completion_percentage = $5,
      completed = $6,
      completed_at = CASE WHEN $6 AND NOT excluded.completed THEN NOW() ELSE module_completion.completed_at END,
      last_updated_at = NOW()
    `,
    [
      moduleId,
      userId,
      totalLessons,
      completedLessons,
      completionPercentage,
      isModuleCompleted,
      isModuleCompleted ? new Date() : null,
    ]
  );

  // Queue course recalculation
  if (isModuleCompleted) {
    const courseResult = await db.query(
      `SELECT course_id FROM modules WHERE id = $1`,
      [moduleId]
    );
    const courseId = courseResult.rows[0]?.course_id;

    if (courseId) {
      await progressQueue.add(
        "recalculate-course-completion",
        { courseId, userId },
        { priority: 1 }
      );
    }
  }
};
```

### Course Completion & Celebration

```typescript
// /jobs/recalculate-course-completion.ts
export const recalculateCourseCompletionJob = async (job: Job) => {
  const { courseId, userId } = job.data;

  // Get all lessons in course (across all modules)
  const lessonsResult = await db.query(
    `
    SELECT DISTINCT l.id
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    WHERE m.course_id = $1
    `,
    [courseId]
  );
  const lessonIds = lessonsResult.rows.map((r) => r.id);

  // Calculate completion
  const completedResult = await db.query(
    `
    SELECT COUNT(*) as count FROM video_progress
    WHERE lesson_id = ANY($1) AND user_id = $2 AND completed = TRUE
    `,
    [lessonIds, userId]
  );

  const completedLessons = parseInt(completedResult.rows[0].count);
  const totalLessons = lessonIds.length;
  const completionPercentage = (completedLessons / totalLessons) * 100;
  const isCourseCompleted = completionPercentage === 100;

  // Get module count
  const modulesResult = await db.query(
    `
    SELECT COUNT(DISTINCT module_id) as count FROM lessons
    WHERE id = ANY($1)
    `,
    [lessonIds]
  );
  const totalModules = parseInt(modulesResult.rows[0].count);

  // Count completed modules
  const completedModulesResult = await db.query(
    `
    SELECT COUNT(*) as count FROM module_completion
    WHERE module_id IN (
      SELECT DISTINCT m.id FROM modules m WHERE m.course_id = $1
    ) AND user_id = $2 AND completed = TRUE
    `,
    [courseId, userId]
  );
  const completedModules = parseInt(completedModulesResult.rows[0].count);

  // Update course completion
  const wasPreviouslyCompleted = await db.query(
    `SELECT completed FROM course_completion WHERE course_id = $1 AND user_id = $2`,
    [courseId, userId]
  );

  const result = await db.query(
    `
    INSERT INTO course_completion
      (course_id, user_id, total_lessons, completed_lessons, completion_percentage, total_modules, completed_modules, completed, completed_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (course_id, user_id)
    DO UPDATE SET
      total_lessons = $3,
      completed_lessons = $4,
      completion_percentage = $5,
      total_modules = $6,
      completed_modules = $7,
      completed = $8,
      completed_at = CASE WHEN $8 AND NOT excluded.completed THEN NOW() ELSE course_completion.completed_at END,
      last_updated_at = NOW()
    RETURNING *
    `,
    [
      courseId,
      userId,
      totalLessons,
      completedLessons,
      completionPercentage,
      totalModules,
      completedModules,
      isCourseCompleted,
      isCourseCompleted ? new Date() : null,
    ]
  );

  const completion = result.rows[0];

  // If just completed, trigger celebration
  if (isCourseCompleted && !wasPreviouslyCompleted.rows[0]?.completed) {
    // Emit real-time event
    emitEvent("course.completed", { courseId, userId });

    // Send notification
    await sendNotification(userId, {
      type: "course-completed",
      courseId,
      message: `Congratulations! You've completed the course.`,
    });

    // Award certificate (if applicable)
    await awardCertificate(courseId, userId);
  }

  return completion;
};
```

### Testing

```typescript
describe("Lesson Completion Logic", () => {
  it("should mark lesson complete at 90% threshold", async () => {
    await updateLessonCompletion(lessonId, userId, 90.0, 3600);
    const result = await getLessonCompletion(lessonId, userId);
    expect(result.completed).toBe(true);
  });

  it("should not mark lesson complete below 90%", async () => {
    await updateLessonCompletion(lessonId, userId, 89.9, 3600);
    const result = await getLessonCompletion(lessonId, userId);
    expect(result.completed).toBe(false);
  });

  it("should handle video replacement correctly", async () => {
    // Old: 60 min, watched 90% = 54 min
    // New: 45 min, proportional = 40.5% (reset to incomplete)
    const affected = await replaceVideoAndRecalculate(
      lessonId,
      oldVideoId,
      newVideoId,
      adminUserId,
      2700 // 45 minutes
    );
    expect(affected.affectedLearners).toBeGreaterThan(0);
  });

  it("should trigger course completion celebration", async () => {
    // Complete all lessons
    // Course should auto-trigger celebration
    const celebration = jest.fn();
    on("course.completed", celebration);
    // ... complete all lessons ...
    expect(celebration).toHaveBeenCalled();
  });
});
```
