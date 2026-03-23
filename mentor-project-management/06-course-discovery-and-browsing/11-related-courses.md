# Related Courses Feature

## Description

Implement a recommendation system that displays related courses on course detail pages and as carousel tiles on course cards. Related courses are determined by category similarity and same instructor. Single-lesson courses link to their parent masterclass if one exists. Related courses boost discoverability and increase engagement by promoting adjacent learning paths.

## Affected Apps/Packages

- `backend/api/hono` — GET /courses/:id/related endpoint
- `backend/db/migrations` — Course relationships (parent_course_id for single lessons)
- `apps/learner-web/components/RelatedCourses.tsx` — Web carousel
- `apps/learner-mobile/components/RelatedCoursesSection.tsx` — Mobile section
- `shared/types` — Course and RelatedCourse types

## Database Schema

### Courses Table Additions

```sql
ALTER TABLE courses ADD COLUMN parent_masterclass_id UUID REFERENCES courses(id);

-- Index for fast related course queries
CREATE INDEX idx_courses_category_id ON courses(category_id);
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_parent_masterclass_id ON courses(parent_masterclass_id);

-- Example: Single lesson course linking to masterclass
INSERT INTO courses (title, course_type, parent_masterclass_id, instructor_id, category_id)
VALUES
  ('Makeup Basics (Quick Lesson)', 'single_lesson', 'masterclass_uuid', 'instructor_uuid', 'category_uuid');
```

## Related Courses Algorithm

**Ranking Logic (priority order):**

1. **Same Instructor + Same Category** (highest priority)
   - Shows learner other courses by instructor in same category
   - Weight: 100%

2. **Same Category (different instructor)**
   - Expands learning in user's interested category
   - Weight: 80%

3. **Same Instructor (different category)**
   - Promotes instructor's other specializations
   - Weight: 60%

4. **Featured Courses (fallback)**
   - Generic recommendations if no related courses found
   - Weight: 40%

**Result limit:** Return top 6 courses per category (configurable)

**Exclusion:**

- Exclude the current course from results
- For single lessons: include parent masterclass in results

## API Endpoint

### GET /courses/:id/related

Retrieve related courses for a given course.

**Path Parameters:**

- `id` (string) — Course UUID

**Query Parameters:**

- `limit` (number, default: 6) — Max courses to return
- `locale` (string, default: "en") — Language locale

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "relatedCourses": [
      {
        "id": "uuid",
        "title": "Advanced Makeup Techniques",
        "slug": "advanced-makeup-techniques",
        "thumbnail_url": "https://...",
        "price": 29.99,
        "price_type": "paid",
        "instructor": {
          "id": "uuid",
          "name": "Sarah Brown"
        },
        "category": {
          "id": "uuid",
          "name": "Makeup"
        },
        "enrollment_count": 1234,
        "interested_count": 567,
        "difficulty": "intermediate",
        "reason": "same_instructor_category" // or: same_category, same_instructor, featured
      }
    ]
  }
}
```

**Caching:**

- Cache key: `related_courses:{course_id}:{limit}:{locale}`
- TTL: 24 hours (86400s) — Update when courses are published/unpublished
- Invalidate on course updates affecting category/instructor

**Implementation:**

```typescript
// backend/api/hono/routes/courses.ts
import { Hono } from "hono";
import { db, sql } from "@/db";
import { eq, ne, and, or } from "drizzle-orm";

const app = new Hono();

