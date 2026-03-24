# Task 11: Community Tables

## Description

Create tables for community features including user posts, comments, likes, and reporting system. Enables learners and instructors to engage in course-specific discussions, share tips, and report inappropriate content for moderation.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (community endpoints)
- `apps/web-learner` (post creation and discussion)
- `apps/web-mentor` (community moderation)
- `apps/web-admin` (report resolution and moderation)

## Requirements

### Community Posts Table

Create table `community_posts`:

| Column          | Type           | Constraints                | Description                                |
| --------------- | -------------- | -------------------------- | ------------------------------------------ |
| `id`            | `UUID`         | PK, Default: `uuid_v7()`   | Unique post identifier                     |
| `author_id`     | `UUID`         | FK → users(id), NOT NULL   | Post author                                |
| `course_id`     | `UUID`         | FK → courses(id), NULL     | Associated course (optional)               |
| `title`         | `VARCHAR(255)` | NULL                       | Post title (optional for text posts)       |
| `content`       | `TEXT`         | NOT NULL                   | Post content (markdown supported)          |
| `post_type`     | `VARCHAR(50)`  | NOT NULL                   | Enum: text, image, video, audio            |
| `media_urls`    | `TEXT[]`       | DEFAULT: ARRAY[]::TEXT[]   | Array of media URLs (R2)                   |
| `is_pinned`     | `BOOLEAN`      | DEFAULT: FALSE             | Pin to top of course community             |
| `is_hidden`     | `BOOLEAN`      | DEFAULT: FALSE             | Hide from community (soft delete)          |
| `visibility`    | `VARCHAR(50)`  | DEFAULT: 'public'          | Enum: public, course_members_only, private |
| `like_count`    | `INTEGER`      | DEFAULT: 0                 | Denormalized like count                    |
| `comment_count` | `INTEGER`      | DEFAULT: 0                 | Denormalized comment count                 |
| `created_at`    | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Post creation time                         |
| `updated_at`    | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last edit time                             |

### Indexes for Community Posts Table

- Primary Key: `id`
- Index: `(author_id)` - find user's posts
- Index: `(course_id)` - find course posts
- Index: `(course_id, is_hidden)` - find visible course posts
- Index: `(course_id, is_pinned, created_at)` - pinned posts first, then recent
- Index: `(created_at)` - recent posts
- Index: `(like_count DESC)` - popular posts
- Partial Index: `(course_id)` WHERE `is_hidden = false` - visible posts only

### Comments Table

Create table `comments`:

| Column              | Type        | Constraints                    | Description                         |
| ------------------- | ----------- | ------------------------------ | ----------------------------------- |
| `id`                | `UUID`      | PK, Default: `uuid_v7()`       | Unique comment identifier           |
| `author_id`         | `UUID`      | FK → users(id), NOT NULL       | Comment author                      |
| `post_id`           | `UUID`      | FK → community_posts(id), NULL | Parent post (for post comments)     |
| `lesson_id`         | `UUID`      | FK → lessons(id), NULL         | Parent lesson (for lesson comments) |
| `parent_comment_id` | `UUID`      | FK → comments(id), NULL        | Parent comment (for replies)        |
| `content`           | `TEXT`      | NOT NULL                       | Comment text (markdown supported)   |
| `is_hidden`         | `BOOLEAN`   | DEFAULT: FALSE                 | Hide comment from community         |
| `like_count`        | `INTEGER`   | DEFAULT: 0                     | Denormalized like count             |
| `reply_count`       | `INTEGER`   | DEFAULT: 0                     | Number of replies (denormalized)    |
| `created_at`        | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`     | Comment creation time               |
| `updated_at`        | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`     | Last edit time                      |

### Constraints for Comments

- Check: Either post_id OR lesson_id must be NOT NULL
- Cannot have both post_id and lesson_id

### Indexes for Comments Table

