# All-Access Change Notifications

## Description

Implement a notification system for learners affected by All-Access subscription plan changes. When super-admins add or remove courses from All-Access eligibility (milestone 11, task 11), affected learners must be notified immediately via email and in-app notifications. Support two key scenarios: (1) Course added to All-Access — notify All-Access subscribers with "New course available: [course_name]" encouraging exploration, (2) Course removed from All-Access — notify enrolled All-Access learners with "Course [course_name] will be removed from All-Access on [date]. You have 30 days to complete it." Grace period logic allows learners 30 days to complete courses being removed. Implement batch notification processing via QStash to prevent system overload. Provide admin preview showing count of affected learners before confirming changes to ensure transparency.

## Affected Apps/Packages

- web-admin (super-admin panel)
- backend API (subscription service, course service, notification service)
- email-service (transactional email)
- qstash-integration (background job queue)
- analytics-adapter (event tracking)

## API Endpoints

- `GET /api/admin/all-access/preview-changes` - Preview learners affected by change
- `PUT /api/admin/all-access/courses/:courseId/add` - Add course to All-Access
- `PUT /api/admin/all-access/courses/:courseId/remove` - Remove course from All-Access
- `POST /api/admin/all-access/notify-changes` - Trigger batch notifications
- `GET /api/admin/all-access/change-history` - View history of All-Access changes
- `GET /api/users/:userId/all-access-notifications` - Fetch notifications for learner
- `PUT /api/users/:userId/all-access-notifications/:notificationId/read` - Mark notification as read
- `POST /api/admin/all-access/grace-period/:courseId/extend` - Extend grace period (admin override)
- `GET /api/admin/all-access/grace-period-status/:courseId` - Check grace period status for course
- `POST /api/qstash/webhooks/all-access-notifications` - QStash webhook for batch job

## Requirements

### All-Access Eligibility Management (Admin Side)

- UI in super-admin panel for managing All-Access course eligibility
- Current state display:
  - List of all courses with badges: "All-Access Eligible" or "Not Eligible"
  - Filter/search: by course title, category, instructor
  - Bulk selection: checkbox to select multiple courses
- Course eligibility change actions:
  - "Add to All-Access" button → initiates add flow
  - "Remove from All-Access" button → initiates remove flow
  - Bulk actions: select multiple courses → "Add All to All-Access" / "Remove All from All-Access"

### Preview Affected Learners (Before Confirming)

- When admin clicks "Add/Remove from All-Access", show preview modal:
  - **Add to All-Access scenario**:
    - "You are about to make [Course Name] available to All-Access subscribers"
    - Display count: "This will affect X All-Access subscribers"
    - Breakdown (optional): show segment (e.g., "5 active, 2 inactive")
    - Action: "Proceed" or "Cancel"
  - **Remove from All-Access scenario**:
    - "You are about to remove [Course Name] from All-Access"
    - Display affected learner counts:
      - "X All-Access subscribers currently enrolled in this course"
      - "Y All-Access subscribers have completed this course"
    - Grace period info: "Enrolled learners will have 30 days to complete the course"
    - Warning: "All-Access subscribers will be notified"
    - Action: "Proceed" or "Cancel"
- API call: `GET /api/admin/all-access/preview-changes` with course_id and action (add/remove)
- Response includes:
  ```json
  {
    "action": "remove",
    "course_id": "course_123",
    "course_name": "Advanced Python",
    "affected_learner_count": 42,
    "enrolled_learner_count": 35,
    "completed_learner_count": 7,
    "all_access_subscribers_count": 150,
    "new_enrollment_count_if_add": 0
  }
  ```

### Add Course to All-Access

- When admin confirms adding course to All-Access:
  - Update course eligibility: `PUT /api/admin/all-access/courses/:courseId/add`
  - Request includes: course_id, effective_date (optional, default: immediate)
  - Backend actions:
    - Set course.all_access_eligible = true
    - Record change in audit log
    - Trigger notification batch job
  - Response: confirmation + notification job status
- Notification to All-Access subscribers:
  - Email subject: "New Course Available: [Course Name]"
  - Email body:

    ```
    Hi [Learner Name],

    Great news! A new course is now available to you as an All-Access subscriber.

    [Course Name]
    [Brief description, 100 chars max]
    Instructor: [Instructor Name]

    Start learning now: [Course Link]

    ---
    You're receiving this because you're an All-Access subscriber.
    ```

  - In-app notification:
    - Title: "New Course Added to All-Access"
    - Body: "[Course Name] is now available. Start learning today."
    - CTA button: "View Course"
    - Notification link: navigates to course detail page
  - Batch processing: send notifications via QStash for 100+ learners

