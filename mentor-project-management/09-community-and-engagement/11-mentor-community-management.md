# Mentor Community Management Tools

## Description

Implement mentor-side community management tools within the Mentor web app (web-instructor). Enable instructors to create posts (text, images, audio) to course-specific community feeds, pin/unpin posts for visibility, hide/delete inappropriate comments from their courses' community feeds, reply to learner questions, and view engagement metrics per post (views, likes, comments). Integrate moderation queue showing reported content from their courses. Support bulk actions for efficient comment management. Deliver real-time notifications when new community activity occurs on their courses. Must integrate with existing community feed API (milestone 09, task 01) and post interactions API (milestone 09, task 04).

## Affected Apps/Packages

- web-instructor (web app)
- backend API (community service, moderation service)
- community-adapter (shared package for community interactions)
- analytics-adapter (event tracking for community engagement)
- notification-service (real-time updates)

## API Endpoints

- `POST /api/courses/:courseId/community/posts` - Create community post
- `GET /api/courses/:courseId/community/posts` - Fetch posts for course
- `PUT /api/community/posts/:postId` - Update post (pin, content)
- `DELETE /api/community/posts/:postId` - Delete post
- `POST /api/community/posts/:postId/pin` - Pin post
- `DELETE /api/community/posts/:postId/pin` - Unpin post
- `POST /api/community/comments/:commentId/hide` - Hide comment
- `DELETE /api/community/comments/:commentId/hide` - Unhide comment
- `DELETE /api/community/comments/:commentId` - Delete comment
- `POST /api/community/posts/:postId/replies` - Reply to post/comment
- `GET /api/community/posts/:postId/metrics` - Fetch engagement metrics
- `GET /api/instructor/moderation-queue` - Fetch reported/flagged content
- `GET /api/instructor/:instructorId/community-activity` - Real-time activity stream
- `PUT /api/instructor/notification-preferences/community` - Update community notification settings

## Requirements

### Mentor Community Dashboard

- Dashboard landing page with:
  - Quick stats: total posts, total likes, avg engagement rate, this week's activity
  - Recent posts list (last 10 posts across all courses)
  - Moderation queue counter badge (number of reported items pending review)
  - Community activity feed (real-time updates)
  - Navigation tabs: All Courses, My Posts, Moderation Queue, Community Settings
- Responsive design: works on tablet and desktop (mentor workspace, not mobile)
- Sticky navigation: easy access to moderation queue from any page

### Create Community Posts

- Create Post button in community section of course detail page
- Post creation modal/form with:
  - Course selector (if instructor teaches multiple courses)
  - Post type selector: Text Only, Text + Image, Text + Audio (radio buttons)
  - Content textarea: min 10 chars, max 5000 chars (with counter)
  - Rich text editor (optional, nice-to-have): bold, italic, link, lists
  - Media upload:
    - Image: JPEG, PNG, WebP (max 10MB), auto-resize to 800x600px, preview
    - Audio: MP3, WAV, M4A (max 50MB), upload progress bar, preview player
  - Hashtags input: comma-separated list (optional, for discoverability)
  - Visibility toggle: Public (all learners), Private (pinned/featured only, advanced)
  - Draft functionality: auto-save draft every 30 seconds
  - Preview button: show how post will look before publishing
- Validation:
  - Client-side: content length, file size, required fields
  - Server-side: content sanitization, XSS prevention, file virus scan (optional)
  - Rate limiting: max 10 posts per day per instructor per course
- Post creation API: `POST /api/courses/:courseId/community/posts`
- Success: show success toast, refresh feed, show post in feed
- Error: specific error messages (e.g., "File too large")

### Post Management

- Post card display in instructor's community view:
  - Post title (if applicable) or first 100 chars of content
  - Author (self, always instructor)
  - Post timestamp (created date + time)
  - Post content preview (truncated if > 200 chars, "Read more" link)
  - Media thumbnail (image/audio player)
  - Pin status badge (if pinned)
  - Engagement stats: views count, likes count, comments count
  - Action buttons: Pin/Unpin, Edit, Delete, Hide, View Metrics
