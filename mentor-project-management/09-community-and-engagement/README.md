# Milestone 09: Community and Engagement Features

## Overview

This milestone implements comprehensive community and engagement features for the Mentor SaaS platform, including community feed, Q&A system, notifications (push, in-app, email), and community guidelines.

## Key Features

### 1. Community Feed

- Users can create posts (text + images) in a shared community space
- Posts visible only to learners who have watched ≥1 lesson from the post author's mentor
- Like, comment, and tag posts with courses/topics
- Instructors can create posts, pin important ones, and moderate comments
- Available on web (learner & mentor) and mobile

### 2. Post Interactions

- Like/unlike posts with optimistic updates
- Comment on posts (single-level only, no nesting)
- Mark answers as helpful/resolved
- Instructors can hide/delete comments
- Restrict users from commenting
- Post pinning by instructors (up to 3 per mentor)

### 3. Q&A System on Lessons

- Learners ask questions linked to specific lessons
- Instructors receive push notifications for new questions
- Instructors can provide answers
- Mark answers as resolved/helpful
- Single-level comments (no @mentions, no nesting)
- Chronological display with filtering

### 4. Push Notifications (Firebase Cloud Messaging)

- Device token registration and management
- Automatic token refresh handling
- Send notifications across platforms (web, iOS, Android)
- Handle invalid/inactive tokens gracefully
- Support for topics-based subscriptions

### 5. In-App Notification Inbox

- Paginated notification list with filtering
- Mark individual notifications as read/unread
- Batch mark all as read
- Delete notifications
- Badge count display
- Real-time updates (polling or WebSocket)
- Notification types: course updates, comments, Q&A, enrollments, payouts, community activity

### 6. Notification Preferences & GDPR

- Opt-in/opt-out for marketing notifications
- Transactional notifications always enabled (GDPR requirement)
- Per-category toggles (push, email, in-app)
- Quiet hours support
- Consent logging for audit trail
- Deep link to OS notification settings if denied

### 7. Grouped & Batched Notifications

- Combine similar notifications to prevent fatigue
- Configurable batching window (default 5 minutes)
- Flush on max notifications reached (default 20)
- QStash scheduled job for batch sending
- Respect quiet hours (reschedule batch)
- Daily/weekly digest emails

### 8. Community Guidelines

- Comprehensive guidelines screen
- Acknowledgment required before first post
- Version control with history
- Admin panel for managing guidelines
- Tracks consent per version
- Notifications when guidelines updated

## Task Files

| Task | File                                  | Description                                                                      |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------- |
| 1    | `01-community-feed-api.md`            | Backend API endpoints for community posts (CRUD, access control, pagination)     |
| 2    | `02-community-feed-ui-web.md`         | Community feed UI components for web (post cards, compose form, infinite scroll) |
| 3    | `03-community-feed-ui-mobile.md`      | React Native community feed (FlatList, bottom sheet compose, image picker)       |
| 4    | `04-post-interactions.md`             | Like/unlike, comments, pinning, comment moderation                               |
| 5    | `05-qa-on-lessons.md`                 | Q&A system on lessons with instructor notifications                              |
| 6    | `06-fcm-push-notifications-setup.md`  | Firebase Cloud Messaging setup and integration                                   |
| 7    | `07-in-app-notification-inbox.md`     | Notification center with read/unread, badge count, real-time updates             |
| 8    | `08-notification-preferences.md`      | GDPR-compliant notification settings, opt-in/out, quiet hours                    |
| 9    | `09-grouped-batched-notifications.md` | Notification batching with QStash scheduled jobs                                 |
| 10   | `10-community-guidelines-screen.md`   | Community guidelines with admin management and version control                   |

## Implementation Order

### Phase 1: Foundation (Tasks 1, 6)

1. Community Feed API
2. Firebase Cloud Messaging Setup

### Phase 2: Web UX (Tasks 2, 4, 7)

3. Community Feed UI (Web)
4. Post Interactions
5. In-App Notification Inbox

### Phase 3: Mobile & Notifications (Tasks 3, 5)

