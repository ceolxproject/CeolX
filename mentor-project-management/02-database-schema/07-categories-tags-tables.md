# Task 7: Categories and Tags Tables

## Description

Create the taxonomy system for organizing courses using hierarchical categories and flexible tags. Categories provide the primary organizational structure with support for parent-child hierarchies (e.g., Makeup → Eye Makeup → Eyeshadow Techniques). Tags enable cross-cutting categorization for content discovery and filtering.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (category and tag endpoints)
- `apps/web-learner` (course browsing and filtering)
- `apps/web-mentor` (course creation and categorization)
- `apps/web-admin` (category and tag management)

## Requirements

### Categories Table

Create table `categories`:

| Column         | Type           | Constraints                | Description                                |
| -------------- | -------------- | -------------------------- | ------------------------------------------ |
| `id`           | `UUID`         | PK, Default: `uuid_v7()`   | Unique category identifier                 |
| `name`         | `VARCHAR(100)` | NOT NULL                   | Category name (e.g., "Makeup", "Skincare") |
| `slug`         | `VARCHAR(100)` | UNIQUE, NOT NULL           | URL-friendly slug                          |
| `description`  | `TEXT`         | NULL                       | Category description for display           |
| `icon_url`     | `TEXT`         | NULL                       | Category icon image (R2 URL)               |
| `banner_url`   | `TEXT`         | NULL                       | Category banner image (R2 URL)             |
| `parent_id`    | `UUID`         | FK → categories(id), NULL  | Parent category for hierarchy              |
| `sort_order`   | `INTEGER`      | NOT NULL, DEFAULT: 0       | Display order at each level                |
| `is_featured`  | `BOOLEAN`      | DEFAULT: FALSE             | Show in featured/prominent sections        |
| `color`        | `VARCHAR(7)`   | NULL                       | Hex color code for UI (e.g., "#FF6B9D")    |
| `course_count` | `INTEGER`      | DEFAULT: 0                 | Number of courses (denormalized)           |
| `created_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Category creation timestamp                |
| `updated_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp                      |

### Unique Constraint for Categories

- Composite unique index: `(parent_id, slug)` - unique slug within parent level

### Indexes for Categories Table

- Primary Key: `id`
- Unique Index: `(slug)` - for URL routing
- Index: `(parent_id)` - find subcategories
- Index: `(parent_id, sort_order)` - ordered subcategories
- Index: `(is_featured)` - find featured categories
- Index: `(sort_order)` - root level ordering

### Tags Table

Create table `tags`:

| Column         | Type          | Constraints                | Description                               |
| -------------- | ------------- | -------------------------- | ----------------------------------------- |
| `id`           | `UUID`        | PK, Default: `uuid_v7()`   | Unique tag identifier                     |
| `name`         | `VARCHAR(50)` | UNIQUE, NOT NULL           | Tag name (e.g., "cruelty-free", "vegan")  |
| `slug`         | `VARCHAR(50)` | UNIQUE, NOT NULL           | URL-friendly slug                         |
| `description`  | `TEXT`        | NULL                       | Tag description and use cases             |
| `color`        | `VARCHAR(7)`  | NULL                       | Hex color for UI display                  |
| `course_count` | `INTEGER`     | DEFAULT: 0                 | Number of courses with tag (denormalized) |
| `created_at`   | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()` | Tag creation timestamp                    |
| `updated_at`   | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()` | Last update timestamp                     |

### Indexes for Tags Table

- Primary Key: `id`
- Unique Index: `(name)` - prevent duplicate tags
- Unique Index: `(slug)` - for URL routing
- Index: `(course_count)` - for sorting by popularity

### Course-Categories Junction Table

Create table `course_categories`:

