# Task 1: Community Feed API

## Description

Implement the backend API endpoints for the community feed functionality. This includes retrieving paginated posts filtered by mentor/course, creating new posts (instructors only), updating and deleting posts with proper access control. Posts should only be visible to learners who have watched at least one lesson from the post author's mentor. Only instructors can create posts; learners can view, like, and comment. The API must enforce strict access control and integrate with the database schema for community posts.

## Affected Apps/Packages

- `apps/api` - Hono.js backend on Vercel
- `packages/db` - Prisma schema and migrations
- `packages/api-client` - TypeScript client types for community endpoints
- `packages/validators` - Zod schemas for request/response validation

## API Endpoints

### GET /api/community/posts

**Description:** Retrieve community posts with pagination, filtering, and access control

**Query Parameters:**

- `page` (number, optional, default: 1) - Page number for pagination
- `limit` (number, optional, default: 20, max: 100) - Items per page
- `mentorId` (string, optional) - Filter posts by specific mentor
- `courseId` (string, optional) - Filter posts by specific course tag
- `sortBy` (enum: "recent", "popular", "trending", optional, default: "recent") - Sort order

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "post_123",
      "content": "Great tips for contouring!",
      "imageUrl": "https://cdn.example.com/post-123.jpg",
      "author": {
        "id": "user_456",
        "username": "makeup_enthusiast",
        "avatarUrl": "https://cdn.example.com/avatar.jpg",
        "isMentor": false
      },
      "mentor": {
        "id": "mentor_789",
        "name": "Expert Mentor"
      },
      "coursesTags": [
        {
          "id": "course_101",
          "title": "Contouring Masterclass"
        }
      ],
      "topicsTags": ["contouring", "face-shaping"],
      "stats": {
        "likes": 45,
        "comments": 12,
        "views": 320
      },
      "userInteraction": {
        "liked": false,
        "bookmarked": false
      },
      "createdAt": "2024-02-18T10:30:00Z",
      "updatedAt": "2024-02-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "hasMore": true,
    "totalPages": 8
  }
}
```

**Access Control:**

- Learner can view posts only if they have watched ≥1 lesson from the post author's mentor
- Instructors can view all posts
- Admins can view all posts
- Return 403 if learner lacks access

### POST /api/community/posts

**Description:** Create a new community post with text and optional image

**Request Body:**

```json
{
  "content": "Just completed the advanced eyeshadow course! So excited.",
  "imageUrl": "https://cdn.example.com/image.jpg",
  "courseTagIds": ["course_101", "course_102"],
  "topicTags": ["eyeshadow", "color-theory"],
  "mentorId": "mentor_789",
  "postType": "text|image"
}
```

**Response (201 Created):**

```json
{
  "id": "post_123",
  "content": "Just completed the advanced eyeshadow course! So excited.",
  "imageUrl": "https://cdn.example.com/image.jpg",
  "author": {
    "id": "user_456",
    "username": "makeup_enthusiast",
    "avatarUrl": "https://cdn.example.com/avatar.jpg",
    "isMentor": false
  },
  "mentor": {
    "id": "mentor_789",
    "name": "Expert Mentor"
  },
  "coursesTags": [
    {
      "id": "course_101",
      "title": "Contouring Masterclass"
    }
  ],
  "topicsTags": ["eyeshadow", "color-theory"],
  "stats": {
    "likes": 0,
    "comments": 0,
    "views": 0
  },
  "createdAt": "2024-02-18T10:30:00Z",
  "updatedAt": "2024-02-18T10:30:00Z"
}
```

**Validation Rules:**

- Content must be 1-2000 characters
- At least one of content or imageUrl must be provided
- Max 5 course tags
- Max 10 topic tags
- Mentor must exist and user must have enrollment/permission
- Image must be valid (JPEG, PNG, WebP, max 10MB)

**Access Control:**

- Only instructors can create posts
- Instructors: can create posts for their own courses only
- Learners: cannot create posts (can only view, like, and comment)

### PUT /api/community/posts/:postId

**Description:** Update a community post

**Request Body:**

```json
{
  "content": "Updated content here",
  "imageUrl": "https://cdn.example.com/new-image.jpg",
  "courseTagIds": ["course_101"],
  "topicTags": ["eyeshadow"]
}
```

**Response (200 OK):**
Same as POST response with updated fields

**Access Control:**

- Only post author can update their own posts
- Instructors can update posts in their courses
- Return 403 if unauthorized

### DELETE /api/community/posts/:postId

**Description:** Delete a community post (soft delete for audit trail)

**Response (204 No Content):**
No response body

**Access Control:**

- Only post author can delete their own posts
- Instructors can delete posts in their courses
- Admins can delete any posts
- Soft delete: mark as `deletedAt` in database

## Requirements

### Database Schema (Prisma)

```prisma
model CommunityPost {
  id String @id @default(cuid())
  content String @db.Text
  imageUrl String?
  imagePublicId String? // Cloudinary public ID for deletion
  authorId String
  author User @relation("PostAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  mentorId String
  mentor User @relation("PostMentor", fields: [mentorId], references: [id], onDelete: Cascade)

  // Relations for tags
  courseTags CommunityPostCourseTag[]
  topicTags CommunityPostTopicTag[]

  // Interactions
  likes CommunityPostLike[]
  comments CommunityPostComment[]
  bookmarks UserPostBookmark[]

  // Moderation
  isPinned Boolean @default(false)
  isHidden Boolean @default(false)
  deletedAt DateTime?

  // Metadata
  viewCount Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([mentorId])
  @@index([authorId])
  @@index([createdAt])
  @@index([isPinned, createdAt])
}

model CommunityPostCourseTag {
  id String @id @default(cuid())
  postId String
  post CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  courseId String
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([postId, courseId])
  @@index([courseId])
}

model CommunityPostTopicTag {
  id String @id @default(cuid())
  postId String
  post CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag String

  createdAt DateTime @default(now())

  @@index([postId])
  @@index([tag])
}

model CommunityPostLike {
  id String @id @default(cuid())
  postId String
  post CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId String
  user User @relation("PostLikes", fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([postId, userId])
  @@index([postId])
  @@index([userId])
}

model UserPostBookmark {
  id String @id @default(cuid())
  postId String
  post CommunityPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId String
  user User @relation("PostBookmarks", fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([postId, userId])
  @@index([userId])
}
```

### Access Control Implementation

```typescript
// Helper function to check if learner can view post
async function canViewPost(
  userId: string,
  postId: string,
  userRole: UserRole,
): Promise<boolean> {
  // Instructors and admins can view all posts
  if (userRole !== "LEARNER") {
    return true;
  }

  // Get post and check mentor
  const post = await db.communityPost.findUnique({
    where: { id: postId },
    select: { mentorId: true },
  });

  if (!post) return false;

  // Check if learner watched at least 1 lesson from this mentor
  const hasViewedLesson = await db.lessonView.findFirst({
    where: {
      userId,
      lesson: {
        course: {
          instructorId: post.mentorId,
        },
      },
    },
  });

  return !!hasViewedLesson;
}
```

### Rate Limiting

- Create post: 1 per minute per user (burst: 10/hour)
- Update post: 10 per minute per user
- Delete post: 10 per minute per user
- List posts: 100 per minute per user

### Cloudinary Integration

- Images uploaded to `/community-posts/{mentorId}/{postId}/` folder
- Use eager transformations for thumbnails (w_400,h_400,c_fill)
- Set up automatic deletion on post soft delete

## Acceptance Criteria

- [ ] GET /api/community/posts endpoint implemented with pagination
- [ ] Pagination correctly handles edge cases (empty results, final page)
- [ ] Access control verified: learners see only posts from mentors they've learned from
- [ ] POST /api/community/posts creates posts with validation (instructors only)
- [ ] Image upload to Cloudinary working with error handling
- [ ] Course and topic tags correctly linked to posts
- [ ] PUT /api/community/posts/:postId updates with access control
- [ ] DELETE /api/community/posts/:postId soft deletes with audit trail
- [ ] All endpoints include proper error handling and response codes
- [ ] Request/response validated with Zod schemas
- [ ] Rate limiting applied and tested
- [ ] Database migrations created and tested
- [ ] TypeScript types exported to api-client package
- [ ] Unit tests for access control logic
- [ ] Integration tests for all CRUD operations

## Dependencies

- `apps/api` - Hono.js setup from earlier milestone
- `packages/db` - Prisma with User, Course models
- `packages/validators` - Zod for schema validation
- Cloudinary account and API credentials
- Database migration tool (Prisma Migrate)
- Auth middleware from earlier milestone

## Technical Notes

### Performance Optimization

- Use database indexes on mentorId, authorId, createdAt for efficient querying
- Implement cursor-based pagination for large result sets
- Cache post counts per mentor (invalidate on new post)
- Use database query optimization with selective field selection
- Consider read replicas for high-traffic feed queries

### Image Handling Best Practices

- Validate image format and size on both client and server
- Use Cloudinary transformations instead of storing multiple sizes
- Set up image moderation using Cloudinary's AI content moderation
- Implement graceful fallback if image upload fails (store without image)
- Log all image deletion failures for manual cleanup

### Access Control Security

- Never trust client-provided user role; decode from JWT
- Always verify lesson enrollment server-side before allowing view
- Cache access control decisions carefully (invalidate on new enrollments)
- Log access control failures for security audits
- Test with multiple user roles to ensure no privilege escalation

### Error Handling

- Return 400 Bad Request for validation errors with detailed messages
- Return 401 Unauthorized if user not authenticated
- Return 403 Forbidden if user lacks access (don't leak post existence)
- Return 404 Not Found for deleted posts or invalid IDs
- Return 429 Too Many Requests if rate limited
- Return 500 Internal Server Error with error ID for debugging

### Database Transactions

- Wrap post creation with likes/comments in transaction for consistency
- Use transaction for updating post when tagging courses
- Handle transaction rollback on Cloudinary upload failure

### Monitoring and Logging

- Log all post creation with user ID and mentor ID
- Track failed access control checks (potential attacks)
- Monitor image upload failures
- Alert on unusual posting patterns (spam detection)
