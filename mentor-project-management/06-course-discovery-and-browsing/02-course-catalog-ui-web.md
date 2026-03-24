# Course Catalog UI - Learner Web

## Description

Implement the main course discovery page for Learner Web (Next.js with SSR/SSG). This includes responsive grid/list view toggle, course cards with essential information, sidebar filtering on desktop, bottom sheet filtering on mobile, infinite scroll, and SEO optimization. The page should support multiple locales via URL routing and enable users to discover courses through various filtering and sorting options.

## Affected Apps/Packages

- `apps/learner-web` — Next.js frontend application
- `apps/learner-web/pages/courses` — Course catalog page
- `apps/learner-web/components/CourseCard` — Card component
- `apps/learner-web/components/CourseFilters` — Filter sidebar/sheet
- `apps/learner-web/components/CourseSortBar` — Sort controls
- `shared/types` — Course type definitions
- `shared/hooks` — useInfiniteScroll, useFilters, etc.

## UI Components

### Course Catalog Layout

**Desktop (1024px+):**

- Header: Logo, search bar, user profile
- Main grid:
  - Left sidebar (240px): Category filters, price filter, course type filter
  - Center content (remaining width): Sort controls, view toggle (grid/list), course items
  - Responsive: sidebar collapses to modal on tablet/mobile

**Tablet (768px - 1023px):**

- Sidebar collapses to expandable drawer
- Grid: 2-column layout
- Touch-friendly padding and spacing

**Mobile (< 768px):**

- Full width single-column layout
- Filter button opens bottom sheet modal
- Sort options in top dropdown
- View toggle accessible but minimal space

### Course Card Component

**Grid View (default):**

```
┌─────────────────────┐
│  Thumbnail (16:9)   │ (180x101px)
├─────────────────────┤
│ Course Title (2 ln) │
│ Instructor Name     │ Avatar (24x24)
│ Category Badge      │
├─────────────────────┤
│ €29.99 | 8 lessons  │
│ Price Type Badge    │
│ Course Type Badge   │
├─────────────────────┤
│ ❤️ 567 interested   │
│ [Interested Button] │
└─────────────────────┘
```

**List View:**

```
┌──────┬──────────────────────────────────────┬─────────────────┐
│Thumb │ Title (truncated)                    │ Price | Interest │
│      │ Instructor, Category                 │ Type  | Count    │
│      │ 8 lessons, 2h 15min, Beginner        │ Button           │
└──────┴──────────────────────────────────────┴─────────────────┘
```

**Card Data:**

- Thumbnail URL (lazy-loaded, placeholder while loading)
- Course title (max 50 chars, truncate with ellipsis)
- Instructor: name + avatar (24x24px circle)
- Category badge (single, dominant category)
- Price: €XX or "Free" (clearly visible)
- Price type badge: "Free" or "Paid" (color-coded)
- Course type badge: "Masterclass" or "Single Lesson"
- Interested count with heart icon
- Interested button: toggle heart icon + count
- Lesson count (e.g., "8 lessons")
- Duration (e.g., "2h 15min")
- Difficulty badge (beginner, intermediate, advanced)

### Filter Sidebar (Desktop)

**Structure:**

```
Filters [X]
─────────────────────────
Category
  ☐ Makeup (45)
  ☐ Skincare (32)
  ☐ Haircare (18)
  [View More]
─────────────────────────
Price
  ◉ All Courses
  ○ Free Only
  ○ Paid Only
─────────────────────────
Course Type
  ☐ Masterclass (120)
  ☐ Single Lesson (54)
─────────────────────────
[Clear All Filters]
```

**Desktop Behavior:**

- Sidebar always visible on desktop
- Filter counts update in real-time
- URL query params update as filters change
- Collapse/expand category sections
- View more button for truncated category lists

**Mobile/Tablet Behavior:**

- Filter button triggers bottom sheet modal
- Close button [X] to dismiss
- Apply/Cancel buttons at bottom
- Sticky header with search in sheet
- Swipe-to-dismiss gesture support

### Sort Controls

**Sort Options Dropdown/Menu:**

- Newest (default)
- Most Popular (by enrollment count)
- Most Interested (by interested count)
- Price: Low to High
- Price: High to Low
- Duration: Short to Long
- Duration: Long to Short (mobile: if screen space allows)