### Remove Course from All-Access

- When admin confirms removing course from All-Access:
  - Update course eligibility: `PUT /api/admin/all-access/courses/:courseId/remove`
  - Request includes: course_id, removal_effective_date, grace_period_days (default: 30)
  - Backend actions:
    - Set course.all_access_eligible = false
    - Set course.grace_period_end_date = removal_effective_date + grace_period_days
    - Record change in audit log
    - Trigger notification batch job for enrolled learners
  - Response: confirmation + notification job status
- Notification to Enrolled All-Access Subscribers:
  - Email subject: "Action Required: [Course Name] Being Removed from All-Access"
  - Email body:

    ```
    Hi [Learner Name],

    We're writing to let you know that [Course Name] will no longer be available
    through your All-Access subscription on [Removal Date].

    You have until [Grace Period End Date] to complete the course.
    That gives you [X days] to finish.

    [Course Name]
    Progress: [X]% Complete | [Y of Z lessons completed]

    Complete the course: [Course Link]

    Questions? Contact support.

    ---
    You're receiving this because you're enrolled in this course
    and have an All-Access subscription.
    ```

  - In-app notification:
    - Title: "Course Access Ending"
    - Body: "[Course Name] is being removed from All-Access on [Date]. You have 30 days to complete it."
    - CTA button: "Continue Learning"
    - Warning badge: "30 Days Remaining"
    - Notification link: navigates to course lesson player (resume where left off)
  - Batch processing: send notifications via QStash for 100+ enrolled learners

### Grace Period Implementation

- Grace period: 30 days (configurable, admin override option)
- During grace period:
  - Learner can continue accessing course even if not All-Access
  - Course access remains unrestricted (can resume, watch videos)
  - Learner progress tracked normally
  - Notifications: periodic reminders at day 15, day 7, day 1
- Post grace period:
  - Course access revoked (unless separately purchased)
  - Learner sees: "Your access to this course has ended" message
  - Can purchase course individually to regain access
- Grace period tracking:
  - Stored in database: course.grace_period_end_date
  - API endpoint: `GET /api/admin/all-access/grace-period-status/:courseId`
  - Returns: grace_period_end_date, learners_affected, learners_completed_during_grace_period
- Grace period extension (admin override):
  - Admin can extend grace period via: `POST /api/admin/all-access/grace-period/:courseId/extend`
  - Request: course_id, extension_days, reason (optional)
  - Notification: send email to affected learners: "Your access period has been extended by [X days]"

### Batch Notification Processing via QStash

- QStash integration for scalable notification sending:
  - Prevent system overload when notifying 1000+ learners
  - Process notifications asynchronously in background
  - Resilient to failures (automatic retry)
- Notification job structure:
  ```json
  {
    "event": "all_access_course_added" | "all_access_course_removed",
    "course_id": "course_123",
    "course_name": "Advanced Python",
    "affected_learner_ids": ["user_1", "user_2", "user_3", ...],
    "removal_effective_date": "2024-03-15",
    "grace_period_end_date": "2024-04-15",
    "batch_size": 100,
    "priority": "normal"
  }
  ```
- QStash processing:
  - API call: `POST /api/qstash/webhooks/all-access-notifications`
  - Process in batches: send 100 notifications per batch
  - Delay between batches: 1-5 seconds (configurable)
  - Retry on failure: exponential backoff (1s, 2s, 4s, 8s)
  - Max retries: 5 attempts over 24 hours
  - Log all processed notifications
- Admin dashboard feedback:
  - Show job status: "Sending notifications... (45 of 150 sent)"
  - Completion notification: "All notifications sent successfully"
  - Error handling: show count of failed notifications, allow retry
- Email service integration:
  - QStash calls email service: `POST /api/email/send-transactional`
  - Email service handles: template rendering, SMTP sending, bounce handling
  - Each email includes: learner name, course info, CTA link, unsubscribe link

### In-App Notifications

- Notification badge on learner dashboard:
  - Count badge: "3 course updates" (number of All-Access notifications)
  - Click badge → show notification panel
- Notification panel:
  - List of All-Access notifications (newest first)
  - Filter: All, Unread, Course Updates, Grace Period Reminders
  - Mark as read: `PUT /api/users/:userId/all-access-notifications/:notificationId/read`
  - Click notification → navigate to course detail (if added) or lesson player (if removed)