- Edit post functionality:
  - Only author can edit (enforce on backend)
  - Edit button → form pre-filled with current content
  - Cannot edit: post creation date, author
  - Can edit: content, hashtags, media (replace)
  - Show edit history: "Edited 2 hours ago" with edit timestamp
  - API: `PUT /api/community/posts/:postId`
  - Rate limiting: max 5 edits per post per day
- Delete post:
  - Delete button → confirmation modal: "Delete this post and all comments?"
  - Soft delete: hide from view, but keep data for moderation archive
  - API: `DELETE /api/community/posts/:postId`
  - Show confirmation: "Post deleted successfully"
- Pin post functionality:
  - Pin button → pins post to top of course community feed
  - Limit: max 3 pinned posts per course
  - Pin duration: can set expiration (e.g., "Pin for 7 days")
  - Visually distinguish pinned posts: pin icon, highlight background
  - API: `POST /api/community/posts/:postId/pin`
  - Unpin: `DELETE /api/community/posts/:postId/pin`
- Post metrics view:
  - Click "View Metrics" → open metrics modal/slide-out
  - Display:
    - Total views (count over time chart)
    - Total likes (engagement trend)
    - Total comments (activity timeline)
    - Engagement rate (likes + comments / views %)
    - Demographics (if available): learner segments engaging most
    - Time to first comment (in minutes)
    - Most common comment sentiment (positive/neutral/negative, optional)
  - API: `GET /api/community/posts/:postId/metrics`

### Community Feed View

- View community feed for each course with:
  - All posts from instructor + learner posts
  - Chronological order (newest first)
  - Filtering: All Posts, My Posts Only, Pinned Posts, Popular (most likes)
  - Search: search posts by content, hashtag, author
  - Sorting: by date, by likes, by comments, by views
- Instructor's own posts: highlighted/differentiated from learner posts
- Pagination: 10 posts per page or infinite scroll
- Post cards show:
  - Author (instructor badge if author is instructor)
  - Avatar, name
  - Post content with media
  - Engagement stats (views, likes, comments)
  - Pin status
  - Time since posted ("2 hours ago")

### Comment Management

- View comments on posts:
  - Comments list under each post (newest first)
  - Show first 3 comments, "Load more comments" button
  - Comment nesting: replies to comments are indented
  - Comment author, timestamp, content
- Comment moderation actions:
  - Hide comment: `POST /api/community/comments/:commentId/hide`
    - Hides from public view, visible only to instructor and original author (as notification)
    - Show "hidden by instructor" message to others
    - Use case: spam, off-topic, mildly inappropriate
  - Delete comment: `DELETE /api/community/comments/:commentId`
    - Permanent deletion, requires reason (optional reason field)
    - Use case: highly inappropriate, harmful content
    - Show "deleted by instructor" message
  - Unhide comment: `DELETE /api/community/comments/:commentId/hide`
    - Restore hidden comment to public view

- Bulk comment actions:
  - Checkbox to select multiple comments
  - Bulk action buttons: Hide All, Delete All, Unhide All
  - Confirmation modal: "Hide 5 comments?"
  - Execute bulk action in background (show progress)
  - API: support batch operations (e.g., `POST /api/community/comments/bulk-hide` with comment IDs)

- Reply to comments:
  - "Reply" button on each comment
  - Reply form appears below comment (inline)
  - Instructor reply content textarea
  - Formatting: can use text + mentions (@username)
  - Character limit: max 1000 chars
  - Validation: min 2 chars
  - Post reply: `POST /api/community/posts/:postId/replies`
  - Reply appears immediately (optimistic update)
  - Notify comment author: "Instructor replied to your comment"

### Moderation Queue

- Dedicated moderation queue tab in dashboard
- Displays all reported/flagged content from instructor's courses:
  - Reported comments (flagged by learners)
  - Reported posts (flagged by learners)
  - Spam detected (automatic detection)
  - Suspended users (if applicable)
- Queue item card shows:
  - Content preview (text truncated)
  - Report reason (user-provided)
  - Reported by (username or "auto-detected")
  - Report timestamp
  - Action buttons: Review, Hide, Delete, Keep, Mark Spam
