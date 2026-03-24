# Task 2: Community Feed UI (Web)

## Description

Implement the community feed user interface for both Learner Web and Mentor Web applications. This includes post cards displaying author information, post content, media, like/comment counts, timestamps, and infinite scroll loading. Only the Mentor Web app includes the compose post form with image upload and course/topic tagging — learners can only view, like, and comment on posts. The UI must be responsive, accessible, and integrate with the design system.

## Affected Apps/Packages

- `apps/web-learner` - Learner Web UI (Next.js)
- `apps/web-mentor` - Mentor Web UI (Next.js)
- `packages/ui` - Reusable React components
- `packages/api-client` - TypeScript API client hooks
- `packages/validators` - Zod schemas for form validation

## UI Components

### 1. CommunityPost Card Component

**Location:** `packages/ui/src/components/CommunityPostCard.tsx`

**Props:**

```typescript
interface CommunityPostCardProps {
  post: CommunityPostData;
  onLike?: (postId: string) => Promise<void>;
  onUnlike?: (postId: string) => Promise<void>;
  onComment?: (postId: string) => void;
  onBookmark?: (postId: string) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (postId: string) => void;
  currentUserId: string;
  isLoading?: boolean;
  showActions?: boolean;
}
```

**Features:**

- Display author avatar, name, and timestamp
- Show post content (text) with proper text wrapping and line breaks
- Display image with proper aspect ratio (16:9 recommended)
- Show mentor badge/indicator
- Course and topic tag pills with click handlers
- Like count with current user's like status
- Comment count with comment preview (2-3 recent comments)
- Like/Comment/Bookmark/More actions buttons
- Edit/Delete dropdown for post author
- Loading skeleton for better UX during async operations

**Styling Considerations:**

- Dark/light mode support via design system
- Hover states for interactive elements
- Smooth transitions for like animations
- Proper z-index layering for dropdowns
- Responsive text sizing

### 2. CommunityFeed Component

**Location:** `apps/web-learner/src/components/CommunityFeed.tsx` and `apps/web-mentor/src/components/CommunityFeed.tsx`

**Props:**

```typescript
interface CommunityFeedProps {
  mentorId?: string;
  courseId?: string;
  sortBy?: "recent" | "popular" | "trending";
  onPostCreated?: (post: CommunityPostData) => void;
}
```

**Features:**

- Infinite scroll implementation using Intersection Observer
- Pull-to-refresh gesture (on mobile via separate mobile component)
- Loading state with skeleton cards
- Empty state with helpful messaging
- Error state with retry button
- Filters/sort dropdown
- Post compose form (mentor web only; learners cannot create posts)
- Real-time updates for likes/comments (optional: via WebSocket)

**State Management:**

```typescript
interface FeedState {
  posts: CommunityPostData[];
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  sortBy: "recent" | "popular" | "trending";
  mentorFilter?: string;
  courseFilter?: string;
}
```

### 3. ComposePostForm Component

**Location:** `packages/ui/src/components/ComposePostForm.tsx`

**Props:**

```typescript
interface ComposePostFormProps {
  mentorId: string;
  onSubmit: (data: PostFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

interface PostFormData {
  content: string;
  image?: File;
  courseTagIds: string[];
  topicTags: string[];
  mentorId: string;
}
```

**Features:**

- Expandable/collapsible form (collapsed: just textarea, expanded: full form)
- Text input with character counter (max 2000)
- Image upload with preview
- Course tag selector (multi-select dropdown)
- Topic tag input (autocomplete with suggestions)
- Community guidelines acknowledgment (required on first post)
- Submit button with loading state
- Cancel button to close form
- Draft auto-save to localStorage

**Form Layout:**

```
[Author Avatar] [Textarea placeholder: "Share your thoughts..."]
[Expand button]

[Expanded state]
- Textarea with counter
- Image upload preview area
- Course tags selector
- Topic tags autocomplete
- Community guidelines checkbox (if needed)
- [Submit] [Cancel]
```

### 4. ImageUploadField Component

**Location:** `packages/ui/src/components/ImageUploadField.tsx`

**Props:**

```typescript
interface ImageUploadFieldProps {
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  selectedImage?: File;
  previewUrl?: string;
  maxSizeBytes?: number;
  acceptedFormats?: string[];
}
```

**Features:**

- Drag-and-drop zone for image upload
- Click to browse file picker
- Image preview before upload
- File size validation with clear error messages
- Format validation (JPEG, PNG, WebP)
- Remove image button
- Accessibility: keyboard navigation, screen reader support