- Primary Key: `id`
- Index: `(author_id)` - find user's comments
- Index: `(post_id)` - find post comments
- Index: `(lesson_id)` - find lesson comments
- Index: `(parent_comment_id)` - find replies to comment
- Index: `(created_at)` - recent comments
- Index: `(post_id, is_hidden, created_at)` - visible post comments
- Index: `(lesson_id, is_hidden, created_at)` - visible lesson comments

### Likes Table

Create table `likes`:

| Column       | Type        | Constraints                    | Description                   |
| ------------ | ----------- | ------------------------------ | ----------------------------- |
| `id`         | `UUID`      | PK, Default: `uuid_v7()`       | Unique like record identifier |
| `user_id`    | `UUID`      | FK → users(id), NOT NULL       | User who liked                |
| `post_id`    | `UUID`      | FK → community_posts(id), NULL | Liked post                    |
| `comment_id` | `UUID`      | FK → comments(id), NULL        | Liked comment                 |
| `created_at` | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`     | Like creation time            |

### Constraints for Likes

- Check: Either post_id OR comment_id must be NOT NULL
- Cannot like both post and comment in same record

### Unique Constraints for Likes

- Composite unique: `(user_id, post_id)` where post_id NOT NULL - one like per user per post
- Composite unique: `(user_id, comment_id)` where comment_id NOT NULL - one like per user per comment

### Indexes for Likes Table

- Primary Key: `id`
- Index: `(user_id)` - find user's likes
- Index: `(post_id)` - find post likes
- Index: `(comment_id)` - find comment likes
- Index: `(created_at)` - recent likes

### Reports Table

Create table `reports`:

| Column          | Type          | Constraints                  | Description                                                        |
| --------------- | ------------- | ---------------------------- | ------------------------------------------------------------------ |
| `id`            | `UUID`        | PK, Default: `uuid_v7()`     | Unique report identifier                                           |
| `reporter_id`   | `UUID`        | FK → users(id), NOT NULL     | User reporting content                                             |
| `target_type`   | `VARCHAR(50)` | NOT NULL                     | Enum: course, post, comment, user                                  |
| `target_id`     | `UUID`        | NOT NULL                     | ID of reported content                                             |
| `category`      | `VARCHAR(50)` | NOT NULL                     | Enum: spam, harassment, copyright, explicit, misinformation, other |
| `description`   | `TEXT`        | NOT NULL                     | Report details                                                     |
| `evidence_urls` | `TEXT[]`      | NULL                         | Links to evidence                                                  |
| `status`        | `VARCHAR(50)` | NOT NULL, DEFAULT: 'pending' | Enum: pending, reviewed, resolved, dismissed                       |
| `severity`      | `VARCHAR(50)` | DEFAULT: 'medium'            | Enum: low, medium, high, critical                                  |
| `reviewed_by`   | `UUID`        | FK → users(id), NULL         | Admin who reviewed                                                 |
| `resolution`    | `TEXT`        | NULL                         | What action was taken                                              |
| `action_taken`  | `VARCHAR(50)` | NULL                         | Enum: removed, warned, suspended, dismissed                        |
| `created_at`    | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`   | Report submission                                                  |
| `reviewed_at`   | `TIMESTAMP`   | NULL                         | When reviewed                                                      |

### Indexes for Reports Table

- Primary Key: `id`
- Index: `(reporter_id)` - find user's reports
- Index: `(target_type, target_id)` - find reports for specific content
- Index: `(status)` - filter by status
- Index: `(severity)` - filter by severity
- Index: `(reviewed_at)` - recent reviews
- Partial Index: `(status, created_at)` WHERE `status = 'pending'` - pending reports queue

### Blocked Users Table

Create table `blocked_users`:

