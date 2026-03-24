# Task 18: Admin Deactivate Instructor Flow

## Description

Implement the complete business logic and UI flow for super-admin deactivation of instructor accounts. When an admin deactivates an instructor, the system must immediately revoke active sessions, hide their published courses, apply a 90-day grace period for enrolled learners, freeze payouts, and trigger comprehensive notifications across multiple stakeholders. This task ensures instructor accountability while protecting learner progress and providing a fair transition period.

## Affected Apps/Packages

- **Hono API Backend** (business logic, database transactions)
- **web-admin** (UI/forms for admin deactivation workflow)
- **BetterAuth** (session revocation)
- **Database** (Postgres with transactions)
- **Email Service** (notifications to instructors, learners, team members)
- **Message Queue** (optional: async processing of notifications and payout freezing)
- **Audit Logging System** (compliance and security tracking)

## API Endpoints

### Deactivate Instructor

```
POST /api/admin/instructors/:id/deactivate
Authorization: Required (Super-Admin role only)
Request Body:
{
  "justificationReason": "string",
  "notifyLearners": boolean (default: true),
  "freezePayouts": boolean (default: true)
}
Response: 200 OK
{
  "instructorId": "uuid",
  "status": "deactivated",
  "affectedCoursesCount": number,
  "affectedLearnersCount": number,
  "graceEndDate": "2025-05-18T00:00:00Z",
  "deactivatedAt": "2025-02-18T14:30:00Z"
}
```

### Reactivate Instructor

```
POST /api/admin/instructors/:id/reactivate
Authorization: Required (Super-Admin role only)
Request Body:
{
  "reactivationReason": "string"
}
Response: 200 OK
{
  "instructorId": "uuid",
  "status": "active",
  "coursesRestored": number,
  "gracePeriodsCleared": number,
  "payoutsUnfrozen": boolean
}
```

### Get Deactivation Impact

```
GET /api/admin/instructors/:id/deactivation-impact
Authorization: Required (Super-Admin role only)
Response: 200 OK
{
  "instructorId": "uuid",
  "instructorName": "string",
  "publishedCourses": [
    {
      "courseId": "uuid",
      "courseName": "string",
      "enrollmentCount": number,
      "activeSubscriptions": number
    }
  ],
  "totalAffectedLearners": number,
  "pendingPayouts": {
    "amount": number,
    "currency": "USD",
    "lastPayoutDate": "2025-02-15T00:00:00Z"
  },
  "teamMembers": [
    {
      "memberId": "uuid",
      "memberName": "string",
      "role": "TA|Content_Reviewer|Moderator"
    }
  ],
  "activeSessions": number
}
```

## Requirements

### Deactivation Process - Technical Flow

#### Step 1: Admin Initiation

- Super-admin navigates to instructor profile in web-admin panel
- Admin clicks "Deactivate Account" button, triggering confirmation modal
- Modal displays:
  - Instructor name and account creation date
  - Count of published courses and enrolled learners
  - Count of pending payouts
  - Reason/justification text field (minimum 20 characters, required)
  - Confirmation checkbox: "I understand this cannot be immediately reversed"
  - Cancel and Confirm buttons

#### Step 2: Backend Validation

- Verify super-admin role via BetterAuth session
- Validate instructor ID exists and is currently active
- Check for edge cases:
  - Instructor with active subscriptions (warn but allow)
  - Instructor with pending payouts (show amount, allow but log notice)
  - Instructor with team members (show count, proceed with team notifications)
  - Instructor with pending course approvals (notify about orphaned reviews)

#### Step 3: Session Revocation

- Query all active sessions for this instructor (from BetterAuth session table)
- Revoke sessions immediately using BetterAuth API
- Log each session revocation for audit trail
- Instructor will be logged out immediately on all devices/browsers

#### Step 4: Course Status Management

- Query all published courses owned by this instructor
- Set course status to "hidden" (NOT deleted)
  - Hidden courses do not appear in learner dashboard or course discovery
  - Learners with active enrollments retain access for 90 days
  - Set `course.visibility = 'hidden'` and `course.hidden_reason = 'instructor_deactivated'`
- Log course status change for each course

