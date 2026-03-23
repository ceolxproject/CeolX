# Account Deletion - Instructor

## Description

Implement instructor account deletion with additional complexity beyond learner deletion:

- Same re-verification and 30-day grace period as learner deletion
- Impact assessment of deletion (courses will be unpublished, learners notified)
- Pending payouts must be processed before/at deletion completion
- Earnings records retained permanently for tax/financial compliance
- Enrolled learners must be notified of instructor account deletion
- Admin notification of instructor deletion request
- Cannot delete if active payouts or disputes exist (with explanation)

This feature ensures business continuity and legal compliance for financial records.

## Affected Apps/Packages

- **Web App** (Next.js) - deletion UI in Instructor Settings
- **Instructor Dashboard** - account management section
- **API Server** - deletion endpoints and validation
- **Background Jobs** - QStash for course unpublishing, learner notification
- **Email Service** - confirmation, learner notification, admin alert
- **Payments Service** - payout processing coordination

## API Endpoints

- `POST /api/instructor/deletion-request` - Request account deletion (requires impact assessment)
- `GET /api/instructor/deletion-impact` - Check impact (courses, enrollments, payouts)
- `POST /api/instructor/deletion-verify` - Re-verify identity
- `GET /api/instructor/deletion-status` - Check deletion request status
- `POST /api/instructor/deletion-cancel` - Cancel pending deletion
- `POST /api/instructor/payouts/process-for-deletion` - Process outstanding payouts

## Requirements

- **Deletion Request UI** (Instructor Settings > Account):
  - Same warning and confirmation flow as learner
  - Impact assessment displayed before confirmation:
    - Number of published courses (will be unpublished)
    - Number of enrolled learners (will be notified)
    - Pending payouts (must be processed)
    - Total earnings to be retained
    - Active disputes or chargebacks (if any)
  - Option to download course metadata export before deletion
  - Cannot proceed if active disputes exist
  - Clear explanation that earnings records retained for tax purposes

- **Impact Assessment Validation**:
  - Check instructor_courses table for published courses
  - Count enrolled learners via enrollment_junction table
  - Check pending_payouts table
  - Verify no active payment disputes
  - Check for active refund requests
  - Calculate total earnings across all courses
  - If blocking conditions exist, show explanation with options:
    - If pending payouts: show "Process Payouts First" flow
    - If disputes: show "Resolve Disputes First" with support link
    - If active refunds: show "Wait for Refunds to Complete"

- **Payout Processing on Deletion**:
  - When deletion initiated, queue all pending payouts for processing
  - Do not complete deletion until all payouts processed
  - Add "Deletion Pending" flag to payouts
  - Notify finance team of deletion-related payouts
  - Allow instructor to monitor payout status during grace period
  - If payout fails, send notification and prevent deletion completion
  - Store final payout timestamp for audit trail

- **Course Unpublishing**:
  - After grace period expires and before deletion completes:
    - Unpublish all published courses
    - Set courses to "deleted_author" status
    - Preserve course data for enrolled learners (read-only access)
    - Refund any pending course purchases (if applicable)
    - Notify all enrolled learners asynchronously

- **Learner Notification**:
  - Email to all enrolled learners:
    - Explanation that instructor is leaving platform
    - Course will remain accessible (read-only)
    - Course materials will not be updated
    - Refund information if applicable
    - No action required
  - Send notifications via QStash job (staggered, max 50/minute)
  - Record notification delivery status
  - Retry failed notifications up to 3 times

- **Admin Notification**:
  - Alert to admin dashboard when instructor deletion requested
  - Include impact summary (learners affected, revenue implications)
  - Direct link to review deletion request
  - Option to cancel deletion as admin (with audit log)
  - Weekly summary of pending instructor deletions

- **Data Retention for Instructors**:
  - **Deleted**: personal data, photo, bio, banking details
  - **Anonymized**: display name, email, profile
  - **Retained**: earnings records, payout history, course enrollments, tax information, transaction records, dispute records

