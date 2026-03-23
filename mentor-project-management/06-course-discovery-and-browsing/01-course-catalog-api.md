# Course Catalog API

## Description

Implement REST API endpoints for course discovery and browsing functionality. This includes paginated course listing with advanced filtering, sorting, and search capabilities. All endpoints must leverage Redis caching for sub-second response times and support both mobile and web clients.

## Affected Apps/Packages

- `backend/api/hono` — Core API service
- `backend/services/course` — Course business logic
- `backend/services/cache` — Redis caching layer
- `backend/db/migrations` — Database schema for course indexing
- `shared/types` — Course type definitions

## API Endpoints

### GET /courses

List courses with pagination, filtering, and sorting.

**Query Parameters:**

- `page` (number, default: 1) — Page number for pagination
- `limit` (number, default: 12, max: 100) — Items per page
- `category_id` (string, optional) — Filter by category UUID
- `instructor_id` (string, optional) — Filter by instructor UUID
- `price_type` (enum, optional) — Filter: "free", "paid", "all" (default)
- `course_type` (enum, optional) — Filter: "masterclass", "single_lesson", "all" (default)
- `sort_by` (enum, default: "newest") — Sort order: "newest", "popular", "most_interested", "price_asc", "price_desc"
- `locale` (string, default: "en") — Language locale for category names and content

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "uuid",
        "title": "string",
        "slug": "string",
        "description": "string (max 500 chars)",
        "thumbnail_url": "string",
        "price": {
          "amount": 29.99,
          "currency": "EUR"
        },
        "price_type": "paid|free",
        "course_type": "masterclass|single_lesson",
        "instructor": {
          "id": "uuid",
          "name": "string",
          "avatar_url": "string"
        },
        "category": {
          "id": "uuid",
          "name": "string",
          "slug": "string"
        },
        "enrollment_count": 1234,
        "interested_count": 567,
        "duration_minutes": 120,
        "difficulty": "beginner|intermediate|advanced",
        "lesson_count": 8,
        "is_free_to_preview": true,
        "published_at": "2024-01-15T10:00:00Z",
        "is_featured": false
      }
    ],
    "pagination": {
      "total_count": 342,
      "page": 1,
      "limit": 12,
      "total_pages": 29,
      "has_next": true,
      "has_previous": false
    }
  }
}
```

**Error Responses:**

- 400 Bad Request — Invalid query parameters or page out of range
- 500 Internal Server Error — Database or cache failure

**Caching Strategy:**

- Cache key: `courses:list:{page}:{limit}:{category_id}:{instructor_id}:{price_type}:{course_type}:{sort_by}:{locale}`
- TTL: 5 minutes (300s) — Invalidate on course publish/unpublish/update
- Use Redis HASH for multi-filter combinations
- Implement cache warming on server startup for popular filters

### GET /courses/:id

Retrieve full course details.

**Path Parameters:**

- `id` (string) — Course UUID

**Query Parameters:**

- `locale` (string, default: "en") — Language locale

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "slug": "string",
    "description": "string",
    "thumbnail_url": "string",
    "price": {
      "amount": 29.99,
      "currency": "EUR"
    },
    "price_type": "paid|free",
    "course_type": "masterclass|single_lesson",
    "instructor": {
      "id": "uuid",
      "name": "string",
      "avatar_url": "string",
      "bio": "string",
      "specialization": "string",
      "other_courses_count": 5
    },
    "category": {
      "id": "uuid",
      "name": "string"
    },
    "enrollment_count": 1234,
    "interested_count": 567,
    "duration_minutes": 120,
    "difficulty": "beginner|intermediate|advanced",
    "what_you_learn": ["Skill 1", "Skill 2"],
    "requirements": ["Requirement 1"],
    "modules": [
      {
        "id": "uuid",
        "title": "string",
        "duration_minutes": 45,
        "lessons": [
          {
            "id": "uuid",
            "title": "string",
            "duration_minutes": 15,
            "is_free_preview": true,
            "video_url": "string (only if free or user enrolled)"
          }
        ]
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "is_featured": false
  }
}
```

**Caching Strategy:**

- Cache key: `course:{id}:{locale}`
- TTL: 10 minutes (600s)
- Invalidate on course update

