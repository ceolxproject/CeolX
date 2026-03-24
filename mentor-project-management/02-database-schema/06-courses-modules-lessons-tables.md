# Task 6: Courses, Modules, and Lessons Tables

## Description

Create the core course content structure with tables for courses, modules, and lessons. This hierarchical structure organizes educational content where courses contain modules, which contain lessons with video assets. Supports both masterclasses and multi-lesson courses with rich media integration via Mux for video streaming.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (course endpoints)
- `apps/web-learner` (course browsing and playback)
- `apps/web-mentor` (course creation and management)
- `apps/web-admin` (course moderation)

## Requirements

### Courses Table

Create table `courses`:

| Column                   | Type            | Constraints                   | Description                                              |
| ------------------------ | --------------- | ----------------------------- | -------------------------------------------------------- |
| `id`                     | `UUID`          | PK, Default: `uuid_v7()`      | Unique course identifier                                 |
| `instructor_id`          | `UUID`          | FK → users(id), NOT NULL      | Course creator/instructor                                |
| `title`                  | `VARCHAR(255)`  | NOT NULL                      | Course title (max 255 chars)                             |
| `slug`                   | `VARCHAR(255)`  | UNIQUE, NOT NULL              | URL-friendly slug (lowercase, hyphens)                   |
| `description`            | `TEXT`          | NOT NULL                      | Full course description                                  |
| `thumbnail_url`          | `TEXT`          | NULL                          | Course thumbnail image (R2 URL)                          |
| `banner_url`             | `TEXT`          | NULL                          | Course banner image (R2 URL)                             |
| `category_id`            | `UUID`          | FK → categories(id), NULL     | Primary course category                                  |
| `course_type`            | `VARCHAR(50)`   | NOT NULL, DEFAULT: 'lesson'   | Enum: masterclass (single module), lesson (multi-module) |
| `skill_level`            | `VARCHAR(50)`   | NOT NULL, DEFAULT: 'beginner' | Enum: beginner, intermediate, advanced, expert           |
| `status`                 | `VARCHAR(50)`   | NOT NULL, DEFAULT: 'draft'    | Enum: draft, published, unpublished, archived            |
| `price`                  | `DECIMAL(10,2)` | NULL                          | Price in specified currency (null if free)               |
| `currency`               | `VARCHAR(3)`    | DEFAULT: 'USD'                | ISO 4217 currency code                                   |
| `is_free`                | `BOOLEAN`       | DEFAULT: FALSE                | Whether course is free                                   |
| `related_masterclass_id` | `UUID`          | FK → courses(id), NULL        | Link to related masterclass course                       |
| `language`               | `VARCHAR(10)`   | DEFAULT: 'en'                 | ISO 639-1 language code                                  |
| `interested_count`       | `INTEGER`       | DEFAULT: 0                    | Number of users interested (denormalized)                |
| `enrollment_count`       | `INTEGER`       | DEFAULT: 0                    | Number of enrolled users (denormalized)                  |
| `total_duration_seconds` | `INTEGER`       | DEFAULT: 0                    | Sum of all lesson durations (denormalized)               |
| `published_at`           | `TIMESTAMP`     | NULL                          | When course was first published                          |
| `created_at`             | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`    | Course creation timestamp                                |
| `updated_at`             | `TIMESTAMP`     | NOT NULL, DEFAULT: `now()`    | Last update timestamp                                    |

### Indexes for Courses Table

- Primary Key: `id`
- Unique Index: `(slug)` - for URL routing
- Index: `(instructor_id)` - find instructor's courses
- Index: `(category_id)` - browse by category
- Index: `(status)` - find published courses
- Index: `(skill_level)` - filter by difficulty
- Index: `(course_type)` - find masterclasses vs lessons
- Index: `(status, published_at)` - recent published courses
- Index: `(status, enrollment_count DESC)` - popular courses
- Partial Index: `(instructor_id, status)` WHERE `status IN ('draft', 'published')` - instructor's active courses

### Modules Table

Create table `modules`:

| Column                   | Type           | Constraints                | Description                            |
| ------------------------ | -------------- | -------------------------- | -------------------------------------- |
| `id`                     | `UUID`         | PK, Default: `uuid_v7()`   | Unique module identifier               |
| `course_id`              | `UUID`         | FK → courses(id), NOT NULL | Parent course                          |
| `title`                  | `VARCHAR(255)` | NOT NULL                   | Module title                           |
| `description`            | `TEXT`         | NULL                       | Module description                     |
| `sort_order`             | `INTEGER`      | NOT NULL, DEFAULT: 0       | Display order within course            |
| `total_duration_seconds` | `INTEGER`      | DEFAULT: 0                 | Sum of lesson durations (denormalized) |
| `created_at`             | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Module creation timestamp              |
| `updated_at`             | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp                  |

### Unique Constraint for Modules

- Composite unique index: `(course_id, sort_order)` - prevent sort order duplicates within course

### Indexes for Modules Table

- Primary Key: `id`
- Index: `(course_id)` - find course modules
- Index: `(course_id, sort_order)` - ordered module retrieval
- Index: `(created_at)` - for pagination

### Lessons Table

Create table `lessons`:

| Column             | Type           | Constraints                | Description                      |
| ------------------ | -------------- | -------------------------- | -------------------------------- |
| `id`               | `UUID`         | PK, Default: `uuid_v7()`   | Unique lesson identifier         |
| `module_id`        | `UUID`         | FK → modules(id), NOT NULL | Parent module                    |
| `title`            | `VARCHAR(255)` | NOT NULL                   | Lesson title                     |
| `description`      | `TEXT`         | NULL                       | Lesson description/notes         |
| `sort_order`       | `INTEGER`      | NOT NULL, DEFAULT: 0       | Display order within module      |
| `mux_asset_id`     | `VARCHAR(255)` | NULL                       | Mux video asset ID               |
| `mux_playback_id`  | `VARCHAR(255)` | NULL                       | Mux playback ID (for streaming)  |
| `duration_seconds` | `INTEGER`      | NOT NULL, DEFAULT: 0       | Video length in seconds          |
| `is_preview`       | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE   | Can non-enrolled users watch?    |
| `video_status`     | `VARCHAR(50)`  | DEFAULT: 'processing'      | Enum: processing, ready, failed  |
| `transcript`       | `TEXT`         | NULL                       | Video transcript/closed captions |
| `created_at`       | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Lesson creation timestamp        |
| `updated_at`       | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp            |

### Unique Constraint for Lessons

- Composite unique index: `(module_id, sort_order)` - prevent sort order duplicates within module

### Indexes for Lessons Table

- Primary Key: `id`
- Index: `(module_id)` - find module lessons
- Index: `(module_id, sort_order)` - ordered lesson retrieval
- Index: `(mux_asset_id)` - find lesson by Mux ID
- Index: `(is_preview)` - find preview lessons
- Index: `(video_status)` - find processing videos

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE course_type AS ENUM ('masterclass', 'lesson');
CREATE TYPE course_status AS ENUM ('draft', 'published', 'unpublished', 'archived');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE video_status AS ENUM ('processing', 'ready', 'failed');
```