| Column        | Type        | Constraints                   | Description                 |
| ------------- | ----------- | ----------------------------- | --------------------------- |
| `id`          | `UUID`      | PK, Default: `uuid_v7()`      | Unique record identifier    |
| `course_id`   | `UUID`      | FK → courses(id), NOT NULL    | Course reference            |
| `category_id` | `UUID`      | FK → categories(id), NOT NULL | Category reference          |
| `is_primary`  | `BOOLEAN`   | DEFAULT: FALSE                | Primary category for course |
| `sort_order`  | `INTEGER`   | DEFAULT: 0                    | Display order of categories |
| `created_at`  | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`    | Assignment timestamp        |

### Unique Constraint for Course-Categories

- Composite unique index: `(course_id, category_id)` - prevent duplicate assignments

### Indexes for Course-Categories

- Primary Key: `id`
- Index: `(course_id)` - find course categories
- Index: `(category_id)` - find category courses
- Index: `(category_id, sort_order)` - ordered courses per category

### Course-Tags Junction Table

Create table `course_tags`:

| Column            | Type           | Constraints                | Description              |
| ----------------- | -------------- | -------------------------- | ------------------------ |
| `id`              | `UUID`         | PK, Default: `uuid_v7()`   | Unique record identifier |
| `course_id`       | `UUID`         | FK → courses(id), NOT NULL | Course reference         |
| `tag_id`          | `UUID`         | FK → tags(id), NOT NULL    | Tag reference            |
| `relevance_score` | `DECIMAL(3,2)` | DEFAULT: 1.0               | Tag relevance (0.0-1.0)  |
| `created_at`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Assignment timestamp     |

### Unique Constraint for Course-Tags

- Composite unique index: `(course_id, tag_id)` - prevent duplicate assignments

### Indexes for Course-Tags

- Primary Key: `id`
- Index: `(course_id)` - find course tags
- Index: `(tag_id)` - find tag courses
- Index: `(tag_id, relevance_score DESC)` - ranked tags per course

### Drizzle Schema Definition

In `packages/db/src/schema/categories.ts`:

- Define `categories` table with self-referential parent_id
- Define `tags` table with simple structure
- Define `courseCategories` junction table
- Define `courseTags` junction table
- Use `relations()` for:
  - categories ↔ categories (self-reference for parent-child)
  - categories ↔ courses (many-to-many via courseCategories)
  - courses ↔ tags (many-to-many via courseTags)
  - tags ↔ courses (inverse)
- Export relations for type-safe queries

## Database Tables

### categories

- **Purpose**: Hierarchical organization of courses
- **Row estimate**: ~100-500 categories (including subcategories)
- **Key relationships**: 1:N with categories (parent-child), N:N with courses

### tags

- **Purpose**: Flexible tagging system for cross-cutting concerns
- **Row estimate**: ~100-1000 tags (varies by content)
- **Key relationships**: N:N with courses

### course_categories

- **Purpose**: Many-to-many mapping of courses to categories
- **Row estimate**: ~200K-2M (avg 2-3 categories per course)
- **Key relationships**: N:1 with courses, N:1 with categories

### course_tags

- **Purpose**: Many-to-many mapping of courses to tags
- **Row estimate**: ~500K-5M (avg 5-10 tags per course)
- **Key relationships**: N:1 with courses, N:1 with tags

## Acceptance Criteria

- [ ] `categories` table created with hierarchical parent_id support
- [ ] `tags` table created with unique name and slug
- [ ] `course_categories` junction table created with primary flag
- [ ] `course_tags` junction table created with relevance_score
- [ ] Unique constraints on (parent_id, slug) for categories
- [ ] Unique constraints on (course_id, category_id) and (course_id, tag_id)
- [ ] All slug fields are properly indexed for routing
- [ ] Indexes on foreign keys for efficient joins
- [ ] Hierarchical category queries work (parent → children)
- [ ] Multiple categories per course supported (with is_primary flag)
- [ ] Tags support relevance scoring for ranking
- [ ] Featured categories highlighted for discovery
- [ ] Denormalized course_count can be updated via triggers or logic
- [ ] All timestamps use UTC timezone
- [ ] Test data with multi-level categories and diverse tags
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 06: Courses, Modules, and Lessons Tables

## Technical Notes

### Category Hierarchy Examples

```
Makeup (parent_id: NULL, sort_order: 1)
├── Eye Makeup (parent_id: makeup_id, sort_order: 1)
│   ├── Eyeshadow (parent_id: eye_makeup_id, sort_order: 1)
│   └── Eyeliner (parent_id: eye_makeup_id, sort_order: 2)
├── Face Makeup (parent_id: makeup_id, sort_order: 2)
└── Lip Makeup (parent_id: makeup_id, sort_order: 3)

