# SEO Landing Pages Implementation

## Description

Implement SEO-optimized landing pages for Learner Web using Next.js SSR/SSG. This includes dynamic meta tags (title, description, OG image), structured data (Course JSON-LD schema), sitemap generation, and URL-based locale routing. Landing pages cover course catalog, category pages, instructor profiles, and course detail pages. All pages optimized for search engine visibility and social sharing.

## Affected Apps/Packages

- `apps/learner-web` — Next.js pages with SSR/SSG
- `apps/learner-web/pages/sitemap.xml.ts` — Dynamic sitemap
- `apps/learner-web/pages/robots.txt.ts` — robots.txt generation
- `apps/learner-web/middleware.ts` — Locale routing middleware
- `apps/learner-web/utils/seo.ts` — SEO helpers
- `backend/api/hono` — API endpoints for page data

## Supported Locales

URL-based routing with ISO 639-1 language codes:

- `/en/` — English (default)
- `/es/` — Spanish (Español)
- `/fr/` — French (Français)
- `/ru/` — Russian (Русский)

**Page Structure:**

```
/en/courses → English course catalog
/es/cursos → Spanish course catalog (translated)
/fr/cours → French course catalog
/ru/курсы → Russian course catalog
```

## Page Types and Implementations

### 1. Course Catalog Landing Page

**URL:** `/[locale]/courses`

**Meta Tags:**

```html
<title>Learn Makeup, Skincare & Beauty - Mentor by Mentor</title>
<meta
  name="description"
  content="Discover online beauty courses from expert instructors. Learn makeup, skincare, haircare and more at your own pace."
/>
<meta
  property="og:title"
  content="Learn Makeup, Skincare & Beauty - Mentor by Mentor"
/>
<meta
  property="og:description"
  content="Discover online beauty courses from expert instructors."
/>
<meta
  property="og:image"
  content="https://mentor.example.com/images/og-courses.jpg"
/>
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Learn Makeup, Skincare & Beauty" />
<meta name="twitter:description" content="Discover online beauty courses" />
<meta
  name="twitter:image"
  content="https://mentor.example.com/images/og-courses.jpg"
/>
<link rel="canonical" href="https://mentor.example.com/en/courses" />
```

**Structured Data (JSON-LD):**

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Online Beauty Courses",
  "description": "Discover online beauty courses from expert instructors",
  "url": "https://mentor.example.com/en/courses",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Mentor by Mentor",
    "url": "https://mentor.example.com"
  },
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "Course",
        "position": 1,
        "name": "Course Title",
        "description": "Course description",
        "url": "https://mentor.example.com/en/courses/course-slug",
        "image": "https://...",
        "provider": {
          "@type": "Organization",
          "name": "Mentor"
        }
      }
    ]
  }
}
```

**Implementation:**

```typescript
// apps/learner-web/pages/[locale]/courses/index.tsx
import { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import { CourseCatalog } from '@/components/CourseCatalog';
import { getCourses } from '@/api/courses';
import { Course } from '@/types';

interface CourseCatalogPageProps {
  courses: Course[];
}

export default function CourseCatalogPage({ courses }: CourseCatalogPageProps) {
  const canonicalUrl = `https://mentor.example.com/en/courses`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Online Beauty Courses',
    description: 'Discover online beauty courses from expert instructors',
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Mentor by Mentor',
      url: 'https://mentor.example.com',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: courses.slice(0, 20).map((course, idx) => ({
        '@type': 'Course',
        position: idx + 1,
        name: course.title,
        description: course.description,
        url: `https://mentor.example.com/en/courses/${course.slug}`,
        image: course.thumbnail_url,
        provider: {
          '@type': 'Organization',
          name: 'Mentor',
        },
      })),
    },
  };

  return (
    <>
      <Head>
        <title>Learn Makeup, Skincare & Beauty - Mentor by Mentor</title>
        <meta
          name="description"
          content="Discover online beauty courses from expert instructors. Learn makeup, skincare, haircare and more at your own pace."
        />
        <meta property="og:title" content="Learn Makeup, Skincare & Beauty" />
        <meta
          property="og:description"
          content="Discover online beauty courses from expert instructors."
        />
        <meta
          property="og:image"
          content="https://mentor.example.com/images/og-courses.jpg"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Learn Makeup, Skincare & Beauty" />
        <meta name="twitter:image" content="https://mentor.example.com/images/og-courses.jpg" />
        <link rel="canonical" href={canonicalUrl} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </Head>

      <CourseCatalog courses={courses} />
    </>
  );
}