#### Step 5: Grace Period Flag Setup

- Query all learners enrolled in any of the instructor's courses
- For each enrollment record, set:
  - `enrollment.grace_period_active = true`
  - `enrollment.grace_period_end_date = NOW() + interval '90 days'`
  - `enrollment.grace_activated_at = NOW()`
- Create grace period records for audit and future reference

#### Step 6: Learner Notifications

- For each affected learner, send email notification:

  ```
  Subject: "[Course Name] Instructor No Longer Active - 90-Day Access Grace Period"

  Dear [Learner Name],

  We are writing to inform you that the instructor for [Course Name],
  [Instructor Name], is no longer active on Mentor.

  You will retain access to [Course Name] for 90 days from today
  ([Grace End Date]) to complete your learning. After this period,
  you will no longer be able to access the course materials or submit assignments.

  If you have questions or need further assistance, please contact our
  support team at support@example.com.

  Best regards,
  Mentor Learning Platform
  ```

- Send notifications in batches (avoid overwhelming email service)
- Mark notifications as sent in database

#### Step 7: Instructor Notification

- Send email to instructor's registered email address:

  ```
  Subject: Your Mentor Instructor Account Has Been Deactivated

  Dear [Instructor Name],

  This email confirms that your instructor account on Mentor has been
  deactivated as of [Deactivation Date] [Deactivation Time (UTC)].

  Reason for Deactivation: [Admin Justification Reason]

  Immediate Actions Taken:
  - Your account sessions have been revoked; you are logged out everywhere
  - Your published courses are now hidden from learners
  - Your pending earnings have been frozen

  Learner Access & Grace Period:
  - Learners currently enrolled in your courses retain access for 90 days
  - After 90 days, course access will be terminated

  Appeals & Support:
  If you believe this decision was made in error, you may submit an appeal
  within 14 days of this email. Please reply to this email or contact
  appeals@example.com with your instructor ID and appeal statement.

  Appeal Submission Deadline: [14 days from deactivation]

  Best regards,
  Mentor Compliance Team
  ```

#### Step 8: Payout Freezing

- Query pending payouts for this instructor (unpaid earnings)
- Set payout status to "frozen":
  - `payout.status = 'frozen'`
  - `payout.frozen_at = NOW()`
  - `payout.frozen_reason = 'instructor_deactivated'`
- Do NOT delete or transfer payouts; they remain on account until:
  - Instructor is reactivated (payouts unfrozen), OR
  - Compliance review period (typically 6 months) completes
- Send notification to finance team with frozen payout details

#### Step 9: Community Content Management

- Query all instructor's community posts (forum posts, comments, blog entries)
- Do NOT delete posts (preserves conversation context)
- Add prefix to instructor profile display in community:
  - Display name becomes: "[Deactivated Instructor] [Original Name]"
  - Mark posts with "Posted by deactivated instructor" badge
  - Disable ability to message instructor

#### Step 10: Team Member Notifications

- Query all team members under this instructor (teaching assistants, content reviewers, etc.)
- For each team member:
  - Send email notification:

    ```
    Subject: Your Supervisor [Instructor Name] Has Been Deactivated

    Dear [Team Member Name],

    Your supervisor, [Instructor Name], has been deactivated from the
    Mentor platform. As a result:

    - You no longer have access to [Course Name(s)]
    - Your role as [Role] for that course has been terminated
    - Any pending tasks or reviews assigned by [Instructor Name] are canceled

    If you need to discuss your future role or course assignments, please
    contact the admin team at admin@example.com.

    Best regards,
    Mentor Admin Team
    ```

  - Remove team member from all courses
  - Revoke role-based permissions

#### Step 11: Audit Log Entry

- Create comprehensive audit log entry:
  ```
  {
    "actionType": "INSTRUCTOR_DEACTIVATED",
    "performedBy": {
      "userId": "admin-uuid",
      "role": "SUPER_ADMIN",
      "email": "admin@example.com"
    },
    "targetInstructor": {
      "id": "instructor-uuid",
      "name": "Instructor Name",
      "email": "instructor@example.com"
    },
    "justificationReason": "[Admin-provided reason]",
    "deactivatedAt": "2025-02-18T14:30:00Z",
    "impact": {
      "affectedCoursesCount": 5,
      "affectedLearnersCount": 142,
      "sessionsRevoked": 3,
      "payoutsFrozen": {
        "amount": 5000,
        "currency": "USD"
      },
      "teamMembersNotified": 4
    },
    "status": "COMPLETED",
    "completedAt": "2025-02-18T14:31:45Z"
  }
  ```