### Drizzle Schema Definition

In `packages/db/src/schema/courses.ts`:

- Define `courses` table with all columns and constraints
- Define `modules` table with course foreign key
- Define `lessons` table with module foreign key
- Use `relations()` for:
  - courses ↔ modules (one-to-many)
  - modules ↔ lessons (one-to-many)
  - courses → users (via instructor_id)
  - courses → categories (via category_id)
  - courses → courses (self-reference for related_masterclass_id)
- Export relations for type-safe queries

## Database Tables

### courses

- **Purpose**: Top-level course information and metadata
- **Row estimate**: ~100K-1M courses (varies by platform maturity)
- **Key relationships**: 1:N with modules, N:1 with users (instructor), N:1 with categories

### modules

- **Purpose**: Logical grouping of lessons within courses
- **Row estimate**: ~300K-3M modules (avg 3-5 per course)
- **Key relationships**: 1:N with lessons, N:1 with courses

### lessons

- **Purpose**: Individual video lessons with Mux integration
- **Row estimate**: ~1M-10M lessons (avg 10 per module)
- **Key relationships**: N:1 with modules

## Acceptance Criteria

- [ ] `courses` table created with all required columns
- [ ] `modules` table created as child of courses
- [ ] `lessons` table created as child of modules
- [ ] Slug column is unique and auto-generated from title
- [ ] `course_type` enum enforces masterclass vs lesson
- [ ] `status` enum prevents invalid statuses
- [ ] `video_status` tracks Mux processing status
- [ ] Foreign keys prevent orphaned modules/lessons
- [ ] Unique constraints on (course_id, sort_order) prevent duplicates
- [ ] Indexes created for all query patterns
- [ ] `mux_asset_id` and `mux_playback_id` stored for Mux integration
- [ ] Denormalized counts (interested_count, enrollment_count) can be updated
- [ ] `related_masterclass_id` allows linking masterclass to course
- [ ] `is_preview` flag marks free preview lessons
- [ ] All timestamps use UTC timezone
- [ ] Test data with multiple courses, modules, and lessons
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables (for instructor foreign key)
- Task 07: Categories and Tags Tables (for category foreign key)
- Mux account with API credentials for video processing

