# Task: Lesson Management

## Description

Implement CRUD (Create, Read, Update, Delete) operations for lessons within a course module. Lessons are the primary content units containing videos, descriptions, and optional resources/assignments. This task covers backend API endpoints and frontend UI components for creating, editing, deleting, and reordering lessons using drag-and-drop. Video duration is auto-populated from Mux after upload. Lesson order is persisted via a `sort_order` field within each module.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared components: `@mentor/ui` (Design system, dnd-kit)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`

## API Endpoints

### POST /api/v1/courses/{courseId}/modules/{moduleId}/lessons

Create a new lesson within a module.

**Request Body:**

```json
{
  "title": string,
  "description": string (optional),
  "muxAssetId": string,
  "muxPlaybackId": string,
  "videoDuration": number (seconds),
  "sortOrder": number (auto-assigned if omitted)
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "moduleId": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "muxAssetId": string,
  "muxPlaybackId": string,
  "videoDuration": number,
  "sortOrder": number,
  "resourceCount": number,
  "assignmentCount": number,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### GET /api/v1/courses/{courseId}/modules/{moduleId}/lessons

List all lessons for a module.

**Response (200 OK):**

```json
{
  "lessons": [
    {
      "id": "uuid",
      "moduleId": "uuid",
      "title": string,
      "description": string | null,
      "videoDuration": number,
      "sortOrder": number,
      "resourceCount": number,
      "assignmentCount": number,
      "createdAt": "ISO8601"
    }
  ],
  "total": number
}
```

### GET /api/v1/courses/{courseId}/modules/{moduleId}/lessons/{lessonId}

Get a single lesson with full details.

**Response (200 OK):**

```json
{
  "id": "uuid",
  "moduleId": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "muxAssetId": string,
  "muxPlaybackId": string,
  "videoDuration": number,
  "sortOrder": number,
  "resources": [
    {
      "id": "uuid",
      "title": string,
      "type": string,
      "url": string
    }
  ],
  "assignments": [
    {
      "id": "uuid",
      "title": string,
      "questionCount": number
    }
  ],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}/lessons/{lessonId}

Update lesson metadata (title, description). Video changes require delete + re-upload (see video-replacement-flow.md).

**Request Body:**

```json
{
  "title": string (optional),
  "description": string (optional)
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "moduleId": "uuid",
  "title": string,
  "description": string | null,
  "videoDuration": number,
  "sortOrder": number,
  "updatedAt": "ISO8601"
}
```

### DELETE /api/v1/courses/{courseId}/modules/{moduleId}/lessons/{lessonId}

Delete a lesson (and associated Mux asset).

**Response (200 OK):**

```json
{
  "success": true,
  "deletedLessonId": "uuid",
  "muxAssetDeleted": boolean
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}/lessons/reorder

Reorder lessons within a module via drag-and-drop.

**Request Body:**

```json
{
  "lessons": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "lessons": [
    {
      "id": "uuid",
      "sortOrder": number
    }
  ]
}
```

## Requirements

1. **Authentication & Authorization**
   - Verify JWT token and instructor role
   - Ensure course belongs to authenticated instructor
   - Return 403 if user is not course owner

2. **Lesson Schema Validation**
   - `title`: Required, non-empty string, max 200 characters
   - `description`: Optional, max 3000 characters
   - `muxAssetId`: Required, non-empty string (from Mux upload)
   - `muxPlaybackId`: Required, non-empty string (from Mux asset)
   - `videoDuration`: Required, positive integer (seconds)
   - `sortOrder`: Auto-assigned based on creation order if not provided

3. **Sort Order Management**
   - Auto-assign `sortOrder` based on creation within module (1, 2, 3, ...)
   - When reordering, update `sortOrder` for affected lessons
   - Ensure no gaps in sort order sequence within a module
   - Query results always ordered by `sortOrder` ASC

4. **Video Metadata**
   - Store `mux_asset_id` and `mux_playback_id` from upload (see video-upload-mux-direct.md)
   - `videoDuration` populated from Mux asset metadata (in seconds)
   - For video replacement, see video-replacement-flow.md
   - Mux asset cleanup handled on deletion

5. **Resource & Assignment Counts**
   - Include `resourceCount` and `assignmentCount` in list responses
   - Calculated from related tables (lesson_resources, lesson_assignments)

6. **Timestamps**
   - Set `createdAt` and `updatedAt` on creation
   - Update `updatedAt` on any modification

7. **Database Constraints**
   - Foreign key: `moduleId` references modules table
   - Unique constraint: Lesson titles unique within module
   - Index on `(moduleId, sortOrder)` for efficient ordering queries

## Acceptance Criteria

- [ ] POST endpoint creates lesson and auto-assigns sortOrder
- [ ] GET (list) returns lessons ordered by sortOrder
- [ ] GET (single) returns lesson with nested resources and assignments
- [ ] PUT endpoint updates title/description without affecting video
- [ ] DELETE endpoint deletes lesson and triggers Mux asset deletion
- [ ] Reorder endpoint updates sortOrder for all lessons in module
- [ ] 403 returned if user is not course owner
- [ ] videoDuration auto-populated from Mux metadata
- [ ] sortOrder always sequential within module (no gaps)
- [ ] Frontend drag-and-drop reordering syncs with API
- [ ] Optimistic UI updates on drag-and-drop
- [ ] Lesson cannot be created without video (muxAssetId and muxPlaybackId required)
- [ ] Resource and assignment counts are accurate

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Module Management (module-management.md)
- **Upstream**: Video Upload Mux (video-upload-mux-direct.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Related**: Resource Management (resource-upload-management.md)
- **Related**: Assignment/MCQ (assignment-mcq-creation.md)
- **Related**: Video Replacement Flow (video-replacement-flow.md)
- **Blocks**: Course Builder UI (course-builder-ui-masterclass.md)

## Technical Notes

### Database Schema

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  mux_asset_id VARCHAR(255) NOT NULL,
  mux_playback_id VARCHAR(255) NOT NULL,
  video_duration INTEGER NOT NULL, -- in seconds
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (module_id, title),
  INDEX idx_module_sort (module_id, sort_order),
  INDEX idx_course_id (course_id)
);
```

### Backend Handler Examples

**Create Lesson:**

```typescript
export const createLesson = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, moduleId } = event.context.params;

  // Verify course belongs to user
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Verify module belongs to course
  const module = await db.query.modules.findFirst({
    where: (modules, { eq, and }) =>
      and(eq(modules.id, moduleId), eq(modules.courseId, courseId)),
  });

  if (!module) throw createError({ statusCode: 404 });

  const body = await readBody(event);
  validateLessonInput(body);

  // Auto-assign sortOrder
  const lastLesson = await db.query.lessons.findFirst({
    where: (lessons, { eq }) => eq(lessons.moduleId, moduleId),
    orderBy: (lessons) => desc(lessons.sortOrder),
  });

  const sortOrder = (lastLesson?.sortOrder ?? 0) + 1;

  const lesson = await db
    .insert(lessons)
    .values({
      moduleId,
      courseId,
      title: body.title,
      description: body.description || null,
      muxAssetId: body.muxAssetId,
      muxPlaybackId: body.muxPlaybackId,
      videoDuration: body.videoDuration,
      sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  setResponseStatus(event, 201);
  return {
    ...lesson[0],
    resourceCount: 0,
    assignmentCount: 0,
  };
});
```

**Delete Lesson with Mux Asset Cleanup:**

```typescript
export const deleteLesson = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, moduleId, lessonId } = event.context.params;

  // Verify ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  // Get lesson to retrieve muxAssetId
  const lesson = await db.query.lessons.findFirst({
    where: (lessons, { eq }) => eq(lessons.id, lessonId),
  });

  if (!lesson) throw createError({ statusCode: 404 });

  // Delete Mux asset
  const mux = new Mux();
  let muxDeleted = false;
  try {
    await mux.video.assets.delete(lesson.muxAssetId);
    muxDeleted = true;
  } catch (error) {
    // Log error but proceed with lesson deletion
    console.error("Failed to delete Mux asset", error);
  }

  // Delete lesson from database (cascade deletes resources, assignments)
  await db.delete(lessons).where(eq(lessons.id, lessonId));

  return {
    success: true,
    deletedLessonId: lessonId,
    muxAssetDeleted: muxDeleted,
  };
});
```

**Reorder Lessons:**

```typescript
export const reorderLessons = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, moduleId } = event.context.params;

  // Verify course belongs to user
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);

  // Validate all lessons belong to module
  const lessonIds = body.lessons.map((l: any) => l.id);
  const dbLessons = await db.query.lessons.findMany({
    where: (lessons, { inArray, eq }) =>
      and(inArray(lessons.id, lessonIds), eq(lessons.moduleId, moduleId)),
  });

  if (dbLessons.length !== lessonIds.length) {
    throw createError({ statusCode: 400, message: "Invalid lesson IDs" });
  }

  // Update sortOrder in transaction
  const updated = await Promise.all(
    body.lessons.map((l: any) =>
      db
        .update(lessons)
        .set({ sortOrder: l.sortOrder, updatedAt: new Date() })
        .where(eq(lessons.id, l.id))
        .returning(),
    ),
  );

  return {
    success: true,
    lessons: updated.map((result) => ({
      id: result[0].id,
      sortOrder: result[0].sortOrder,
    })),
  };
});
```

### Frontend Drag-and-Drop Integration

Similar to module reordering, use `dnd-kit`:

```typescript
function LessonList({ lessons, moduleId, courseId }: Props) {
  const [items, setItems] = useState(lessons);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(l => l.id === active.id);
    const newIndex = items.findIndex(l => l.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    setItems(newItems);

    // Persist to API
    await reorderLessons(courseId, moduleId, newItems.map((l, i) => ({
      id: l.id,
      sortOrder: i + 1
    })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(l => l.id)} strategy={verticalListSortingStrategy}>
        {items.map(lesson => (
          <SortableLesson key={lesson.id} lesson={lesson} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### Video Duration Handling

- During Mux upload, webhook returns asset details including duration
- Store duration (in seconds) in lesson record at upload completion
- Display duration in lesson list UI (convert to MM:SS format)
- If duration is 0 or missing, mark video as "processing" until webhook updates

### Error Handling

- Return 400 if request validation fails (missing muxAssetId, etc.)
- Return 403 if user not course owner
- Return 404 if lesson, module, or course not found
- Log Mux asset deletion failures but proceed with lesson deletion
- Do not expose database errors to client

### Performance Considerations

- Index on `(moduleId, sortOrder)` for fast retrieval in order
- Batch update sortOrder values in single transaction
- Cache lesson list in frontend state to reduce API calls
- Load resources/assignments only when lesson is selected/expanded

### Testing Checklist

- Create lesson with valid Mux asset IDs → success
- Create lesson without muxAssetId → 400
- Delete lesson → Mux asset deleted and lesson removed from DB
- Reorder lessons → all sortOrder values update correctly
- Verify sortOrder is sequential within module after reorder
- Lesson duration displays correctly from mux metadata