Skincare (parent_id: NULL, sort_order: 2)
├── Acne Care (parent_id: skincare_id, sort_order: 1)
└── Anti-Aging (parent_id: skincare_id, sort_order: 2)
```

### Slug Generation

- Auto-generate from name: lowercase, remove special chars, replace spaces with hyphens
- Examples: "Eye Makeup" → "eye-makeup"
- Unique within parent level (allow same slug under different parents)
- If slug exists at level, append number: "eye-makeup-2"

### Primary Category Selection

- Each course should have primary category marked with `is_primary = true`
- Primary category used for breadcrumbs and main categorization
- Secondary categories for discovery and filtering
- Application should enforce single primary category per course

### Tags vs. Categories

- **Categories**: Hierarchical, mutually exclusive structure (course must belong to category)
- **Tags**: Flat, flexible labels (course can have multiple tags)
- Example categories: Makeup, Skincare, Haircare
- Example tags: vegan, cruelty-free, trending, best-seller, beginner-friendly

### Tag Examples for Mentor Platform

- Ingredient-based: cruelty-free, vegan, natural, organic
- Technique-level: beginner-friendly, advanced, step-by-step
- Product-based: makeup, skincare, hair
- Trend-based: trending, bestseller, new
- Business: business-owner-friendly, freelancer-tips
- Audience: men, women, teens, seniors

### Denormalized Counts

- `course_count` in categories and tags for ranking/sorting
- Update via database triggers or application logic
- Enables fast queries like "Top 10 most-used tags"
- Consider caching counts if updates are frequent

### Query Patterns

```typescript
// Get category with all subcategories
db.select()
  .from(categories)
  .where(or(eq(categories.id, categoryId), eq(categories.parentId, categoryId)))
  .orderBy(asc(categories.sortOrder));

// Get courses in category (including subcategories)
db.select()
  .from(courses)
  .innerJoin(courseCategories, eq(courses.id, courseCategories.courseId))
  .where(inArray(courseCategories.categoryId, [categoryId, ...subcategoryIds]));

// Get courses with specific tags
db.select()
  .from(courses)
  .innerJoin(courseTags, eq(courses.id, courseTags.courseId))
  .innerJoin(tags, eq(courseTags.tagId, tags.id))
  .where(inArray(courseTags.tagId, selectedTagIds));
```

### Featured Categories

- `is_featured` flag highlights categories on homepage/landing page
- Limit to 5-10 featured categories for UX clarity
- Admin can change featured categories without code changes
- Consider seasonal/temporal featuring (e.g., holiday makeup)

### Color Scheme

- Store hex color (e.g., "#FF6B9D") for visual category coding
- Use in UI for category badges, icons, filters
- Helps users recognize categories at a glance
- Can be used in charts and analytics visualizations

### Icon and Banner Management

- Store R2 URLs for category icons and banners
- Icons: Small (128x128px) for navigation/lists
- Banners: Large (1200x400px) for category landing pages
- Allow admins to upload icons via UI

### Sort Order Management

- Root categories sorted by `sort_order`
- Subcategories sorted independently within parent
- Reordering updates sort_order values
- Default 0 for new items; reassign on save

### Performance Optimization

- Use partial indexes for featured categories: `WHERE is_featured = true`
- Denormalize course_count for fast sorting/ranking
- Cache category hierarchy (often accessed, rarely changes)
- Consider materialized view for category with course counts

### Testing Considerations

- Test hierarchical category retrieval
- Test unique slug constraint within parent level
- Test primary category assignment
- Test multiple tags per course
- Test featured category filtering
- Test course count denormalization
- Test cascade delete (deleting category removes associations)
- Test slug generation and uniqueness
- Test color validation (valid hex format)

### Migration Strategy

Seed initial categories and tags during migration:

```sql
INSERT INTO categories (name, slug, sort_order, is_featured) VALUES
  ('Makeup', 'makeup', 1, true),
  ('Skincare', 'skincare', 2, true),
  ('Haircare', 'haircare', 3, false);

INSERT INTO tags (name, slug) VALUES
  ('cruelty-free', 'cruelty-free'),
  ('vegan', 'vegan'),
  ('trending', 'trending');
```

### Content Discovery

- Category-based browsing: Main navigation
- Tag-based filtering: Refine within category
- Combined queries: "Makeup courses with vegan tag"
- Consider full-text search on course title + description + tags

### Analytics and Reporting

- Track popular categories (by enrollment count)
- Track most-used tags (by course count)
- Monitor category growth over time
- Use for content strategy decisions
