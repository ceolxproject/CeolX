# Task 12: Notifications Tables

## Description

Create tables for in-app notifications, notification preferences, and Firebase Cloud Messaging (FCM) token management. Enables push notifications for learners and mentors across web and mobile platforms, with granular user controls for notification types.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (notification creation and delivery)
- `apps/web-learner` (notification display and settings)
- `apps/web-mentor` (notification display and settings)
- `apps/mobile` (push notification handling)

## Requirements

### Notifications Table

Create table `notifications`:

| Column           | Type           | Constraints                | Description                                                                            |
| ---------------- | -------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `id`             | `UUID`         | PK, Default: `uuid_v7()`   | Unique notification identifier                                                         |
| `user_id`        | `UUID`         | FK → users(id), NOT NULL   | Notification recipient                                                                 |
| `type`           | `VARCHAR(50)`  | NOT NULL                   | Enum: course_published, lesson_added, comment_reply, like, enrollment, message, system |
| `title`          | `VARCHAR(255)` | NOT NULL                   | Notification title                                                                     |
| `body`           | `TEXT`         | NOT NULL                   | Notification message body                                                              |
| `data`           | `JSONB`        | NULL                       | Additional metadata (links, IDs, etc.)                                                 |
| `action_url`     | `TEXT`         | NULL                       | URL to navigate to when clicked                                                        |
| `icon_url`       | `TEXT`         | NULL                       | Notification icon (R2 URL)                                                             |
| `is_read`        | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE   | Whether user read                                                                      |
| `is_dismissed`   | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE   | Whether user dismissed                                                                 |
| `read_at`        | `TIMESTAMP`    | NULL                       | When user read                                                                         |
| `dismissed_at`   | `TIMESTAMP`    | NULL                       | When user dismissed                                                                    |
| `sent_via_email` | `BOOLEAN`      | DEFAULT: FALSE             | Whether sent as email too                                                              |
| `sent_via_push`  | `BOOLEAN`      | DEFAULT: FALSE             | Whether sent as push notification                                                      |
| `created_at`     | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Notification creation                                                                  |
| `expires_at`     | `TIMESTAMP`    | NULL                       | When notification expires (archive after)                                              |

### Notification Data JSON Structure

Example for different notification types:

```json
// Course published notification
{
  "course_id": "uuid",
  "course_title": "Advanced Eye Makeup",
  "instructor_id": "uuid"
}

// Comment reply notification
{
  "post_id": "uuid",
  "comment_id": "uuid",
  "commenter_id": "uuid",
  "commenter_name": "Sarah"
}

// Like notification
{
  "post_id": "uuid",
  "liker_id": "uuid",
  "liker_name": "Jessica"
}

// Enrollment notification
{
  "course_id": "uuid",
  "course_title": "Skincare Basics"
}
```

### Indexes for Notifications Table

- Primary Key: `id`
- Index: `(user_id)` - find user's notifications
- Index: `(user_id, is_read)` - unread notifications
- Index: `(user_id, created_at DESC)` - recent notifications
- Index: `(type)` - filter by type
- Index: `(created_at)` - for archival/cleanup
- Partial Index: `(user_id, is_read)` WHERE `is_read = false` - unread only
- Partial Index: `(user_id, expires_at)` WHERE `expires_at IS NOT NULL AND expires_at < NOW()` - expired

### Notification Preferences Table

Create table `notification_preferences`:

