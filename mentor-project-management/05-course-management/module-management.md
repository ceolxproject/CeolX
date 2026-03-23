# Task: Module Management

## Description

Implement CRUD (Create, Read, Update, Delete) operations for modules within a Masterclass course. Modules are organizational containers for lessons. This task covers backend API endpoints and frontend UI components for creating, editing, deleting, and reordering modules using drag-and-drop. Module order is persisted via a `sort_order` field.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared components: `@mentor/ui` (Design system, dnd-kit)
- Shared types: `@mentor/types`
- API client: `@mentor/api-client`

## API Endpoints

### POST /api/v1/courses/{courseId}/modules

Create a new module within a course.

**Request Body:**

```json
{
  "title": string,
  "description": string (optional),
  "sortOrder": number (auto-assigned if omitted)
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "sortOrder": number,
  "lessonCount": number,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### GET /api/v1/courses/{courseId}/modules

List all modules for a course.

**Response (200 OK):**

```json
{
  "modules": [
    {
      "id": "uuid",
      "courseId": "uuid",
      "title": string,
      "description": string | null,
      "sortOrder": number,
      "lessonCount": number,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "total": number
}
```

### GET /api/v1/courses/{courseId}/modules/{moduleId}

Get a single module with details.

**Response (200 OK):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "sortOrder": number,
  "lessons": [
    {
      "id": "uuid",
      "title": string,
      "description": string | null,
      "videoDuration": number,
      "sortOrder": number
    }
  ],
  "lessonCount": number,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}

Update module metadata.

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
  "courseId": "uuid",
  "title": string,
  "description": string | null,
  "sortOrder": number,
  "lessonCount": number,
  "updatedAt": "ISO8601"
}
```

### DELETE /api/v1/courses/{courseId}/modules/{moduleId}

Delete a module (and optionally cascade delete lessons).

**Query Parameters:**

- `cascade`: boolean (default false) - if true, delete all lessons in module

**Response (200 OK):**

```json
{
  "success": true,
  "deletedModuleId": "uuid",
  "deletedLessonCount": number (if cascade=true)
}
```

**Error Response (409 Conflict):**
If module has lessons and cascade=false, return:

```json
{
  "error": "Module has lessons. Use cascade=true to delete with lessons or delete lessons first.",
  "lessonCount": number
}
```

### PUT /api/v1/courses/{courseId}/modules/reorder

Reorder modules via drag-and-drop.

**Request Body:**

```json
{
  "modules": [
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
  "modules": [
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

2. **Module Schema Validation**
   - `title`: Required, non-empty string, max 200 characters
   - `description`: Optional, max 2000 characters
   - `sortOrder`: Auto-assigned as next integer if not provided
   - Each module title must be unique within its course

3. **Sort Order Management**
   - Auto-assign `sortOrder` based on creation time (1, 2, 3, ...)
   - When reordering, update `sortOrder` for affected modules
   - Ensure no gaps in sort order sequence
   - Query results always ordered by `sortOrder` ASC

4. **Lesson Cascade**
   - GET endpoint includes lesson count
   - DELETE with `cascade=true` deletes all associated lessons and their videos (Mux assets)
   - DELETE with `cascade=false` requires no lessons present (409 conflict if lessons exist)

5. **Timestamps**
   - Set `createdAt` and `updatedAt` on creation
   - Update `updatedAt` on any modification

6. **Database Constraints**
   - Foreign key: `courseId` references courses table
   - Index on `(courseId, sortOrder)` for efficient ordering queries
   - Unique constraint on `(courseId, title)` to prevent duplicate module names

## Acceptance Criteria

- [ ] POST endpoint creates module and auto-assigns sortOrder
- [ ] GET (list) returns modules ordered by sortOrder
- [ ] GET (single) returns module with nested lessons
- [ ] PUT endpoint updates title/description without affecting sortOrder
- [ ] DELETE endpoint checks for lessons and returns 409 if present (cascade=false)
- [ ] DELETE with cascade=true deletes module and all lessons
- [ ] Reorder endpoint updates sortOrder for all modules
- [ ] 403 returned if user is not course owner
- [ ] Unique constraint on (courseId, title) enforced
- [ ] sortOrder always sequential (no gaps)
- [ ] Frontend drag-and-drop reordering syncs with API
- [ ] Optimistic UI updates on drag-and-drop
- [ ] Error messages clear when deletion blocked due to lessons

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Authentication (04-authentication-and-onboarding)
- **Related**: Lesson Management (lesson-management.md)
- **Blocks**: Course Builder UI Masterclass (course-builder-ui-masterclass.md)

## Technical Notes

### Database Schema

```sql
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE (course_id, title),
  INDEX idx_course_sort (course_id, sort_order)
);
```

### Backend Handler Examples

**Create Module:**

```typescript
export const createModule = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course belongs to user
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);
  validateModuleInput(body);

  // Auto-assign sortOrder
  const lastModule = await db.query.modules.findFirst({
    where: (modules, { eq }) => eq(modules.courseId, courseId),
    orderBy: (modules) => desc(modules.sortOrder),
  });

  const sortOrder = (lastModule?.sortOrder ?? 0) + 1;

  const module = await db
    .insert(modules)
    .values({
      courseId,
      title: body.title,
      description: body.description || null,
      sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  setResponseStatus(event, 201);
  return {
    ...module[0],
    lessonCount: 0,
  };
});
```

**Reorder Modules:**

```typescript
export const reorderModules = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course belongs to user
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);

  // Validate all modules belong to course
  const moduleIds = body.modules.map((m: any) => m.id);
  const dbModules = await db.query.modules.findMany({
    where: (modules, { inArray, eq }) =>
      and(inArray(modules.id, moduleIds), eq(modules.courseId, courseId)),
  });

  if (dbModules.length !== moduleIds.length) {
    throw createError({ statusCode: 400, message: "Invalid module IDs" });
  }

  // Update sortOrder for each module
  const updated = await Promise.all(
    body.modules.map((m: any) =>
      db
        .update(modules)
        .set({ sortOrder: m.sortOrder, updatedAt: new Date() })
        .where(eq(modules.id, m.id))
        .returning()
    )
  );

  return {
    success: true,
    modules: updated.map((result) => ({
      id: result[0].id,
      sortOrder: result[0].sortOrder,
    })),
  };
});
```

### Frontend Drag-and-Drop Integration

Use `dnd-kit` library for accessible drag-and-drop:

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function ModuleList({ modules, courseId }: Props) {
  const [items, setItems] = useState(modules);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(m => m.id === active.id);
    const newIndex = items.findIndex(m => m.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);

    // Optimistic update
    setItems(newItems);

    // Persist to API
    await reorderModules(courseId, newItems.map((m, i) => ({
      id: m.id,
      sortOrder: i + 1
    })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(m => m.id)} strategy={verticalListSortingStrategy}>
        {items.map(module => (
          <SortableModule key={module.id} module={module} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### Error Handling

- Return 400 if request body validation fails
- Return 403 if user is not course owner
- Return 404 if course or module not found
- Return 409 if DELETE attempted on module with lessons (cascade=false)
- Log all errors server-side for debugging
- Do not expose database errors to client

### Performance Considerations

- Index on `(courseId, sortOrder)` for fast retrieval in order
- Batch update sortOrder values in single transaction during reorder
- Cache module list in frontend state to reduce API calls
- Load lessons only when module is expanded/viewed

### Testing Checklist

- Create module as course owner → success
- Create module as non-owner → 403
- Create module with duplicate title → unique constraint violation
- Delete module with lessons, cascade=false → 409
- Delete module with lessons, cascade=true → success, lessons deleted
- Reorder modules → all sortOrder values update correctly
- Verify sort order is sequential after reorder (no gaps)