app.get("/courses/:id/related", async (c) => {
  const courseId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "6");
  const locale = c.req.query("locale") || "en";

  try {
    // Fetch the course
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
      with: { category: true, instructor: true },
    });

    if (!course) {
      return c.json({ success: false, error: "Course not found" }, 404);
    }

    // Query related courses using SQL ranking
    const relatedCourses = await db.execute(
      sql`
        WITH ranked_courses AS (
          SELECT
            c.*,
            CASE
              WHEN c.category_id = ${course.category_id} AND c.instructor_id = ${course.instructor_id} THEN 100
              WHEN c.category_id = ${course.category_id} THEN 80
              WHEN c.instructor_id = ${course.instructor_id} THEN 60
              WHEN c.is_featured = true THEN 40
              ELSE 0
            END AS relevance_score,
            CASE
              WHEN c.category_id = ${course.category_id} AND c.instructor_id = ${course.instructor_id} THEN 'same_instructor_category'
              WHEN c.category_id = ${course.category_id} THEN 'same_category'
              WHEN c.instructor_id = ${course.instructor_id} THEN 'same_instructor'
              ELSE 'featured'
            END AS reason
          FROM courses c
          WHERE
            c.id != ${courseId}
            AND c.is_published = true
            AND c.deleted_at IS NULL
        )
        SELECT * FROM ranked_courses
        WHERE relevance_score > 0
        ORDER BY relevance_score DESC, enrollment_count DESC
        LIMIT ${limit}
      `
    );

    // Format response with instructor and category details
    const formattedCourses = await Promise.all(
      relatedCourses.map(async (course) => {
        const instructor = await db.query.instructors.findFirst({
          where: eq(instructors.id, course.instructor_id),
        });

        const category = await db.query.categories.findFirst({
          where: eq(categories.id, course.category_id),
        });

        return {
          id: course.id,
          title: course.title,
          slug: course.slug,
          thumbnail_url: course.thumbnail_url,
          price: course.price,
          price_type: course.price_type,
          instructor: {
            id: instructor.id,
            name: instructor.name,
          },
          category: {
            id: category.id,
            name: category.name,
          },
          enrollment_count: course.enrollment_count,
          interested_count: course.interested_count,
          difficulty: course.difficulty,
          reason: course.reason,
        };
      })
    );

    return c.json({
      success: true,
      data: {
        relatedCourses: formattedCourses,
      },
    });
  } catch (error) {
    console.error("Related courses error:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
});

export default app;
```

## Web Implementation

### Related Courses Carousel Component

```typescript
// apps/learner-web/components/RelatedCourses.tsx
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CourseCard } from './CourseCard';
import styles from './RelatedCourses.module.css';

interface RelatedCourse {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string;
  price: number;
  price_type: 'free' | 'paid';
  instructor: { id: string; name: string };
  category: { id: string; name: string };
  enrollment_count: number;
  interested_count: number;
  difficulty: string;
  reason: string;
}

interface RelatedCoursesProps {
  courses: RelatedCourse[];
  title?: string;
}

export const RelatedCourses: React.FC<RelatedCoursesProps> = ({
  courses,
  title = 'Related Courses',
}) => {
  const [scrollPosition, setScrollPosition] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;

    const scrollAmount = 300;
    const newPosition =
      direction === 'left'
        ? scrollPosition - scrollAmount
        : scrollPosition + scrollAmount;

    containerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    });
    setScrollPosition(newPosition);
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.controls}>
          <button
            className={styles.scrollButton}
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            ◀
          </button>
          <button
            className={styles.scrollButton}
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            ▶
          </button>
        </div>
      </div>

      <div className={styles.carousel} ref={containerRef}>
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.slug}`}
            className={styles.cardWrapper}
          >
            <a className={styles.card}>
              <div className={styles.thumbnail}>
                <Image
                  src={course.thumbnail_url}
                  alt={course.title}
                  layout="fill"
                  objectFit="cover"
                />
              </div>
              <div className={styles.info}>
                <h3 className={styles.courseTitle}>{course.title}</h3>
                <p className={styles.instructorName}>
                  {course.instructor.name}
                </p>
                <div className={styles.metadata}>
                  <span className={styles.category}>{course.category.name}</span>
                  <span className={styles.price}>
                    {course.price_type === 'free'
                      ? 'FREE'
                      : `€${course.price.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </a>
          </Link>
        ))}
      </div>

      {/* Relation explanation */}
      <div className={styles.relationInfo}>
        <p className={styles.relationText}>
          Courses shown are related by instructor or category
        </p>
      </div>
    </section>
  );
};
```

### Styling

```css
/* apps/learner-web/components/RelatedCourses.module.css */

.container {
  margin-top: 40px;
  padding: 24px 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.controls {
  display: flex;
  gap: 8px;
}

.scrollButton {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e0e0e0;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 14px;
}

.scrollButton:hover {
  border-color: #ff6b9d;
  color: #ff6b9d;
}

.carousel {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}

.carousel::-webkit-scrollbar {
  height: 6px;
}

.carousel::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 3px;
}

.carousel::-webkit-scrollbar-thumb {
  background: #d0d0d0;
  border-radius: 3px;
}

.carousel::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.cardWrapper {
  flex-shrink: 0;
  width: 220px;
}

.card {
  display: block;
  text-decoration: none;
  color: inherit;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #f0f0f0;
}

.info {
  padding: 12px;
}

