# Task: Publish Validation Flow

## Description

Implement publish-readiness validation for courses. Before publishing, the system checks that courses meet minimum completeness requirements (Masterclass requires ≥1 module with ≥1 lesson; Lesson requires ≥1 content item). Required fields like title, description, thumbnail, category, and skill level must be filled. The system displays clear error indicators for missing fields and prevents publish if validation fails. Courses publish directly without admin approval.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`

## API Endpoints

### POST /api/v1/courses/{courseId}/validate-publish

Validate course readiness for publish (dry run, no changes made).

**Response (200 OK, valid):**

```json
{
  "isValid": true,
  "message": "Course is ready to publish",
  "validations": {
    "title": { "valid": true },
    "description": { "valid": true },
    "category": { "valid": true },
    "skillLevel": { "valid": true },
    "thumbnail": { "valid": true },
    "price": { "valid": true },
    "modules": { "valid": true, "count": 3 },
    "lessons": { "valid": true, "count": 8 },
    "lessonVideos": { "valid": true },
    "communitySettings": { "valid": true }
  },
  "completeness": 100,
  "estimatedPublishTime": "2 seconds"
}
```

**Response (200 OK, invalid):**

```json
{
  "isValid": false,
  "message": "Course cannot be published. See errors below.",
  "validations": {
    "title": { "valid": true },
    "description": { "valid": false, "error": "Description is required" },
    "modules": {
      "valid": false,
      "error": "At least 1 module required",
      "count": 0
    },
    "lessons": {
      "valid": false,
      "error": "At least 1 lesson per module required",
      "missingLessonsInModule": ["Module 1"]
    },
    "lessonVideos": {
      "valid": false,
      "error": "Some lessons missing videos",
      "lessonsWithoutVideo": ["Lesson 2", "Lesson 5"]
    }
  },
  "completeness": 45,
  "missingFields": ["description", "modules", "lessons", "lesson_videos"]
}
```

### POST /api/v1/courses/{courseId}/publish

Publish the course. Validates before publishing.

**Request Body:**

```json
{
  "confirmValidations": boolean (optional, for UI confirmation)
}
```

**Response (200 OK):**

```json
{
  "courseId": "uuid",
  "status": "published",
  "slug": "string",
  "publishedUrl": "https://mentor.example.com/courses/course-slug",
  "publishedAt": "ISO8601",
  "message": "Course published successfully"
}
```

**Response (400 Bad Request, validation failed):**

```json
{
  "error": "Cannot publish. Validation failed.",
  "validations": {
    "modules": {
      "valid": false,
      "error": "At least 1 module required",
      "count": 0
    }
  },
  "missingFields": ["modules", "lessons"]
}
```

### GET /api/v1/courses/{courseId}/publish-readiness

Get detailed publish readiness report (same as validate-publish).

**Response (200 OK):**

```json
{
  "isValid": boolean,
  "completeness": number,
  "validations": {...},
  "missingFields": [...]
}
```

## Validation Rules

### Masterclass Course

- **Required Fields:**
  - Title: non-empty, max 200 chars
  - Description: non-empty, max 5000 chars
  - Category: must be valid category
  - Skill Level: must be one of (beginner, intermediate, advanced)
  - Price: must be set (free or paid amount)

- **Content Requirements:**
  - Modules: At least 1 module required
  - Lessons: At least 1 lesson per module
  - Videos: All lessons must have video (mux_asset_id set)

- **Optional but Recommended:**
  - Thumbnail: Course should have thumbnail (not blocked if missing)
  - Community Settings: Should be configured (not blocked)
  - Resources/Assignments: Nice to have (not blocked)

- **Pass Criteria:**
  - All required fields filled
  - At least 1 module with ≥1 lesson
  - All lessons have videos
  - No validation errors

### Lesson Course

- **Required Fields:**
  - Title: non-empty, max 200 chars
  - Description: non-empty, max 5000 chars
  - Category: must be valid category
  - Skill Level: must be one of (beginner, intermediate, advanced)
  - Price: must be set

- **Content Requirements:**
  - Video: Must have video (mux_asset_id set)

- **Optional but Recommended:**
  - Thumbnail: Should have thumbnail (not blocked if missing)
  - Masterclass Link: Can link to Masterclass (optional)
  - Resources/Assignments: Nice to have

- **Pass Criteria:**
  - All required fields filled
  - Video uploaded and ready
  - No validation errors

## UI Components

### Validation Summary (Review Step)

- Display checklist of all validation points
- Show ✓ (valid) or ✗ (invalid) icons
- Color code: green (valid), red (invalid), gray (optional)
- For invalid items: show error message below

**Example Layout:**

```
Publish Readiness Check (45% Complete)

