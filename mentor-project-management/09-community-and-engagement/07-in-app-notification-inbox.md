# Task 7: In-App Notification Inbox

## Description

Implement an in-app notification inbox where users can view their notifications, mark as read/unread, see notification types (new course, comment reply, subscription reminder, enrollment, payout, community activity), view badge count, and receive real-time updates. Build database schema, API endpoints, and UI components for web and mobile.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for notifications
- `packages/ui` - React components for web
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API client hooks
- `apps/web-learner` - Learner web app
- `apps/web-mentor` - Mentor web app
- `apps/mobile` - React Native mobile app

## Database Schema (Prisma)

```prisma
enum NotificationType {
  COURSE_NEW
  COURSE_UPDATED
  LESSON_PUBLISHED
  COMMENT_REPLY
  POST_LIKED
  QUESTION_ANSWERED
  SUBSCRIPTION_REMINDER
  ENROLLMENT_NEW
  ENROLLMENT_CONFIRMATION
  PAYOUT_PROCESSED
  PAYOUT_PENDING
  COMMUNITY_POST
  COMMUNITY_MENTION
  COMMUNITY_ACTIVITY
  INSTRUCTOR_NEW_QUESTION
  INSTRUCTOR_ENROLLMENT
  INSTRUCTOR_COMMENT
}

model Notification {
  id String @id @default(cuid())

  userId String
  user User @relation("Notifications", fields: [userId], references: [id], onDelete: Cascade)

  type NotificationType
  title String
  body String @db.Text
  icon String? // URL to icon
  image String? // URL to preview image

  // Context/metadata for deep linking
  relatedId String? // postId, commentId, courseId, lessonId, etc.
  relatedType String? // "post", "comment", "course", "lesson", etc.
  deepLink String? // "/community/posts/123" or "/courses/456/lessons/789"

  // Read status
  isRead Boolean @default(false)
  readAt DateTime?

  // Grouping for batched notifications
  groupKey String? // "comment-post-123" to batch similar notifications
  groupCount Int @default(1) // "5 new comments on your post"

  // Priority
  priority String @default("normal") // "low", "normal", "high"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([type])
  @@index([isRead])
  @@index([createdAt])
  @@index([userId, isRead, createdAt])
  @@index([groupKey])
}

// Extend User model
extend model User {
  notifications Notification[]
  unreadNotificationCount Int @default(0) // Denormalized for perf
}
```

## API Endpoints

### GET /api/notifications

**Description:** Retrieve paginated notifications for current user

**Query Parameters:**

- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 20, max: 100)
- `type` (string, optional) - Filter by notification type
- `isRead` (boolean, optional) - Filter by read status
- `sortBy` (enum: "recent", "oldest", optional, default: "recent")

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "notif_123",
      "type": "COMMENT_REPLY",
      "title": "New comment on your post",
      "body": "Sarah commented: 'Great tips! I'll try this.'",
      "icon": "https://cdn.example.com/icon-comment.png",
      "image": null,
      "relatedId": "comment_456",
      "relatedType": "comment",
      "deepLink": "/community/posts/post_789",
      "isRead": false,
      "readAt": null,
      "groupCount": 1,
      "priority": "normal",
      "createdAt": "2024-02-18T10:30:00Z"
    },
    {
      "id": "notif_124",
      "type": "SUBSCRIPTION_REMINDER",
      "title": "Subscription ending soon",
      "body": "Your subscription ends in 3 days. Renew now to keep access.",
      "isRead": false,
      "readAt": null,
      "groupCount": 1,
      "deepLink": "/subscription/renew",
      "createdAt": "2024-02-18T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "hasMore": true,
    "unreadCount": 8,
    "badgeCount": 8
  }
}
```

### POST /api/notifications/:notificationId/read

**Description:** Mark notification as read

**Request Body:**

```json
{
  "isRead": true
}
```

**Response (200 OK):**

```json
{
  "id": "notif_123",
  "isRead": true,
  "readAt": "2024-02-18T14:00:00Z"
}
```

### POST /api/notifications/read-all

**Description:** Mark all notifications as read

**Response (200 OK):**

```json
{
  "updatedCount": 8,
  "unreadCount": 0
}
```

### DELETE /api/notifications/:notificationId

**Description:** Delete a notification

**Response (204 No Content):**

### DELETE /api/notifications

**Description:** Delete all read notifications

**Query Parameters:**

- `olderThan` (ISO date string, optional) - Delete only notifications older than date

**Response (200 OK):**

```json
{
  "deletedCount": 45
}
```

### GET /api/notifications/unread-count

**Description:** Get badge count of unread notifications (lightweight endpoint)

**Response (200 OK):**

```json
{
  "unreadCount": 8,
  "hasUnread": true
}
```

## Notification Types

### Learner Notifications

| Type                    | Title                    | Body                                          | Deep Link                                |
| ----------------------- | ------------------------ | --------------------------------------------- | ---------------------------------------- |
| COURSE_NEW              | New course available     | "[Mentor] published [Course Name]"            | `/courses/{courseId}`                    |
| COURSE_UPDATED          | Course updated           | "[Course Name] was updated with new content"  | `/courses/{courseId}`                    |
| LESSON_PUBLISHED        | New lesson available     | "[Course Name] - New lesson: [Lesson Name]"   | `/courses/{courseId}/lessons/{lessonId}` |
| COMMENT_REPLY           | New comment              | "[User] commented on your post"               | `/community/posts/{postId}`              |
| POST_LIKED              | Post liked               | "[User] liked your post"                      | `/community/posts/{postId}`              |
| QUESTION_ANSWERED       | Answer to your question  | "[Mentor] answered your question on [Lesson]" | `/lessons/{lessonId}/qa/{qaId}`          |
| SUBSCRIPTION_REMINDER   | Subscription ending soon | "Your subscription ends in X days"            | `/subscription/renew`                    |
| ENROLLMENT_CONFIRMATION | Enrollment confirmed     | "You're enrolled in [Course Name]"            | `/courses/{courseId}`                    |
| COMMUNITY_ACTIVITY      | New in community         | "New posts from [Mentor] you follow"          | `/community`                             |

### Instructor Notifications

| Type                    | Title            | Body                                     | Deep Link                                 |
| ----------------------- | ---------------- | ---------------------------------------- | ----------------------------------------- |
| INSTRUCTOR_NEW_QUESTION | New question     | "[User] asked a question on [Lesson]"    | `/lessons/{lessonId}/qa/{qaId}`           |
| INSTRUCTOR_ENROLLMENT   | New enrollment   | "[User] enrolled in [Course Name]"       | `/instructor/courses/{courseId}/students` |
| INSTRUCTOR_COMMENT      | New comment      | "[User] commented on a post in [Course]" | `/instructor/community/post/{postId}`     |
| PAYOUT_PROCESSED        | Payout completed | "Payout of ${amount} processed"          | `/instructor/payouts/{payoutId}`          |
| PAYOUT_PENDING          | Payout pending   | "Your payout is being processed"         | `/instructor/payouts`                     |
| COURSE_NEW              | Course published | "Your course [Course Name] is now live"  | `/instructor/courses/{courseId}`          |

## UI Components (Web)

### 1. NotificationBell Component

**Location:** `packages/ui/src/components/NotificationBell.tsx`

**Props:**

```typescript
interface NotificationBellProps {
  badgeCount?: number;
  onClick?: () => void;
  unreadOnly?: boolean;
}
```

**Features:**

- Bell icon with badge showing unread count
- Badge color changes based on priority/count
- Accessible (aria-label, aria-live)
- Tooltip showing number of unread
- Loading spinner while fetching count
- Real-time update of badge count

### 2. NotificationInbox Component

**Location:** `packages/ui/src/components/NotificationInbox.tsx`

**Props:**

```typescript
interface NotificationInboxProps {
  isOpen: boolean;
  onClose?: () => void;
  notificationType?: string; // Filter by type
}
```

**Features:**

- Modal or drawer that opens from notification bell
- List of notifications with infinite scroll
- "Mark all as read" button
- "Clear all" button (delete read notifications)
- Filter by type (dropdown/tabs)
- Sort options (recent, oldest)
- Empty state message

**Layout:**

```
┌──────────────────────────┐
│ Notifications ×          │
├──────────────────────────┤
│ [Mark all as read]       │
│ [Filters] [Sort]         │
├──────────────────────────┤
│ ☐ [Notification 1]       │
│   Title                  │
│   Body text...           │
│   2 hours ago            │
│   [Mark as read] [Delete]│
├──────────────────────────┤
│ ☐ [Notification 2]       │
│   ...                    │
└──────────────────────────┘
```

### 3. NotificationCard Component

**Location:** `packages/ui/src/components/NotificationCard.tsx`

**Props:**

```typescript
interface NotificationCardProps {
  notification: Notification;
  onRead?: (id: string, isRead: boolean) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: Notification) => void;
}
```

**Features:**

- Unread indicator (dot or highlight)
- Icon/image
- Title and body preview (truncate long text)
- Timestamp (relative: "2 hours ago")
- Mark as read/unread toggle
- Delete button
- Click to navigate to related content
- Group badge showing "5 new comments on your post"

**Styling:**

- Bold text and light background for unread
- Normal text and white background for read
- Hover effects for interactivity

### 4. NotificationPage Component (Dedicated Page)

**Location:** `apps/web-learner/src/pages/notifications.tsx`

**Features:**

- Full-page notification center
- Filter by type (tabs or dropdown)
- Filter by read status
- Infinite scroll or pagination
- "Mark all as read" button
- "Clear all read" button
- Sort options
- Search/filter by keyword (optional)

## React Hooks (API Client)

### useNotifications Hook

```typescript
interface UseNotificationsOptions {
  pageSize?: number;
  type?: string;
  isRead?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications", options.type, options.isRead],
    queryFn: ({ pageParam = 1 }) =>
      api.notifications.getNotifications({
        page: pageParam,
        limit: options.pageSize ?? 20,
        type: options.type,
        isRead: options.isRead,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
  });

