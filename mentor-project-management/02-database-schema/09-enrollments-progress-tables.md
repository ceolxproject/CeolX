# Task 9: Enrollments and Progress Tracking Tables

## Description

Create tables to track course enrollments, lesson progress, bookmarks, and user notes. These tables form the foundation of learner engagement tracking and personalized learning experiences. Progress tracking enables resume-from-where-you-left-off functionality and completion metrics.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (enrollment and progress endpoints)
- `apps/web-learner` (course enrollment, progress tracking, bookmarks)
- `apps/web-mentor` (learner progress view)
- `apps/web-admin` (enrollment analytics)

## Requirements

### Enrollments Table

Create table `enrollments` for course enrollment tracking:

| Column          | Type            | Constraints                 | Description                                     |
| --------------- | --------------- | --------------------------- | ----------------------------------------------- |
| `id`            | `UUID`          | PK, Default: `uuid_v7()`    | Unique enrollment identifier                    |
| `user_id`       | `UUID`          | FK → users(id), NOT NULL    | Enrolled learner                                |
| `course_id`     | `UUID`          | FK → courses(id), NOT NULL  | Enrolled course                                 |
| `enrolled_at`   | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`  | Enrollment date/time                            |
| `source`        | `VARCHAR(50)`   | NOT NULL, DEFAULT: 'direct' | Enum: subscription, purchase, free, admin_grant |
| `paid_amount`   | `DECIMAL(10,2)` | NULL                        | Amount paid (if source=purchase)                |
| `currency`      | `VARCHAR(3)`    | NULL                        | Currency code                                   |
| `coupon_code`   | `VARCHAR(50)`   | NULL                        | Coupon applied at enrollment                    |
| `completed_at`  | `TIMESTAMP`     | NULL                        | When learner completed course                   |
| `is_active`     | `BOOLEAN`       | NOT NULL, DEFAULT: TRUE     | Whether enrollment is active                    |
| `unenrolled_at` | `TIMESTAMP`     | NULL                        | When learner unenrolled                         |
| `created_at`    | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`  | Record creation                                 |
| `updated_at`    | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`  | Last update                                     |

### Unique Constraint for Enrollments

- Composite unique index: `(user_id, course_id)` - prevent duplicate enrollments

### Indexes for Enrollments Table

- Primary Key: `id`
- Unique Index: `(user_id, course_id)` - uniqueness
- Index: `(user_id)` - find learner's courses
- Index: `(course_id)` - find course enrollments
- Index: `(enrolled_at)` - new enrollments
- Index: `(completed_at)` - find completed enrollments
- Index: `(is_active)` - find active learners
- Index: `(source)` - enrollment source analytics

### Lesson Progress Table

Create table `lesson_progress` for tracking watch time and completion:

| Column                  | Type        | Constraints                | Description                        |
| ----------------------- | ----------- | -------------------------- | ---------------------------------- |
| `id`                    | `UUID`      | PK, Default: `uuid_v7()`   | Unique progress record identifier  |
| `user_id`               | `UUID`      | FK → users(id), NOT NULL   | Learner watching lesson            |
| `lesson_id`             | `UUID`      | FK → lessons(id), NOT NULL | Lesson being watched               |
| `watched_percentage`    | `INTEGER`   | NOT NULL, DEFAULT: 0       | 0-100, percentage of video watched |
| `watched_seconds`       | `INTEGER`   | NOT NULL, DEFAULT: 0       | Total seconds watched              |
| `last_position_seconds` | `INTEGER`   | NOT NULL, DEFAULT: 0       | Resume position for video          |
| `view_count`            | `INTEGER`   | NOT NULL, DEFAULT: 1       | How many times lesson viewed       |
| `started_at`            | `TIMESTAMP` | NULL                       | When learner started lesson        |
| `completed_at`          | `TIMESTAMP` | NULL                       | When marked as completed (100%)    |
| `is_completed`          | `BOOLEAN`   | NOT NULL, DEFAULT: FALSE   | Whether lesson marked complete     |
| `updated_at`            | `TIMESTAMP` | NOT NULL, DEFAULT: `now()` | Last progress update               |

### Unique Constraint for Lesson Progress

- Composite unique index: `(user_id, lesson_id)` - one progress record per user per lesson

### Indexes for Lesson Progress Table

- Primary Key: `id`
- Unique Index: `(user_id, lesson_id)` - uniqueness
- Index: `(user_id)` - find learner's progress
- Index: `(lesson_id)` - find lesson progress
- Index: `(is_completed)` - find completed lessons
- Index: `(completed_at)` - for statistics
- Index: `(updated_at)` - recent activity

### Bookmarks Table

Create table `bookmarks` for saved courses:

| Column      | Type        | Constraints                | Description                |
| ----------- | ----------- | -------------------------- | -------------------------- |
| `id`        | `UUID`      | PK, Default: `uuid_v7()`   | Unique bookmark identifier |
| `user_id`   | `UUID`      | FK → users(id), NOT NULL   | Learner who bookmarked     |
| `course_id` | `UUID`      | FK → courses(id), NOT NULL | Bookmarked course          |
| `added_at`  | `TIMESTAMP` | NOT NULL, DEFAULT: `now()` | When bookmarked            |

### Unique Constraint for Bookmarks

- Composite unique index: `(user_id, course_id)` - one bookmark per user per course

### Indexes for Bookmarks Table

- Primary Key: `id`
- Unique Index: `(user_id, course_id)` - uniqueness
- Index: `(user_id)` - find learner's bookmarks
- Index: `(course_id)` - find who bookmarked course
- Index: `(added_at)` - recently bookmarked

### Notes Table

Create table `notes` for lesson-specific user notes:

| Column                    | Type        | Constraints                | Description                           |
| ------------------------- | ----------- | -------------------------- | ------------------------------------- |
| `id`                      | `UUID`      | PK, Default: `uuid_v7()`   | Unique note identifier                |
| `user_id`                 | `UUID`      | FK → users(id), NOT NULL   | Note author                           |
| `lesson_id`               | `UUID`      | FK → lessons(id), NOT NULL | Associated lesson                     |
| `content`                 | `TEXT`      | NOT NULL                   | Note text (markdown supported)        |
| `video_timestamp_seconds` | `INTEGER`   | NULL                       | Timestamp in video where note applies |
| `is_public`               | `BOOLEAN`   | DEFAULT: FALSE             | Share note with other learners?       |
| `pinned`                  | `BOOLEAN`   | DEFAULT: FALSE             | Pin note to top of lesson             |
| `created_at`              | `TIMESTAMP` | NOT NULL, DEFAULT: `now()` | Note creation                         |
| `updated_at`              | `TIMESTAMP` | NOT NULL, DEFAULT: `now()` | Last edit                             |

### Indexes for Notes Table

- Primary Key: `id`
- Index: `(user_id)` - find user's notes
- Index: `(lesson_id)` - find lesson notes
- Index: `(user_id, lesson_id)` - user's notes for lesson
- Index: `(is_public)` - find shared notes
- Index: `(pinned)` - find pinned notes

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE enrollment_source AS ENUM ('subscription', 'purchase', 'free', 'admin_grant');
```