**UX:**

- Desktop: dropdown menu in top-right of content area
- Mobile: dropdown or segment control above grid
- Selected option highlighted
- Show current sort in header/button label

### Search Integration

**Search Bar Location:**

- Global search in page header
- Sticky at top on mobile scroll
- Placeholder: "Search courses, instructors..."
- Integrated with Typesense (see search-as-you-type.md)

## Page Structure

### Next.js File Structure

```
apps/learner-web/
├── pages/
│   └── [locale]/
│       ├── courses/
│       │   ├── index.tsx          // Main catalog page
│       │   ├── [slug].tsx          // Course detail page
│       │   └── category/
│       │       └── [categorySlug].tsx
│       └── instructor/
│           └── [instructorSlug].tsx
├── components/
│   ├── CourseCard.tsx
│   ├── CourseCardSkeleton.tsx
│   ├── CourseGrid.tsx
│   ├── CourseList.tsx
│   ├── CourseFilters.tsx
│   ├── FilterSidebar.tsx
│   ├── FilterBottomSheet.tsx
│   ├── SortControl.tsx
│   └── CourseGridHeader.tsx
├── hooks/
│   ├── useCourses.ts             // API hook with caching
│   ├── useFilters.ts             // Filter state management
│   ├── useInfiniteScroll.ts      // Pagination
│   └── useLocalStorage.ts        // Persist filters
├── api/
│   └── courses.ts                // Client-side API wrapper
└── styles/
    └── coursesCatalog.module.css
```

## Implementation Details

### Infinite Scroll vs Pagination

- **Default: Infinite Scroll** for mobile and tablet (better UX)
- **Optional: Pagination** toggle for desktop (shows "Load More" button and page numbers)
- Implement Intersection Observer API for scroll detection
- Load next page when user scrolls 80% down the page
- Show skeleton loaders while fetching
- Prevent double-fetching with loading state flag

### State Management

- **Client-side URL state:** Filter state persists in URL query params
  - `/courses?category=makeup&price_type=free&sort_by=newest&page=1`
  - Users can share filtered views via URL
- **Session storage:** Remember last viewed filter combination
- **Local storage:** Optional "save my preferences" feature (v2+)

### Course Card Styling

- Border radius: 8px
- Box shadow: light (0 1px 3px rgba(0,0,0,0.1))
- Hover effect: shadow increase + slight scale (1.02x)
- Skeleton loader while thumbnail loads
- Lazy loading: load images below viewport
- Click handler: navigate to `/[locale]/courses/[slug]`

### Image Optimization

- Use Next.js Image component with `<Image>`
- Thumbnail sizes: 240x135 (16:9), 360x202 (high DPI)
- Srcset for responsive images
- AVIF/WebP with JPEG fallback
- Placeholder: blurred base64 or dominant color
- Lazy loading: `loading="lazy"`

### Filter URL Parameters

```
?category=makeup,skincare&price_type=free&course_type=masterclass&sort_by=popular&page=2
```

Query params:

- `category` — CSV of category IDs/slugs
- `price_type` — "all", "free", "paid"
- `course_type` — "all", "masterclass", "single_lesson"
- `sort_by` — "newest", "popular", "most_interested", "price_asc", "price_desc"
- `page` — Current page (start at 1)
- `q` — Search query (see search-as-you-type.md)

### Real-time Interest Updates

- User clicks interest button → immediately toggle heart icon
- Optimistic UI: show new count without waiting for API response
- API call in background to persist (`POST /courses/:id/interest`)
- If API fails, revert UI state and show error toast
- Use SWR or React Query for cache invalidation

### Skeleton Loaders

- Course card skeleton: placeholder boxes during image load
- Grid skeleton: 12-card grid of skeletons while initial fetch
- Progressive reveal: images appear as they load
- Prevents layout shift

### SEO Considerations

- Static generation (SSG) for category pages: `/courses/category/makeup`
- Server-side rendering (SSR) for personalized filters
- Dynamic meta tags: title, description, OG image
- Canonical URLs for pagination: `rel="next"`, `rel="prev"`
- Structured data (JSON-LD) for course collection
- robots.txt allows crawling: `User-agent: * Allow: /[locale]/courses`

