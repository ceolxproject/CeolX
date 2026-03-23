# Task: Published Course Editing

## Description

Implement editing capabilities for published courses. Text fields (title, description, category, skill level, pricing) are freely editable and changes apply immediately without admin approval. Video replacement requires a specific delete+re-upload flow (see video-replacement-flow.md). Changes are reflected immediately in the course catalog and to learners. No version history is maintained; old content is permanently overwritten.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Frontend: `@mentor/web` (Next.js, React)
- Shared types: `@mentor/types`

## API Endpoints

### PUT /api/v1/courses/{courseId}

Update published course metadata (text fields).

**Request Body (flexible, only include fields to update):**

```json
{
  "title": string (optional),
  "description": string (optional),
  "category": string (optional),
  "skillLevel": string (optional),
  "price": number (optional),
  "thumbnailUrl": string (optional)
}
```

**Response (200 OK):**

```json
{
  "id": "uuid",
  "courseId": "uuid",
  "title": string,
  "description": string,
  "category": string,
  "skillLevel": string,
  "price": number,
  "thumbnailUrl": string | null,
  "updatedAt": "ISO8601",
  "changesSummary": {
    "fieldsChanged": ["title", "price"],
    "previousValues": {
      "title": "old title",
      "price": 1999
    }
  }
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}

Update module metadata (title, description).

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
  "description": string,
  "updatedAt": "ISO8601"
}
```

### PUT /api/v1/courses/{courseId}/modules/{moduleId}/lessons/{lessonId}