- Notification types:
  - Course Added: "New Course Available", primary CTA: "Start Learning"
  - Course Removed: "Access Ending", secondary CTA: "Continue Learning", warning badge
  - Grace Period Reminder (day 15): "Course Expires in 15 Days", CTA: "Resume Course"
  - Grace Period Reminder (day 7): "Course Expires in 7 Days", urgent badge
  - Grace Period Reminder (day 1): "Course Expires Tomorrow", urgent badge
  - Grace Period Extension: "Your Access Has Been Extended", CTA: "Resume Course"
- Notification persistence:
  - Store in database: user_all_access_notifications table
  - Retention: 90 days after resolved
  - Soft delete: mark as deleted but keep for audit

### Change History & Audit Trail

- Super-admin can view change history:
  - API: `GET /api/admin/all-access/change-history`
  - Query params: filters (course_id, date_range, action_type)
  - Response: list of changes with:
    ```json
    {
      "id": "change_123",
      "course_id": "course_456",
      "course_name": "Advanced Python",
      "action": "removed",
      "effective_date": "2024-03-15",
      "grace_period_end_date": "2024-04-15",
      "admin_id": "admin_789",
      "admin_name": "John Doe",
      "timestamp": "2024-02-18T10:30:00Z",
      "affected_learner_count": 42,
      "learners_notified": 42,
      "notification_sent_at": "2024-02-18T10:35:00Z",
      "notes": "Optional reason for change"
    }
    ```
- Change history UI:
  - Timeline view: show all All-Access changes chronologically
  - Course view: show all changes for a specific course
  - Filter: by course, date, action type (add/remove)
  - Export: download change history as CSV

### Learner-Facing Experience

- Dashboard impact:
  - Show All-Access badge on learner profile: "All-Access Subscriber"
  - Highlight new courses available through All-Access
  - Show grace period countdown on in-progress courses (if applicable)
- Course enrollment flow:
  - All-Access courses show "Included with All-Access" badge (no price)
  - Non-All-Access courses show price (purchase required or separated)
  - Filter: "Show All-Access courses only" in course browser
- Course detail page:
  - Show All-Access eligibility status
  - If grace period active: countdown banner "You have X days to complete this course"
  - If grace period expired: "Your access to this course has ended" + purchase option
- Progress tracking:
  - Show progress bar for All-Access courses with grace period
  - Highlight courses expiring soon in dashboard
  - Email reminder: "You have 7 days to complete [Course]"

### Notification Preferences

- Learners can manage All-Access notification preferences:
  - Email notifications for All-Access changes (enable/disable)
  - In-app notifications (enable/disable)
  - Frequency: immediately, daily digest, weekly digest
  - Opt-out: "I don't want to be notified about All-Access changes"
- API: `PUT /api/users/:userId/notification-preferences` (existing endpoint, extend)
- Preferences stored: user.notification_preferences.all_access

### Reporting & Analytics

- Admin dashboard analytics:
  - Total All-Access subscribers impacted by recent changes
  - Course completion rate during grace periods
  - Average time to complete course (if added to All-Access)
  - Notification delivery metrics: sent, bounced, opened, clicked
  - Learner sentiment: engagement before/after course added
- Reports:
  - All-Access Impact Report: show courses added/removed, affected learner counts
  - Grace Period Report: show completion rates, learners who didn't complete
  - Notification Delivery Report: open rates, click rates, bounce rates
  - Export: CSV, PDF formats

### Error Handling & Fallback

- If notification job fails:
  - Retry via QStash (max 5 attempts)
  - Log error for admin review
  - Admin can manually trigger notification re-send
  - Show error count on dashboard: "5 notifications failed to send. Retry?"
- If email service down:
  - Queue notifications in database
  - Retry when email service recovers
  - Fallback: notify learner via in-app notification only
- If learner email is invalid:
  - Skip email, send in-app notification only
  - Log invalid email for support team
  - Allow learner to update email to resubscribe to emails

### Security & Compliance

- Access control: only super-admins can add/remove All-Access courses
  - Verify role on every API call
  - Log all add/remove actions with admin ID, timestamp, IP address
- Data privacy:
  - Notifications only contain non-sensitive data (course name, dates)
  - No payment info, subscription details in email
  - Comply with GDPR: learner can unsubscribe from emails
  - Comply with CCPA: honor do-not-email preferences
- Email security:
  - Use TLS/SSL for email transmission
  - Implement SPF, DKIM, DMARC for email authenticity
  - Unsubscribe link in all transactional emails
  - Honor bounce feedback (remove invalid emails)

### Performance Optimization

- Database indexing:
  - Index: courses(all_access_eligible)
  - Index: user_all_access_subscriptions(user_id, all_access_eligible)
  - Index: user_enrollments(user_id, course_id, enrolled_at)