| Column       | Type          | Constraints                | Description                   |
| ------------ | ------------- | -------------------------- | ----------------------------- |
| `id`         | `UUID`        | PK, Default: `uuid_v7()`   | Unique block record           |
| `blocker_id` | `UUID`        | FK → users(id), NOT NULL   | User doing the blocking       |
| `blocked_id` | `UUID`        | FK → users(id), NOT NULL   | User being blocked            |
| `reason`     | `VARCHAR(50)` | NULL                       | Enum: harassment, spam, other |
| `created_at` | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()` | When blocked                  |

### Unique Constraint for Blocked Users

- Composite unique: `(blocker_id, blocked_id)` - one block per pair

### Indexes for Blocked Users Table

- Primary Key: `id`
- Index: `(blocker_id)` - find who user blocked
- Index: `(blocked_id)` - find who blocked user
- Index: `(blocker_id, blocked_id)` - check if specific user is blocked

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE post_type AS ENUM ('text', 'image', 'video', 'audio');
CREATE TYPE post_visibility AS ENUM ('public', 'course_members_only', 'private');
CREATE TYPE report_category AS ENUM ('spam', 'harassment', 'copyright', 'explicit', 'misinformation', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE report_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE report_action AS ENUM ('removed', 'warned', 'suspended', 'dismissed');
CREATE TYPE block_reason AS ENUM ('harassment', 'spam', 'other');
```

### Drizzle Schema Definition

In `packages/db/src/schema/community.ts`:

- Define `communityPosts` table
- Define `comments` table with self-reference for replies
- Define `likes` table (union type for post/comment likes)
- Define `reports` table
- Define `blockedUsers` table
- Use `relations()` for:
  - posts ↔ comments (one-to-many)
  - comments ↔ comments (self-reference for replies)
  - users ↔ posts (one-to-many via author_id)
  - users ↔ comments (one-to-many via author_id)
  - users ↔ likes (one-to-many)
  - posts ↔ likes (one-to-many)
  - comments ↔ likes (one-to-many)

## Database Tables

### community_posts

- **Purpose**: User-generated posts in course communities
- **Row estimate**: ~1M-10M posts (varies by engagement)
- **Key relationships**: N:1 with users, N:1 with courses, 1:N with comments

### comments

- **Purpose**: Replies and discussions on posts and lessons
- **Row estimate**: ~5M-50M comments (typically 5-10:1 comment:post ratio)
- **Key relationships**: N:1 with users, N:1 with posts/lessons, N:1 with comments (replies)

### likes

- **Purpose**: Track user engagement (post/comment likes)
- **Row estimate**: ~10M-100M likes
- **Key relationships**: N:1 with users, N:1 with posts/comments

### reports

- **Purpose**: Content moderation queue
- **Row estimate**: ~10K-100K reports (1-2% of posts)
- **Key relationships**: N:1 with users (reporter and reviewer)

### blocked_users

- **Purpose**: User blocking feature
- **Row estimate**: ~100K-1M blocks
- **Key relationships**: N:1 with users (blocker and blocked)

## Acceptance Criteria

- [ ] `community_posts` table created with post_type enum
- [ ] `comments` table created with post and lesson support
- [ ] `comments` supports nested replies (parent_comment_id)
- [ ] Check constraint enforces post_id OR lesson_id in comments
- [ ] `likes` table supports post and comment likes
- [ ] Unique constraints prevent duplicate likes
- [ ] `reports` table created with comprehensive fields
- [ ] `blocked_users` table prevents blocked users from seeing posts
- [ ] All denormalized counts (like_count, comment_count) updatable
- [ ] Pinned posts appear first in community
- [ ] Hidden posts/comments not visible to regular users
- [ ] All indexes created for efficient queries
- [ ] All timestamps use UTC timezone
- [ ] Test data with posts, comments, likes, and reports
- [ ] Test post and comment visibility
- [ ] Test blocking functionality
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 06: Courses, Modules, and Lessons Tables

## Technical Notes

### Post Visibility

- **public** - Visible to all logged-in users
- **course_members_only** - Only enrolled learners can see
- **private** - Only author and admin can see

### Post Types

- **text** - Text content only (with markdown)
- **image** - Text + image media
- **video** - Text + video media
- **audio** - Text + audio media

### Media Storage

