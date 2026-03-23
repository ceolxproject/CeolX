# Progress Tracking API & Backend

## Description

Implement backend API and database schema for comprehensive progress tracking across lessons, modules, and courses. This service calculates completion percentages, updates lesson status (90% watched threshold), module completion based on lesson completion, and course completion percentage. All progress updates are real-time and synced to learner profiles for display across the platform.

## Affected Apps/Packages

- `apps/api` (Express/Node backend)
- Database layer (PostgreSQL)
- `packages/types` (TypeScript types for progress)
- Queue system (Bull/BullMQ for async updates)

## API Endpoints

- `POST /api/lessons/:lessonId/progress` - Update lesson progress (video watched %)
- `GET /api/lessons/:lessonId/progress` - Get lesson progress for user
- `GET /api/modules/:moduleId/progress` - Get module completion status
- `GET /api/courses/:courseId/progress` - Get course completion percentage
- `PATCH /api/users/:userId/progress` - Trigger progress recalculation (admin)
- `GET /api/users/:userId/learning-dashboard` - Get all learner's progress across courses

## Requirements

### 1. Lesson Progress Endpoint

**POST /api/lessons/:lessonId/progress**

- Request:
  ```json
  {
    "userId": "uuid",
    "lastPositionSeconds": 342.5,
    "watchedSegments": [
      { "start": 0, "end": 300 },
      { "start": 420, "end": 900 }
    ],
    "totalDurationSeconds": 3600
  }
  ```
- Response:
  ```json
  {
    "lessonId": "uuid",
    "userId": "uuid",
    "watchedPercentage": 35.5,
    "lastPositionSeconds": 342.5,
    "completed": false,
    "completedAt": null,
    "lastUpdatedAt": "2026-02-18T10:30:00Z"
  }
  ```
- Logic:
  - Calculate watched percentage: `(sum of watched_segments) / totalDurationSeconds * 100`
  - Store watched_segments, last_position_seconds
  - If watched% >= 90% AND not previously completed: mark completed, set completedAt timestamp
  - Trigger module and course recalculation (async via queue)
  - Return updated progress

### 2. Lesson Progress Retrieval

**GET /api/lessons/:lessonId/progress**

- Query: `?userId=uuid`
- Response: lesson progress with watched%, position, segments, completion status
- Used when opening lesson to resume playback
- Also provides watched segments for progress bar visualization

### 3. Module Progress Calculation

**GET /api/modules/:moduleId/progress**

- Returns:
  ```json
  {
    "moduleId": "uuid",
    "userId": "uuid",
    "totalLessons": 5,
    "completedLessons": 3,
    "completionPercentage": 60,
    "completed": false,
    "completedAt": null,
    "lessons": [
      { "lessonId": "uuid", "completed": true, "watchedPercentage": 100 }
    ]
  }
  ```
- Logic:
  - Count total lessons in module
  - Count lessons marked completed (90%+ watched)
  - Calculate: `(completedLessons / totalLessons) * 100`
  - Module marked complete when ALL lessons complete
  - Lessons array for detailed breakdown

### 4. Course Progress Calculation

**GET /api/courses/:courseId/progress**

- Returns:
  ```json
  {
    "courseId": "uuid",
    "userId": "uuid",
    "totalLessons": 20,
    "completedLessons": 15,
    "completionPercentage": 75,
    "totalModules": 4,
    "completedModules": 2,
    "completed": false,
    "completedAt": null,
    "modules": [
      { "moduleId": "uuid", "completionPercentage": 100, "completed": true }
    ]
  }
  ```
- Logic:
  - Count total lessons across all modules
  - Count completed lessons
  - Calculate overall completion: `(completedLessons / totalLessons) * 100`
  - Also track module-level completion
  - Course marked complete when completionPercentage == 100% AND all lessons/modules complete
  - Used for course completion celebration page trigger

### 5. Real-Time Sync

- All progress updates trigger webhook/event:
  - `lesson.progress.updated` → module recalculation
  - `lesson.completed` → module recalculation & course recalculation
  - `module.completed` → course recalculation
  - `course.completed` → trigger celebration page & notifications