  const notifications = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const unreadCount = useMemo(
    () => data?.pages[0]?.pagination?.unreadCount ?? 0,
    [data],
  );

  const markAsRead = useMutation({
    mutationFn: (notificationId: string) =>
      api.notifications.markAsRead(notificationId, true),
    onMutate: (notificationId) => {
      // Optimistic update
      queryClient.setQueryData(["notifications"], (old) => {
        // Update notification to read
        return old;
      });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
  });

  const deleteNotification = useMutation({
    mutationFn: (notificationId: string) =>
      api.notifications.delete(notificationId),
  });

  return {
    notifications,
    isLoading,
    error,
    loadMore: fetchNextPage,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    unreadCount,
    markAsRead: markAsRead.mutateAsync,
    markAllAsRead: markAllAsRead.mutateAsync,
    deleteNotification: deleteNotification.mutateAsync,
  };
}
```

### useUnreadCount Hook

```typescript
export function useUnreadCount() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.notifications.getUnreadCount(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      // Refetch unread count
      queryClient.invalidateQueries(["notifications", "unread-count"]);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    unreadCount: data?.unreadCount ?? 0,
    hasUnread: (data?.unreadCount ?? 0) > 0,
    isLoading,
  };
}
```

## Mobile Components

### 1. NotificationBadge Component

**Location:** `packages/ui-mobile/src/components/NotificationBadge.tsx`

**Props:**

```typescript
interface NotificationBadgeProps {
  count: number;
  variant?: "dot" | "badge";
}
```

**Features:**

- Red badge with count
- Or simple red dot if count is 0
- Animated pulse effect

### 2. NotificationListScreen Component

**Location:** `apps/mobile/src/screens/NotificationListScreen.tsx`

**Features:**

- FlatList with notifications
- Pull-to-refresh
- Load more pagination
- Swipe to mark as read/delete
- Tap on notification to navigate
- Empty state

### 3. NotificationCardMobile Component

**Location:** `packages/ui-mobile/src/components/NotificationCardMobile.tsx`

**Features:**

- Vertical layout (touch-friendly)
- Swipe actions (mark as read, delete)
- Unread indicator (dot/highlight)
- Full-width tappable area
- Image preview if available

## Real-Time Updates

### Option 1: Polling (Simpler)

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    queryClient.invalidateQueries(["notifications"]);
  }, 30000); // Poll every 30 seconds

  return () => clearInterval(interval);
}, []);
```

### Option 2: WebSocket (Advanced)

```typescript
useEffect(() => {
  const ws = new WebSocket(`${WS_URL}/notifications?token=${token}`);

  ws.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    // Update notification list
    queryClient.setQueryData(["notifications"], (old) => {
      return [notification, ...old];
    });
  };

  return () => ws.close();
}, [token]);
```

### Option 3: Server-Sent Events (Middle Ground)

```typescript
useEffect(() => {
  const eventSource = new EventSource(
    `/api/notifications/stream?token=${token}`,
  );

  eventSource.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    queryClient.setQueryData(["notifications"], (old) => {
      return [notification, ...old];
    });
  };

  return () => eventSource.close();
}, [token]);
```