| Column                        | Type          | Constraints                      | Description                                 |
| ----------------------------- | ------------- | -------------------------------- | ------------------------------------------- |
| `id`                          | `UUID`        | PK, Default: `uuid_v7()`         | Unique preferences record                   |
| `user_id`                     | `UUID`        | FK → users(id), NOT NULL, UNIQUE | User preferences                            |
| `marketing_push_enabled`      | `BOOLEAN`     | DEFAULT: FALSE                   | Promotional push notifications              |
| `marketing_email_enabled`     | `BOOLEAN`     | DEFAULT: FALSE                   | Promotional emails                          |
| `transactional_push_enabled`  | `BOOLEAN`     | DEFAULT: TRUE                    | Transaction alerts (immutable)              |
| `transactional_email_enabled` | `BOOLEAN`     | DEFAULT: TRUE                    | Transaction emails (immutable)              |
| `course_published_enabled`    | `BOOLEAN`     | DEFAULT: TRUE                    | Notify on instructor's new courses          |
| `lesson_added_enabled`        | `BOOLEAN`     | DEFAULT: TRUE                    | Notify when lesson added to enrolled course |
| `comment_reply_enabled`       | `BOOLEAN`     | DEFAULT: TRUE                    | Notify on post/comment replies              |
| `like_enabled`                | `BOOLEAN`     | DEFAULT: TRUE                    | Notify on post/comment likes                |
| `enrollment_enabled`          | `BOOLEAN`     | DEFAULT: TRUE                    | Notify when someone enrolls in course       |
| `message_enabled`             | `BOOLEAN`     | DEFAULT: TRUE                    | Direct message notifications                |
| `digest_frequency`            | `VARCHAR(50)` | DEFAULT: 'daily'                 | Enum: realtime, daily, weekly, never        |
| `digest_send_time`            | `TIME`        | DEFAULT: '09:00:00'              | Time of day for digest (UTC)                |
| `quiet_hours_enabled`         | `BOOLEAN`     | DEFAULT: FALSE                   | Silence notifications during quiet hours    |
| `quiet_hours_start`           | `TIME`        | DEFAULT: '22:00:00'              | Quiet hours start time (UTC)                |
| `quiet_hours_end`             | `TIME`        | DEFAULT: '08:00:00'              | Quiet hours end time (UTC)                  |
| `updated_at`                  | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`       | Last preference change                      |

### Unique Constraint for Notification Preferences

- Unique Index: `(user_id)` - one preferences record per user

### Indexes for Notification Preferences Table

- Primary Key: `id`
- Unique Index: `(user_id)` - uniqueness
- Index: `(digest_frequency)` - find users for digest batch jobs
- Index: `(quiet_hours_enabled)` - find users with quiet hours

### FCM Tokens Table

Create table `fcm_tokens`:

| Column         | Type           | Constraints                | Description                               |
| -------------- | -------------- | -------------------------- | ----------------------------------------- |
| `id`           | `UUID`         | PK, Default: `uuid_v7()`   | Unique token record                       |
| `user_id`      | `UUID`         | FK → users(id), NOT NULL   | Token owner                               |
| `token`        | `TEXT`         | NOT NULL                   | FCM registration token                    |
| `device_type`  | `VARCHAR(50)`  | NOT NULL                   | Enum: ios, android, web                   |
| `device_name`  | `VARCHAR(255)` | NULL                       | Device name for user reference            |
| `is_active`    | `BOOLEAN`      | NOT NULL, DEFAULT: TRUE    | Whether token is valid                    |
| `created_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Token registration                        |
| `updated_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last activity                             |
| `last_used_at` | `TIMESTAMP`    | NULL                       | Last push notification sent to this token |

### Unique Constraint for FCM Tokens

- Composite unique index: `(user_id, token)` - prevent duplicate tokens

### Indexes for FCM Tokens Table

- Primary Key: `id`
- Index: `(user_id)` - find user's tokens
- Index: `(token)` - find token owner (for webhook updates)
- Index: `(device_type)` - segment by device type
- Index: `(is_active)` - find active tokens only
- Index: `(updated_at)` - find stale tokens (cleanup)
- Partial Index: `(user_id)` WHERE `is_active = true` - active tokens only

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE notification_type AS ENUM ('course_published', 'lesson_added', 'comment_reply', 'like', 'enrollment', 'message', 'system');
CREATE TYPE digest_frequency AS ENUM ('realtime', 'daily', 'weekly', 'never');
CREATE TYPE device_type AS ENUM ('ios', 'android', 'web');
```

### Drizzle Schema Definition

In `packages/db/src/schema/notifications.ts`:

