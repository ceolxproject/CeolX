# Task 4: Post Interactions (Like, Comment, Pin, Moderation)

## Description

Implement post interaction features including liking/unliking posts, commenting with single-level replies only, comment pagination, instructor post pinning, and instructor comment moderation (hide/delete). Build API endpoints and UI components for these interactions with proper access control, optimistic updates, and real-time feedback.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for likes and comments
- `packages/ui` - React components for interactions (web)
- `packages/ui-mobile` - React Native components (mobile)
- `packages/api-client` - API client methods and hooks

## API Endpoints

### Like/Unlike Post

#### POST /api/community/posts/:postId/like

**Description:** Like a community post

**Response (200 OK):**

```json
{
  "id": "like_123",
  "postId": "post_456",
  "userId": "user_789",
  "createdAt": "2024-02-18T10:30:00Z"
}
```

**Access Control:**

- Only authenticated users can like
- User must have access to the post (follow access rules from community feed API)
- Each user can like each post maximum once (duplicate prevents via database unique constraint)

**Error Responses:**

- 401 Unauthorized - user not authenticated
- 403 Forbidden - user doesn't have access to post
- 404 Not Found - post doesn't exist
- 409 Conflict - already liked (optional, can be idempotent)

#### DELETE /api/community/posts/:postId/like

**Description:** Unlike a community post

**Response (204 No Content):**
No response body

**Access Control:**

- Only the user who liked can unlike their own like
- Return 404 if no like exists (idempotent)

### Post Comments

#### POST /api/community/posts/:postId/comments

**Description:** Add a comment to a post (single-level only)

**Request Body:**

```json
{
  "content": "Great tips! I'll definitely try this technique.",
  "mentions": [] // No @mentions; left empty for future use
}
```

**Response (201 Created):**

```json
{
  "id": "comment_123",
  "postId": "post_456",
  "authorId": "user_789",
  "author": {
    "id": "user_789",
    "username": "makeup_fan",
    "avatarUrl": "https://cdn.example.com/avatar.jpg"
  },
  "content": "Great tips! I'll definitely try this technique.",
  "isAuthorMentor": false,
  "stats": {
    "likes": 0,
    "replies": 0
  },
  "createdAt": "2024-02-18T10:30:00Z",
  "updatedAt": "2024-02-18T10:30:00Z"
}
```

**Validation Rules:**

- Content must be 1-500 characters
- No nested replies (parentCommentId not allowed)
- User must have access to post
- Instructor can restrict specific users from commenting on their posts

**Access Control:**

- Only authenticated users can comment
- Check if post author (instructor) has blocked user from commenting
- Return 403 if user is blocked from commenting

**Notifications:**

- Send push notification to post author: "New comment on your post"
- Send in-app notification
- Batch notifications if multiple comments within 5 minutes

#### GET /api/community/posts/:postId/comments

**Description:** Retrieve paginated comments on a post

**Query Parameters:**

- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 20, max: 100)
- `sortBy` (enum: "recent", "oldest", "popular", optional, default: "recent")

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "comment_123",
      "postId": "post_456",
      "authorId": "user_789",
      "author": {
        "id": "user_789",
        "username": "makeup_fan",
        "avatarUrl": "https://cdn.example.com/avatar.jpg",
        "isMentor": false
      },
      "content": "Great tips! I'll definitely try this technique.",
      "isAuthorMentor": false,
      "isHidden": false,
      "stats": {
        "likes": 2,
        "replies": 0
      },
      "userInteraction": {
        "liked": false,
        "canDelete": false,
        "canHide": false
      },
      "createdAt": "2024-02-18T10:30:00Z",
      "updatedAt": "2024-02-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasMore": true
  }
}
```

**Notes:**

- Comments marked as isHidden should appear as "[This comment was hidden]" or similar to the user
- Only show canDelete: true if user is comment author or post author
- Only show canHide: true if user is post author (instructor)

#### PUT /api/community/posts/:postId/comments/:commentId

**Description:** Update a comment

**Request Body:**

```json
{
  "content": "Updated comment text"
}
```

**Response (200 OK):**
Same comment object with updated content and updatedAt timestamp

**Access Control:**

- Only comment author can update
- Cannot update content that would change meaning significantly (recommend delete + new comment instead)
- Return 403 if unauthorized

#### DELETE /api/community/posts/:postId/comments/:commentId

**Description:** Delete a comment (soft delete)

**Response (204 No Content):**
No response body

**Access Control:**

- Comment author can always delete their own comment
- Post author (instructor) can delete any comment on their post
- Admin can delete any comment
- Use soft delete (mark deletedAt timestamp)

#### POST /api/community/posts/:postId/comments/:commentId/like

**Description:** Like a comment

**Response (200 OK):**

```json
{
  "id": "like_456",
  "commentId": "comment_123",
  "userId": "user_789",
  "createdAt": "2024-02-18T10:30:00Z"
}
```

#### DELETE /api/community/posts/:postId/comments/:commentId/like

**Description:** Unlike a comment

**Response (204 No Content):**

### Instructor Post Management

#### PUT /api/community/posts/:postId/pin

**Description:** Pin an instructor's post to the top of feed

**Request Body:**

```json
{
  "isPinned": true
}
```

**Response (200 OK):**

```json
{
  "id": "post_123",
  "isPinned": true,
  "pinnedAt": "2024-02-18T10:30:00Z",
  "pinnedBy": "mentor_789"
}
```

**Access Control:**

- Only post author (instructor) can pin their own posts
- Admin can pin any post
- Max 3 pinned posts per mentor

**Error Responses:**

- 403 Forbidden - user not authorized
- 409 Conflict - max pinned posts exceeded

#### PUT /api/community/posts/:postId/comments/:commentId/hide

**Description:** Hide a comment (visible only to comment author and post author)

**Request Body:**

```json
{
  "isHidden": true,
  "reason": "spam" // optional: spam, inappropriate, off-topic, other
}
```

**Response (200 OK):**

```json
{
  "id": "comment_123",
  "isHidden": true,
  "hiddenAt": "2024-02-18T10:30:00Z",
  "hiddenBy": "mentor_789",
  "hiddenReason": "spam"
}
```

**Access Control:**

- Only post author (instructor) can hide comments on their posts
- Admin can hide any comment
- Soft flag (comment not deleted, just hidden from public view)

**Notification:**

- Send notification to comment author: "Your comment was hidden by the post author"

#### PUT /api/community/posts/:postId/restrict-user

**Description:** Restrict a user from commenting on instructor's posts (future posts)

**Request Body:**

```json
{
  "userId": "user_999",
  "restrictFromComments": true,
  "reason": "inappropriate behavior"
}
```

**Response (200 OK):**

```json
{
  "id": "restriction_123",
  "userId": "user_999",
  "mentorId": "mentor_789",
  "restrictFromComments": true,
  "reason": "inappropriate behavior",
  "createdAt": "2024-02-18T10:30:00Z"
}
```

**Access Control:**

- Only mentor who authored post can restrict users
- Admin can restrict users

**Notification:**

- Send notification to restricted user: "You've been restricted from commenting on posts by [Mentor Name]"

## Database Schema (Prisma)

### Comment Schema

```prisma
model CommunityPostComment {
  id String @id @default(cuid())
  postId String
  post CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)

  authorId String
  author User @relation("CommentAuthor", fields: [authorId], references: [id], onDelete: Cascade)

  content String @db.Text

  // No parentCommentId: single-level comments only

  likes CommunityCommentLike[]

  // Moderation
  isHidden Boolean @default(false)
  hiddenAt DateTime?
  hiddenBy String?
  hiddenReason String? // "spam", "inappropriate", "off-topic", "other"

  // Audit
  deletedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([postId])
  @@index([authorId])
  @@index([createdAt])
  @@index([postId, createdAt])
}