- Use Bull/BullMQ queue for async processing:
  - High-priority: module/course recalculation
  - Medium-priority: analytics logging
  - Low-priority: notification sending

### 6. Data Consistency

- **Idempotency**: Same progress update applied twice = same result
  - Use lesson_id + user_id as unique key
  - Use UPSERT logic (INSERT ... ON CONFLICT)
- **Transaction Safety**: Completion state changes in transaction
  - Acquire lock on lesson_id + user_id row
  - Calculate watched%
  - Check if crossed 90% threshold
  - Update completion flag atomically
- **Cascade Updates**: Module/course completion bubble up from lesson changes
  - After lesson completion update, queue module recalculation
  - After module completion, queue course recalculation

## Acceptance Criteria

- [ ] POST /api/lessons/:lessonId/progress accepts and validates request
- [ ] Watched percentage calculated correctly from segments
- [ ] Lesson marked completed when watched% >= 90%
- [ ] completion timestamp set on first completion
- [ ] GET /api/lessons/:lessonId/progress returns all progress data
- [ ] Module progress calculates completionPercentage correctly
- [ ] Module marked complete when all lessons complete
- [ ] Course progress aggregates all lessons across modules
- [ ] Course marked complete when 100% of lessons complete
- [ ] Progress updates trigger async module/course recalculation
- [ ] No duplicate recalculations (debounced/batched)
- [ ] Real-time updates visible in UI within 2 seconds
- [ ] Completion timestamps accurate and immutable
- [ ] Progress data persists across app restarts
- [ ] API returns 400 for invalid userId/lessonId
- [ ] API returns 403 for unauthorized access (user accessing other user's progress)
- [ ] Database transactions prevent race conditions
- [ ] Course completion triggers celebration page
- [ ] Progress export available for analytics

## Dependencies

- Express.js (or similar backend framework)
- PostgreSQL database
- Bull/BullMQ (queue system)
- TypeScript types for Progress/Completion
- Authentication middleware (validate userId)

## Technical Notes

### Database Schema

```sql
-- Video progress (lessons)
CREATE TABLE video_progress (
  id SERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  watched_segments JSONB DEFAULT '[]', -- [{start, end}, ...]
  last_position_seconds FLOAT DEFAULT 0,
  total_duration_seconds FLOAT,
  watched_percentage FLOAT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lesson_id, user_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Lesson completion tracking
CREATE TABLE lesson_completion (
  id SERIAL PRIMARY KEY,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  completed_at TIMESTAMP NOT NULL,
  UNIQUE(lesson_id, user_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Module completion tracking
CREATE TABLE module_completion (
  id SERIAL PRIMARY KEY,
  module_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_lessons INT,
  completed_lessons INT,
  completion_percentage FLOAT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module_id, user_id),
  FOREIGN KEY (module_id) REFERENCES modules(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Course completion tracking
CREATE TABLE course_completion (
  id SERIAL PRIMARY KEY,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_lessons INT,
  completed_lessons INT,
  completion_percentage FLOAT,
  total_modules INT,
  completed_modules INT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(course_id, user_id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for fast lookups
CREATE INDEX idx_video_progress_user_lesson ON video_progress(user_id, lesson_id);
CREATE INDEX idx_module_completion_user ON module_completion(user_id, module_id);
CREATE INDEX idx_course_completion_user ON course_completion(user_id, course_id);
CREATE INDEX idx_lesson_completion_user ON lesson_completion(user_id, lesson_id);
```

### TypeScript Types

```typescript
// types/progress.ts
export interface WatchedSegment {
  start: number; // seconds
  end: number; // seconds
}

export interface LessonProgress {
  lessonId: string;
  userId: string;
  watchedSegments: WatchedSegment[];
  lastPositionSeconds: number;
  totalDurationSeconds: number;
  watchedPercentage: number;
  completed: boolean;
  completedAt: Date | null;
  lastUpdatedAt: Date;
}

export interface ModuleProgress {
  moduleId: string;
  userId: string;
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  completed: boolean;
  completedAt: Date | null;
  lessons: Array<{
    lessonId: string;
    completed: boolean;
    watchedPercentage: number;
  }>;
}

export interface CourseProgress {
  courseId: string;
  userId: string;
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  totalModules: number;
  completedModules: number;
  completed: boolean;
  completedAt: Date | null;
  modules: Array<{
    moduleId: string;
    completionPercentage: number;
    completed: boolean;
  }>;
}

export interface ProgressUpdateEvent {
  type:
    | "lesson.progress.updated"
    | "lesson.completed"
    | "module.completed"
    | "course.completed";
  lessonId?: string;
  moduleId?: string;
  courseId?: string;
  userId: string;
  timestamp: Date;
}
```

### API Implementation: Lesson Progress

```typescript
// /routes/lessons.ts
import express from "express";
import { progressQueue } from "../queue";
import { calculateWatchedPercentage } from "../utils/progress";

const router = express.Router();

// POST /api/lessons/:lessonId/progress
router.post("/:lessonId/progress", authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user.id;
  const { watchedSegments, lastPositionSeconds, totalDurationSeconds } =
    req.body;

  try {
    // Calculate watched percentage
    const watchedPercentage = calculateWatchedPercentage(
      watchedSegments,
      totalDurationSeconds
    );

    // Determine if now completed (crossed 90% threshold)
    const existingProgress = await db.query(
      "SELECT completed FROM video_progress WHERE lesson_id = $1 AND user_id = $2",
      [lessonId, userId]
    );

    const wasCompleted = existingProgress.rows[0]?.completed || false;
    const isNowCompleted = watchedPercentage >= 90;
    const completionStatusChanged = !wasCompleted && isNowCompleted;

    // Upsert progress
    const result = await db.query(
      `
      INSERT INTO video_progress
        (lesson_id, user_id, watched_segments, last_position_seconds,
         total_duration_seconds, watched_percentage, completed, completed_at, last_updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (lesson_id, user_id)
      DO UPDATE SET
        watched_segments = $3,
        last_position_seconds = $4,
        total_duration_seconds = $5,
        watched_percentage = $6,
        completed = $7,
        completed_at = CASE WHEN $7 AND NOT excluded.completed THEN NOW() ELSE video_progress.completed_at END,
        last_updated_at = NOW()
      RETURNING *;
      `,
      [
        lessonId,
        userId,
        JSON.stringify(watchedSegments),
        lastPositionSeconds,
        totalDurationSeconds,
        watchedPercentage,
        isNowCompleted,
        isNowCompleted ? new Date() : null,
      ]
    );

    const progress = result.rows[0];

    // Queue module/course recalculation if completion status changed
    if (completionStatusChanged) {
      await progressQueue.add(
        "recalculate-module-progress",
        { lessonId, userId },
        { priority: 1 } // High priority
      );

      // Emit event for real-time updates
      emitEvent("lesson.completed", {
        lessonId,
        userId,
        watchedPercentage,
      });
    }

    return res.json(progress);
  } catch (error) {
    console.error("Error updating lesson progress:", error);
    return res.status(500).json({ error: "Failed to update progress" });
  }
});

// GET /api/lessons/:lessonId/progress
router.get("/:lessonId/progress", authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "SELECT * FROM video_progress WHERE lesson_id = $1 AND user_id = $2",
      [lessonId, userId]
    );

    const progress = result.rows[0] || {
      lessonId,
      userId,
      watchedSegments: [],
      lastPositionSeconds: 0,
      watchedPercentage: 0,
      completed: false,
      completedAt: null,
    };

    // Parse JSON
    if (progress.watched_segments) {
      progress.watchedSegments = JSON.parse(progress.watched_segments);
    }

    return res.json(progress);
  } catch (error) {
    console.error("Error fetching lesson progress:", error);
    return res.status(500).json({ error: "Failed to load progress" });
  }
});

export default router;
```

### Queue Job: Module Progress Recalculation

```typescript
// /jobs/recalculate-module-progress.ts
import { Job } from "bull";

export const recalculateModuleProgressJob = async (job: Job) => {
  const { lessonId, userId } = job.data;

  // Find module containing this lesson
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
  const totalLessons = lessonIds.length;

  // Count completed lessons
  const completedResult = await db.query(
    `
    SELECT COUNT(*) FROM video_progress
    WHERE lesson_id = ANY($1) AND user_id = $2 AND completed = TRUE
    `,
    [lessonIds, userId]
  );
  const completedLessons = parseInt(completedResult.rows[0].count);
  const completionPercentage = (completedLessons / totalLessons) * 100;
  const isCompleted = completionPercentage === 100;

  // Upsert module completion
  const result = await db.query(
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
    RETURNING *;
    `,
    [
      moduleId,
      userId,
      totalLessons,
      completedLessons,
      completionPercentage,
      isCompleted,
      isCompleted ? new Date() : null,
    ]
  );

  // Queue course recalculation
  if (isCompleted) {
    await progressQueue.add(
      "recalculate-course-progress",
      { moduleId, userId },
      { priority: 1 }
    );
  }

  return result.rows[0];
};
```

### Helper: Calculate Watched Percentage

```typescript
// /utils/progress.ts
export interface WatchedSegment {
  start: number;
  end: number;
}