Update lesson metadata (title, description). Videos require separate replacement flow.

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
  "lessonId": "uuid",
  "title": string,
  "description": string,
  "updatedAt": "ISO8601"
}
```

## UI Components

### Course Edit Page

- Available from:
  - Instructor dashboard: "Edit" button on published course
  - Course detail page: "Edit Course" button (owner only)
- Read-only sections:
  - Course status: "Published on [date]"
  - Published URL: copyable link
  - Enrollment count (informational)
  - Learner list (with option to message)
- Editable sections:
  - Course title (text input)
  - Description (textarea)
  - Category (dropdown)
  - Skill level (radio buttons)
  - Price (input)
  - Thumbnail (upload button with replace option)
  - Module titles and descriptions
  - Lesson titles and descriptions
  - Video replacement (see video-replacement-flow.md)

### Edit UI Behaviors

- Inline editing: Click to edit, click away or Enter to save
- OR modal editing: Click "Edit" button to open modal
- Optimistic updates: Show change immediately
- "Saving..." indicator during API call
- Success toast: "Changes saved successfully"
- Error handling: Revert on failure with error message
- Unsaved changes indicator (dot, asterisk, or banner)
- Clear indication: "Published on [date], last edited [date]"

### Video Replacement Indicator

- If video replacement in progress: "Video update in progress..."
- Once complete: "Video updated on [date]"
- Button: "Replace Video" (leads to video replacement flow)

## Requirements

1. **Editable Fields**
   - Course title: text input, max 200 chars
   - Description: textarea, max 5000 chars
   - Category: dropdown, must be valid category
   - Skill level: radio buttons (beginner, intermediate, advanced)
   - Price: numeric input (0 for free, cents for paid)
   - Thumbnail: upload with replacement option
   - Module title/description: inline or modal edit
   - Lesson title/description: inline or modal edit

2. **Non-Editable / Restricted Fields**
   - Course type (Masterclass vs Lesson): immutable after publish
   - Slug: immutable (used for URLs)
   - Published date: immutable
   - Published status: cannot unpublish via this endpoint (see course-unpublish-archive.md)
   - Videos: restricted to separate replacement flow
   - Module/lesson structure: can edit metadata but not add/remove via this endpoint

3. **Immediate Changes**
   - No staging or preview mode
   - Changes apply immediately upon save
   - Reflect in course catalog/search results within seconds
   - Learners see updated course details next page load
   - No notification to learners of minor changes (title, description)

4. **Change Tracking**
   - Optional: Track change history (previous values)
   - Return `changesSummary` with fields modified
   - Store `updated_at` timestamp on course
   - Do NOT maintain version history (old values overwritten)

5. **Validation**
   - Validate text lengths
   - Validate category exists
   - Validate skill level enum
   - Validate price is non-negative integer
   - Return validation errors for invalid input

6. **Authorization**
   - Verify JWT token
   - Verify user is course owner
   - Return 403 if not authorized

7. **Atomic Updates**
   - Update all changed fields in single transaction
   - If any field fails validation, reject entire request
   - Do not partially apply changes

8. **Cache Invalidation**
   - Invalidate course detail cache after update
   - Invalidate course list cache (for catalog/discovery)
   - Update timestamp for cache busting
   - Consider CDN cache (if applicable)

9. **Learner Impact**
   - Title change: appears on course detail, dashboard
   - Description change: appears on course detail, marketing pages
   - Price change: only affects NEW enrollments (existing learners unaffected)
   - Video replacement: affects all learners (completion reset, see video-replacement-flow.md)
   - Category/skill level change: affects discoverability

## Acceptance Criteria

- [ ] PUT /api/v1/courses/{courseId} updates text fields
- [ ] Updated fields validated before saving
- [ ] Changes saved and reflected immediately
- [ ] Changes do not require admin approval
- [ ] Optimistic UI updates show change before API response
- [ ] "Saving..." indicator shows during update
- [ ] Success toast shows after save
- [ ] Error handling reverts changes on failure
- [ ] Course type field is immutable
- [ ] Video changes require separate replacement flow
- [ ] Module and lesson metadata can be edited
- [ ] Slug cannot be changed
- [ ] Published date cannot be changed
- [ ] Price changes only affect new enrollments
- [ ] 403 returned if user not course owner
- [ ] Validation errors returned with field details
- [ ] Course catalog cache invalidated after update
- [ ] Learners see changes on next page load
- [ ] Change summary includes previous values (optional)
- [ ] Concurrent edits handled (last-write-wins or conflict detection)

## Dependencies

- **Upstream**: Course Creation API (course-creation-api.md)
- **Upstream**: Publish Validation Flow (publish-validation-flow.md)
- **Upstream**: Video Replacement Flow (video-replacement-flow.md)
- **Related**: Course Discovery (06-course-discovery-and-browsing)
- **Related**: Instructor Dashboard (10-instructor-dashboard-and-revenue)

## Technical Notes

### Database Schema

```sql
-- Courses table already has these columns
-- No schema changes needed for editing published courses
CREATE INDEX idx_published_courses ON courses(status) WHERE status = 'published';
CREATE INDEX idx_instructor_published ON courses(instructor_id, status) WHERE status = 'published';
```

### Backend Handler: Update Course

```typescript
export const updateCourse = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);

  // Track changes for response
  const changes: Record<string, any> = {};
  const previousValues: Record<string, any> = {};

  // Validate all fields before updating
  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) {
      throw createError({ statusCode: 400, message: "Invalid title" });
    }
    if (body.title !== course.title) {
      previousValues.title = course.title;
      changes.title = body.title;
    }
  }

  if (body.description !== undefined) {
    if (body.description && body.description.length > 5000) {
      throw createError({ statusCode: 400, message: "Description too long" });
    }
    if (body.description !== course.description) {
      previousValues.description = course.description;
      changes.description = body.description;
    }
  }

  if (body.category !== undefined) {
    const validCategory = await db.query.courseCategories.findFirst({
      where: (cc, { eq }) => eq(cc.name, body.category),
    });
    if (!validCategory) {
      throw createError({ statusCode: 400, message: "Invalid category" });
    }
    if (body.category !== course.category) {
      previousValues.category = course.category;
      changes.category = body.category;
    }
  }

  if (body.skillLevel !== undefined) {
    const validLevels = ["beginner", "intermediate", "advanced"];
    if (!validLevels.includes(body.skillLevel)) {
      throw createError({ statusCode: 400, message: "Invalid skill level" });
    }
    if (body.skillLevel !== course.skillLevel) {
      previousValues.skillLevel = course.skillLevel;
      changes.skillLevel = body.skillLevel;
    }
  }

  if (body.price !== undefined) {
    if (typeof body.price !== "number" || body.price < 0) {
      throw createError({ statusCode: 400, message: "Invalid price" });
    }
    if (body.price !== course.price) {
      previousValues.price = course.price;
      changes.price = body.price;
    }
  }

  if (body.thumbnailUrl !== undefined) {
    if (body.thumbnailUrl !== course.thumbnailUrl) {
      previousValues.thumbnailUrl = course.thumbnailUrl;
      changes.thumbnailUrl = body.thumbnailUrl;
    }
  }

  // If no changes, return current state
  if (Object.keys(changes).length === 0) {
    return {
      id: course.id,
      ...course,
      changesSummary: {
        fieldsChanged: [],
        previousValues: {},
      },
    };
  }

  // Update course
  changes.updatedAt = new Date();
  const updated = await db
    .update(courses)
    .set(changes)
    .where(eq(courses.id, courseId))
    .returning();

  // Invalidate cache (implementation depends on cache layer)
  await invalidateCourseCache(courseId);
  await invalidateCourseListCache();

  return {
    id: updated[0].id,
    ...updated[0],
    changesSummary: {
      fieldsChanged: Object.keys(previousValues),
      previousValues,
    },
  };
});

