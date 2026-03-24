# Typesense Search Setup

## Description

Configure and deploy Typesense Cloud for fuzzy, typo-tolerant full-text search across courses. This includes schema definition, indexing all published courses, configuring search parameters, setting up real-time sync via QStash, and implementing faceted search for categories, price types, and course types. Target search latency: sub-50ms p99.

## Affected Apps/Packages

- `backend/services/search` — Typesense client integration
- `backend/workers/indexing` — Course indexing worker (QStash)
- `backend/api/hono` — Search API endpoints
- `shared/types` — Search result types
- DevOps/Infrastructure — Typesense Cloud credentials

## Typesense Cluster Setup

### Typesense Cloud Configuration

- **Plan:** Growth/Scale (dependent on course volume)
- **Region:** EU (Frankfurt or similar, close to primary DB)
- **Nodes:** 2-3 nodes for redundancy
- **API Key:** Generate admin and search-only keys

### API Keys

1. **Admin Key** (backend server only)
   - Permissions: All operations (index, delete, update)
   - Rotation: Every 90 days
   - Storage: Environment variable `TYPESENSE_ADMIN_KEY`

2. **Search Key** (frontend clients)
   - Permissions: Search only
   - Rate limit: 1000 requests/minute
   - Storage: Environment variable `TYPESENSE_SEARCH_KEY`

## Schema Definition

### Course Collection Schema

```json
{
  "name": "courses",
  "enable_nested_fields": true,
  "fields": [
    {
      "name": "id",
      "type": "string",
      "infix": false
    },
    {
      "name": "title",
      "type": "string",
      "infix": true,
      "stem": true
    },
    {
      "name": "description",
      "type": "string",
      "infix": true,
      "stem": true,
      "index": true
    },
    {
      "name": "category_id",
      "type": "string",
      "facet": true,
      "index": false
    },
    {
      "name": "category_name",
      "type": "string",
      "facet": true,
      "index": true
    },
    {
      "name": "instructor_id",
      "type": "string",
      "facet": true,
      "index": false
    },
    {
      "name": "instructor_name",
      "type": "string",
      "facet": true,
      "index": true
    },
    {
      "name": "price_type",
      "type": "string",
      "facet": true,
      "enum": ["free", "paid"]
    },
    {
      "name": "course_type",
      "type": "string",
      "facet": true,
      "enum": ["masterclass", "single_lesson"]
    },
    {
      "name": "price",
      "type": "float",
      "sort": true
    },
    {
      "name": "enrollment_count",
      "type": "int32",
      "sort": true
    },
    {
      "name": "interested_count",
      "type": "int32",
      "sort": true
    },
    {
      "name": "duration_minutes",
      "type": "int32",
      "sort": true
    },
    {
      "name": "difficulty",
      "type": "string",
      "facet": true,
      "enum": ["beginner", "intermediate", "advanced"]
    },
    {
      "name": "lesson_count",
      "type": "int32"
    },
    {
      "name": "published_at",
      "type": "int64",
      "sort": true
    },
    {
      "name": "updated_at",
      "type": "int64"
    },
    {
      "name": "thumbnail_url",
      "type": "string",
      "index": false
    },
    {
      "name": "slug",
      "type": "string",
      "index": false
    },
    {
      "name": "is_featured",
      "type": "bool",
      "facet": false
    },
    {
      "name": "locale",
      "type": "string",
      "facet": true,
      "enum": ["en", "es", "fr", "ru"]
    }
  ],
  "default_sorting_field": "enrollment_count"
}
```

### Field Definitions Explained

**Indexed Fields (searchable):**

- `title` — Course title with stemming (search "makeup" matches "makeups")
- `description` — Course description, infix search (search "beauty" in middle of phrase)
- `instructor_name` — Instructor name for instructor search
- `category_name` — Category name searchable

**Facet Fields (for filtering):**

- `category_id`, `category_name` — Filter by category
- `instructor_id`, `instructor_name` — Filter by instructor
- `price_type` — Filter: free, paid
- `course_type` — Filter: masterclass, single_lesson
- `difficulty` — Filter: beginner, intermediate, advanced
- `locale` — Filter by language

**Sortable Fields:**

- `enrollment_count` — Sort by popularity (default)
- `interested_count` — Sort by interest
- `price` — Sort by price (low-to-high, high-to-low)
- `duration_minutes` — Sort by duration
- `published_at` — Sort by newest

**Non-indexed Fields:**

- `id`, `slug`, `thumbnail_url` — Returned but not searchable

## Indexing Strategy

### Initial Bulk Index

1. **Fetch all published courses from primary DB:**

   ```sql
   SELECT
     c.id, c.title, c.description, c.slug,
     c.category_id, cat.name as category_name,
     c.instructor_id, i.name as instructor_name,
     c.price, c.price_type, c.course_type,
     c.difficulty, c.lesson_count,
     c.enrollment_count, c.interested_count,
     c.duration_minutes, c.thumbnail_url,
     c.published_at, c.updated_at,
     c.is_featured, 'en' as locale
   FROM courses c
   JOIN categories cat ON c.category_id = cat.id
   JOIN instructors i ON c.instructor_id = i.id
   WHERE c.is_published = true AND c.deleted_at IS NULL
   ORDER BY c.published_at DESC;
   ```

