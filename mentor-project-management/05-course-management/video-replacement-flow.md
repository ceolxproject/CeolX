# Task: Video Replacement Flow

## Description

Implement the workflow for replacing an existing lesson video. This includes deleting the old Mux asset, uploading a new video, updating the lesson record with new Mux metadata, triggering transcript re-generation, and marking the lesson as unwatched for learners who previously completed it. No version history is maintained; the old video is permanently replaced.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Frontend: `@mentor/web` (Next.js, React)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`
- External: Mux Video API

## API Endpoints

### DELETE /api/v1/courses/{courseId}/lessons/{lessonId}/video

Delete the current video (Mux asset) from a lesson.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Video deleted. Ready to upload replacement.",
  "lessonId": "uuid"
}
```

**Error Response (409 Conflict):**

```json
{
  "error": "Cannot delete video. No replacement video provided.",
  "suggestedAction": "Use DELETE endpoint followed by video upload"
}
```

### PUT /api/v1/courses/{courseId}/lessons/{lessonId}/video

Upload and save a new video for the lesson (replaces existing).

**Request Body:**

```json
{
  "muxAssetId": string,
  "muxPlaybackId": string,
  "videoDuration": number (seconds)
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "muxAssetId": string,
  "muxPlaybackId": string,
  "videoDuration": number,
  "updatedAt": "ISO8601",
  "learnersMarkedUnwatched": number
}
```

### POST /api/v1/courses/{courseId}/lessons/{lessonId}/mark-unwatched

Mark a lesson as unwatched for all learners who previously completed it.

**Response (200 OK):**

```json
{
  "success": true,
  "learnersUpdated": number,
  "message": "Lesson marked as unwatched for X learners"
}
```

## UI Flow

### Step 1: Initiate Replacement

In lesson editor (published course):

- Display current video with "Replace Video" button
- Button visible only for course owner/instructor
- Button disabled if no other video available to replace with

### Step 2: Delete Old Video

- User clicks "Replace Video"
- Confirmation modal: "Deleting video will mark the lesson as unwatched for learners who completed it. Continue?"
- On confirm:
  - Call DELETE /api/v1/courses/{courseId}/lessons/{lessonId}/video
  - Show "Video deleted. You can now upload a replacement."
  - Disable video player (show placeholder)
  - Display "Upload New Video" form

### Step 3: Upload New Video

- Same video upload flow as lesson creation (see video-upload-mux-direct.md)
- Upload to Mux via Direct Upload
- Poll for asset ready
- Show upload progress
- Display new video preview once ready

### Step 4: Confirm and Save

- Once new video ready, display preview
- Auto-fill video duration from Mux metadata
- Show summary: "Current duration: X minutes"
- Learners see "Lesson updated" notification
- Button to view lesson (if published)

## Requirements

1. **Video Deletion**
   - Call Mux API to delete old asset via `mux_asset_id`
   - Handle Mux deletion errors gracefully
   - Continue with lesson update even if Mux deletion fails (log error)
   - Clear `mux_asset_id` and `mux_playback_id` from lesson record
   - Lesson becomes "video pending" state until new video uploaded

2. **Video Replacement**
   - Accept new `mux_asset_id`, `mux_playback_id`, `video_duration` from upload
   - Update lesson record atomically
   - Update `updated_at` timestamp
   - Mark lesson as "modified" for cache invalidation

3. **Learner State Reset**
   - Query all learner_progress records for this lesson with `completed = true`
   - Update `completed` to `false` and `last_watched_at` to current time
   - Update `updated_at` for each progress record
   - Do NOT delete progress records (retain watch history)
   - Do NOT reset progress for lessons NOT affected (other lessons in module)

4. **Transcript Regeneration**
   - Trigger Mux Data job to generate transcripts for new video
   - Store transcript metadata with lesson
   - Transcripts become available asynchronously
   - Learners see "Generating transcript" placeholder until ready

5. **No Version History**
   - Old video metadata completely replaced (not archived)
   - No "video version" table or history
   - Learner progress records updated, not versioned

6. **Notifications**
   - System message to enrolled learners: "Lesson [Title] has been updated with new content"
   - Optional: Learners see "Mark as watched" button if they had previously completed
   - Instructor confirmation: "Video updated. X learners notified."