**Validation:**

- Max 10MB file size
- Allowed formats: image/jpeg, image/png, image/webp
- Min dimensions: 400x300 (suggested, not enforced)

### 5. CourseTagSelector Component

**Location:** `packages/ui/src/components/CourseTagSelector.tsx`

**Props:**

```typescript
interface CourseTagSelectorProps {
  selectedCourses: CourseData[];
  onCoursesChange: (courses: CourseData[]) => void;
  availableCourses: CourseData[];
  maxTags?: number;
  isLoading?: boolean;
}
```

**Features:**

- Dropdown/modal with searchable course list
- Show only courses where user is enrolled or instructor
- Display course thumbnail and title
- Multi-select with checkboxes
- Max 5 course tags (configurable)
- Clear selected tags
- Search/filter courses by name

### 6. TopicTagInput Component

**Location:** `packages/ui/src/components/TopicTagInput.tsx`

**Props:**

```typescript
interface TopicTagInputProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  isLoading?: boolean;
}
```

**Features:**

- Autocomplete input with suggestions
- Add tags via Enter key or click suggestions
- Remove tags with × button
- Show max tags indicator
- Prevent duplicate tags
- Case-insensitive matching
- Fetch suggestions from API or local list

### 7. CommentSection Component

**Location:** `packages/ui/src/components/CommentSection.tsx`

**Props:**

```typescript
interface CommentSectionProps {
  postId: string;
  comments: CommentData[];
  onCommentAdded?: (comment: CommentData) => void;
  onCommentDeleted?: (commentId: string) => void;
  isLoadingComments?: boolean;
  canCommentOnPost: boolean;
}
```

**Features:**

- Display comments in chronological order
- Single-level comments only (no nested replies)
- Comment pagination (load more button)
- Comment compose form (text only, no images)
- Comment timestamp relative to now ("2 hours ago")
- Like/unlike comment buttons
- Delete button for comment author
- Comment count counter

## Page Layout

### Learner Web Community Tab

```
┌─────────────────────────────────┐
│ Community | Bookmarks            │
├─────────────────────────────────┤
│ [Filters] [Sort Dropdown]        │
├─────────────────────────────────┤
│ ┌───────────────────────────────┐│
│ │ Post Card #1                   ││
│ └───────────────────────────────┘│
│ ┌───────────────────────────────┐│
│ │ Post Card #2                   ││
│ └───────────────────────────────┘│
│ ┌───────────────────────────────┐│
│ │ Post Card #3                   ││
│ └───────────────────────────────┘│
│ [Loading skeleton cards...]      │
└─────────────────────────────────┘
```

### Mentor Web Community Management

```
┌──────────────────────────────────────┐
│ Community Hub | Analytics | Moderation│
├──────────────────────────────────────┤
│ [Create Post Button] [Filter/Sort]   │
├──────────────────────────────────────┤
│ ┌────────────────────────────────────┐│
│ │ My Post Card                        ││
│ │ [Edit] [Delete] [Pin] [Hide]        ││
│ └────────────────────────────────────┘│
│ ┌────────────────────────────────────┐│
│ │ Learner Posts (your course)         ││
│ │ [Hide Comment] [Delete Post]        ││
│ └────────────────────────────────────┘│
└──────────────────────────────────────┘
```

## Routing Structure

### Learner Web

```
/community
  ├── / (main feed)
  ├── /bookmarks (bookmarked posts)
  ├── /posts/:postId (detailed view - modal/page)
  ├── /mentor/:mentorId (mentor feed)
  └── /course/:courseId (course-specific feed)
```

### Mentor Web

```
/community
  ├── / (mentor's community hub)
  ├── /my-posts (instructor's posts)
  ├── /create-post (compose page)
  ├── /posts/:postId (post detail)
  ├── /moderation (comment/post management)
  └── /analytics (community analytics)
```

## Requirements

### State Management

- Use React Query (`@tanstack/react-query`) for server state
- Use Zustand or Context API for UI state (form visibility, filters)
- Implement optimistic updates for likes/comments
- Handle offline state and sync when online

### Infinite Scroll Implementation

```typescript
// Using Intersection Observer API
const observerTarget = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && hasMore && !isLoadingMore) {
        loadMore();
      }
    },
    { threshold: 0.1 },
  );

  if (observerTarget.current) {
    observer.observe(observerTarget.current);
  }

  return () => observer.disconnect();
}, [hasMore, isLoadingMore]);
```