### Accessibility

- Filter sidebar: keyboard navigation with arrow keys
- Checkboxes have proper ARIA labels
- Price filter radio buttons: keyboard accessible
- Sort dropdown: keyboard navigation
- Course links: descriptive anchor text
- Image alt text: "Course thumbnail for {title}"
- Color contrast: ensure filter badges meet WCAG AA
- Touch targets: min 44x44px on mobile

### Loading States and Error Handling

- Initial page load: show 12-card skeleton grid
- Filter change: show loading state, keep current results visible
- Scroll end: show loading indicator at bottom
- API error (50x): show error message and retry button
- API error (4xx): show user-friendly message
- No results: show "No courses found" message with suggestions

## Acceptance Criteria

- [ ] Course catalog page renders with SSR/SSG on server startup
- [ ] Grid view displays courses in responsive columns (1 col mobile, 2 col tablet, 3-4 col desktop)
- [ ] List view shows all course information in horizontal layout
- [ ] Grid/list view toggle works and persists during session
- [ ] Course cards show: thumbnail, title, instructor, category, price, type badge, interested count
- [ ] Sidebar filters visible on desktop (240px width)
- [ ] Filter sidebar collapses to bottom sheet on mobile (< 768px)
- [ ] Category filter shows up to 5 categories, "View More" expands full list
- [ ] Price filter toggle (All/Free/Paid) works correctly
- [ ] Course type filter (Masterclass/Single Lesson) works
- [ ] Sort dropdown shows 6+ sort options and changes order correctly
- [ ] Filter changes update URL query params
- [ ] URL-based filters restore state on page reload
- [ ] Infinite scroll loads next page when scrolling to 80%
- [ ] Pagination optional: "Load More" button available
- [ ] Skeleton loaders show during image load
- [ ] Images lazy-loaded with proper optimization
- [ ] Interested button toggles state optimistically and persists via API
- [ ] Search bar integrated and functional (see search-as-you-type.md)
- [ ] Responsive on mobile (< 768px), tablet (768-1023px), desktop (1024px+)
- [ ] Touch-friendly: min 44x44px tap targets on mobile
- [ ] Keyboard navigation works: Tab through filters, arrow keys in dropdowns
- [ ] Alt text on all images
- [ ] No layout shifts (proper image aspect ratios)
- [ ] Loading states show during data fetch
- [ ] Error states handled with user-friendly messages
- [ ] Performance: initial page load < 2s (Core Web Vitals)
- [ ] Page renders correctly in multiple locales (/en/, /fr/, /es/, /ru/)
- [ ] Meta tags set for SEO (title, description, OG image)
- [ ] Structured data (JSON-LD Course schema) rendered
- [ ] Canonical URLs for category pages
- [ ] Mobile tested on iOS Safari, Android Chrome
- [ ] Desktop tested on Chrome, Firefox, Safari, Edge
- [ ] No console errors or warnings in production build

## Dependencies

- `next` (v14+) — React framework with SSR/SSG
- `react` (v18+) — UI library
- `react-query` / `swr` — Data fetching and caching
- `next/image` — Image optimization
- `zustand` / `jotai` — Light state management for filters
- `next-intl` — Locale routing
- `axios` / `fetch` — HTTP client
- `tailwindcss` — Styling (or custom CSS modules)
- `react-intersection-observer` — Infinite scroll detection
- `lodash-es` — Utility functions

## Technical Notes

- Use CSS modules or Tailwind for responsive design (no Bootstrap)
- Implement service worker for offline catalog caching
- Cache course data in IndexedDB for repeat visits
- Monitor Core Web Vitals: LCP, FID, CLS
- Test with Lighthouse audit
- Use Next.js Image Optimization API for thumbnail transforms
- Implement HTTP caching headers in Next.js middleware
- Use concurrent requests (React 18) for faster data fetching
- Consider streaming SSR for faster initial page load
- Price display: always show currency symbol (€) and decimal (€29.99)
- Loading spinners: use 200-300ms minimum duration to prevent flashing
- Filter sheet modal: trap focus within modal for accessibility
- Test filter URL param combinations for edge cases