- Caching:
  - Cache All-Access course list (TTL: 1 hour)
  - Cache learner All-Access subscription status (TTL: 5 minutes)
  - Invalidate cache on All-Access changes
- Query optimization:
  - Batch fetch learner IDs for notification (avoid N+1 queries)
  - Use database cursors for large learner lists
  - Denormalize learner_count in course table (update on changes)

## Acceptance Criteria

- [ ] All-Access eligibility management UI created in super-admin panel
- [ ] Course list displays with badges (Eligible/Not Eligible)
- [ ] Filter and search by course title, category, instructor
- [ ] Bulk selection: select multiple courses for batch operations
- [ ] Preview modal shows affected learner count for add/remove
- [ ] Preview breakdown: enrolled vs completed vs all-access subscribers
- [ ] Add to All-Access API endpoint working (PUT /api/admin/all-access/courses/:courseId/add)
- [ ] Remove from All-Access API endpoint working (PUT /api/admin/all-access/courses/:courseId/remove)
- [ ] Course added email: sent to all All-Access subscribers, contains course info and CTA
- [ ] Course added in-app notification: displays on learner dashboard with link to course
- [ ] Course removed email: sent to enrolled All-Access learners, includes grace period details
- [ ] Course removed in-app notification: displays grace period countdown and warning badge
- [ ] Grace period implementation: learners can access course for 30 days after removal
- [ ] Grace period tracking: database stores grace_period_end_date, queryable via API
- [ ] Grace period extension: admin can extend via API, learner notified
- [ ] Reminders during grace period: sent at day 15, day 7, day 1 before expiration
- [ ] QStash integration: batch notifications processed asynchronously
- [ ] QStash batching: processes 100 notifications per batch, ~1-5s between batches
- [ ] QStash retry logic: exponential backoff, max 5 attempts over 24 hours
- [ ] QStash dashboard feedback: admin sees "Sending... X of Y" progress
- [ ] Email service integration: QStash calls email service, emails sent successfully
- [ ] In-app notifications stored in database and queryable via API
- [ ] In-app notification badge: shows count of unread All-Access notifications
- [ ] Notification panel: filterable by type, mark as read
- [ ] Learner can click notification to navigate to course/lesson
- [ ] Change history API: returns all All-Access changes with filters
- [ ] Change history UI: timeline or list view with search/filter
- [ ] Audit trail: logs all changes with admin ID, timestamp, affected count
- [ ] Notification preferences: learners can opt in/out of email/in-app
- [ ] Preference persistence: stored and respected when sending notifications
- [ ] Analytics dashboard: shows impact metrics (affected learners, completion rates)
- [ ] Error handling: failed notifications queued and retryable
- [ ] Fallback: in-app notifications sent if email fails
- [ ] Invalid email handling: skip email, send in-app, log for support
- [ ] Security: role verification, audit logging, no sensitive data in emails
- [ ] Email compliance: SPF/DKIM/DMARC configured, unsubscribe link present
- [ ] GDPR/CCPA compliance: honor preferences, allow data deletion, unsubscribe working
- [ ] Database indexing: queries optimized, no performance degradation
- [ ] Caching: All-Access course list and subscription status cached
- [ ] Testing: unit tests for notification logic, integration tests for QStash
- [ ] Documentation: API endpoints, email templates, admin workflow

## Dependencies

- QStash SDK (background job queue)
- Email service (transactional email sending)
- Notification service (in-app notifications)
- Database: user_all_access_notifications table, course.grace_period_end_date field
- User service: All-Access subscription data
- Course service: All-Access eligibility management
- Analytics adapter: event tracking for All-Access changes
- Design system: modal, badge, button components

## Technical Notes

- QStash: queue notifications with priority (normal for regular, high for critical)
- Email templates: use handlebars for variable substitution ({{learner_name}}, {{course_name}})
- Email sending: use service like SendGrid, Mailgun, or AWS SES via QStash
- In-app notifications: can use existing notification system (extend if needed)
- Learner counts: pre-calculate before showing preview (avoid long loading times)
- Grace period: store as course field, also track per-enrollment (learner can complete before period ends)
- Notification dedupe: prevent duplicate emails if learner enrolled multiple times (unlikely but possible)
- Batch size: 100 is configurable, can adjust based on email service limits
- Monitoring: set up alerts for high notification failure rates (>10%)
- Database: partition notification table by user_id or course_id for large scale (1M+ notifications)
- Rate limiting: limit to 1000 changes per day per admin (prevent accidental bulk changes)