- Review action:
  - Click "Review" → full content modal
  - Show context: full post/comment, thread, related posts
  - Show reporter information (if not auto-detected)
  - Show report reason
  - Action buttons: Hide, Delete, Mark Spam, Dismiss (no action needed)
- Moderation queue filters:
  - By type: Comments, Posts, Spam, Suspended Users
  - By status: Pending, Resolved, Dismissed
  - By severity: Low, Medium, High
- Pagination: 20 items per page
- Clear queue: bulk dismiss resolved items
- Analytics: track moderation metrics (items reviewed, actions taken)

### Real-Time Community Activity Notifications

- Real-time activity feed on dashboard:
  - New post published in course
  - New comment on instructor's post
  - Instructor's post received likes
  - Learner replied to instructor's comment
  - New reported content in moderation queue
  - Learner mention (@instructor_name) in comment
- Activity items show:
  - Timestamp (relative: "2 mins ago")
  - Activity type icon
  - Brief description ("Alice commented on your post")
  - Link to post/comment
  - Auto-refresh: new items appear at top
  - Optional: toast notification (if instructor is away from page)
- Integration with notification service:
  - WebSocket or Server-Sent Events (SSE) for real-time updates
  - Fallback: poll for updates every 30 seconds if WebSocket unavailable
  - API: `GET /api/instructor/:instructorId/community-activity`
- Activity notification preferences:
  - Settings: enable/disable activity types
  - Email digest: daily or weekly digest of activity
  - In-app notifications: enable/disable

### Community Engagement Analytics

- Engagement metrics dashboard (if not in individual post metrics):
  - Total community posts (all time)
  - Average engagement rate (likes + comments / views)
  - Most engaged post (by likes/comments)
  - Most active course (by posts/comments)
  - Engagement trend (last 30 days)
  - Learner participation rate (% of enrolled learners who posted/commented)
- Charts:
  - Line chart: posts + comments over time
  - Bar chart: engagement by course
  - Pie chart: post type distribution (text vs image vs audio)

### Instructor-Learner Interaction

- Instructor presence badge: show when instructor is online
- Mention system: learners can @mention instructor, instructor gets notification
- Direct messaging (optional, nice-to-have): within community context
- Community guidelines modal: instructors can view/set community rules for their course

### Responsive Design

- Desktop-first: full feature set on desktop (1200px+)
- Tablet (768px-1199px):
  - Moderation queue collapses to modal/drawer
  - Post metrics in slide-out panel
  - Touch-friendly buttons (min 44px)
- Mobile (< 768px): not primary use case, but basic view:
  - Mobile view shows posts in feed
  - Moderation queue link navigates to separate page
  - Metrics, edit, delete in dropdown menu
- Test on: 1920px, 1200px, 768px

### Performance & UX

- Lazy load images: low-quality placeholders, full-quality on scroll
- Comment list pagination: load 10 comments initially, "Load more" button
- Debounce search: wait 300ms after user stops typing before searching
- Optimistic updates: UI updates immediately, rollback if API fails
- Loading states: skeleton loaders for feeds, spinners for actions
- Error handling: specific error messages, retry buttons
- Empty states: "No community posts yet" with CTA to create first post
- Undo functionality (optional): can undo delete/hide within 30 seconds

### Accessibility

- WCAG 2.1 AA compliant
- Semantic HTML: `<article>` for posts, `<section>` for comments
- ARIA labels: buttons, modals, activity feed
- Keyboard navigation: Tab through posts, comments, action buttons
- Focus management: modal focus trap, return focus after close
- Color contrast: min 4.5:1 for text
- Screen reader testing: posts, comments, metrics all announced correctly
- Form labels: associated with form controls

### Security

- HTTPS only: all community data encrypted
- XSS prevention: sanitize all user-generated content (posts, comments)
- CSRF protection: include CSRF token in API requests
- Rate limiting: prevent spam (max 10 posts/day, max 50 comments/day)
- Access control: instructors can only manage their own courses' community
- Sensitive data: no personal info in public community posts (enforce character limits)
- File upload validation: check MIME type, file size, scan for malware (optional)
- Moderator audit log: log all moderation actions (hide, delete) with instructor ID, timestamp