## Notification Grouping/Batching

### Grouping Strategy

```typescript
// Multiple notifications on same post should be grouped
// "5 new comments on your post: Tips for Mature Skin"

const groupKey = `COMMENT_REPLY-post-${postId}`;

// Create/update grouped notification
const existing = await db.notification.findFirst({
  where: {
    userId,
    groupKey,
    isRead: false,
  },
});

if (existing) {
  // Update group count
  await db.notification.update({
    where: { id: existing.id },
    data: {
      groupCount: existing.groupCount + 1,
      body: `${existing.groupCount + 1} new comments on your post`,
      updatedAt: new Date(),
    },
  });
} else {
  // Create new grouped notification
  await db.notification.create({
    data: {
      userId,
      type: "COMMENT_REPLY",
      title: "New comments on your post",
      body: "1 new comment on your post",
      relatedId: postId,
      groupKey,
      groupCount: 1,
    },
  });
}
```

## Requirements

### Database Indexing

- `userId, isRead, createdAt` - Most important for queries
- `userId, type, createdAt` - For filtered queries
- `groupKey` - For batch operations
- `createdAt` - For cleanup jobs

### Read Status Tracking

- Track when notification marked as read (readAt timestamp)
- Update user.unreadNotificationCount on read/unread
- Only count for last 30 days (older notifications not critical)

### Cleanup/Archival

- Delete read notifications after 30 days
- Or archive to separate table (optional)
- Cron job to run daily or weekly

### Performance

- Denormalize unreadNotificationCount on User model
- Use single query with proper indexes
- Avoid N+1 queries (use select/include carefully)
- Cache badge count (refresh on read/new notification)

## Acceptance Criteria

- [ ] Notification database schema created with indexes
- [ ] GET /api/notifications returns paginated list
- [ ] Pagination includes unreadCount and badgeCount
- [ ] POST /api/notifications/:notificationId/read marks as read
- [ ] POST /api/notifications/read-all marks all as read
- [ ] DELETE /api/notifications/:notificationId removes notification
- [ ] DELETE /api/notifications clears old read notifications
- [ ] GET /api/notifications/unread-count returns quick count
- [ ] NotificationBell shows correct badge count
- [ ] NotificationInbox modal opens/closes smoothly
- [ ] Notifications display with unread styling
- [ ] Click on notification navigates to related content
- [ ] Mark as read button toggles read status
- [ ] Filter by type works correctly
- [ ] Infinite scroll loads more notifications
- [ ] useNotifications hook fetches and caches correctly
- [ ] useUnreadCount hook polls or listens for updates
- [ ] Mobile notification list renders efficiently
- [ ] Swipe to delete/mark as read works on mobile
- [ ] Empty state appears when no notifications
- [ ] Real-time updates work (via polling or WebSocket)

## Dependencies

- `apps/api` - Hono backend
- `packages/db` - Prisma ORM
- `packages/ui` - React components
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API hooks
- `@tanstack/react-query` - Server state
- Firebase Cloud Messaging - Push notifications

## Technical Notes

### Unread Count Denormalization

```typescript
// Keep User.unreadNotificationCount in sync
// Update on create, read, unread, delete

// Create
await db.user.update({
  where: { id: userId },
  data: { unreadNotificationCount: { increment: 1 } },
});

// Read
await db.user.update({
  where: { id: userId },
  data: { unreadNotificationCount: { decrement: 1 } },
});
```

### Notification Badges

- Show number if 0-99
- Show "99+" if 100+
- Or just show dot if >0 (simpler)
- Update in real-time (not polled if possible)

### Clean Old Notifications

```typescript
// Cron job (daily or weekly)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

await db.notification.deleteMany({
  where: {
    isRead: true,
    createdAt: { lt: thirtyDaysAgo },
  },
});
```

### Deep Link Handling

- Web: Use Next.js router.push(deepLink)
- Mobile: Use React Navigation navigate
- Store deepLink in notification for navigation on click
- Handle deep link even if user not logged in (redirect to login first)

### Notification Icons

- Store icon URLs in database or use SVG sprites
- Optimize images (SVG preferred for notifications)
- Use theme colors for badge/dot

### Accessibility

- aria-live="polite" for real-time updates
- aria-label for notification badge
- Keyboard navigation through notification list
- Screen reader announces unread count and notification content