### Drizzle Schema Definition

In `packages/db/src/schema/progress.ts`:

- Define `enrollments` table
- Define `lessonProgress` table
- Define `bookmarks` table
- Define `notes` table
- Use `relations()` for:
  - users ↔ enrollments (one-to-many)
  - courses ↔ enrollments (one-to-many)
  - users ↔ lessonProgress (one-to-many)
  - lessons ↔ lessonProgress (one-to-many)
  - users ↔ bookmarks (one-to-many)
  - courses ↔ bookmarks (one-to-many)
  - users ↔ notes (one-to-many)
  - lessons ↔ notes (one-to-many)

## Database Tables

### enrollments

- **Purpose**: Track which users are enrolled in which courses
- **Row estimate**: ~5M-50M (varies by platform size)
- **Key relationships**: N:1 with users, N:1 with courses

### lesson_progress

- **Purpose**: Track learner progress through course content
- **Row estimate**: ~50M-500M (multiple views per lesson)
- **Key relationships**: N:1 with users, N:1 with lessons

### bookmarks

- **Purpose**: Save courses for later viewing
- **Row estimate**: ~1M-10M (20-30% of users bookmark courses)
- **Key relationships**: N:1 with users, N:1 with courses

### notes

- **Purpose**: User-generated study notes for lessons
- **Row estimate**: ~2M-20M (power users take notes)
- **Key relationships**: N:1 with users, N:1 with lessons

## Acceptance Criteria

- [ ] `enrollments` table created with enrollment source enum
- [ ] Unique constraint on (user_id, course_id) prevents duplicate enrollments
- [ ] `lesson_progress` table tracks watched percentage and position
- [ ] Unique constraint on (user_id, lesson_id) for one progress record
- [ ] `bookmarks` table supports saving courses
- [ ] `notes` table supports lesson-specific notes with timestamps
- [ ] Video timestamp stored for video-synchronized notes
- [ ] `is_public` flag supports note sharing
- [ ] All relationships have proper foreign keys
- [ ] All indexes created for efficient queries
- [ ] Denormalized fields (watched_percentage) updatable
- [ ] All timestamps use UTC timezone
- [ ] Test data with various enrollment sources
- [ ] Test progress tracking with multiple views
- [ ] Test bookmarks and notes functionality
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 06: Courses, Modules, and Lessons Tables

## Technical Notes

### Enrollment Sources