async function invalidateCourseCache(courseId: string) {
  // Redis cache invalidation
  await redis.del(`course:${courseId}`);
  // CDN cache busting (if using)
  // await cdnClient.purgeCache(`/courses/${courseId}`);
}

async function invalidateCourseListCache() {
  // Invalidate all course list caches
  await redis.del("courses:published");
  await redis.del("courses:by_category:*");
}
```

### Backend Handler: Update Module/Lesson

```typescript
export const updateModule = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, moduleId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);
  const changes: Record<string, any> = {};

  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) {
      throw createError({ statusCode: 400, message: "Invalid title" });
    }
    changes.title = body.title;
  }

  if (body.description !== undefined) {
    if (body.description && body.description.length > 2000) {
      throw createError({ statusCode: 400, message: "Description too long" });
    }
    changes.description = body.description || null;
  }

  if (Object.keys(changes).length === 0) {
    throw createError({ statusCode: 400, message: "No fields to update" });
  }

  changes.updatedAt = new Date();

  const updated = await db
    .update(modules)
    .set(changes)
    .where(eq(modules.id, moduleId))
    .returning();

  if (!updated.length) {
    throw createError({ statusCode: 404 });
  }

  return updated[0];
});

export const updateLesson = defineEventHandler(async (event) => {
  const user = await requireAuth(event);
  const { courseId, moduleId, lessonId } = event.context.params;

  // Verify course ownership
  const course = await db.query.courses.findFirst({
    where: (courses, { eq, and }) =>
      and(eq(courses.id, courseId), eq(courses.instructorId, user.id)),
  });

  if (!course) throw createError({ statusCode: 403 });

  const body = await readBody(event);
  const changes: Record<string, any> = {};

  if (body.title !== undefined) {
    if (!body.title || body.title.length > 200) {
      throw createError({ statusCode: 400, message: "Invalid title" });
    }
    changes.title = body.title;
  }

  if (body.description !== undefined) {
    if (body.description && body.description.length > 3000) {
      throw createError({ statusCode: 400, message: "Description too long" });
    }
    changes.description = body.description || null;
  }

  if (Object.keys(changes).length === 0) {
    throw createError({ statusCode: 400, message: "No fields to update" });
  }

  changes.updatedAt = new Date();

  const updated = await db
    .update(lessons)
    .set(changes)
    .where(eq(lessons.id, lessonId))
    .returning();

  if (!updated.length) {
    throw createError({ statusCode: 404 });
  }

  return updated[0];
});
```

### Frontend Component: Inline Course Editor

```typescript
import { useState } from 'react';