### Image Upload

- Client-side validation (size, format)
- Compress image before upload (use `image-compressor.js` or similar)
- Show upload progress
- Fallback for failed uploads (show error, allow retry)
- Use Cloudinary for image storage (signed uploads)

### Accessibility

- Semantic HTML (article, section, button elements)
- ARIA labels for interactive elements
- Keyboard navigation (Tab through posts, Enter to expand)
- Screen reader support for image captions
- Focus management in modals
- Color contrast compliance (WCAG AA)

### Performance

- Code splitting for community feed routes
- Lazy load images (native `loading="lazy"`)
- Memoize components (React.memo for post cards)
- Debounce search/filter inputs
- Implement virtual scrolling if feed has 1000+ posts

### Responsive Design

- Mobile: single column, full width
- Tablet: single column with padding
- Desktop: single column with max-width constraint (600px)
- Breakpoints: 640px, 1024px, 1280px

## Acceptance Criteria

- [ ] CommunityPost card component displays all required information
- [ ] Post card styles match design system tokens
- [ ] Infinite scroll loads more posts automatically at end of feed
- [ ] Pull-to-refresh gesture works on mobile (separate component)
- [ ] Compose post form expands/collapses correctly
- [ ] Image upload with preview works and validates file size/format
- [ ] Course tag selector shows enrolled/instructed courses
- [ ] Topic tag input with autocomplete suggestions functions correctly
- [ ] Character counter updates in real-time (max 2000 chars)
- [ ] Post submission creates post and updates feed optimistically
- [ ] Error states show helpful messages and retry options
- [ ] Loading skeleton cards display while loading
- [ ] Empty state message appears when no posts found
- [ ] Like/unlike buttons work with optimistic updates
- [ ] Comment section displays single-level comments only
- [ ] Dark/light mode transitions work smoothly
- [ ] All routes load quickly with code splitting
- [ ] Mobile responsive layout tested on iOS/Android sizes
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader announces post content correctly
- [ ] Form validation prevents submission of invalid data

## Dependencies

- `apps/web-learner` and `apps/web-mentor` - Next.js setup
- `packages/ui` - Design system components
- `packages/api-client` - API hooks and types
- `packages/validators` - Form validation schemas
- `@tanstack/react-query` - Server state management
- `zod` - Schema validation
- `react-intersection-observer` - Intersection Observer wrapper (optional)
- `next-image-export-optimizer` - Image optimization (optional)

## Technical Notes

### Component Composition Strategy

- Keep `CommunityPost` card pure and reusable
- Wrap in data-fetching logic at page/container level
- Use render props or custom hooks for composition
- Container pattern: separate data fetching from presentation

### Optimistic Updates

```typescript
// Like button optimistic update example
const onLike = async (postId: string) => {
  // Optimistically update UI
  queryClient.setQueryData(["posts"], (old) => {
    return old.map((post) =>
      post.id === postId
        ? { ...post, liked: true, likes: post.likes + 1 }
        : post,
    );
  });

  try {
    await api.posts.like(postId);
  } catch (error) {
    // Revert on error
    queryClient.invalidateQueries(["posts"]);
    toast.error("Failed to like post");
  }
};
```

### URL Structure Best Practices

- Use meaningful slugs and IDs in URLs
- Support deep linking (post URL should show post detail)
- Implement browser back button behavior correctly
- Use Next.js dynamic routes with proper typing

### Error Handling

- 403 Forbidden: show "You don't have access to this post"
- 404 Not Found: show "Post not found or deleted"
- 500 Server Error: show "Failed to load posts, please try again"
- Network error: show offline indicator with retry

### Testing Strategy

- Component snapshots for card layouts
- Integration tests for infinite scroll behavior
- E2E tests for compose → submit → appears in feed
- Accessibility tests using axe or similar
- Performance tests for render time with 100+ posts

### SEO Considerations

- Dynamic pages should be noindexed (community content is user-generated)
- Use proper Open Graph tags for post sharing
- Implement canonical URLs to prevent duplicate content
- Consider server-side rendering for initial feed load

### Image Handling Best Practices

- Lazy load images in feed (below fold)
- Set explicit dimensions to prevent layout shift
- Use srcset for responsive images
- Cache image URLs to avoid re-renders
- Handle missing/broken images gracefully