Required Fields:
  ✓ Course title
  ✓ Description
  ✗ Category - Please select a category
  ✓ Skill level
  ✗ Thumbnail - Recommended (not required)

Course Content:
  ✗ Modules - At least 1 module required
  ✗ Lessons - At least 1 lesson per module
  ✗ Videos - All lessons must have videos

Optional:
  ⊘ Community settings (not configured)
  ⊘ Assignments (not added)

[← Back] [Publish Course] [← Save as Draft]
```

### Error Indicators in Wizard

- Invalid fields highlighted with red border
- Error message displayed inline below field
- When navigating to step with errors, highlight changes
- Show error count badge on step button (e.g., "Step 3: Videos (2 errors)")

### Publish Button States

- **Disabled** (gray, tooltip): "Complete missing fields before publishing"
- **Enabled** (blue): All validations pass
- **Loading** (spinner): Validation in progress or publishing
- **Success** (green): Course published successfully

### Error Toast Examples

- "Please fill in all required fields"
- "All lessons must have videos before publishing"
- "Course needs at least 1 module to publish"

## Requirements

1. **Validation Logic**
   - Query database for complete course structure
   - Check all required fields present
   - Verify modules/lessons exist and have content
   - Verify videos uploaded (check mux_asset_id)
   - Return detailed validation errors

2. **Validation Response**
   - `isValid`: Boolean indicating pass/fail
   - `validations`: Object with per-field validation results
   - `missingFields`: Array of field names failing validation
   - `completeness`: Percentage of course filled in
   - Clear error messages for each failure

3. **Error Messages**
   - User-friendly, not technical
   - Specific field name: "Description is required"
   - Not just "Invalid": "Category must be selected from dropdown"
   - Actionable: "Add at least 1 module to proceed"

4. **Publishing Process**
   - Validate before publishing (repeat validation)
   - If invalid, return error details (do NOT publish)
   - If valid, set status to "published"
   - Set `published_at` timestamp
   - NO admin approval needed (direct publish)
   - Return published course URL

5. **Publishing Side Effects**
   - Create course slug URL-safe identifier (if not exists)
   - Generate public share URL
   - Mark course as discoverable in search
   - Notify instructor of successful publish (optional email)
   - Log publish action for analytics

6. **Authorization**
   - Verify JWT token
   - Verify user is course owner
   - Return 403 if not authorized

7. **Data Validation**
   - Validate data types and formats
   - Check for NULL values in required fields
   - Verify foreign key relationships
   - Check video duration > 0

8. **Atomicity**
   - Publish is atomic (all or nothing)
   - If any part fails, entire publish fails
   - No partial publishes

## Acceptance Criteria

- [ ] POST validate-publish returns detailed validation report
- [ ] Masterclass validates ≥1 module with ≥1 lesson with videos
- [ ] Lesson validates ≥1 video uploaded
- [ ] Required fields (title, description, category, skill level) validated
- [ ] Validation distinguishes required vs optional fields
- [ ] POST publish validates before publishing
- [ ] If validation fails, publish blocked with clear error messages
- [ ] If validation passes, course published and status updated to "published"
- [ ] Published course has status="published" and published_at timestamp
- [ ] No admin approval required (direct publish)
- [ ] UI Publish button disabled until all validations pass
- [ ] Error messages display inline on relevant wizard steps
- [ ] Error count badges show on step buttons
- [ ] Validation summary shows completeness percentage
- [ ] ✓/✗ icons display for each validation point
- [ ] Toast notifications show on validation failures
- [ ] Course slug auto-generated if not exists
- [ ] Published URL returned in response
- [ ] 403 returned if user not course owner
- [ ] Concurrent publish requests handled (only 1 succeeds)

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Module Management API (module-management.md)
- **Upstream**: Lesson Management API (lesson-management.md)
- **Upstream**: Video Upload API (video-upload-mux-direct.md)
- **Upstream**: Course Builder UI (course-builder-ui-masterclass.md, course-builder-ui-lesson.md)
- **Related**: Course Discovery (06-course-discovery-and-browsing)

## Technical Notes

### Backend Validation Handler

```typescript
export const validatePublish = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const validations = await performValidation(courseId, course.type, db);
  const isValid = Object.values(validations).every(
    (v: any) => v.valid !== false
  );

  // Calculate completeness
  const completeness = calculateCompleteness(validations);

  // Extract missing fields
  const missingFields = Object.entries(validations)
    .filter(([_, v]: [string, any]) => v.valid === false)
    .map(([field, _]) => field);

  return {
    isValid,
    message: isValid
      ? "Course is ready to publish"
      : "Course cannot be published. See errors below.",
    validations,
    completeness,
    missingFields,
    estimatedPublishTime: "2 seconds",
  };
});