export function PublishedCourseEditor({ course, courseId }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEditClick = (field: string) => {
    setEditingField(field);
    setError(null);
  };

  const handleSave = async (field: string, newValue: string | number) => {
    if (newValue === getFieldValue(field)) {
      setEditingField(null);
      return; // No change
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Save failed');
      }

      toast.success('Changes saved successfully');
      setEditingField(null);
      setError(null);

      // Refresh course data
      await refetchCourse();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const getFieldValue = (field: string) => {
    const fieldMap: Record<string, any> = {
      title: course.title,
      description: course.description,
      category: course.category,
      skillLevel: course.skillLevel,
      price: course.price
    };
    return fieldMap[field];
  };

  return (
    <div className="course-editor">
      <div className="course-status">
        <span className="badge">Published</span>
        <span className="date">on {formatDate(course.publishedAt)}</span>
        {course.updatedAt > course.publishedAt && (
          <span className="last-edited">Last edited {formatDate(course.updatedAt)}</span>
        )}
      </div>

      <EditableField
        label="Course Title"
        value={course.title}
        field="title"
        isEditing={editingField === 'title'}
        onEdit={() => handleEditClick('title')}
        onSave={(value) => handleSave('title', value)}
        isSaving={isSaving}
        error={error}
      />

      <EditableField
        label="Description"
        value={course.description}
        field="description"
        isEditing={editingField === 'description'}
        onEdit={() => handleEditClick('description')}
        onSave={(value) => handleSave('description', value)}
        type="textarea"
        isSaving={isSaving}
        error={error}
      />

      <EditableField
        label="Category"
        value={course.category}
        field="category"
        isEditing={editingField === 'category'}
        onEdit={() => handleEditClick('category')}
        onSave={(value) => handleSave('category', value)}
        type="select"
        options={categories}
        isSaving={isSaving}
        error={error}
      />

      <EditableField
        label="Skill Level"
        value={course.skillLevel}
        field="skillLevel"
        isEditing={editingField === 'skillLevel'}
        onEdit={() => handleEditClick('skillLevel')}
        onSave={(value) => handleSave('skillLevel', value)}
        type="radio"
        options={['beginner', 'intermediate', 'advanced']}
        isSaving={isSaving}
        error={error}
      />

      <EditableField
        label="Price"
        value={formatPrice(course.price)}
        field="price"
        isEditing={editingField === 'price'}
        onEdit={() => handleEditClick('price')}
        onSave={(value) => handleSave('price', parsePrice(value))}
        type="price"
        isSaving={isSaving}
        error={error}
      />
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  value: string | number;
  field: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string | number) => Promise<void>;
  isSaving?: boolean;
  error?: string | null;
  type?: 'text' | 'textarea' | 'select' | 'radio' | 'price';
  options?: string[];
}

function EditableField({
  label,
  value,
  field,
  isEditing,
  onEdit,
  onSave,
  isSaving,
  error,
  type = 'text',
  options
}: EditableFieldProps) {
  const [localValue, setLocalValue] = useState(value);

  if (!isEditing) {
    return (
      <div className="editable-field">
        <label>{label}</label>
        <div className="display-value">
          <span>{value}</span>
          <button onClick={onEdit} disabled={isSaving}>
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editable-field editing">
      <label>{label}</label>
      {type === 'textarea' && (
        <textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          disabled={isSaving}
        />
      )}
      {type === 'select' && (
        <select
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          disabled={isSaving}
        >
          {options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {type === 'radio' && (
        <div className="radio-group">
          {options?.map(opt => (
            <label key={opt}>
              <input
                type="radio"
                value={opt}
                checked={localValue === opt}
                onChange={(e) => setLocalValue(e.target.value)}
                disabled={isSaving}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {type === 'price' && (
        <input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          disabled={isSaving}
        />
      )}
      {type === 'text' && (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          disabled={isSaving}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button
          onClick={() => onSave(localValue)}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setLocalValue(value);
            // Close editing
          }}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

### Testing Checklist

- Update course title → saved and reflected immediately
- Update description → saved without approval needed
- Update category → reflected in discovery
- Update price → new enrollments charged new price
- Existing enrollments unaffected by price change
- Video change restricted to replacement flow
- Course type immutable after publish
- Slug immutable after publish
- Validation errors prevent invalid updates
- 403 returned if not course owner
- Cache invalidated after update
- Optimistic UI shows change before API response
- Error handling reverts on failure