- **Database Schema** (extends learner deletion schema):

  ```
  instructor_deletion_requests table:
  - id: UUID (primary key)
  - instructor_id: UUID (foreign key)
  - status: enum (pending, processing, blocked, cancelled, completed)
  - requested_at: timestamp with timezone
  - grace_period_ends_at: timestamp with timezone
  - cancelled_at: timestamp with timezone (nullable)
  - completed_at: timestamp with timezone (nullable)
  - impact_assessment: jsonb
    {
      published_courses: number,
      enrolled_learners: number,
      pending_payouts: {
        count: number,
        total_amount: decimal,
        currency: string
      },
      total_lifetime_earnings: decimal,
      active_disputes: boolean,
      active_refunds: boolean
    }
  - blocking_reason: enum (pending_payouts, active_disputes, active_refunds) (nullable)
  - payouts_processed_at: timestamp with timezone (nullable)
  - courses_unpublished_at: timestamp with timezone (nullable)
  - learners_notified_at: timestamp with timezone (nullable)
  - cancellation_token: string
  - cancellation_token_expires_at: timestamp with timezone

  instructor_deletion_audit_log table:
  - id: UUID
  - instructor_id: UUID
  - action: enum (request, impact_assessed, blocked, unblocked, payouts_processed, courses_unpublished, learners_notified, cancel, complete)
  - timestamp: timestamp with timezone
  - ip_address: string
  - details: jsonb
  - admin_id: UUID (nullable, if action taken by admin)
  ```

## Acceptance Criteria

- [ ] Instructor Settings has "Delete Account" option
- [ ] Deletion form shows impact assessment before confirmation
- [ ] Impact assessment shows: courses, learners, payouts, earnings, disputes
- [ ] Cannot proceed if active disputes exist (shows explanation)
- [ ] Cannot proceed if active refunds exist (shows explanation)
- [ ] Pending payouts queued for processing when deletion initiated
- [ ] Payout processing completes before deletion finishes
- [ ] Payout status visible to instructor during grace period
- [ ] All published courses unpublished after grace period
- [ ] Course status changed to "deleted_author" for read-only access
- [ ] Enrolled learners receive notification email
- [ ] Learner emails include clear explanation and no-action-needed message
- [ ] Notification delivery status tracked
- [ ] Admin dashboard shows pending instructor deletions
- [ ] Admin can view deletion request details and impact summary
- [ ] Admin can cancel deletion with audit trail
- [ ] instructor_deletion_requests table stores all required fields
- [ ] 30-day grace period enforced (same as learner)
- [ ] Cancellation link works and restores instructor account
- [ ] Earnings records preserved in earnings_records table
- [ ] Tax-related payout history retained indefinitely
- [ ] Dispute records retained for compliance
- [ ] Instructor cannot create courses during grace period
- [ ] Instructor cannot receive new enrollments during grace period
- [ ] IP address recorded in deletion audit log
- [ ] Re-verification required (password or email)
- [ ] Weekly admin summary email of pending deletions sent
- [ ] Blocking conditions prevent completion with clear messaging
- [ ] QStash jobs handle course unpublishing and learner notification
- [ ] Retry logic for failed learner notifications (max 3 attempts)

## Dependencies

- **Account Deletion - Learner** - shared grace period and re-verification logic
- **Automated Anonymization** - triggers for instructor PII after grace period
- **IP Anonymization Cron** - anonymizes IPs in deletion logs
- **Email Service** - learner notification, admin alerts, confirmation emails
- **Background Jobs (QStash)** - course unpublishing, learner notification scheduling
- **Payments Service** - payout processing coordination
- **Data Export** - instructor course metadata export before deletion

## Technical Notes

- Implement impact assessment as separate API call with caching (5-min TTL)
- Consider "soft delete" state for courses (deleted_author) instead of hard delete
- Use QStash for staggered learner notifications (avoid email flooding)
- Log all impact assessment results for compliance audit
- Implement webhook for finance team to monitor deletion-related payouts
- Create database views for reporting on instructor deletions
- Test with various instructor states (active enrollments, pending payouts, disputes)
- Consider automation: if no new sales in 30 days, warn instructor of inactive status
- Store impact assessment as immutable record for dispute resolution
- Implement feature flag for gradual rollout
- Learner notification email template should be empathetic
- Consider offering course transfer option instead of deletion (future enhancement)
- Document blocking conditions in UI with links to resolution steps
- Implement rate limiting on deletion requests (1 per 30 days max)
- Create audit report of instructor deletions quarterly
- Test payout processing edge cases (partial refunds, failed charges)
- Ensure earnings records cannot be modified after deletion request
- Consider instructor's tax year for earnings record retention (keep 7 years minimum)
- Implement separate queue for instructor deletion jobs (higher priority)
- Notify legal/compliance team of instructor deletions for record-keeping