## Technical Notes

### Slug Generation

- Auto-generate from title: lowercase, remove special chars, replace spaces with hyphens
- Examples: "Advanced Makeup Techniques" → "advanced-makeup-techniques"
- Unique constraint prevents slug collisions
- If slug exists, append number: "advanced-makeup-techniques-2"
- Store only for efficient URL routing

### Course Denormalization

- `interested_count` and `enrollment_count` are denormalized from enrollments table
- Update these columns via database triggers or application logic
- Use for sorting popular courses without expensive joins
- Consider caching if updates lag

### Mux Video Integration

- `mux_asset_id` returned by Mux API after upload
- `mux_playback_id` used to generate streaming URLs
- Example URL: `https://image.mux.com/{playback_id}/thumbnail.jpg`
- `duration_seconds` captured from Mux asset info
- `video_status` tracks upload/processing: processing → ready → (or failed)
- Webhook from Mux updates status when processing completes

### Course Statuses

- **draft** - Instructor editing, not visible to learners
- **published** - Live and visible to learners
- **unpublished** - Was published, now hidden (soft delete)
- **archived** - Old course, kept for record but not discoverable

### Masterclass vs. Lesson Courses

- **masterclass** - Single module, typically 1-5 lessons, focused topic
- **lesson** - Multi-module structure, comprehensive curriculum
- Same schema, different organizational approach
- `related_masterclass_id` can link masterclass to full course

### Preview Lessons

- Lessons with `is_preview = true` visible to non-enrolled users
- Typically first lesson of course
- Allows users to preview content before enrolling
- Combine with `status = 'published'` to make discoverable

### Transcript and Captions

- `transcript` field stores video transcript text
- Can be auto-generated by Mux or manually uploaded
- Enable search across course content (transcript search)
- Support multiple languages (use separate lessons or JSONB for multi-language)

### Sort Order Management

- `sort_order` field determines display order
- Unique constraint ensures no gaps or duplicates within module/course
- Reordering updates sort_order values
- Default 0 for new items; reassign on save

### Query Performance Tips

- Composite index (course_id, sort_order) enables ordered module retrieval with single index
- Filter published courses: `WHERE status = 'published'`
- Find instructor courses: `WHERE instructor_id = ? AND status IN ('draft', 'published')`
- Popular courses: `ORDER BY enrollment_count DESC LIMIT 10`

### Testing Considerations

- Test course creation with instructor
- Test module and lesson hierarchy
- Test slug uniqueness and generation
- Test sorting within modules
- Test preview lessons visible to non-enrolled users
- Test Mux asset ID storage and retrieval
- Test video status progression
- Test cascade delete (deleting course deletes modules and lessons)
- Test soft delete (unpublish vs. archive)

### Mux Webhook Integration

- Mux sends webhook when video processing completes
- Webhook handler updates `video_status` and `duration_seconds`
- Handle webhook failures with retry logic
- Store webhook signatures for security verification

### Content Search

- Index transcript field for full-text search
- Search courses by title, description, and lesson transcripts
- Consider separate search index (Elasticsearch) for scaling

### Course Recommendations

- Use enrollment_count for "popular courses"
- Use skill_level filter for "recommended for you"
- Combine with user interests and progress data
- Consider machine learning for personalized recommendations