async function performValidation(
  courseId: string,
  courseType: string,
  db: Database
): Promise<Record<string, any>> {
  const validations: Record<string, any> = {};

  // Fetch full course structure
  const course = await db.query.courses.findFirst({
    where: (courses, { eq }) => eq(courses.id, courseId),
  });

  // Required fields validation
  validations.title = {
    valid: !!(course?.title && course.title.length > 0),
    error: "Title is required",
  };

  validations.description = {
    valid: !!(course?.description && course.description.length > 0),
    error: "Description is required",
  };

  validations.category = {
    valid: !!(course?.category && course.category.length > 0),
    error: "Category must be selected",
  };

  validations.skillLevel = {
    valid: !!(course?.skillLevel && course.skillLevel.length > 0),
    error: "Skill level must be selected",
  };

  validations.price = {
    valid: course?.price !== null && course?.price !== undefined,
    error: "Price must be set (free or paid)",
  };

  validations.thumbnail = {
    valid: !!course?.thumbnailUrl,
    error: "Thumbnail recommended (not required)",
    optional: true,
  };

  if (courseType === "masterclass") {
    // Modules validation
    const modules = await db.query.modules.findMany({
      where: (m, { eq }) => eq(m.courseId, courseId),
    });

    validations.modules = {
      valid: modules.length > 0,
      count: modules.length,
      error: "At least 1 module required",
    };

    // Lessons validation
    const lessons = await db.query.lessons.findMany({
      where: (l, { eq }) => eq(l.courseId, courseId),
    });

    validations.lessons = {
      valid:
        lessons.length > 0 &&
        modules.every((m) => lessons.some((l) => l.moduleId === m.id)),
      count: lessons.length,
      error: "At least 1 lesson per module required",
      missingLessonsInModule: findModulesWithoutLessons(modules, lessons),
    };

    // Videos validation
    const lessonsWithoutVideo = lessons.filter((l) => !l.muxAssetId);
    validations.lessonVideos = {
      valid: lessonsWithoutVideo.length === 0,
      error: "All lessons must have videos",
      lessonsWithoutVideo: lessonsWithoutVideo.map((l) => l.title),
    };
  } else {
    // Lesson type validation
    const lessons = await db.query.lessons.findMany({
      where: (l, { eq }) => eq(l.courseId, courseId),
    });

    const firstLesson = lessons[0];
    validations.video = {
      valid: !!(firstLesson?.muxAssetId && firstLesson?.muxPlaybackId),
      error: "Video must be uploaded",
    };
  }

  validations.communitySettings = {
    valid: true, // Optional
    optional: true,
  };

  return validations;
}