6. Community Feed UI (Mobile)
7. Q&A on Lessons

### Phase 4: Settings & Compliance (Tasks 8, 9, 10)

8. Notification Preferences & GDPR
9. Grouped & Batched Notifications
10. Community Guidelines

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
├──────────────────────┬─────────────────────┬────────────────┤
│  Web Learner         │   Web Mentor        │  React Native  │
│  - Community Feed    │   - Community Hub   │  - Mobile Feed │
│  - Q&A               │   - Moderation      │  - Mobile Q&A  │
│  - Notifications     │   - Analytics       │  - Compose     │
└──────────────────────┴─────────────────────┴────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Hono)                        │
├──────────────────────────────────────────────────────────────┤
│  /api/community/posts      - CRUD operations               │
│  /api/community/posts/:id/comments - Comment management     │
│  /api/lessons/:id/qa       - Q&A system                    │
│  /api/notifications        - In-app notifications           │
│  /api/notifications/preferences - Settings & GDPR          │
│  /api/notifications/token  - FCM device tokens              │
│  /jobs/notification-batch-flush - QStash job               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
├──────────────────┬──────────────────┬──────────────────────┤
│  Firebase        │  Postmark        │  QStash              │
│  - FCM Push      │  - Email         │  - Scheduled Jobs    │
│  - Realtime DB   │  - Digests       │  - Batching          │
└──────────────────┴──────────────────┴──────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
├──────────────────────────────────────────────────────────────┤
│  - CommunityPost, Comment, Like, Bookmark                  │
│  - QandA, QandAAnswer, Feedback                             │
│  - Notification, NotificationBatch, NotificationPreference  │
│  - CommunityGuidelines, Acknowledgment                      │
│  - DeviceToken, NotificationTopic, GDPRConsent             │
└──────────────────────────────────────────────────────────────┘
```

## Key Integration Points

### Database

- Prisma ORM with proper indexing
- Soft deletes for audit trails
- Denormalized counts for performance
- Foreign keys for referential integrity

### Authentication

- Requires auth middleware from earlier milestone
- Role-based access control (learner, instructor, admin)
- Scope access to post author/mentor relationship

### Storage

- Cloudinary for post images
- Signed URLs for security
- Automatic cleanup on deletion

### Notifications

- Firebase Cloud Messaging for push
- Postmark for email
- QStash for scheduled batching
- PostgreSQL for in-app store

### Performance

- Database indexes on frequently queried fields
- Denormalized counts (like count, comment count)
- Batch queries for efficiency
- Caching layer for preferences
- Soft deletes to avoid expensive migrations

## Data Models

### Community Feed

```
CommunityPost
├── Content (text, imageUrl)
├── Author (User ID)
├── Mentor (User ID - scope visibility)
├── Tags (CourseTags, TopicTags)
├── Interactions
│   ├── Likes (CommunityPostLike)
│   └── Comments (CommunityPostComment)
└── Metadata (pins, hidden, views)
```

### Q&A System

```
QandA
├── Question (text)
├── Asker (User ID)
├── Lesson (Lesson ID)
└── Answers (QandAAnswer[])
    ├── Content
    ├── Answerer
    ├── Feedback (helpful/not helpful)
    └── Resolution status
```

### Notifications

```
Notification
├── User ID
├── Type (enum)
├── Content (title, body)
├── Metadata (relatedId, deepLink)
├── Status (read/unread)
└── Batching (groupKey, groupCount)

NotificationBatch
├── Group Key
├── Notification Count
├── Scheduled Flush
└── QStash Message ID

NotificationPreference
├── Opt-in Toggles (marketing, transactional)
├── Channel Toggles (push, email, in-app)
├── Category Toggles (per notification type)
├── Quiet Hours
└── Digest Settings
```

### Guidelines

```
CommunityGuidelines
├── Version
├── Sections (ordered)
├── Enforcement Policy
└── Edit History