7. **Error Handling**
   - If Mux asset deletion fails, log but continue
   - If learner state update fails, rollback lesson update
   - If transcript generation fails, lesson still usable but without transcripts
   - Clear error messages for missing/invalid Mux IDs

## Acceptance Criteria

- [ ] DELETE endpoint deletes Mux asset and clears lesson video fields
- [ ] Lesson enters "video pending" state after deletion
- [ ] PUT endpoint accepts new Mux metadata and updates lesson
- [ ] Video duration auto-updated from new Mux asset
- [ ] learner_progress records updated for previously completed learners
- [ ] learner_progress.completed set to false for affected learners
- [ ] Transcript regeneration triggered for new video
- [ ] Learners receive notification of lesson update
- [ ] Video player disabled while video pending
- [ ] UI shows upload form after video deletion
- [ ] New video preview displays after upload completes
- [ ] Optimistic UI updates during replacement flow
- [ ] Error handling for Mux failures
- [ ] Old video completely replaced (no version history)
- [ ] Test: Learner progress records not affected for other lessons

## Dependencies

- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Video Upload Mux (video-upload-mux-direct.md)
- **Upstream**: Published Course Editing (published-course-editing.md)
- **Related**: Course Analytics (course-analytics-instructor.md)
- **Related**: Learning Progress Tracking (07-video-player-and-learning)

## Technical Notes

### Database Schema Reference

```sql
-- Lesson videos table
CREATE TABLE lesson_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  mux_asset_id VARCHAR(255) NOT NULL UNIQUE,
  mux_playback_id VARCHAR(255) NOT NULL,
  video_duration INTEGER NOT NULL, -- seconds
  transcript_status VARCHAR(20) DEFAULT 'pending', -- pending, ready, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  INDEX idx_lesson_id (lesson_id)
);

-- Learner progress with completion tracking
CREATE TABLE learner_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  completed BOOLEAN DEFAULT FALSE,
  watch_time INTEGER, -- seconds watched
  last_watched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (user_id, lesson_id),
  INDEX idx_lesson_completed (lesson_id, completed)
);
```

### Backend Handlers

**Delete Video:**

```typescript
export const deleteVideo = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, lessonId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Get lesson with video
  const lesson = await db.query.lessons.findFirst({
    where: (lessons, { eq }) => eq(lessons.id, lessonId),
  });

  if (!lesson) throw createError({ statusCode: 404 });

  const muxAssetId = lesson.muxAssetId;

  // Delete Mux asset
  const mux = new Mux();
  try {
    await mux.video.assets.delete(muxAssetId);
    console.log(`Deleted Mux asset: ${muxAssetId}`);
  } catch (error) {
    // Log but don't fail - proceed with lesson update
    console.error(`Failed to delete Mux asset ${muxAssetId}:`, error);
  }

  // Clear video fields from lesson
  await db
    .update(lessons)
    .set({
      muxAssetId: null,
      muxPlaybackId: null,
      videoDuration: 0,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, lessonId));

  return {
    success: true,
    message: "Video deleted. Ready to upload replacement.",
    lessonId,
  };
});
```

**Replace Video:**

