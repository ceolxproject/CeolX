# Task 9: Grouped and Batched Notifications

## Description

Implement notification batching and grouping to prevent notification fatigue during burst events. Combine multiple similar notifications into summaries (e.g., "5 new comments on your post"), use configurable batching windows (e.g., 5 minutes), implement QStash scheduled job to flush batches, and provide user controls for batching preferences. Notify users of grouped events across push, email, and in-app channels.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for notification batching
- `packages/api-client` - API client methods
- Vercel QStash - Scheduled batching jobs
- Firebase Cloud Messaging - Send batched notifications
- Postmark - Send batched emails

## Notification Batching Strategy

### Grouping Keys

Notifications are grouped by events happening on the same object:

```
Group Key Format: {EVENT_TYPE}-{OBJECT_ID}

Examples:
- "comment-reply-post-{postId}" → Multiple comments on same post
- "question-answer-qa-{qaId}" → Multiple answers to same question
- "post-like-post-{postId}" → Multiple likes on same post
- "course-new-mentor-{mentorId}" → Multiple new courses from same mentor
- "payout-processed-mentor-{mentorId}" → Multiple payouts
- "community-post-mentor-{mentorId}" → Multiple posts from mentor
```

### Batching Window

- **Window Duration:** 5 minutes (configurable)
- **Flush Trigger:** Either 5 minutes elapsed OR 20 notifications accumulated (whichever comes first)
- **Quiet Hours:** Respect user's quiet hours (batch during quiet hours, send summary after)
- **Off-Peak:** Batch events for 1-2 hours during night (e.g., 12 AM - 6 AM)

### Example Batch Scenarios

**Scenario 1: Multiple Comments**

```
Individual notifications:
1. [2:00 PM] Sarah commented on your post
2. [2:01 PM] Mike commented on your post
3. [2:02 PM] Jessica commented on your post
4. [2:03 PM] David commented on your post
5. [2:04 PM] Alex commented on your post

Batched notification (after 5 min window):
[2:05 PM] "5 people commented on your post"
Body: "Sarah, Mike, Jessica, David, and Alex"
```

**Scenario 2: Multiple Likes**

```
Individual (suppressed):
[2:00 PM] Sarah liked your post
[2:00 PM] Mike liked your post
[2:01 PM] Jessica liked your post
...

Batched notification (after 5 min):
[2:05 PM] "8 people liked your post"
Deep link: /community/posts/{postId}
```

**Scenario 3: Multiple New Courses (Marketing)**

```
Individual (suppressed if opted into batching):
[9:00 AM] New course: Advanced Contouring
[9:15 AM] New course: Skin Prep Fundamentals
[9:30 AM] New course: Color Theory Basics

Daily digest email (if subscribed):
"3 new courses you might like:
1. Advanced Contouring by Expert Mentor
2. Skin Prep Fundamentals by Skincare Pro
3. Color Theory Basics by Design Expert"
```

## Database Schema (Prisma)

```prisma
model NotificationBatch {
  id String @id @default(cuid())

  userId String
  user User @relation("NotificationBatches", fields: [userId], references: [id], onDelete: Cascade)

  // Grouping
  groupKey String // "comment-reply-post-123"
  batchType String // "comment-reply", "post-like", "course-new", etc.

  // Batch state
  count Int @default(0) // Number of notifications in batch
  isSent Boolean @default(false)
  sentAt DateTime?

  // Notifications in this batch
  notifications Notification[]

  // Scheduled job tracking
  qstashMessageId String? // For cancellation if needed

  // Settings
  batchingWindow Int @default(300) // seconds (5 minutes)
  maxNotificationsBeforeFlush Int @default(20)

  // Timing
  createdAt DateTime @default(now())
  scheduledFlushTime DateTime // When to flush if not full

  @@unique([userId, groupKey])
  @@index([userId, isSent])
  @@index([scheduledFlushTime])
}

// Extend Notification model
extend model Notification {
  batchId String?
  batch NotificationBatch? @relation(fields: [batchId], references: [id], onDelete: SetNull)

  @@index([batchId])
}

// Track batch history for analytics
model NotificationBatchHistory {
  id String @id @default(cuid())

  userId String
  user User @relation("NotificationBatchHistory", fields: [userId], references: [id], onDelete: Cascade)

  groupKey String
  batchType String
  notificationCount Int
  channels String[] // ["push", "email", "inApp"]
  sentAt DateTime

  @@index([userId])
  @@index([sentAt])
}

// Extend User model
extend model User {
  notificationBatches NotificationBatch[]
  notificationBatchHistory NotificationBatchHistory[]
}
```

## API Endpoints

### POST /api/notifications (modified)

When creating a notification, check if batching applies:

```typescript
// Before: Create notification immediately
// Now: Add to batch, schedule flush

async function createNotification(
  userId: string,
  notification: NotificationPayload,
  shouldBatch: boolean = true
) {
  // Check if batching enabled for user
  const prefs = await getNotificationPreferences(userId);
  if (!prefs.batchingEnabled || !shouldBatch) {
    // Send immediately
    return sendNotificationImmediately(userId, notification);
  }

  // Check if batch exists
  const batch = await db.notificationBatch.findUnique({
    where: {
      userId_groupKey: {
        userId,
        groupKey: notification.groupKey,
      },
    },
  });

  if (batch && !batch.isSent) {
    // Add to existing batch
    const notif = await db.notification.create({
      data: {
        userId,
        ...notification,
        batchId: batch.id,
      },
    });

    // Increment batch count
    await db.notificationBatch.update({
      where: { id: batch.id },
      data: { count: { increment: 1 } },
    });

    // Check if should flush immediately
    if (batch.count + 1 >= batch.maxNotificationsBeforeFlush) {
      return flushBatch(batch.id);
    }

    return notif;
  } else {
    // Create new batch
    const scheduledFlushTime = new Date(
      Date.now() + batch?.batchingWindow || 300000
    );

    const newBatch = await db.notificationBatch.create({
      data: {
        userId,
        groupKey: notification.groupKey,
        batchType: notification.batchType,
        count: 1,
        scheduledFlushTime,
      },
    });

    // Create notification
    const notif = await db.notification.create({
      data: {
        userId,
        ...notification,
        batchId: newBatch.id,
      },
    });

    // Schedule flush with QStash
    const qstashRes = await scheduleNotificationBatchFlush(
      newBatch.id,
      scheduledFlushTime
    );

    await db.notificationBatch.update({
      where: { id: newBatch.id },
      data: { qstashMessageId: qstashRes.messageId },
    });

    return notif;
  }
}
```

### GET /api/notifications/batches (analytics)

**Description:** Get batching statistics for current user

**Response (200 OK):**

```json
{
  "batchesEnabled": true,
  "stats": {
    "totalBatches": 45,
    "notificationsSaved": 120, // Prevented duplicates
    "averageBatchSize": 2.7,
    "lastBatchSentAt": "2024-02-18T10:30:00Z"
  },
  "preferences": {
    "batchingEnabled": true,
    "batchingWindowSeconds": 300,
    "maxNotificationsBeforeFlush": 20,
    "batchDigestEmail": true,
    "batchPushNotifications": true
  }
}
```

### PUT /api/notifications/batches/preferences

**Description:** Update batching preferences

**Request Body:**

```json
{
  "batchingEnabled": true,
  "batchingWindowSeconds": 300,
  "maxNotificationsBeforeFlush": 20,
  "batchDigestEmail": true,
  "batchPushNotifications": true
}
```

## QStash Integration

### Setup

```bash
# Install QStash CLI
npm install @upstash/qstash

# Add credentials to .env
QSTASH_TOKEN=your_token_here
QSTASH_URL=https://qstash.io

# Verify installation
npx qstash
```

### Scheduled Job Handler

**Location:** `apps/api/src/jobs/notification-batch-flush.ts`