- Define `notifications` table
- Define `notificationPreferences` table
- Define `fcmTokens` table
- Use `relations()` for:
  - users ↔ notifications (one-to-many)
  - users ↔ notificationPreferences (one-to-one)
  - users ↔ fcmTokens (one-to-many)

## Database Tables

### notifications

- **Purpose**: User notification inbox (in-app)
- **Row estimate**: ~10M-100M notifications (varies by engagement)
- **Retention**: Archive after 90 days (move to separate archive table)
- **Key relationships**: N:1 with users

### notification_preferences

- **Purpose**: User control over notification types and frequency
- **Row estimate**: ~1M (same as users)
- **Key relationships**: 1:1 with users

### fcm_tokens

- **Purpose**: Firebase Cloud Messaging tokens for push notifications
- **Row estimate**: ~2M-5M (avg 2-5 tokens per active user across devices)
- **Key relationships**: N:1 with users

## Acceptance Criteria

- [ ] `notifications` table created with comprehensive notification types
- [ ] Notification data JSONB supports various notification metadata
- [ ] `notification_preferences` table created with granular controls
- [ ] Transactional preferences cannot be disabled (enforced in API)
- [ ] Quiet hours support prevents notifications during sleep
- [ ] Digest frequency allows batched email notifications
- [ ] `fcm_tokens` table created with device tracking
- [ ] Unique constraint prevents duplicate FCM tokens
- [ ] Device names help users identify which device token is from
- [ ] All indexes created for efficient queries
- [ ] Partial indexes on active/unread notifications
- [ ] `is_read` and `is_dismissed` allow different states
- [ ] Notification expiration enables archive after time period
- [ ] All timestamps use UTC timezone
- [ ] Test data with various notification types
- [ ] Test FCM token management and delivery
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Firebase Cloud Messaging (FCM) setup

## Technical Notes

### Notification Types

- **course_published** - Instructor published new course
- **lesson_added** - New lesson added to enrolled course
- **comment_reply** - Someone replied to user's post/comment
- **like** - Someone liked user's post/comment
- **enrollment** - Someone enrolled in user's course (instructor notification)
- **message** - Direct message received
- **system** - System announcements and maintenance notices

### Data Field Usage

Store context in JSONB for efficient notification display:

- Include IDs (course_id, post_id, etc.) for navigation
- Include display names to avoid additional queries
- Include thumbnails or icons for quick visual reference
- Keep object flat (don't deeply nest)

### Notification Preferences Structure

- **Marketing notifications** (promotional) - False by default
- **Transactional notifications** (required) - Always true, cannot disable
- **Feature notifications** (engagement) - Individual toggles per type
- **Digest frequency** - Batch notifications (realtime, daily, weekly, never)
- **Quiet hours** - No notifications during sleep times
- **Timezone awareness** - Digest times and quiet hours respect user timezone

### Transactional Notifications

These CANNOT be disabled by user (compliance/legal requirement):

- Order confirmations and receipts
- Subscription changes and renewals
- Password reset emails
- Account security alerts
- Terms of service updates

### Quiet Hours Implementation

```typescript
// Check if notification should be delayed
const shouldDelayNotification = (user, preferences) => {
  if (!preferences.quietHoursEnabled) return false;

  const now = new Date();
  const userTime = convertToUserTimezone(now, user.timezone);
  const currentTime = userTime.getHours() * 60 + userTime.getMinutes();

  const quietStart = preferences.quietHoursStart.split(":").map(Number);
  const quietEnd = preferences.quietHoursEnd.split(":").map(Number);

  const quietStartMinutes = quietStart[0] * 60 + quietStart[1];
  const quietEndMinutes = quietEnd[0] * 60 + quietEnd[1];

  if (quietStartMinutes <= quietEndMinutes) {
    return currentTime >= quietStartMinutes && currentTime < quietEndMinutes;
  } else {
    // Quiet hours span midnight
    return currentTime >= quietStartMinutes || currentTime < quietEndMinutes;
  }
};
```

### Digest Email Strategy

```typescript
// Query notifications for digest
const getUserDigestNotifications = (userId, frequency) => {
  const sinceTime = frequency === 'daily'
    ? NOW - INTERVAL '1 day'
    : NOW - INTERVAL '7 days';

  return db.select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      gt(notifications.createdAt, sinceTime)
    ))
    .orderBy(desc(notifications.createdAt));
};
```

### FCM Token Management

- Register new token when user logs in on new device
- Mark token inactive if FCM reports bad token
- Clean up inactive tokens older than 30 days
- Allow user to see devices and revoke specific tokens

### Push Notification Delivery

```typescript
// Send push notification
const sendPushNotification = async (userId, notification) => {
  const preferences = await getNotificationPreferences(userId);

  // Check if notification type is enabled
  if (!preferences[`${notification.type}_enabled`]) return;

  // Check quiet hours
  if (shouldDelayNotification(user, preferences)) {
    // Schedule for after quiet hours
    return scheduleNotification(notification, preferences.quietHoursEnd);
  }

  // Get active tokens
  const tokens = await db
    .select()
    .from(fcmTokens)
    .where(and(eq(fcmTokens.userId, userId), eq(fcmTokens.isActive, true)));

  // Send to all active tokens
  for (const token of tokens) {
    await sendToFCM(token.token, {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.iconUrl,
      },
      data: notification.data,
      webpush: {
        fcmOptions: { link: notification.actionUrl },
      },
    });
  }
};
```

### FCM Token Webhook

Firebase can report invalid tokens via webhook:

```typescript
// Handle FCM webhook for invalid tokens
router.post("/webhooks/fcm/invalid", (req, body) => {
  const { token, reason } = body;

  db.update(fcmTokens)
    .set({ isActive: false })
    .where(eq(fcmTokens.token, token));
});
```

### Notification Archive Strategy

```typescript
// Archive old notifications (cron job, daily)
const archiveOldNotifications = async () => {
  const thirtyDaysAgo = NOW - INTERVAL '30 days';

  const toArchive = await db.select()
    .from(notifications)
    .where(lt(notifications.createdAt, thirtyDaysAgo));

  // Insert to archive table (or hard delete if not needed)
  await db.insert(notificationArchive).values(toArchive);

  // Delete from active table
  await db.delete(notifications)
    .where(lt(notifications.createdAt, thirtyDaysAgo));
};
```

### Query Patterns

```typescript
// Get unread notifications for user
db.select()
  .from(notifications)
  .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
  .orderBy(desc(notifications.createdAt))
  .limit(20);

// Mark notifications as read
db.update(notifications)
  .set({
    isRead: true,
    readAt: NOW,
  })
  .where(
    and(
      eq(notifications.userId, userId),
      inArray(notifications.id, notificationIds),
    ),
  );

// Get user's preference for notification type
db.select()
  .from(notificationPreferences)
  .where(eq(notificationPreferences.userId, userId))
  .limit(1);
```

### Email Digest Template

Group notifications by type:

```
You have 5 new notifications:

Courses & Learning (3)
- Someone enrolled in "Advanced Makeup" course
- New lesson: "Contouring Techniques" in "Face Makeup Mastery"
- Course published: "Color Theory for Makeup Artists"

Community (2)
- Sarah replied to your post
- Jessica liked your comment
```

### Testing Considerations

- Test notification creation for various types
- Test notification preferences enforcement
- Test quiet hours logic
- Test digest email batching
- Test FCM token registration and removal
- Test push notification delivery
- Test notification archival
- Test unread notification count
- Test cascade delete (deleting user deletes notifications)

### Performance Optimization

- Partial index on unread notifications: `WHERE is_read = false`
- Archive old notifications (>90 days) to separate table
- Batch notification inserts for bulk creation
- Cache user preferences in session/Redis

### Compliance & Privacy

- No notification data stored that violates privacy
- GDPR: Allow users to download notification history
- GDPR: Support notification deletion on account deletion
- CAN-SPAM: Track unsubscribe requests for marketing
- Privacy: Don't expose sensitive data in push notifications