export const getStaticProps: GetStaticProps<CourseCatalogPageProps> = async ({
  locale,
}) => {
  try {
    const courses = await getCourses({ locale, limit: 100, page: 1 });

    return {
      props: { courses },
      revalidate: 3600, // Revalidate every hour
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  const locales = ['en', 'es', 'fr', 'ru'];

  return {
    paths: locales.map((locale) => ({ params: { locale }, locale })),
    fallback: 'blocking',
  };
};
```

### 2. Category Landing Pages

**URL:** `/[locale]/courses/category/[slug]`

**Meta Tags (dynamic per category):**

```html
<title>Makeup Courses - Learn from Experts | Mentor</title>
<meta
  name="description"
  content="Browse 45 makeup courses from professional instructors. Learn techniques, tips and tricks from industry experts."
/>
<link
  rel="canonical"
  href="https://mentor.example.com/en/courses/category/makeup"
/>
```

**Implementation:**

```typescript
// apps/learner-web/pages/[locale]/courses/category/[slug].tsx
import { GetStaticProps, GetStaticPaths } from 'next';
import Head from 'next/head';
import { CourseCatalog } from '@/components/CourseCatalog';
import { getCategory, getCoursesByCategory } from '@/api/courses';
import { Category, Course } from '@/types';

interface CategoryPageProps {
  category: Category;
  courses: Course[];
}

export default function CategoryPage({ category, courses }: CategoryPageProps) {
  const canonicalUrl = `https://mentor.example.com/en/courses/category/${category.slug}`;

  const title = `${category.name} Courses - Learn from Experts | Mentor`;
  const description = `Browse ${courses.length} ${category.name.toLowerCase()} courses from professional instructors. Learn techniques and tips from industry experts.`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} Courses`,
    description,
    url: canonicalUrl,
    about: {
      '@type': 'Thing',
      name: category.name,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: courses.slice(0, 20).map((course, idx) => ({
        '@type': 'Course',
        position: idx + 1,
        name: course.title,
        description: course.description,
        url: `https://mentor.example.com/en/courses/${course.slug}`,
        image: course.thumbnail_url,
      })),
    },
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </Head>

      <CourseCatalog courses={courses} category={category} />
    </>
  );
}