CommunityGuidelinesAcknowledgment
├── User ID
├── Version Acknowledged
└── Timestamp + IP/UA
```

## API Response Patterns

All endpoints follow consistent patterns:

### Success Response (2xx)

```json
{
  "data": {
    /* payload */
  },
  "pagination": {
    /* if applicable */
  }
}
```

### Error Response (4xx, 5xx)

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    /* optional */
  }
}
```

### Pagination

```json
{
  "page": 1,
  "limit": 20,
  "total": 156,
  "hasMore": true,
  "totalPages": 8,
  "unreadCount": 5 // For notifications
}
```

## Security Considerations

### Access Control

- Verify lesson watched before showing post from that mentor
- Only post author or mentor can delete/edit
- Instructors can moderate comments on their courses
- Admins can moderate anything

### GDPR Compliance

- Marketing notifications require explicit opt-in
- Transactional notifications cannot be disabled
- Consent logging with IP/UA for audit trail
- Data export capability
- Right to be forgotten support

### Rate Limiting

- Post creation: 1 per minute, 10/hour
- Comments: 10 per minute
- Likes: 100 per minute
- Q&A questions: 5 per day
- Token registration: 100 per day

### Content Validation

- Max lengths enforced (2000 for posts, 500 for comments)
- Image size limits (10MB max)
- Image format validation
- HTML escaping for text content
- No @mentions in single-level comments

## Monitoring & Analytics

### Metrics to Track

- Daily active users in community
- Post engagement rates (likes, comments)
- Q&A velocity and answer rates
- Notification delivery rates
- Opt-in rates for marketing
- Community guideline violations

### Error Tracking

- Failed notification sends
- Invalid device tokens
- Batch job failures
- Access control denials
- Rate limit hits

### Performance Metrics

- Post load time
- Comment pagination latency
- Notification delivery latency
- API response times

## Testing Strategy

### Unit Tests

- Access control logic
- Batch grouping logic
- Notification filtering
- Guideline versioning

### Integration Tests

- Post creation → appears in feed
- Like post → count updates
- Comment → notification sent
- Accept guidelines → post enabled

### E2E Tests

- Full post creation flow
- Comment and reply flow
- Notification acknowledgment flow
- Preference changes apply immediately

### Load Testing

- 1000+ posts in feed
- Batch processing at scale
- Concurrent post creation

## Deployment Notes

### Environment Variables

```
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
QSTASH_TOKEN
POSTMARK_API_KEY
CLOUDINARY_API_KEY
CLOUDINARY_UPLOAD_PRESET
```

### Database Migrations

Run migrations in order:

1. Create all schemas
2. Create indexes
3. Seed default guidelines
4. Initialize notification preferences for existing users

### Service Configuration

1. Firebase: Enable Cloud Messaging
2. QStash: Set up webhook endpoint
3. Postmark: Configure API key and templates
4. Cloudinary: Configure upload presets and transformations

## Performance Optimization Tips

1. **Query Optimization**
   - Use selective field selection
   - Batch related queries
   - Avoid N+1 problems
   - Index on (userId, createdAt, isRead) for notifications

2. **Caching**
   - Cache notification preferences (1 hour TTL)
   - Cache guidelines (30 day TTL)
   - Cache post metadata (5 min TTL)

3. **Pagination**
   - Use cursor-based for large datasets
   - Limit max page size
   - Implement infinite scroll on client

4. **Image Optimization**
   - Use Cloudinary transformations
   - Lazy load in feeds
   - Generate thumbnails on upload

## Troubleshooting

### Push Notifications Not Received

1. Check device token is registered: GET /api/notifications/tokens
2. Verify preference enabled: GET /api/notifications/preferences
3. Check quiet hours not active
4. Verify FCM credentials
5. Check token expiry and refresh

### Notifications Piling Up

1. Check batch job is running
2. Verify QStash configuration
3. Review quiet hours settings
4. Check preference for batching enabled

### Performance Issues

1. Check database indexes exist
2. Review query plans (EXPLAIN)
3. Check for N+1 queries in logs
4. Monitor notification batch processing time

---

**Last Updated:** 2024-02-18
**Status:** Planned
**Effort:** 8-10 weeks