.courseTitle {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.instructorName {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px 0;
}

.metadata {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.category {
  color: #999;
}

.price {
  font-weight: 600;
  color: #ff6b9d;
}

.relationInfo {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  text-align: center;
}

.relationText {
  font-size: 12px;
  color: #999;
  margin: 0;
}

@media (max-width: 768px) {
  .title {
    font-size: 18px;
  }

  .cardWrapper {
    width: 180px;
  }

  .scrollButton {
    width: 32px;
    height: 32px;
  }
}
```

## Mobile Implementation

```typescript
// apps/learner-mobile/components/RelatedCoursesSection.tsx
import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { RelatedCourse } from '@/types';
import styles from './RelatedCoursesSection.styles';

interface RelatedCoursesSectionProps {
  courses: RelatedCourse[];
  onSelectCourse: (courseId: string) => void;
}

export const RelatedCoursesSection: React.FC<
  RelatedCoursesSectionProps
> = ({ courses, onSelectCourse }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Related Courses</Text>

      <FlatList
        data={courses}
        renderItem={({ item: course }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectCourse(course.id)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: course.thumbnail_url }}
              style={styles.thumbnail}
            />
            <View style={styles.content}>
              <Text style={styles.courseTitle} numberOfLines={2}>
                {course.title}
              </Text>
              <Text style={styles.instructorName} numberOfLines={1}>
                {course.instructor.name}
              </Text>
              <View style={styles.metadata}>
                <Text style={styles.category}>{course.category.name}</Text>
                <Text style={styles.price}>
                  {course.price_type === 'free'
                    ? 'FREE'
                    : `€${course.price.toFixed(2)}`}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
      />
    </View>
  );
};
```

## Single Lesson to Masterclass Linking

For single-lesson courses, prominently display the parent masterclass:

```typescript
// apps/learner-web/components/ParentMasterclassLink.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Course } from '@/types';
import styles from './ParentMasterclassLink.module.css';

interface ParentMasterclassLinkProps {
  parentCourse: Course;
}

export const ParentMasterclassLink: React.FC<
  ParentMasterclassLinkProps
> = ({ parentCourse }) => {
  return (
    <Link href={`/courses/${parentCourse.slug}`}>
      <a className={styles.container}>
        <div className={styles.thumbnail}>
          <Image
            src={parentCourse.thumbnail_url}
            alt={parentCourse.title}
            layout="fill"
            objectFit="cover"
          />
        </div>
        <div className={styles.content}>
          <p className={styles.label}>This is part of:</p>
          <h3 className={styles.title}>{parentCourse.title}</h3>
          <p className={styles.subtitle}>
            Enroll in the complete masterclass
          </p>
        </div>
        <span className={styles.arrow}>→</span>
      </a>
    </Link>
  );
};
```

## Acceptance Criteria

- [ ] GET /courses/:id/related endpoint returns up to 6 related courses
- [ ] Related courses ranked by relevance: same instructor + category highest
- [ ] Same category (different instructor) weighted 80%
- [ ] Same instructor (different category) weighted 60%
- [ ] Featured courses fallback if no related courses 40%
- [ ] Current course excluded from results
- [ ] Related courses cache TTL 24 hours
- [ ] Cache invalidates on course publish/unpublish/update
- [ ] Web carousel displays 6 courses horizontally
- [ ] Web carousel scroll left/right buttons work
- [ ] Web carousel smooth scroll behavior
- [ ] Mobile horizontal scroll works with FlatList
- [ ] Course cards show thumbnail, title, instructor, category, price
- [ ] Click on related course navigates to detail page
- [ ] Single lesson courses show parent masterclass prominently
- [ ] Parent masterclass link includes CTA "Enroll in complete masterclass"
- [ ] Related courses display with "reason" tag (same instructor, category, etc.)
- [ ] Performance: related courses load < 500ms
- [ ] Related courses section visible on course detail page
- [ ] Related courses section on both web and mobile
- [ ] No console errors or warnings
- [ ] Mobile responsive: cards fit horizontal scroll
- [ ] Keyboard navigation works: Tab through carousel links
- [ ] Accessibility: alt text on all images

## Dependencies

- `next/image` (web) — Image optimization
- `react-native` (mobile) — FlatList, Image component
- `drizzle-orm` — Database ORM for SQL queries
- Backend: Database with course relationships

## Technical Notes

- Use SQL window functions for efficient ranking
- Implement caching to avoid repeated ranking calculations
- For performance: pre-calculate related courses on course publish
- Monitor: ensure no slow queries on get related courses
- Single lesson: always include parent masterclass in UI
- Related courses boost discovery: aim for 15-20% CTR on related links
- Analytics: track which related courses users click most
- A/B test: carousel vs grid layout for related courses (v2+)
- Consider "More from this instructor" vs "More in this category" tabs (v2+)
- Personalization (v2+): weight by user's category preferences
- Cold start (v2+): use featured/trending courses until enough data
- Monitor related course conversions: are they leading to enrollments?