- Media URLs point to R2 Cloudflare
- Format: `https://r2-bucket.example.com/posts/{post_id}/{filename}`
- Multiple media per post stored in array

### Comment Threading

- `parent_comment_id` enables nested replies (1-2 levels deep)
- Limit nesting depth to prevent too-deep trees
- Display replies indented under parent comment
- Collapse/expand long threads

### Denormalized Counts

- `like_count` and `comment_count` on posts (updated on like/comment)
- `like_count` and `reply_count` on comments
- Update via database triggers or application logic
- Enable fast sorting by popularity

### Pinned Posts

- Course instructor can pin helpful posts
- `is_pinned = true` posts appear first in community
- Limit to 3-5 pinned posts per course
- Display different styling for pinned

### Moderation Workflow

1. Community members report inappropriate content
2. Reports appear in admin queue (pending)
3. Admin reviews report and views reported content
4. Admin resolves: removed, warned, suspended, or dismissed
5. User notification if action taken

### Report Severity Levels

- **low** - Minor issues, review when time permits
- **medium** - Violations but not urgent
- **high** - Serious violations, review soon
- **critical** - Imminent harm, immediate action needed

### Report Actions

- **removed** - Post/comment deleted, user notified
- **warned** - User notified but content stays (first offense)
- **suspended** - User temporarily suspended from community
- **dismissed** - Report investigated, no action needed

### Blocking Implementation

Query to hide blocked users' content:

```typescript
// Get unblocked posts from course
const blockedUserIds = await db
  .select()
  .from(blockedUsers)
  .where(eq(blockedUsers.blockerId, userId))
  .then((rows) => rows.map((r) => r.blockedId));

const posts = await db
  .select()
  .from(communityPosts)
  .where(
    and(
      eq(communityPosts.courseId, courseId),
      eq(communityPosts.isHidden, false),
      notInArray(communityPosts.authorId, blockedUserIds),
    ),
  );
```

### Query Patterns

```typescript
// Get course community posts (ordered)
db.select()
  .from(communityPosts)
  .where(
    and(
      eq(communityPosts.courseId, courseId),
      eq(communityPosts.isHidden, false),
    ),
  )
  .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt));

// Get post comments with reply counts
db.select()
  .from(comments)
  .where(
    and(
      eq(comments.postId, postId),
      isNull(comments.parentCommentId), // Top-level only
      eq(comments.isHidden, false),
    ),
  )
  .orderBy(desc(comments.likeCount), asc(comments.createdAt));

// Get pending reports for admin review
db.select()
  .from(reports)
  .where(eq(reports.status, "pending"))
  .orderBy(desc(reports.severity), asc(reports.createdAt));
```

### Spam Prevention

- Track post creation frequency (rate limit)
- Prevent duplicate posts from same user within short time
- Auto-hide posts from new accounts (< 7 days old) until mod review
- Monitor report patterns (users with many reports)

### Content Moderation Workflow

```typescript
// Auto-hide posts from new users
if (user.createdAt > NOW - INTERVAL '7 days') {
  post.isHidden = true;
  post.needsModReview = true;
}

// Auto-escalate critical reports
if (report.severity === 'critical') {
  escalateToAdmin(report);
}
```

### Testing Considerations

- Test post creation and visibility
- Test comment threading and replies
- Test like functionality (prevent duplicate likes)
- Test blocking users (content hidden)
- Test post pinning
- Test report submission and resolution
- Test comment and post deletion
- Test cascade delete (deleting post deletes comments)
- Test denormalized count updates

### Performance Optimization

- Partial index on unmoderated posts: `WHERE is_hidden = false`
- Partial index on pending reports: `WHERE status = 'pending'`
- Cache course community posts (updated frequently, read much)
- Limit comment depth (prevent N+1 on replies to replies)
- Pagination on large comment threads (load 20 at a time)

### Community Guidelines

- Display in app during post creation
- Check for flagged keywords (automated)
- Manual review of high-severity reports
- Appeal process for removed content
- Warning escalation: warning → suspension → ban