2. **Batch upload to Typesense:**
   - Use `/documents/import` endpoint (NDJSON format)
   - Batch size: 1000 documents per request
   - Timeout: 30 seconds per batch
   - Retry on failure: exponential backoff (max 3 retries)

3. **Timeout:** 10-15 minutes for initial index (depends on course count)

### Real-time Sync Strategy

**Trigger Events (QStash):**

- `course.published` → Index course
- `course.unpublished` → Delete from index
- `course.updated` → Re-index course
- `course.deleted` → Delete from index
- `category.updated` → Re-index all courses in category
- `interested_count.updated` → Update course interested_count in index

**QStash Worker Implementation:**

```typescript
// backend/workers/indexing.ts
import { Hono } from "hono";
import { Typesense } from "typesense";

const app = new Hono();
const typesense = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST, port: 443, protocol: "https" }],
  apiKey: process.env.TYPESENSE_ADMIN_KEY,
  connectionTimeoutSeconds: 10,
});

app.post("/webhook/course-published", async (c) => {
  const { courseId } = await c.req.json();

  // Fetch full course data from DB
  const course = await db.courses.findById(courseId);

  // Index in Typesense
  await typesense.collections("courses").documents().create({
    id: course.id,
    title: course.title,
    description: course.description,
    // ... all fields
  });

  return c.json({ success: true });
});

app.post("/webhook/course-unpublished", async (c) => {
  const { courseId } = await c.req.json();

  try {
    await typesense.collections("courses").documents(courseId).delete();
  } catch (e) {
    // Document not found is ok
    if (!e.message.includes("Not Found")) throw e;
  }

  return c.json({ success: true });
});

app.post("/webhook/interested-count-updated", async (c) => {
  const { courseId, newCount } = await c.req.json();

  await typesense.collections("courses").documents(courseId).update({
    interested_count: newCount,
  });

  return c.json({ success: true });
});

export default app;
```

**QStash Configuration:**

- Endpoint: `https://api.mentor.example.com/webhook/course-{event}`
- Retry policy: 3 retries with 60-second intervals
- Timeout: 30 seconds
- Message format: JSON with courseId, event timestamp

## Search API Endpoints

### GET /search/courses

Instant search with typo tolerance.

**Query Parameters:**

- `q` (string, required) — Search query
- `category` (string, optional) — Category ID for faceting
- `price_type` (enum, optional) — "free", "paid"
- `course_type` (enum, optional) — "masterclass", "single_lesson"
- `difficulty` (enum, optional) — "beginner", "intermediate", "advanced"
- `sort_by` (enum, default: "enrollment_count") — Sort field
- `page` (number, default: 1) — Page number
- `limit` (number, default: 10) — Results per page
- `locale` (string, default: "en") — Language locale

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "title": "Advanced Makeup Techniques",
        "description": "Learn professional makeup techniques...",
        "slug": "advanced-makeup-techniques",
        "category_name": "Makeup",
        "instructor_name": "Sarah Brown",
        "price": 29.99,
        "price_type": "paid",
        "course_type": "masterclass",
        "difficulty": "advanced",
        "lesson_count": 12,
        "enrollment_count": 2341,
        "interested_count": 567,
        "duration_minutes": 240,
        "thumbnail_url": "https://...",
        "highlights": {
          "title": "Advanced <mark>Makeup</mark> Techniques",
          "description": "Learn professional <mark>makeup</mark> techniques..."
        }
      }
    ],
    "facets": {
      "category_name": [
        { "count": 45, "value": "Makeup" },
        { "count": 32, "value": "Skincare" }
      ],
      "price_type": [
        { "count": 120, "value": "free" },
        { "count": 200, "value": "paid" }
      ],
      "course_type": [
        { "count": 180, "value": "masterclass" },
        { "count": 140, "value": "single_lesson" }
      ]
    },
    "pagination": {
      "total_count": 87,
      "page": 1,
      "limit": 10,
      "total_pages": 9
    }
  }
}
```

**Caching:**

- Cache search results in Redis for 2 minutes
- Key: `search:{q}:{category}:{price_type}:{sort_by}:{locale}:{page}`
- Invalidate on course index updates

**Typo Tolerance Settings:**

```json
{
  "typo_tokens_threshold": 10,
  "num_typos": 1,
  "prefix": true,
  "drop_tokens_threshold": 10
}
```

## Search Parameters Configuration

### Query Rules

- **Prefix Search:** Enabled (search "make" matches "makeup")
- **Infix Search:** Enabled for description (search "beauty" matches "natural beauty")
- **Stem Search:** Enabled for title (search "makeup" matches "makeups")
- **Typo Tolerance:** 1 typo allowed up to 10 characters, 2 typos for 10+ characters
- **Case Sensitivity:** Off (search is case-insensitive)

### Highlighting

- Wrap matching terms in `<mark>` tags
- Enable for title and description fields
- Pre/post tags configurable

### Facet Search

```typescript
// Example: Get categories with count
const results = await typesense.collections("courses").documents().search({
  q: "makeup",
  facet_by: "category_name",
  filter_by: "price_type:= free",
});
```

## Synonyms Configuration (optional, v2+)

```json
{
  "synonyms": [
    {
      "id": "makeup-beauty",
      "synonyms": ["makeup", "beauty", "cosmetics", "face paint"]
    },
    {
      "id": "skincare-skin",
      "synonyms": ["skincare", "skin care", "facial care", "skin treatment"]
    },
    {
      "id": "haircare-hair",
      "synonyms": ["haircare", "hair care", "hair treatment", "hair styling"]
    }
  ]
}
```

## Client-Side Search Integration

### Frontend Search Implementation

```typescript
// apps/learner-web/api/search.ts
import axios from "axios";