### GET /courses/category/:slug

List courses by category with pagination.

**Path Parameters:**

- `slug` (string) — Category slug (SEO-friendly URL)

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 12)
- `sort_by` (enum, default: "newest")
- `locale` (string, default: "en")

**Response:** Same as `GET /courses` with category pre-filtered.

**Caching Strategy:**

- Cache key: `courses:category:{slug}:{page}:{limit}:{sort_by}:{locale}`
- TTL: 10 minutes (600s)

### GET /courses/instructor/:slug

List courses by instructor with pagination.

**Path Parameters:**

- `slug` (string) — Instructor slug (URL-friendly)

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 12)
- `sort_by` (enum, default: "newest")

**Response:** Same as `GET /courses` with instructor pre-filtered.

**Caching Strategy:**

- Cache key: `courses:instructor:{slug}:{page}:{limit}:{sort_by}`
- TTL: 10 minutes (600s)

### POST /courses/:id/interest

Mark course as interested (not logged in users: use anonymous interest tracking).

**Path Parameters:**

- `id` (string) — Course UUID

**Request Body (for authenticated users):**

```json
{
  "interested": true
}
```

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "course_id": "uuid",
    "interested": true,
    "interested_count": 568
  }
}
```

**Error Responses:**

- 401 Unauthorized — User not authenticated (anonymous interest allowed via tracking)
- 404 Not Found — Course not found
- 409 Conflict — Already interested (return current state)

**Implementation Notes:**

- For authenticated users: store in `user_course_interests` table
- Atomically increment/decrement `interested_count` on course record
- Return updated count in response for real-time UI updates
- For anonymous users: track via browser localStorage and SessionStorage
- Invalidate course cache after interest update

## Requirements

- Handle up to 10,000+ courses without performance degradation
- Support filter combinations (category + price_type + course_type)
- Pagination must prevent out-of-bounds requests
- All monetary values in EUR, support other currencies via conversion
- Course cards show: thumbnail, title, instructor name/avatar, price, type badge, interested count
- Catalog must load in <500ms from cache
- Support 50+ concurrent users per second
- API versioning: use `/api/v1/` prefix

## Acceptance Criteria

- [ ] GET /courses endpoint returns paginated list with all filter and sort options working
- [ ] GET /courses/:id returns full course details with modules/lessons
- [ ] GET /courses/category/:slug works with proper caching
- [ ] GET /courses/instructor/:slug works with proper caching
- [ ] POST /courses/:id/interest marks interest and updates count atomically
- [ ] Redis caching implemented with appropriate TTLs (5-10 min for lists, 10 min for details)
- [ ] Cache invalidation strategy tested (publish/unpublish/update course clears relevant cache keys)
- [ ] All query parameters validated and documented
- [ ] Error handling returns proper HTTP status codes with meaningful messages
- [ ] Performance tested: catalog load <500ms, detail page <300ms (cached)
- [ ] API tested with up to 100 courses per page
- [ ] Locale routing works: responses respect locale parameter
- [ ] Interested count persists correctly and updates real-time
- [ ] Integration tests pass for all endpoints
- [ ] API documentation generated (OpenAPI/Swagger)

## Dependencies

- `express` / `hono` — Web framework
- `redis` / `upstash-redis` — Caching layer
- `postgres` — Primary database
- `zod` — Request validation
- `ts-node` — TypeScript runtime

## Technical Notes

- Use database indexes on `category_id`, `instructor_id`, `price_type`, `course_type` for fast filtering
- Consider materialized views for popular sort orders (popular, newest)
- Implement cursor-based pagination for mobile apps (offset-limit can be slow with large datasets)
- All responses must include HTTP cache headers: `Cache-Control: public, max-age=300` for listing, `max-age=600` for details
- Use ETags for course detail endpoint to support client-side caching
- Monitor cache hit/miss ratios and adjust TTLs based on access patterns
- Ensure price is always returned with currency (EUR for MVP)
- Course type badge critical for UX (masterclass vs single lesson distinction)
- Interested count should update within 2-3 seconds of user action for best UX
- Rate limiting: 100 requests per minute per IP for public endpoints