function findModulesWithoutLessons(modules: any[], lessons: any[]): string[] {
  return modules
    .filter((m) => !lessons.some((l) => l.moduleId === m.id))
    .map((m) => m.title);
}

function calculateCompleteness(validations: Record<string, any>): number {
  const total = Object.entries(validations).length;
  const valid = Object.entries(validations).filter(
    ([_, v]) => v.valid !== false || v.optional
  ).length;

  return Math.round((valid / total) * 100);
}
```

### Publish Handler

```typescript
export const publishCourse = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Validate before publishing
  const validations = await performValidation(courseId, course.type, db);
  const isValid = Object.values(validations).every(
    (v: any) => v.valid !== false
  );

  if (!isValid) {
    const missingFields = Object.entries(validations)
      .filter(([_, v]: [string, any]) => v.valid === false)
      .map(([field, _]) => field);

    throw createError({
      statusCode: 400,
      message: "Cannot publish. Validation failed.",
      data: { validations, missingFields },
    });
  }

  // Generate slug if not exists
  let slug = course.slug;
  if (!slug) {
    slug = await ensureUniqueSlug(generateSlug(course.title), db, courseId);
  }

  // Publish course
  const now = new Date();
  const published = await db
    .update(courses)
    .set({
      status: "published",
      slug,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(courses.id, courseId))
    .returning();

  // Log publish action
  await logPublishAction(courseId, user.id);

  // Notify instructor (async)
  notifyInstructorPublished(user.id, published[0].title).catch((err) =>
    console.error("Notification failed:", err)
  );

  return {
    courseId,
    status: "published",
    slug,
    publishedUrl: `https://mentor.example.com/courses/${slug}`,
    publishedAt: now.toISOString(),
    message: "Course published successfully",
  };
});

async function logPublishAction(courseId: string, userId: string) {
  // Log to analytics/audit table (optional)
  console.log(`Course ${courseId} published by ${userId}`);
}

async function notifyInstructorPublished(userId: string, courseTitle: string) {
  // Send email notification (optional)
  // Implementation depends on email service
}
```

### Frontend Component: Validation Summary

```typescript
export function PublishValidationSummary({ validations, completeness, isValid }: Props) {
  return (
    <div className="validation-summary">
      <div className="completeness">
        <h3>Publish Readiness Check</h3>
        <ProgressBar value={completeness} />
        <p>{completeness}% Complete</p>
      </div>

      <div className="validations">
        {Object.entries(validations).map(([field, validation]: [string, any]) => {
          const isOptional = validation.optional;
          const isValid = validation.valid !== false;

          return (
            <div
              key={field}
              className={`validation-item ${isValid ? 'valid' : 'invalid'} ${isOptional ? 'optional' : ''}`}
            >
              <span className="icon">
                {isValid ? '✓' : '✗'}
              </span>
              <div className="content">
                <p className="label">{formatFieldName(field)}</p>
                {!isValid && (
                  <p className="error">{validation.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatFieldName(field: string): string {
  const map: Record<string, string> = {
    title: 'Course title',
    description: 'Description',
    category: 'Category',
    skillLevel: 'Skill level',
    price: 'Pricing',
    thumbnail: 'Thumbnail',
    modules: 'Modules',
    lessons: 'Lessons',
    lessonVideos: 'Videos',
    video: 'Video',
    communitySettings: 'Community settings'
  };
  return map[field] || field;
}
```

### Testing Checklist

- Validate Masterclass with all required fields → isValid=true
- Validate Masterclass missing modules → isValid=false, error shown
- Validate Masterclass with lessons but no videos → isValid=false
- Validate Lesson with video uploaded → isValid=true
- Validate Lesson missing video → isValid=false
- Publish invalid course → 400 error, course not published
- Publish valid course → status="published", published_at set
- Publish button disabled until validations pass
- Error messages display inline in form
- Completeness percentage calculated correctly