```typescript
import { getMessaging } from "@/lib/firebase";
import { db } from "@/lib/db";

export async function handleNotificationBatchFlush(batchId: string) {
  const batch = await db.notificationBatch.findUnique({
    where: { id: batchId },
    include: {
      notifications: true,
      user: {
        include: { notificationPreference: true },
      },
    },
  });

  if (!batch || batch.isSent) {
    console.log(`Batch ${batchId} already sent or not found`);
    return;
  }

  const user = batch.user;
  const prefs = user.notificationPreference;

  // Skip if in quiet hours
  if (isQuietHours(prefs)) {
    // Reschedule for after quiet hours
    const nextFlush = getNextQuietHourEnd(prefs);
    await rescheduleBatch(batch.id, nextFlush);
    return;
  }

  // Create summary notification
  const summary = createBatchSummary(batch);

  // Send across channels
  const notificationChannels: string[] = [];

  if (prefs?.pushEnabled) {
    await sendToUser(user.id, {
      title: summary.title,
      body: summary.body,
      deepLink: summary.deepLink,
      data: {
        batchId: batch.id,
        groupKey: batch.groupKey,
        count: batch.count.toString(),
      },
    });
    notificationChannels.push("push");
  }

  if (prefs?.emailEnabled && batch.batchType === "daily_digest") {
    await sendDigestEmail(user.id, batch);
    notificationChannels.push("email");
  }

  // Update batch
  await db.notificationBatch.update({
    where: { id: batch.id },
    data: {
      isSent: true,
      sentAt: new Date(),
    },
  });

  // Log to history
  await db.notificationBatchHistory.create({
    data: {
      userId: user.id,
      groupKey: batch.groupKey,
      batchType: batch.batchType,
      notificationCount: batch.count,
      channels: notificationChannels,
      sentAt: new Date(),
    },
  });

  console.log(`Flushed batch ${batch.id}: ${batch.count} notifications`);
}

function createBatchSummary(batch: NotificationBatch) {
  switch (batch.batchType) {
    case "comment-reply":
      return {
        title: `${batch.count} new comments on your post`,
        body: batch.notifications
          .slice(0, 3)
          .map((n) => n.body)
          .join(", "),
        deepLink: `/community/posts/${batch.groupKey.split("-").pop()}`,
      };

    case "post-like":
      return {
        title: `${batch.count} people liked your post`,
        body: "",
        deepLink: `/community/posts/${batch.groupKey.split("-").pop()}`,
      };

    case "course-new":
      return {
        title: `${batch.count} new courses from instructors you follow`,
        body: batch.notifications
          .slice(0, 3)
          .map((n) => n.body)
          .join(", "),
        deepLink: "/courses",
      };

    default:
      return {
        title: `${batch.count} updates from our platform`,
        body: "",
        deepLink: "/notifications",
      };
  }
}

async function rescheduleBatch(batchId: string, flushTime: Date) {
  const batch = await db.notificationBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) return;

  // Cancel old QStash job
  if (batch.qstashMessageId) {
    await cancelQStashJob(batch.qstashMessageId);
  }

  // Schedule new job
  const qstashRes = await scheduleNotificationBatchFlush(batchId, flushTime);

  await db.notificationBatch.update({
    where: { id: batchId },
    data: {
      scheduledFlushTime: flushTime,
      qstashMessageId: qstashRes.messageId,
    },
  });
}
```

### QStash Route Handler

**Location:** `apps/api/src/routes/jobs/notification-batch-flush.ts`

```typescript
import { Hono } from "hono";
import { verifySignature } from "@upstash/qstash/nextjs";
import { handleNotificationBatchFlush } from "@/jobs/notification-batch-flush";

const route = new Hono();

route.post("/jobs/notification-batch-flush", async (c) => {
  const signature = c.req.header("upstash-signature");
  const body = await c.req.text();

  try {
    // Verify signature
    await verifySignature({
      signature,
      body,
      secret: process.env.QSTASH_TOKEN || "",
    });
  } catch (error) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Parse payload
  const { batchId } = JSON.parse(body);

  // Execute job
  try {
    await handleNotificationBatchFlush(batchId);
    return c.json({ success: true });
  } catch (error) {
    console.error("Batch flush error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default route;
```

### Schedule Batch Flush Function

**Location:** `apps/api/src/lib/qstash.ts`

```typescript
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN });

export async function scheduleNotificationBatchFlush(
  batchId: string,
  flushTime: Date
) {
  const delay = Math.max(0, flushTime.getTime() - Date.now());

  const response = await qstash.publishJSON({
    url: `${process.env.API_URL}/jobs/notification-batch-flush`,
    headers: {
      "Content-Type": "application/json",
    },
    body: { batchId },
    delay,
  });

  return {
    messageId: response.messageId,
  };
}

export async function cancelBatchFlush(messageId: string) {
  try {
    await qstash.messages.delete(messageId);
  } catch (error) {
    console.error("Failed to cancel batch flush:", error);
  }
}
```

## Batch Summary Templates

### Comment Replies

```
1-2 comments: "Sarah commented on your post"
3-5 comments: "3 people commented on your post"
6+ comments: "6+ people commented on your post"

Details: List first 2-3 commenters with snippets
```

### Post Likes

```
1-2 likes: "Sarah liked your post"
3-5 likes: "3 people liked your post"
6+ likes: "6+ people liked your post"

Details: Just the count (no need to list all)
```

### New Courses

```
1-2 courses: "New course available: Advanced Contouring"
3-5 courses: "3 new courses from instructors you follow"
6+ courses: "6+ new courses from instructors you follow"

Details: List course titles and mentors
```

### Q&A Answers

```
1 answer: "Someone answered your question"
2+ answers: "2 people answered your question"

Details: List answerers
```

## Batching Rules

### When to Batch

- Multiple comments on same post → batch
- Multiple likes on same post → batch
- Multiple new courses from same mentor → batch (2+ hours)
- Multiple Q&A answers to same question → batch
- Multiple question notifications (instructor) → batch

### When NOT to Batch