export const getStaticProps: GetStaticProps<CategoryPageProps> = async ({
  params,
  locale,
}) => {
  try {
    const slug = params?.slug as string;
    const category = await getCategory(slug, locale);
    const courses = await getCoursesByCategory(category.id, { limit: 100, locale });

    return {
      props: { category, courses },
      revalidate: 3600,
    };
  } catch (error) {
    return { notFound: true };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Fetch all categories
  const categories = await getAllCategories();
  const locales = ['en', 'es', 'fr', 'ru'];

  const paths = categories.flatMap((category) =>
    locales.map((locale) => ({
      params: { locale, slug: category.slug },
    }))
  );

  return {
    paths,
    fallback: 'blocking',
  };
};
```

### 3. Course Detail Pages

**URL:** `/[locale]/courses/[slug]`

**Meta Tags (dynamic per course):**

```html
<title>Advanced Makeup Techniques - Learn from Sarah Brown | Mentor</title>
<meta
  name="description"
  content="Master professional makeup techniques in this comprehensive course. Includes 8 lessons, 2+ hours of video content. Taught by makeup artist Sarah Brown."
/>
<meta property="og:title" content="Advanced Makeup Techniques" />
<meta
  property="og:description"
  content="Master professional makeup techniques..."
/>
<meta property="og:image" content="https://...course-thumbnail.jpg" />
<link
  rel="canonical"
  href="https://mentor.example.com/en/courses/advanced-makeup-techniques"
/>
```

**Structured Data (Course schema):**

```json
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Advanced Makeup Techniques",
  "description": "Master professional makeup techniques...",
  "url": "https://mentor.example.com/en/courses/advanced-makeup-techniques",
  "image": "https://...",
  "provider": {
    "@type": "Organization",
    "name": "Mentor",
    "url": "https://mentor.example.com"
  },
  "instructor": {
    "@type": "Person",
    "name": "Sarah Brown",
    "url": "https://mentor.example.com/en/instructor/sarah-brown"
  },
  "price": "29.99",
  "priceCurrency": "EUR",
  "coursePrerequisites": "Basic makeup knowledge",
  "offers": {
    "@type": "Offer",
    "url": "https://mentor.example.com/en/courses/advanced-makeup-techniques",
    "price": "29.99",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
}
```

(See 08-course-detail-page-web.md for full implementation)

### 4. Instructor Profile Pages

**URL:** `/[locale]/instructor/[slug]`

**Meta Tags:**

```html
<title>Sarah Brown - Makeup Artist & Instructor | Mentor</title>
<meta
  name="description"
  content="Learn makeup from Sarah Brown, professional makeup artist with 12 years of experience. 5 courses available."
/>
<link
  rel="canonical"
  href="https://mentor.example.com/en/instructor/sarah-brown"
/>
```

**Structured Data (Person schema):**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Sarah Brown",
  "url": "https://mentor.example.com/en/instructor/sarah-brown",
  "image": "https://...",
  "jobTitle": "Makeup Artist",
  "description": "Professional makeup artist...",
  "worksFor": {
    "@type": "Organization",
    "name": "Mentor"
  }
}
```

## Next.js Configuration for SEO

### next.config.js

```javascript
// apps/learner-web/next.config.js
module.exports = {
  i18n: {
    locales: ["en", "es", "fr", "ru"],
    defaultLocale: "en",
    localeDetection: true,
  },
  images: {
    domains: ["cdn.mentor.example.com"],
    formats: ["image/avif", "image/webp"],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Robots-Tag",
          value: "index, follow",
        },
      ],
    },
  ],
};
```

## Sitemap Generation

### Dynamic Sitemap XML

```typescript
// apps/learner-web/pages/sitemap.xml.ts
import { GetServerSideProps } from "next";

function generateSiteMap(
  courses: any[],
  categories: any[],
  instructors: any[]
) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://mentor.example.com/en</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
      </url>
      ${["en", "es", "fr", "ru"]
        .map(
          (locale) => `
      <url>
        <loc>https://mentor.example.com/${locale}/courses</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
      </url>
      `
        )
        .join("")}
      ${categories
        .flatMap((category) =>
          ["en", "es", "fr", "ru"].map(
            (locale) => `
      <url>
        <loc>https://mentor.example.com/${locale}/courses/category/${category.slug}</loc>
        <lastmod>${new Date(category.updated_at).toISOString()}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
      </url>
      `
          )
        )
        .join("")}
      ${courses
        .flatMap((course) =>
          ["en", "es", "fr", "ru"].map(
            (locale) => `
      <url>
        <loc>https://mentor.example.com/${locale}/courses/${course.slug}</loc>
        <lastmod>${new Date(course.updated_at).toISOString()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>
      `
          )
        )
        .join("")}
    </urlset>`;
}

export async function getServerSideProps({ res }: GetServerSideProps) {
  try {
    // Fetch all courses and categories
    const [courses, categories] = await Promise.all([
      getCourses({ limit: 10000 }),
      getCategories(),
    ]);

    const sitemap = generateSiteMap(courses, categories, []);

    res.setHeader("Content-Type", "text/xml");
    res.write(sitemap);
    res.end();

    return {
      props: {},
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
}

// Empty component (sitemap.xml has no visual output)
export default function Sitemap() {
  return null;
}
```

## Robots.txt

```typescript
// apps/learner-web/pages/robots.txt.ts
export async function getServerSideProps({ res }) {
  const robots = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://mentor.example.com/sitemap.xml

User-agent: Googlebot
Allow: /
Crawl-delay: 0

User-agent: Bingbot
Allow: /
Crawl-delay: 1`;

  res.setHeader("Content-Type", "text/plain");
  res.write(robots);
  res.end();

  return {
    props: {},
  };
}

export default function Robots() {
  return null;
}
```

## Locale Routing Middleware

```typescript
// apps/learner-web/middleware.ts
import { NextRequest, NextResponse } from "next/server";

const locales = ["en", "es", "fr", "ru"];
const defaultLocale = "en";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if locale is in pathname
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (hasLocale) {
    return NextResponse.next();
  }

  // Redirect to locale-prefixed URL
  const locale = defaultLocale;
  request.nextUrl.pathname = `/${locale}${pathname}`;

  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
```

## SEO Helpers Utility

```typescript
// apps/learner-web/utils/seo.ts
export interface SEOMetaData {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  locale?: string;
}

export function generateMetaTags(metadata: SEOMetaData) {
  const {
    title,
    description,
    image = "https://mentor.example.com/images/og-default.jpg",
    url = "https://mentor.example.com",
    type = "website",
    locale = "en",
  } = metadata;

  return {
    title,
    metaTags: [
      {
        name: "description",
        content: description,
      },
      {
        property: "og:title",
        content: title,
      },
      {
        property: "og:description",
        content: description,
      },
      {
        property: "og:image",
        content: image,
      },
      {
        property: "og:type",
        content: type,
      },
      {
        property: "og:locale",
        content: locale.replace("-", "_"),
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: title,
      },
      {
        name: "twitter:image",
        content: image,
      },
    ],
    canonicalUrl: url,
  };
}

export function generateStructuredData(type: string, data: any) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };
}
```

## Acceptance Criteria

- [ ] Course catalog page renders with SSG/SSR
- [ ] Catalog page meta title set dynamically
- [ ] Catalog page meta description set dynamically
- [ ] Catalog page OG image set for social sharing
- [ ] Category pages generated statically or on-demand
- [ ] Category page meta title includes category name
- [ ] Category page meta description mentions course count
- [ ] Course detail pages use SSR/ISR with revalidation
- [ ] Course detail page meta tags dynamic per course
- [ ] Course detail page JSON-LD Course schema rendered
- [ ] Instructor profile pages have Person schema
- [ ] All pages have canonical URL set
- [ ] All pages have rel="alternate" hreflang for locales
- [ ] Sitemap.xml generated with all courses and categories
- [ ] Sitemap includes lastmod and changefreq
- [ ] Sitemap updated daily (courses list changes)
- [ ] Robots.txt returns 200 OK
- [ ] Robots.txt allows all public pages
- [ ] Robots.txt disallows /admin and /api
- [ ] URL-based locale routing works: /en/, /es/, /fr/, /ru/
- [ ] Default locale redirects to /en/
- [ ] hreflang alternate links set for all locales
- [ ] Meta viewport tag set for responsive design
- [ ] Open Graph tags set on all pages
- [ ] Twitter Card tags set on all pages
- [ ] Image alt text on all images
- [ ] Page titles under 60 characters
- [ ] Meta descriptions between 150-160 characters
- [ ] No duplicate content across locales (hreflang prevents)
- [ ] Structured data validates with Google Rich Results Test
- [ ] Core Web Vitals pass Lighthouse audit (90+ score)
- [ ] Mobile friendly test passes
- [ ] No console errors or warnings
- [ ] Links follow rel="nofollow" for external links (if applicable)

## Dependencies

- `next` (v14+) — Framework with SSG, SSR, i18n
- `next-seo` (optional) — SEO utilities library
- `@next/bundle-analyzer` — Bundle size analysis

## Technical Notes

- Pre-generate top 100 courses as static pages (fastest load)
- Fallback to blocking SSR for remaining courses (on-demand generation)
- Revalidate landing pages every 1 hour (3600s) to keep fresh
- Revalidate course pages every 24 hours (86400s)
- Use ISR (Incremental Static Regeneration) for background updates
- Monitor Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Compress images: use AVIF/WebP with JPEG fallback
- Implement breadcrumb navigation for better UX and SEO
- Test with Google Search Console: submit sitemap, monitor indexing
- Use Google PageSpeed Insights to identify performance issues
- Monitor search traffic with Google Analytics 4
- Update meta descriptions to be unique and compelling
- Keyword optimization: include category/course keywords in titles/descriptions
- Monitor keyword rankings: track top courses in search
- Implement structured data testing: Google Rich Results Test
- Set proper hreflang tags to prevent duplicate content penalties
- Monitor 404 errors in Search Console
- Implement 301 redirects if URLs change
- Prevent crawling of duplicate or low-value pages
- Use robots.txt and meta robots tags strategically
- Consider implementing JSON-LD for breadcrumbs and FAQ sections