export const searchCourses = async (
  query: string,
  filters?: { category?: string; priceType?: string; courseType?: string },
  page: number = 1,
) => {
  const response = await axios.get("/api/v1/search/courses", {
    params: {
      q: query,
      ...filters,
      page,
      limit: 10,
    },
  });

  return response.data.data;
};
```

### React Hook

```typescript
// apps/learner-web/hooks/useSearchCourses.ts
import { useState, useCallback } from "react";
import { searchCourses } from "@/api/search";

export const useSearchCourses = () => {
  const [results, setResults] = useState([]);
  const [facets, setFacets] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(async (query: string, filters?: any) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const data = await searchCourses(query, filters);
      setResults(data.results);
      setFacets(data.facets);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, facets, loading, error, search };
};
```

## Monitoring and Maintenance

### Monitoring Metrics

- **Indexing latency:** Target < 100ms per document
- **Search latency:** Target p99 < 50ms
- **Index size:** Monitor collection size (alert if > 1GB)
- **Query count:** Monitor search volume for capacity planning
- **Failed indexing:** Alert on QStash failures

### Health Checks

```bash
# Check Typesense cluster health
curl -H "X-TYPESENSE-API-KEY: {api_key}" \
  https://{cluster}.typesense.net/health

# Monitor collection stats
curl -H "X-TYPESENSE-API-KEY: {api_key}" \
  https://{cluster}.typesense.net/collections/courses
```

### Index Optimization

- Run periodic optimization (weekly): `POST /collections/courses/documents:compact`
- Monitor disk usage and purge old data if needed
- Regenerate index quarterly from source DB for consistency

## Acceptance Criteria

- [ ] Typesense Cloud cluster created in EU region with 2+ nodes
- [ ] Admin and search-only API keys generated and stored securely
- [ ] Course collection schema created with all required fields
- [ ] Typo tolerance configured: 1 typo for <10 chars, 2 for 10+ chars
- [ ] Prefix and infix search enabled for title/description
- [ ] Faceted search working for: category, price_type, course_type, difficulty
- [ ] Initial bulk index complete: all published courses indexed
- [ ] QStash integration set up for real-time sync
- [ ] course.published trigger indexes new course within 5 seconds
- [ ] course.unpublished trigger removes from index within 5 seconds
- [ ] course.updated trigger re-indexes within 5 seconds
- [ ] GET /search/courses endpoint returns results with facets
- [ ] Search results highlight matching terms in title/description
- [ ] Search results pagination works correctly
- [ ] Cache strategy implemented: 2-minute TTL for search results
- [ ] Typo tolerance tested: "makup" returns makeup courses
- [ ] Multi-word search works: "makeup tutorial" returns relevant courses
- [ ] Facet filters applied correctly (e.g., price_type=free)
- [ ] Multiple facet filters work together (category + price_type)
- [ ] Search latency monitored: p99 < 50ms
- [ ] No memory leaks or hanging connections
- [ ] Graceful error handling for Typesense outages
- [ ] Search accessible to unauthenticated users (search-only key)
- [ ] Index consistency validated weekly (row count matches DB)
- [ ] Documentation updated with search endpoint examples

## Dependencies

- `typesense` (npm package v1.4+) — Typesense client library
- `upstash-qstash` — Serverless job queue for indexing
- `redis` / `upstash-redis` — Result caching
- `hono` — API framework (already in stack)
- `zod` — Query parameter validation

## Technical Notes

- Typesense search must be case-insensitive for better UX
- Highlighting with `<mark>` tags requires frontend parsing
- Index size limit: Typesense Cloud typically supports 100M documents
- Search query timeout: 30 seconds (Typesense default)
- Facet count limited to top 100 values per facet
- Consider multi-collection search if expanding beyond courses (v2+)
- Implement analytics to track popular search terms for SEO
- Backup Typesense index weekly to cold storage
- Document rate limiting: 1000 requests/minute per search key
- Implement circuit breaker for Typesense failures (fallback to DB search)
- Test search with special characters: apostrophes, accents (é, ñ)
- Localized search: maintain separate collections per locale or use locale filtering
- Consider Typesense Analytics for search insights (v2+)