### Reactivation Process

#### Step 1: Admin Initiates Reactivation

- Super-admin navigates to deactivated instructor profile
- Clicks "Reactivate Account" button
- Modal appears with:
  - Reactivation reason text field
  - Confirmation: "I confirm this instructor may resume teaching"
  - Cancel and Confirm buttons

#### Step 2: Reactivation Logic

- Set `instructor.status = 'active'`
- Restore all courses: `course.visibility = 'published'` (was hidden)
- Clear grace period flags:
  - `enrollment.grace_period_active = false`
  - `enrollment.grace_period_end_date = NULL`
- Unfreeze payouts:
  - `payout.status = 'pending'` (was frozen)
  - `payout.frozen_at = NULL`
- Restore community profile display (remove "[Deactivated Instructor]" prefix)
- Create audit log for reactivation

#### Step 3: Notifications

- Send email to instructor confirming reactivation
- Send email to affected learners:

  ```
  Subject: Your Course Instructor [Name] Is Active Again

  Dear [Learner Name],

  Good news! The instructor for [Course Name], [Instructor Name], has been
  reactivated and is now able to resume teaching.

  Your 90-day grace period access has been extended. You can continue your
  learning without the previous time restriction.

  Best regards,
  Mentor Learning Platform
  ```

- Notify team members that courses are accessible again

### Edge Cases & Error Handling

#### Instructor with Active Subscriptions

- Allow deactivation but log prominently
- Subscription refund rules apply (based on platform policy)
- Show warning in confirmation dialog: "X learners have active paid subscriptions"

#### Instructor with Pending Payouts

- Show frozen payout amount in confirmation dialog
- Proceed with deactivation, freeze payouts immediately
- Log in audit trail: "$X pending earnings frozen"

#### Instructor with Team Members

- Revoke all team member access to instructor's courses
- Team members are notified of loss of access
- Pending assignments/reviews by team members are marked as void

#### Concurrent Deactivation Requests

- Use database transaction with row-level locking
- Prevent duplicate deactivation (idempotent operation)
- Return existing deactivation status if already deactivated

#### Learner Grace Period Expiry

- Implement background job to check grace period expiry daily
- At expiry, revoke course access:
  - Set `enrollment.status = 'expired'`
  - Remove from learner's active courses list
  - Send reminder email 7 days before expiry

## Acceptance Criteria

- [ ] API endpoint `POST /api/admin/instructors/:id/deactivate` is implemented with authorization check
- [ ] Deactivation modal in web-admin displays all required information (courses, learners, payouts, team members)
- [ ] Justification reason field validates minimum 20 characters
- [ ] Confirmation checkbox is required before deactivation can proceed
- [ ] All active sessions for instructor are revoked (BetterAuth integration works)
- [ ] All published courses are set to hidden status within same transaction
- [ ] Grace period flags are set for all 142+ test learner enrollments
- [ ] Learner notification emails are sent in batches (verified in email service logs)
- [ ] Learner emails contain correct course name, grace end date (90 days), and support contact
- [ ] Instructor notification email is sent with deactivation reason and appeal deadline
- [ ] Payout freezing logic freezes all pending payouts without data loss
- [ ] Finance team receives notification of frozen payouts with amounts
- [ ] Community posts are preserved and marked as "[Deactivated Instructor]"
- [ ] Team members are notified of deactivation and lose course access
- [ ] Audit log entry is created with complete impact details
- [ ] API endpoint `POST /api/admin/instructors/:id/reactivate` is implemented
- [ ] Reactivation restores course visibility and clears grace periods
- [ ] Reactivation unfreezes payouts and enables course access
- [ ] Learner emails are sent upon reactivation confirming instructor is active
- [ ] Reactivation audit log is created
- [ ] Deactivation endpoint returns deactivation impact summary with counts
- [ ] GET `/api/admin/instructors/:id/deactivation-impact` returns correct impact preview
- [ ] Database transaction ensures atomicity (all-or-nothing behavior)
- [ ] Concurrent deactivation requests are handled safely (no duplicates)
- [ ] Grace period expiry background job is implemented and tested
- [ ] E2E test: Admin deactivates instructor, learner notification sent, grace period set
- [ ] E2E test: Admin reactivates instructor, courses visible, payouts unfrozen
- [ ] Load test: Deactivation with 500+ affected learners completes in <5 seconds
- [ ] Security audit: Only super-admin role can deactivate/reactivate instructors