### Moderation Best Practices

- Provide clear moderation guidelines
- Show reasoning: when hiding/deleting, optionally provide feedback to learner
- Escalation: path to escalate to super-admin if content needs higher-level review
- Community standards template: instructors can set course-specific community standards
- Automated rules (optional): auto-hide posts with spam keywords, multiple reports
- Appeal process: learners can appeal hidden/deleted content (optional)

## Acceptance Criteria

- [ ] Community dashboard created with quick stats and navigation tabs
- [ ] Create post functionality: text, image, audio support
- [ ] Post validation: min 10 chars, max 5000 chars, file size limits
- [ ] Rate limiting enforced: max 10 posts/day per instructor per course
- [ ] Post editing: content, media, hashtags (edit history tracked)
- [ ] Post deletion: soft delete, confirmation modal
- [ ] Pin/unpin posts: max 3 pinned per course, expiration optional
- [ ] View post metrics: views, likes, comments, engagement rate, trends
- [ ] Community feed: chronological, filterable, searchable, sortable
- [ ] Comment viewing: nested, paginated, instructor comments highlighted
- [ ] Comment moderation: hide, delete, unhide actions
- [ ] Bulk comment actions: select multiple, bulk hide/delete/unhide
- [ ] Reply to comments: inline reply form, mentions support
- [ ] Moderation queue: displays reported content with filters and bulk actions
- [ ] Real-time activity notifications: WebSocket or SSE implementation
- [ ] Activity feed: displays on dashboard with auto-refresh
- [ ] Community engagement analytics: total posts, engagement rate, trends
- [ ] Responsive design: tested on desktop (1200px+), tablet, mobile
- [ ] Lazy loading: images, comments pagination
- [ ] Optimistic updates: UI updates immediately, rollback if fails
- [ ] Loading states: skeleton loaders, spinners for async operations
- [ ] Error handling: specific messages, retry buttons
- [ ] Empty states: clear CTAs
- [ ] Undo functionality: can undo delete/hide within 30 seconds (optional)
- [ ] Accessibility: WCAG 2.1 AA, keyboard navigation, screen reader tested
- [ ] Security: HTTPS, XSS prevention, CSRF protection, rate limiting, access control
- [ ] Audit log: all moderation actions logged with instructor ID, timestamp
- [ ] Integration: works with community feed API (milestone 09, task 01) and post interactions (task 04)
- [ ] Testing: unit tests for moderation logic, integration tests for API calls
- [ ] Documentation: component API, state management, moderation guidelines

## Dependencies

- React Hook Form (form state management)
- react-quill or slate.js (rich text editor, optional)
- React Query or SWR (server state management)
- Socket.io or native WebSocket (real-time updates)
- Community adapter (milestone 09, task 01)
- Post interactions API (milestone 09, task 04)
- Analytics adapter (milestone 13, task 13) for engagement tracking
- Design system components (Button, Modal, Input, Card, Chart, Avatar)
- Chart library (recharts, chart.js) for metrics
- Image uploader library (react-dropzone)
- Audio player library (react-audio-player or html5 `<audio>`)

## Technical Notes

- Moderation queue: prioritize high-severity reports, auto-resolve after 30 days if no action
- Real-time updates: use polling (30s interval) as fallback if WebSocket unavailable
- Post metrics: cache for 5 minutes to avoid excessive API calls
- Comment pagination: consider cursor-based pagination for large threads (1000+ comments)
- Batch operations: implement on backend for efficiency (hide 100 comments in one query)
- Soft delete: keep deleted content in database for 90 days before permanent deletion
- Spam detection: can use Akismet, OpenAI moderation API, or custom keyword filtering
- Mention system: use @username syntax, notify mentioned user
- Community guidelines: store per-course, fetched on community feed load
- Profanity filter: optional, can use library like bad-words or custom list
- Sentiment analysis: optional enhancement to flag potentially negative comments
- IP logging: store IP of post/comment author for moderation history
- Instructor online status: use Redis or in-memory store with heartbeat (30s timeout)
- Performance: index community posts by course_id, created_at for fast queries