model CommunityCommentLike {
  id String @id @default(cuid())
  commentId String
  comment CommunityPostComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  userId String
  user User @relation("CommentLikes", fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([commentId, userId])
  @@index([commentId])
  @@index([userId])
}

model PostCommentRestriction {
  id String @id @default(cuid())
  userId String
  user User @relation("CommentRestrictions", fields: [userId], references: [id], onDelete: Cascade)

  mentorId String
  mentor User @relation("RestrictedCommenters", fields: [mentorId], references: [id], onDelete: Cascade)

  reason String?
  createdAt DateTime @default(now())

  @@unique([userId, mentorId])
  @@index([mentorId])
  @@index([userId])
}

// Update CommunityPost to include pinning
extend model CommunityPost {
  isPinned Boolean @default(false)
  pinnedAt DateTime?
  pinnedBy String?
}
```

## UI Components (Web)

### 1. LikeButton Component

**Location:** `packages/ui/src/components/LikeButton.tsx`

```typescript
interface LikeButtonProps {
  postId: string;
  isLiked: boolean;
  likeCount: number;
  onLike: (postId: string) => Promise<void>;
  onUnlike: (postId: string) => Promise<void>;
  isLoading?: boolean;
}
```

**Features:**

- Heart icon animation on like
- Optimistic update
- Loading state
- Disabled state during request
- Accessible (aria-label)

### 2. CommentSection Component

**Location:** `packages/ui/src/components/CommentSection.tsx`

**Features:**

- List of comments with pagination
- Comment cards with author info, content, timestamp
- Like/unlike comment buttons
- Delete button (author/instructor only)
- Hide button (instructor only)
- Compose comment form
- Empty state "No comments yet. Be the first!"
- Load more button

### 3. CommentCard Component

**Location:** `packages/ui/src/components/CommentCard.tsx`

**Layout:**

```
┌────────────────────────────────────┐
│ [Avatar] Author Name | Time ago    │
│ Comment content text               │
│ ❤️ 2 likes | [Delete] [Hide]       │
└────────────────────────────────────┘
```

### 4. CommentForm Component

**Location:** `packages/ui/src/components/CommentForm.tsx`

```typescript
interface CommentFormProps {
  postId: string;
  onSubmit: (content: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
}
```

**Features:**

- Text input with character counter (max 500)
- Submit button
- Cancel button
- Auto-focus on mount (optional)
- Keyboard handling (Cmd/Ctrl+Enter to submit)

### 5. PinButton Component (Instructor Only)

**Location:** `packages/ui/src/components/PinButton.tsx`

```typescript
interface PinButtonProps {
  postId: string;
  isPinned: boolean;
  onPin: (postId: string) => Promise<void>;
  onUnpin: (postId: string) => Promise<void>;
  isLoading?: boolean;
  canPin: boolean;
}
```

### 6. HideCommentButton Component

**Location:** `packages/ui/src/components/HideCommentButton.tsx`

```typescript
interface HideCommentButtonProps {
  commentId: string;
  isHidden: boolean;
  onHide: (commentId: string, reason?: string) => Promise<void>;
  onUnhide: (commentId: string) => Promise<void>;
  isLoading?: boolean;
  canHide: boolean;
}
```

**Features:**

- Dropdown to select reason for hiding
- Reason options: spam, inappropriate, off-topic, other
- Tooltip explaining hiding behavior
- Confirmation dialog before hiding

## React Hooks (API Client)

### usePostLike Hook

```typescript
interface UsePostLikeOptions {
  postId: string;
  initialIsLiked?: boolean;
  initialLikeCount?: number;
}

export function usePostLike(options: UsePostLikeOptions) {
  const [isLiked, setIsLiked] = useState(options.initialIsLiked ?? false);
  const [likeCount, setLikeCount] = useState(options.initialLikeCount ?? 0);
  const [isLoading, setIsLoading] = useState(false);

  const like = async () => {
    setIsLiked(true);
    setLikeCount((prev) => prev + 1);
    try {
      await api.community.likePost(options.postId);
    } catch (error) {
      // Revert optimistic update
      setIsLiked(false);
      setLikeCount((prev) => prev - 1);
      throw error;
    }
  };

  const unlike = async () => {
    setIsLiked(false);
    setLikeCount((prev) => prev - 1);
    try {
      await api.community.unlikePost(options.postId);
    } catch (error) {
      setIsLiked(true);
      setLikeCount((prev) => prev + 1);
      throw error;
    }
  };

  return { isLiked, likeCount, like, unlike, isLoading };
}
```

### useComments Hook

```typescript
interface UseCommentsOptions {
  postId: string;
  pageSize?: number;
}

export function useComments(options: UseCommentsOptions) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["comments", options.postId],
    queryFn: ({ pageParam = 1 }) =>
      api.community.getComments(options.postId, {
        page: pageParam,
        limit: options.pageSize ?? 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const comments = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data]
  );

  return {
    comments,
    isLoading,
    error,
    loadMore: fetchNextPage,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
  };
}
```

## Requirements

### Optimistic Updates

- Update UI immediately before API request completes
- Revert on error with error toast
- Show loading state during request
- Never show stale data after revert

### Comment Moderation

- Instructors can delete/hide comments on their posts
- Admin can delete/hide any comment
- Hiding doesn't remove comment, just hides from public view
- Deletion is soft delete for audit trail

### Access Control Checks

```typescript
// Can user like post?
- User must be authenticated
- User must have access to view post (same as feed view rules)

// Can user comment on post?
- User must be authenticated
- User must have access to view post
- User must not be restricted by post author
- User must not have been blocked by mentor

// Can user hide/delete comment?
- User is comment author, OR
- User is post author, OR
- User is admin

// Can user pin post?
- User is post author, AND
- User is instructor, AND
- Mentor doesn't already have 3 pinned posts
```

### Rate Limiting

- Like/unlike: 100 per minute per user
- Comment: 10 per minute per user
- Delete comment: 10 per minute per user
- Hide comment: 10 per minute per user

### Real-Time Updates (Optional Enhancement)

- Use WebSocket or Server-Sent Events for real-time:
  - Like count updates
  - New comment notifications
  - Comment hiding/deletion
- Consider Firebase Realtime Database or similar
- Fallback to polling if WebSocket unavailable

## Acceptance Criteria

- [ ] Like button works with optimistic updates
- [ ] Unlike button removes like correctly
- [ ] Like count updates immediately in UI
- [ ] User cannot like same post twice
- [ ] POST /api/community/posts/:postId/like endpoint works
- [ ] DELETE /api/community/posts/:postId/like endpoint works
- [ ] Comment form validates content (max 500 chars)
- [ ] Comments submitted and appear in list
- [ ] Comment pagination loads more on demand
- [ ] Comment timestamps display as relative time ("2 hours ago")
- [ ] Author can delete their own comments
- [ ] Instructor can delete comments on their posts
- [ ] Comments marked as hidden show as "[Hidden]" to non-viewers
- [ ] Instructor can pin up to 3 posts
- [ ] Pinned posts appear at top of feed
- [ ] Instructor can hide comment with reason
- [ ] Hidden comments visible to author and post author only
- [ ] Restrict user endpoint prevents future comments
- [ ] All endpoints include proper error handling
- [ ] Optimistic updates revert on error
- [ ] Loading states show during async operations
- [ ] Keyboard shortcuts work (Cmd/Ctrl+Enter to submit comment)
- [ ] Accessibility: all buttons have aria-labels
- [ ] Like/unlike doesn't cause page layout shift
- [ ] Comment section scrolls independently (web) or in modal (mobile)

## Dependencies

- `apps/api` - Hono backend
- `packages/db` - Prisma ORM
- `packages/ui` - React components
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API client hooks
- `@tanstack/react-query` - Server state
- `zod` - Validation

## Technical Notes

### Comment Visibility Logic

```typescript
// When returning comments, filter based on user
function shouldShowComment(
  comment: Comment,
  userId: string,
  postAuthorId: string
) {
  // Hidden comments visible only to author and post author
  if (
    comment.isHidden &&
    userId !== comment.authorId &&
    userId !== postAuthorId
  ) {
    return false; // Don't include in response
  }
  return true;
}
```

### Pinned Posts in Feed

```typescript
// Sort posts: pinned first (by pinnedAt desc), then regular posts (by createdAt desc)
const sortedPosts = [
  ...pinnedPosts.sort((a, b) => b.pinnedAt - a.pinnedAt),
  ...regularPosts.sort((a, b) => b.createdAt - a.createdAt),
];
```

### Preventing Double-Like

```prisma
// Unique constraint in database prevents duplicate likes
@@unique([postId, userId])

// API endpoint should return 409 if attempting duplicate
// Or make endpoint idempotent (return success if already liked)
```

### Comment Restrictions

```typescript
// Check before allowing comment
const isRestricted = await db.postCommentRestriction.findUnique({
  where: {
    userId_mentorId: {
      userId: commentingUserId,
      mentorId: post.mentorId, // post author's mentor ID
    },
  },
});

if (isRestricted) {
  throw new ForbiddenError("You cannot comment on posts by this mentor");
}
```

### Monitoring and Logging

- Log all post/comment deletions (soft delete)
- Track comment hiding patterns (potential spam)
- Monitor like patterns (potential bot activity)
- Alert on unusual comment volumes
