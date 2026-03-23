# Task: Course Creation API

## Description

Implement backend API endpoint for creating new courses. This endpoint initializes a course record with metadata (title, description, category, thumbnail URL, price, skill level) and sets it to draft status by default. The course should be associated with the authenticated instructor and automatically generate a URL-safe slug for the course. This is the entry point for both Masterclass and Lesson-type courses.

## Affected Apps/Packages

- Backend: `@mentor/api` (Hono on Vercel)
- Database: `@mentor/db` (Drizzle + Neon PostgreSQL)
- Shared types: `@mentor/types`

## API Endpoints

### POST /api/v1/courses

Create a new course.

**Request Body:**

```json
{
  "type": "masterclass" | "lesson",
  "title": string,
  "description": string,
  "category": string,
  "skillLevel": "beginner" | "intermediate" | "advanced",
  "price": number (cents, 0 for free),
  "thumbnailUrl": string (optional, can be set later)
}
```

**Response (201 Created):**

```json
{
  "id": "uuid",
  "instructorId": "uuid",
  "type": "masterclass" | "lesson",
  "title": string,
  "description": string,
  "category": string,
  "skillLevel": string,
  "price": number,
  "slug": string,
  "thumbnailUrl": string | null,
  "status": "draft",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Error Responses:**

- `400 Bad Request`: Missing required fields or invalid input
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not an instructor
- `409 Conflict`: Slug already exists (handle with auto-increment suffix)

## Requirements

1. **Authentication & Authorization**
   - Verify JWT token is present and valid
   - Confirm user has `instructor` or `admin` role
   - Associate course with authenticated instructor's ID

2. **Course Schema Validation**
   - `title`: Required, non-empty string, max 200 characters
   - `description`: Required, non-empty string, max 5000 characters
   - `type`: Required enum (`masterclass` or `lesson`)
   - `category`: Required, must exist in course_categories table
   - `skillLevel`: Required enum (`beginner`, `intermediate`, `advanced`)
   - `price`: Optional, non-negative integer (in cents, default 0)
   - `thumbnailUrl`: Optional string, must be valid URL if provided

3. **Slug Generation**
   - Convert title to URL-safe slug (lowercase, hyphens instead of spaces, remove special chars)
   - Ensure uniqueness: if slug already exists, append `-{number}` suffix
   - Store as immutable identifier for SEO/URLs
   - Example: "Advanced Skincare Techniques 101" → "advanced-skincare-techniques-101"

4. **Default Values**
   - `status`: Always set to `draft` on creation
   - `publishedAt`: null
   - `modules`: Empty array (populated later)
   - `lessons`: Empty array (populated later)

5. **Timestamps**
   - Set `createdAt` and `updatedAt` to current UTC timestamp
   - `publishedAt` remains null until course is published

## Acceptance Criteria

- [ ] POST /api/v1/courses endpoint created and responds with 201 status
- [ ] Course record inserted into database with correct instructor association
- [ ] Slug auto-generated from title and stored as unique identifier
- [ ] Default status is `draft` on creation
- [ ] Request validation returns 400 with detailed error messages for invalid inputs
- [ ] 401 returned when user is not authenticated
- [ ] 403 returned when user lacks instructor role
- [ ] Concurrent requests with same title generate unique slugs (no collisions)
- [ ] Response includes all created course fields (id, slug, timestamps, etc.)
- [ ] Database schema includes indexes on (instructorId, status) for efficient queries
- [ ] Slug uniqueness constraint enforced at database level with conflict handling

## Dependencies

- **Upstream**: Authentication system (04-authentication-and-onboarding)
- **Upstream**: Database schema for courses and course_categories (02-database-schema)
- **Blocks**: All course builder tasks (module-management, lesson-management, video-upload, etc.)

## Technical Notes

### Database Schema Reference

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instructor_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('masterclass', 'lesson')),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  skill_level VARCHAR(20) NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  slug VARCHAR(255) NOT NULL UNIQUE,
  thumbnail_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (instructor_id) REFERENCES users(id),
  FOREIGN KEY (category) REFERENCES course_categories(name),
  INDEX idx_instructor_status (instructor_id, status),
  INDEX idx_slug (slug)
);
```

### Slug Generation Algorithm

```typescript
// Example implementation in Hono
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove consecutive hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

async function ensureUniqueSlug(
  baseSlug: string,
  db: Database,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.query.courses.findFirst({
      where: (courses, { eq, ne }) => {
        const conditions = [eq(courses.slug, slug)];
        if (excludeId) conditions.push(ne(courses.id, excludeId));
        return and(...conditions);
      },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}
```

### API Handler Structure

```typescript
// POST /api/v1/courses
export const createCourse = defineEventHandler(async (event) => {
  // 1. Extract and validate JWT
  const user = await requireAuth(event);
  if (user.role !== "instructor" && user.role !== "admin") {
    throw createError({ statusCode: 403 });
  }

  // 2. Parse and validate request body
  const body = await readBody(event);
  const validated = validateCourseInput(body);

  // 3. Generate unique slug
  const slug = await ensureUniqueSlug(generateSlug(body.title), db);

  // 4. Insert course record
  const course = await db
    .insert(courses)
    .values({
      instructorId: user.id,
      type: body.type,
      title: body.title,
      description: body.description,
      category: body.category,
      skillLevel: body.skillLevel,
      price: body.price || 0,
      slug,
      thumbnailUrl: body.thumbnailUrl || null,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // 5. Return 201 with course data
  setResponseStatus(event, 201);
  return course[0];
});
```

### Error Handling

- Log all 400 validation errors with request context for debugging
- Return structured error response with field-level validation details
- Do not expose database errors to client; log server-side and return generic 500
- Implement rate limiting on this endpoint to prevent spam course creation

### Indexing Strategy

Create compound index on `(instructor_id, status)` to efficiently query instructor's courses by status (drafts, published, etc.) in dashboard views.