export function calculateWatchedPercentage(
  segments: WatchedSegment[],
  totalDuration: number
): number {
  if (!segments.length || !totalDuration) return 0;

  const merged = mergeSegments(segments);
  const totalWatched = merged.reduce(
    (sum, seg) => sum + (seg.end - seg.start),
    0
  );
  return (totalWatched / totalDuration) * 100;
}

function mergeSegments(segments: WatchedSegment[]): WatchedSegment[] {
  if (!segments.length) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: WatchedSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}
```

### Event Emission: Real-Time Updates

```typescript
// /events/progress-events.ts
import { EventEmitter } from "events";
import { io } from "../websocket"; // WebSocket server

export const progressEmitter = new EventEmitter();

// Listen for lesson completion
progressEmitter.on("lesson.completed", (data) => {
  // Emit to user via WebSocket
  io.to(`user:${data.userId}`).emit("lesson:completed", data);

  // Log to analytics
  analytics.track("lesson_completed", {
    lessonId: data.lessonId,
    userId: data.userId,
    watchedPercentage: data.watchedPercentage,
  });
});

// Listen for course completion
progressEmitter.on("course.completed", (data) => {
  io.to(`user:${data.userId}`).emit("course:completed", data);
  io.to(`user:${data.userId}`).emit("show-celebration", {
    courseId: data.courseId,
  });

  // Send notification
  sendNotification(data.userId, {
    type: "course-completed",
    courseId: data.courseId,
    message: `Congratulations! You've completed the course.`,
  });
});
```

### Testing

```typescript
// Tests for progress tracking
describe("Progress Tracking API", () => {
  it("should calculate watched percentage correctly", () => {
    const segments = [
      { start: 0, end: 300 },
      { start: 420, end: 900 },
    ];
    const duration = 3600;
    const percentage = calculateWatchedPercentage(segments, duration);
    expect(percentage).toBe(33.33);
  });

  it("should mark lesson complete at 90% watched", async () => {
    const response = await request(app)
      .post(`/api/lessons/${lessonId}/progress`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        watchedSegments: [{ start: 0, end: 3240 }], // 90% of 3600s
        lastPositionSeconds: 3240,
        totalDurationSeconds: 3600,
      });

    expect(response.body.completed).toBe(true);
    expect(response.body.watchedPercentage).toBeGreaterThanOrEqual(90);
  });

  it("should not mark lesson complete below 90%", async () => {
    const response = await request(app)
      .post(`/api/lessons/${lessonId}/progress`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        watchedSegments: [{ start: 0, end: 3000 }], // 83% of 3600s
        lastPositionSeconds: 3000,
        totalDurationSeconds: 3600,
      });

    expect(response.body.completed).toBe(false);
    expect(response.body.watchedPercentage).toBeLessThan(90);
  });
});
```