- First notification of a thread (send immediately)
- High-priority notifications (enrollment, payout)
- Transactional notifications (always immediate)
- Time-sensitive notifications (subscription ending in 1 day)

### Category-Specific Rules

| Notification Type     | Batching          | Window | Channels     |
| --------------------- | ----------------- | ------ | ------------ |
| Comment Reply         | Yes               | 5 min  | push, in-app |
| Post Like             | Yes               | 5 min  | push, in-app |
| New Course            | No (daily digest) | 1 day  | email        |
| Enrollment            | No                | -      | push, email  |
| Q&A Answer            | Yes               | 5 min  | push, in-app |
| Payout                | No                | -      | push, email  |
| Subscription Reminder | No                | -      | push, email  |

## UI Components

### NotificationBatchingPreferences Component

**Location:** `packages/ui/src/components/NotificationBatchingPreferences.tsx`

**Props:**

```typescript
interface NotificationBatchingPreferencesProps {
  onSave: (prefs: BatchingPreferences) => Promise<void>;
  initialPreferences: BatchingPreferences;
}
```

**Features:**

- Toggle batching on/off
- Slider for batching window (1-30 minutes)
- Slider for max notifications before flush (5-50)
- Toggle batch push notifications
- Toggle daily digest email
- Toggle weekly digest email
- Show estimated savings (e.g., "Could save ~120 notifications/month")

## Database Cleanup

### Cron Job: Archive Old Batches

**Location:** `apps/api/src/jobs/cleanup-old-batches.ts`

```typescript
export async function cleanupOldBatches() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const deleted = await db.notificationBatch.deleteMany({
    where: {
      isSent: true,
      sentAt: { lt: thirtyDaysAgo },
    },
  });

  console.log(`Deleted ${deleted.count} old notification batches`);
}

// Run daily via QStash or cron
```

## Acceptance Criteria

- [ ] NotificationBatch database schema created
- [ ] createNotification function batches notifications based on groupKey
- [ ] Batching window configured (5 minutes default)
- [ ] Max notifications before flush set (20 default)
- [ ] QStash integration for scheduling batch flushes
- [ ] Batch flush handler processes and sends summaries
- [ ] Batch summary text generates correctly for each type
- [ ] Push notifications sent for batched events
- [ ] Email digests sent for batched events
- [ ] In-app notifications show batch count
- [ ] Quiet hours respected (reschedule batch)
- [ ] Batch history logged for analytics
- [ ] GET /api/notifications/batches returns stats
- [ ] PUT /api/notifications/batches/preferences updates settings
- [ ] Batching preference in user notification settings
- [ ] UI shows estimated notification savings
- [ ] Old batches cleaned up after 30 days
- [ ] QStash job signature verification works
- [ ] Failed batch flushes don't cause duplicate sends
- [ ] Batch cancellation works if needed
- [ ] Performance: no N+1 queries in batch processing

## Dependencies

- `@upstash/qstash` - Scheduled jobs
- `apps/api` - Hono backend
- `packages/db` - Prisma ORM
- Firebase Cloud Messaging - Push notifications
- Postmark - Email sending
- `date-fns` - Time/date manipulation

## Technical Notes

### Performance Optimization

```typescript
// Batch queries for multiple notifications
const notifications = await db.notification.findMany({
  where: { batchId },
  select: { body: true, relatedId: true },
  take: 5, // Only fetch for summary
});

// Use aggregation for counts
const batchStats = await db.notificationBatch.aggregate({
  where: { userId },
  _count: { id: true },
  _sum: { count: true },
});
```

### Idempotency

```typescript
// Prevent duplicate batch flushes if QStash retries
const batch = await db.notificationBatch.findUnique({
  where: { id: batchId },
});

if (batch.isSent) {
  console.log(`Batch already sent, skipping`);
  return;
}
```

### Testing Batching

```typescript
// Create multiple notifications in quick succession
for (let i = 0; i < 5; i++) {
  await createNotification(userId, {
    type: "COMMENT_REPLY",
    title: `Comment ${i}`,
    body: `Comment body ${i}`,
    groupKey: "comment-reply-post-123",
    batchType: "comment-reply",
  });
}

// Manually trigger batch flush
await handleNotificationBatchFlush(batchId);

// Verify summary notification created
const summary = await db.notification.findFirst({
  where: { batchId, isRead: false },
});
```

### Monitoring

- Track batches created per hour
- Monitor batch flush latency
- Alert if batch flush fails
- Track notification savings (duplicates prevented)
- Analytics dashboard showing batching stats

### Edge Cases

- User changes batching preference while batch pending → flush immediately or reschedule
- User goes offline → batch queued, sent on next online
- Notification preference changes → recalculate if should batch
- New notification comes while batch being flushed → create new batch
