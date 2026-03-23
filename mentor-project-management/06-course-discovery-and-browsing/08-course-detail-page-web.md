# Course Detail Page - Learner Web

## Description

Implement a comprehensive course detail page for Learner Web (Next.js) with server-side rendering for SEO. The page includes hero section with course information, curriculum accordion (modules/lessons), course metadata (What You'll Learn, Requirements), instructor profile with link to other courses, related courses carousel, interested count with toggle button, and enrollment count. All content optimized for search engines with dynamic meta tags and structured data.

## Affected Apps/Packages

- `apps/learner-web/pages/[locale]/courses/[slug].tsx` — Course detail page
- `apps/learner-web/components/CourseHero.tsx` — Hero section
- `apps/learner-web/components/CurriculumAccordion.tsx` — Modules/lessons
- `apps/learner-web/components/InstructorCard.tsx` — Instructor info
- `apps/learner-web/components/RelatedCourses.tsx` — Related carousel
- `backend/api/hono` — GET /courses/:id endpoint
- `shared/types` — Course detail types

## Page Layout

### Full Page Structure

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (Navigation, Logo, Search)                       │
├─────────────────────────────────────────────────────────┤
│ HERO SECTION                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Thumbnail (16:9)  │  Course Title                   │ │
│ │                   │  Instructor + Avatar            │ │
│ │                   │  Students | Interested          │ │
│ │                   │  Category Badge                 │ │
│ │                   │  €29.99 | Paid                 │ │
│ │                   │  ┌──────────────┐               │ │
│ │                   │  │ Enroll Now   │               │ │
│ │                   │  └──────────────┘               │ │
│ │                   │  ❤️ 567 interested             │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ MAIN CONTENT (2-Column Grid)                            │
│ ┌───────────────────────────────┬─────────────────────┐ │
│ │ LEFT COLUMN (80%)             │ RIGHT COLUMN (20%)  │ │
│ │                               │                     │ │
│ │ Description                   │ Course Stats        │ │
│ │ ...                           │ • 8 lessons         │ │
│ │                               │ • 2h 15m duration   │ │
│ │ What You'll Learn             │ • Beginner level    │ │
│ │ • Skill 1                     │ • 1,234 enrolled    │ │
│ │ • Skill 2                     │                     │ │
│ │ ...                           │ Related Courses     │ │
│ │                               │ [Carousel]          │ │
│ │ Requirements                  │                     │ │
│ │ • Requirement 1               │                     │ │
│ │ • Requirement 2               │                     │ │
│ │                               │                     │ │
│ │ Curriculum                    │                     │ │
│ │ ┌─────────────────────────┐  │                     │ │
│ │ │ Module 1: Foundations   │  │                     │ │
│ │ │ [▼] 3 lessons, 45 min   │  │                     │ │
│ │ │  ├─ Lesson 1: Intro...  │  │                     │ │
│ │ │  ├─ Lesson 2: Basics... │  │                     │ │
│ │ │  └─ Lesson 3: Tools...  │  │                     │ │
│ │ │                         │  │                     │ │
│ │ │ Module 2: Techniques    │  │                     │ │
│ │ │ [►] 4 lessons, 60 min   │  │                     │ │
│ │ │                         │  │                     │ │
│ │ └─────────────────────────┘  │                     │ │
│ │                               │                     │ │
│ │ Instructor Profile            │                     │ │
│ │ ┌─────────────────────────┐  │                     │ │
│ │ │ Avatar (64x64)          │  │                     │ │
│ │ │ Name                    │  │                     │ │
│ │ │ Bio (max 200 chars)     │  │                     │ │
│ │ │ Specialization          │  │                     │ │
│ │ │ [View Other Courses]    │  │                     │ │
│ │ └─────────────────────────┘  │                     │ │
│ └───────────────────────────────┴─────────────────────┘ │
│                                                          │
│ FOOTER                                                   │
└─────────────────────────────────────────────────────────┘
```

## Page Implementation

### Next.js Page File

```typescript
// apps/learner-web/pages/[locale]/courses/[slug].tsx
import { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { CourseHero } from '@/components/CourseHero';
import { CurriculumAccordion } from '@/components/CurriculumAccordion';
import { InstructorCard } from '@/components/InstructorCard';
import { RelatedCourses } from '@/components/RelatedCourses';
import { getCourseBySlug, getRelatedCourses } from '@/api/courses';
import { Course, RelatedCourse } from '@/types';
import styles from '@/styles/courseDetail.module.css';

interface CourseDetailPageProps {
  course: Course;
  relatedCourses: RelatedCourse[];
}

export default function CourseDetailPage({
  course,
  relatedCourses,
}: CourseDetailPageProps) {
  const router = useRouter();
  const [isInterested, setIsInterested] = useState(false);

  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>{course.title} | Mentor - Mentor</title>
        <meta name="description" content={course.description} />
        <meta property="og:title" content={course.title} />
        <meta property="og:description" content={course.description} />
        <meta property="og:image" content={course.thumbnail_url} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`https://mentor.example.com/${router.asPath}`} />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Course',
              name: course.title,
              description: course.description,
              provider: {
                '@type': 'Organization',
                name: 'Mentor',
                sameAs: 'https://mentor.example.com',
              },
              instructor: {
                '@type': 'Person',
                name: course.instructor.name,
              },
              image: course.thumbnail_url,
              price: course.price,
              priceCurrency: 'EUR',
              offers: {
                '@type': 'Offer',
                url: `https://mentor.example.com/${router.asPath}`,
                priceCurrency: 'EUR',
                price: course.price,
                availability: 'https://schema.org/InStock',
              },
            }),
          }}
        />
      </Head>

      <main className={styles.container}>
        {/* Hero Section */}
        <CourseHero
          course={course}
          isInterested={isInterested}
          onInterestedChange={setIsInterested}
        />

        {/* Main Content */}
        <div className={styles.mainContent}>
          <div className={styles.leftColumn}>
            {/* Description */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>About This Course</h2>
              <p className={styles.description}>{course.description}</p>
            </section>

            {/* What You'll Learn */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>What You'll Learn</h2>
              <ul className={styles.list}>
                {course.what_you_learn.map((item, idx) => (
                  <li key={idx} className={styles.listItem}>
                    <span className={styles.listIcon}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {/* Requirements */}
            {course.requirements.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Requirements</h2>
                <ul className={styles.list}>
                  {course.requirements.map((item, idx) => (
                    <li key={idx} className={styles.listItem}>
                      <span className={styles.listIcon}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Curriculum */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Curriculum</h2>
              <CurriculumAccordion modules={course.modules} />
            </section>

            {/* Instructor Profile */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>About the Instructor</h2>
              <InstructorCard
                instructor={course.instructor}
                otherCoursesCount={course.instructor.other_courses_count}
              />
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className={styles.rightColumn}>
            {/* Course Stats */}
            <div className={styles.statsCard}>
              <h3 className={styles.statsTitle}>Course Details</h3>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Duration</span>
                <span className={styles.statValue}>
                  {Math.floor(course.duration_minutes / 60)}h{' '}
                  {course.duration_minutes % 60}m
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Lessons</span>
                <span className={styles.statValue}>{course.lesson_count}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Level</span>
                <span className={styles.statValue}>
                  {course.difficulty.charAt(0).toUpperCase() +
                    course.difficulty.slice(1)}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Students</span>
                <span className={styles.statValue}>
                  {course.enrollment_count.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Related Courses */}
            {relatedCourses.length > 0 && (
              <div className={styles.relatedCard}>
                <h3 className={styles.relatedTitle}>Related Courses</h3>
                <RelatedCourses courses={relatedCourses} />
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

// Static generation with revalidation
export const getStaticProps: GetStaticProps<CourseDetailPageProps> = async ({
  params,
  locale,
}) => {
  try {
    const course = await getCourseBySlug(params?.slug as string, locale);
    const relatedCourses = await getRelatedCourses(course.id, 6);

    return {
      props: { course, relatedCourses },
      revalidate: 60 * 60, // Revalidate every hour
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Fetch top 100 courses for static generation
  const courses = await getTopCourses(100);

  const paths = courses.flatMap((course) =>
    ['en', 'es', 'fr', 'ru'].map((locale) => ({
      params: { locale, slug: course.slug },
    }))
  );

  return {
    paths,
    fallback: 'blocking', // Generate missing paths on demand
  };
};
```

## Hero Section Component

```typescript
// apps/learner-web/components/CourseHero.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import { Course } from '@/types';
import styles from './CourseHero.module.css';

interface CourseHeroProps {
  course: Course;
  isInterested: boolean;
  onInterestedChange: (isInterested: boolean) => void;
}

export const CourseHero: React.FC<CourseHeroProps> = ({
  course,
  isInterested,
  onInterestedChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleInterestedToggle = async () => {
    setIsLoading(true);
    try {
      await fetch(`/api/v1/courses/${course.id}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interested: !isInterested }),
      });
      onInterestedChange(!isInterested);
    } catch (error) {
      console.error('Failed to update interest:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.thumbnail}>
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            priority
            style={{ objectFit: 'cover' }}
          />
        </div>

        <div className={styles.content}>
          <h1 className={styles.title}>{course.title}</h1>

          <div className={styles.instructor}>
            <Image
              src={course.instructor.avatar_url}
              alt={course.instructor.name}
              width={40}
              height={40}
              className={styles.instructorAvatar}
            />
            <div>
              <p className={styles.instructorName}>{course.instructor.name}</p>
              <p className={styles.instructorSpec}>
                {course.instructor.specialization}
              </p>
            </div>
          </div>

          <div className={styles.metadata}>
            <span className={styles.category}>{course.category.name}</span>
            <span className={styles.typeTag}>{course.course_type}</span>
            <span className={styles.level}>{course.difficulty}</span>
          </div>

          <div className={styles.price}>
            {course.price_type === 'free' ? (
              <span className={styles.freeBadge}>FREE</span>
            ) : (
              <span className={styles.priceBadge}>€{course.price.toFixed(2)}</span>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.enrollButton}>
              {course.price_type === 'free' ? 'Start Learning' : 'Enroll Now'}
            </button>

            <button
              className={`${styles.interestedButton} ${
                isInterested ? styles.active : ''
              }`}
              onClick={handleInterestedToggle}
              disabled={isLoading}
            >
              <span className={styles.heart}>{isInterested ? '❤️' : '🤍'}</span>
              {course.interested_count + (isInterested ? 1 : 0)} interested
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
```

## Curriculum Accordion Component

```typescript
// apps/learner-web/components/CurriculumAccordion.tsx
import React, { useState } from 'react';
import { Module } from '@/types';
import styles from './CurriculumAccordion.module.css';

interface CurriculumAccordionProps {
  modules: Module[];
}

export const CurriculumAccordion: React.FC<CurriculumAccordionProps> = ({
  modules,
}) => {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(
    modules[0]?.id || null
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModuleId(
      expandedModuleId === moduleId ? null : moduleId
    );
  };

  return (
    <div className={styles.accordion}>
      {modules.map((module) => (
        <div key={module.id} className={styles.module}>
          <button
            className={styles.moduleHeader}
            onClick={() => toggleModule(module.id)}
          >
            <span className={styles.expandIcon}>
              {expandedModuleId === module.id ? '▼' : '▶'}
            </span>
            <div className={styles.moduleInfo}>
              <h4 className={styles.moduleName}>{module.title}</h4>
              <p className={styles.moduleMeta}>
                {module.lessons.length} lessons • {module.duration_minutes} min
              </p>
            </div>
          </button>

          {expandedModuleId === module.id && (
            <div className={styles.moduleLessons}>
              {module.lessons.map((lesson, idx) => (
                <div key={lesson.id} className={styles.lesson}>
                  <span className={styles.lessonNumber}>{idx + 1}</span>
                  <div className={styles.lessonInfo}>
                    <p className={styles.lessonTitle}>{lesson.title}</p>
                    <p className={styles.lessonDuration}>
                      {lesson.duration_minutes} min
                    </p>
                  </div>
                  {lesson.is_free_preview && (
                    <span className={styles.previewBadge}>Preview</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

## Instructor Card Component

```typescript
// apps/learner-web/components/InstructorCard.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Instructor } from '@/types';
import styles from './InstructorCard.module.css';

interface InstructorCardProps {
  instructor: Instructor & { other_courses_count: number };
}

export const InstructorCard: React.FC<InstructorCardProps> = ({
  instructor,
}) => {
  return (
    <div className={styles.card}>
      <Image
        src={instructor.avatar_url}
        alt={instructor.name}
        width={80}
        height={80}
        className={styles.avatar}
      />

      <div className={styles.info}>
        <h3 className={styles.name}>{instructor.name}</h3>
        <p className={styles.specialization}>{instructor.specialization}</p>
        <p className={styles.bio}>{instructor.bio}</p>

        <Link
          href={`/instructor/${instructor.id}`}
          className={styles.link}
        >
          View All Courses ({instructor.other_courses_count})
        </Link>
      </div>
    </div>
  );
};
```

## Styling

```css
/* apps/learner-web/styles/courseDetail.module.css */

.container {
  min-height: 100vh;
  background: white;
}

.mainContent {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 40px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.leftColumn {
  min-width: 0;
}

.rightColumn {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  margin-bottom: 40px;
}

.sectionTitle {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.description {
  font-size: 16px;
  line-height: 1.6;
  color: #666;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.listItem {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 15px;
  color: #555;
}

.listIcon {
  flex-shrink: 0;
  color: #27ae60;
  font-weight: bold;
}

.statsCard,
.relatedCard {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
}

.statsTitle,
.relatedTitle {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
}

.statItem {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}

.statItem:last-child {
  border-bottom: none;
}

.statLabel {
  font-size: 14px;
  color: #666;
}

.statValue {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* Responsive */
@media (max-width: 1024px) {
  .mainContent {
    grid-template-columns: 1fr;
  }

  .rightColumn {
    order: -1; /* Move to top */
  }
}

@media (max-width: 768px) {
  .mainContent {
    padding: 20px;
    gap: 24px;
  }

  .sectionTitle {
    font-size: 18px;
  }

  .description {
    font-size: 15px;
  }
}
```

## SEO Meta Tags

**Dynamic meta tags generated on server:**

- Title: "{course.title} | Mentor - Mentor"
- Description: Course description (max 160 chars)
- OG Image: Course thumbnail URL
- Canonical: Absolute URL to course detail page
- Structured Data: Course schema (JSON-LD)

## Acceptance Criteria

- [ ] Course detail page renders with SSG/SSR
- [ ] Hero section displays thumbnail, title, instructor, price, CTA button
- [ ] Course description renders fully
- [ ] What You'll Learn section shows as bullet list
- [ ] Requirements section shows if courses has requirements
- [ ] Curriculum accordion shows all modules with lesson count
- [ ] Curriculum modules are expandable/collapsible
- [ ] Lessons show duration and preview badge (if applicable)
- [ ] Instructor card shows avatar, name, bio, specialization
- [ ] "View All Courses" link navigates to instructor profile page
- [ ] Related courses carousel shows 4-6 related courses
- [ ] Interested button toggles state and updates count
- [ ] Interested button shows optimistic UI (immediate visual feedback)
- [ ] Enrollment count displayed in right sidebar
- [ ] Course stats (duration, lessons, level, students) visible
- [ ] Responsive layout: 2-col desktop, 1-col tablet/mobile
- [ ] Images lazy-loaded and optimized with Next.js Image
- [ ] Meta title and description set dynamically
- [ ] OG image set for social sharing
- [ ] Canonical URL prevents duplicate indexing
- [ ] JSON-LD Course schema rendered
- [ ] Page pre-rendered for top 100 courses (SSG)
- [ ] Missing courses return 404 page
- [ ] Performance: page load < 3s (Core Web Vitals)
- [ ] Mobile responsive: iPhone SE, Android phones
- [ ] Desktop responsive: 1920px wide screens
- [ ] No console errors or warnings
- [ ] Keyboard navigation works: Tab through links, buttons

## Dependencies

- `next` (v14+) — Framework with SSR/SSG, Image optimization
- `react` (18+) — UI library
- `react-query` / `swr` — API data fetching
- `axios` / `fetch` — HTTP client

## Technical Notes

- Use Next.js Image component for all images (optimization, responsive)
- Implement incremental static regeneration (ISR): revalidate every 60 minutes
- Generate static pages for top 100 courses, fallback to blocking SSR
- Course detail page uses `getStaticProps` and `getStaticPaths`
- Interested count updates must be optimistic (no loading state)
- Curriculum accordion expands first module by default for better UX
- Price always displayed with currency symbol (€)
- Free courses show "FREE" badge in green (#27ae60)
- Paid courses show price in pink (#ff6b9d)
- Ensure all links are internal navigation (Next.js Link component)
- Test Lighthouse score: target 90+ for Performance, SEO
- Monitor Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- Error handling: graceful fallback if course not found (404 page)
- Implement breadcrumb navigation for better UX
- Consider instructor bio word limit: max 200 characters