## Dependencies

### Must Complete Before

- **Task 5: User Roles & Permissions** — Super-admin role must be defined
- **Task 7: BetterAuth Integration** — Session management and revocation API
- **Task 12: Course Management Core** — Course status management (hidden/published states)
- **Task 13: Enrollment Management** — Enrollment records and status tracking
- **Task 15: Payout System** — Payout records and freezing/unfreezing logic
- **Task 20: Audit Logging System** — Audit trail creation and querying

### May Be Blocked By

- Email service integration (can use mock email in development)
- Background job scheduler (for grace period expiry checks)

### Blocking Tasks

- Task 19: Appeal Process (depends on deactivation audit logs)
- Task 25: Admin Dashboard Analytics (uses deactivation statistics)

## Technical Notes

### Database Schema Considerations

- `instructors` table: Add `status ENUM('active', 'deactivated', 'suspended')` column
- `enrollments` table: Add `grace_period_active BOOLEAN`, `grace_period_end_date TIMESTAMP`, `grace_activated_at TIMESTAMP`
- `courses` table: Add `visibility ENUM('published', 'hidden', 'draft')`, `hidden_reason VARCHAR` columns
- `payouts` table: Add `frozen_at TIMESTAMP`, `frozen_reason VARCHAR`, status should support 'frozen'
- `audit_logs` table: Schema must support detailed action metadata

### Transaction Management

- Wrap entire deactivation logic in a database transaction (SERIALIZABLE isolation level)
- If any step fails, rollback entire operation (no partial deactivations)
- Example pseudocode:
  ```
  BEGIN TRANSACTION;
  UPDATE instructors SET status = 'deactivated';
  UPDATE courses SET visibility = 'hidden';
  UPDATE enrollments SET grace_period_active = true;
  UPDATE payouts SET status = 'frozen';
  INSERT INTO audit_logs VALUES (...);
  COMMIT;
  ```

### Notification Queue

- Implement message queue (Bull, Bullmq, or similar) for async email sending
- Enqueue notification jobs with exponential backoff retries
- Log job completions for audit trail

### Performance Optimization

- Use database indexes on:
  - `instructors.status`
  - `courses.instructor_id, courses.visibility`
  - `enrollments.instructor_id, enrollments.grace_period_active`
  - `payouts.status`
- Batch update operations to avoid N+1 queries
- Consider caching deactivation status in Redis for fast lookups

### Testing Strategy

- Unit tests:
  - Validate session revocation logic
  - Verify grace period date calculations
  - Test audit log entry structure
  - Test email template rendering with variables

- Integration tests:
  - Full deactivation flow with mock database and email service
  - Concurrent deactivation requests (verify transaction safety)
  - Grace period expiry job execution
  - Reactivation flow with verification of all state changes

- E2E tests:
  - Admin dashboard deactivation flow
  - Learner receives email and sees grace period in course page
  - Instructor receives deactivation email

- Security tests:
  - Only super-admin can deactivate (verify role-based access)
  - Deactivated instructor cannot login
  - Team members lose access immediately

### Debugging & Monitoring

- Log all deactivation steps with timestamps for troubleshooting
- Monitor grace period expiry job execution daily
- Alert on failed email deliveries (bounces, rejections)
- Dashboard query for "Deactivated Instructors" count and trend

### Related Documentation

- BetterAuth Session Management: https://betterauth.dev/docs/session-management
- Database Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Email Service Integration: [Internal wiki link]
- Audit Logging Standards: [Internal compliance documentation]