```typescript
export const replaceVideo = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, lessonId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);
  validateVideoUpload(body);

  // Update lesson with new video metadata
  const updatedLesson = await db
    .update(lessons)
    .set({
      muxAssetId: body.muxAssetId,
      muxPlaybackId: body.muxPlaybackId,
      videoDuration: body.videoDuration,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, lessonId))
    .returning();

  if (!updatedLesson.length) {
    throw createError({ statusCode: 404 });
  }

  // Mark lesson as unwatched for previously completed learners
  const completedProgress = await db.query.learnerProgress.findMany({
    where: (lp, { eq, and }) =>
      and(eq(lp.lessonId, lessonId), eq(lp.completed, true)),
  });

  const learnersMarkedUnwatched = completedProgress.length;

  if (learnersMarkedUnwatched > 0) {
    await db
      .update(learnerProgress)
      .set({
        completed: false,
        lastWatchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        inArray(
          learnerProgress.id,
          completedProgress.map((p) => p.id)
        )
      );
  }

  // Trigger transcript generation (async)
  triggerTranscriptGeneration(body.muxAssetId).catch((err) =>
    console.error("Transcript generation failed:", err)
  );

  // Notify enrolled learners (async)
  notifyLearnersOfLessonUpdate(lessonId, course.title).catch((err) =>
    console.error("Learner notification failed:", err)
  );

  return {
    id: updatedLesson[0].id,
    lessonId,
    muxAssetId: body.muxAssetId,
    muxPlaybackId: body.muxPlaybackId,
    videoDuration: body.videoDuration,
    updatedAt: new Date().toISOString(),
    learnersMarkedUnwatched,
  };
});

async function triggerTranscriptGeneration(muxAssetId: string) {
  const mux = new Mux();
  // Use Mux Data API to request transcripts
  // (Implementation depends on Mux transcription service)
}

async function notifyLearnersOfLessonUpdate(
  lessonId: string,
  courseTitle: string
) {
  const lesson = await db.query.lessons.findFirst({
    where: (lessons, { eq }) => eq(lessons.id, lessonId),
  });

  // Get enrolled learners
  const enrollments = await db.query.enrollments.findMany({
    where: (enrollments, { eq }) => eq(enrollments.courseId, lesson?.courseId),
  });

  // Send notifications (email, in-app, etc.)
  for (const enrollment of enrollments) {
    // Send notification
  }
}
```

**Mark Unwatched:**

```typescript
export const markLessonUnwatched = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, lessonId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Update all completed progress for this lesson
  const result = await db
    .update(learnerProgress)
    .set({
      completed: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(learnerProgress.lessonId, lessonId),
        eq(learnerProgress.completed, true)
      )
    )
    .returning();

  return {
    success: true,
    learnersUpdated: result.length,
    message: `Lesson marked as unwatched for ${result.length} learners`,
  };
});
```

### Frontend Component: Video Replacement UI

```typescript
export function VideoReplacementFlow({ lesson, courseId }: Props) {
  const [stage, setStage] = useState<'current' | 'deleting' | 'uploading' | 'complete'>('current');
  const [newVideoData, setNewVideoData] = useState<VideoUploadData | null>(null);
  const [learnersAffected, setLearnersAffected] = useState(0);

  const handleDelete = async () => {
    const confirmed = confirm(
      'Deleting this video will mark the lesson as unwatched for learners who completed it. Continue?'
    );

    if (!confirmed) return;

    setStage('deleting');
    try {
      await fetch(`/api/v1/courses/${courseId}/lessons/${lesson.id}/video`, {
        method: 'DELETE'
      });
      setStage('uploading');
    } catch (error) {
      alert('Failed to delete video: ' + error.message);
      setStage('current');
    }
  };

  const handleUploadComplete = async (videoData: VideoUploadData) => {
    try {
      const response = await fetch(
        `/api/v1/courses/${courseId}/lessons/${lesson.id}/video`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(videoData)
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setNewVideoData(videoData);
      setLearnersAffected(result.learnersMarkedUnwatched);
      setStage('complete');
    } catch (error) {
      alert('Failed to save video: ' + error.message);
      setStage('uploading');
    }
  };

  return (
    <div className="video-replacement">
      {stage === 'current' && (
        <>
          <VideoPlayer src={lesson.muxPlaybackId} />
          <button onClick={handleDelete}>Replace Video</button>
        </>
      )}

      {stage === 'deleting' && <p>Deleting video...</p>}

      {stage === 'uploading' && (
        <VideoUploadForm onComplete={handleUploadComplete} />
      )}

      {stage === 'complete' && (
        <div className="success">
          <p>Video updated successfully!</p>
          <p>{learnersAffected} learners have been notified.</p>
          <button onClick={() => window.location.reload()}>View Updated Lesson</button>
        </div>
      )}
    </div>
  );
}
```

### Testing Checklist

- Delete video → Mux asset deleted, lesson video fields cleared
- Replace video → new Mux IDs stored in lesson
- Mark unwatched → learner_progress.completed set to false
- Only affected learners marked unwatched (not all lesson progress)
- Transcript generation triggered after replacement
- Learners receive notification of update
- Old video completely removed (no history)
- UI transitions correctly through delete → upload → complete