- **subscription** - Enrolled via active subscription plan
- **purchase** - Enrolled via one-time purchase
- **free** - Enrolled in free course
- **admin_grant** - Admin granted access (e.g., promotion)

### Purchase Tracking

- Store `paid_amount` and `currency` for purchase enrollments
- Track coupon codes applied (links to coupons table in Task 10)
- Enables revenue analytics by course and source

### Enrollment Active Status

- `is_active=true` for active enrollments
- `is_active=false` after unenrollment (soft delete)
- Store `unenrolled_at` timestamp for analytics
- Allow re-enrollment (create new enrollment record)
- Keep historical enrollments for audit trail

### Progress Tracking

- `watched_percentage` updated as video plays (via client)
- Assume completion at 90% watched (not strict 100%)
- `last_position_seconds` enables resume functionality
- `view_count` tracks how many times lesson viewed
- `started_at` marks first view, `completed_at` marks completion

### Completion Definition

- Lesson marked complete when `watched_percentage >= 90%`
- Completion triggered automatically or via explicit button
- Course completion when all required lessons completed
- Track completion time for analytics

### Resume Functionality

- Use `last_position_seconds` to resume playback
- Update every 10-30 seconds (batch updates)
- Display "Resume from 23:45" button on lesson list
- Fallback to start if no progress exists

### Bookmarks

- Simple save/unsave mechanism (no folder structure)
- Denormalized count on courses (optional)
- Display in "My Bookmarks" or "Saved Courses" section
- No limit on bookmarks (or generous limit, e.g., 1000)

### Notes Features

- Support markdown formatting (store as text, parse on display)
- `video_timestamp_seconds` allows seeking to note location
- `is_public=true` makes note visible to other enrolled learners
- Public notes have attribution (show note author)
- Learner can edit own notes, delete own notes
- Instructor can delete spam/inappropriate notes
- `pinned=true` sticky notes appear at top of lesson

### Public Notes Display

```typescript
// Get all public notes for lesson
db.select()
  .from(notes)
  .where(and(eq(notes.lessonId, lessonId), eq(notes.isPublic, true)))
  .orderBy(desc(notes.pinned), desc(notes.createdAt));
```

### Query Patterns

```typescript
// Get learner's enrolled courses
db.select()
  .from(courses)
  .innerJoin(enrollments, eq(courses.id, enrollments.courseId))
  .where(and(eq(enrollments.userId, userId), eq(enrollments.isActive, true)));

// Get learner's progress in course
db.select()
  .from(lessonProgress)
  .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
  .innerJoin(modules, eq(lessons.moduleId, modules.id))
  .where(
    and(eq(lessonProgress.userId, userId), eq(modules.courseId, courseId))
  );

// Get learner's bookmarked courses
db.select()
  .from(courses)
  .innerJoin(bookmarks, eq(courses.id, bookmarks.courseId))
  .where(eq(bookmarks.userId, userId));
```

### Progress Synchronization

- Client-side: Track progress as video plays
- Batch updates: Send progress every 10-30 seconds (not per frame)
- Fallback: If offline, sync when connection restored
- Conflict resolution: Server timestamp wins (cloud source of truth)

### Performance Optimization

- Partial index on lesson_progress for incomplete lessons: `WHERE is_completed = false`
- Index on enrolled courses: `(user_id, is_active)` for quick enrollment checks
- Denormalize course enrollment count (courses.enrollment_count)
- Cache user's enrolled course IDs (invalidate on enrollment changes)

### Analytics Use Cases

- Enrollment funnel: signups → views → enrollments
- Course popularity: by enrollment_count
- Completion rates: completed_at / enrolled_at
- Average watch time: sum(watched_seconds) / view_count
- Time-to-completion: days between enrolled_at and completed_at
- Engagement: bookmark rate, note-taking rate

### Testing Considerations

- Test enrollment creation and uniqueness
- Test progress updates and resume position
- Test bookmark add/remove
- Test note creation with video timestamp
- Test public note visibility
- Test cascade delete (deleting course removes enrollments/progress)
- Test soft delete (unenroll without deleting)
- Test completion status transitions

### Data Retention

- Keep enrollments/progress indefinitely (historical data)
- Archive old notes (>2 years) to separate table (optional)
- Soft delete strategy for unenrollments (don't hard delete)
- Maintain audit trail for compliance

### Denormalization Strategy

- `courses.enrollment_count` updated on each enrollment
- Periodically refresh counts: `SELECT COUNT(*) FROM enrollments WHERE course_id = X AND is_active = true`
- Update in background job (nightly or hourly)
- Or use triggers for real-time updates (performance trade-off)

### Video Streaming Integration

- `last_position_seconds` integrated with Mux player
- Resume from last position on next view
- Track watch events from Mux analytics
- Combine with progress table for comprehensive view
