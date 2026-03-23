# Admin Deletion Processing

## Description

Implement an admin dashboard for processing user deletion requests that have completed their 30-day grace period. Admins review pending deletions, assess impact (especially for instructors), finalize accounts, and confirm completion. The system prevents accidental deletions with multiple confirmation steps and maintains immutable audit trail of every deletion action.

## Affected Apps/Packages

- **Admin Dashboard** - deletion request interface
- **API Server** - deletion processing endpoints
- **Database** - deletion_requests, deletion_audit_log tables
- **Background Jobs** - anonymization triggers
- **Email Service** - user notifications

## API Endpoints

- `GET /api/admin/deletions/pending` - List pending deletions (grace period expired)
- `GET /api/admin/deletions/:deletion_id` - Get deletion request details
- `POST /api/admin/deletions/:deletion_id/assess-impact` - Assess impact (instructors)
- `POST /api/admin/deletions/:deletion_id/finalize` - Complete deletion
- `POST /api/admin/deletions/:deletion_id/cancel` - Cancel deletion (with reason)
- `GET /api/admin/deletions/history` - Completed deletions audit log

## Requirements

- **Pending Deletions Dashboard** (`/api/admin/deletions/pending`):
  - List of deletion requests where grace_period_ends_at <= now
  - Sorted by grace period end date (oldest first)
  - Status indicators:
    - "Ready for Processing" (grace period expired, no issues)
    - "Impact Assessment Needed" (instructor with courses)
    - "Requires Review" (flagged for some reason)
  - Filters:
    - User type (learner, instructor)
    - Status (pending, in_review, ready)
    - Date range
  - Card view showing:
    - User name (or anonymized if already processing)
    - Account type (learner/instructor)
    - Deletion requested date
    - Grace period end date (in red if past due)
    - Reason for deletion (user-provided, if any)
    - Actions: View Details, Assess Impact, Finalize
  - Pagination (50 per page)

- **Deletion Details View** (`/api/admin/deletions/:deletion_id`):
  - Full deletion request information:
    - User details (name, email, account type)
    - Deletion request date
    - Grace period timeline
    - Reason (user-provided)
    - Cancellation token status (valid/expired)
    - Any manual re-consent attempts (date, IP)
  - For instructors, impact assessment section:
    - Number of published courses
    - Total enrolled learners
    - Pending payouts (amount, dates)
    - Active disputes or chargebacks
    - Total lifetime earnings
    - Status of each impact area
  - Audit history:
    - When assessment completed
    - When impacts processed (payouts, course unpublishing)
    - By which admin
  - Action buttons:
    - "Assess Impact" (if not done)
    - "Finalize Deletion"
    - "Cancel Deletion" (requires reason)
    - "Preview Anonymization" (what will be anonymized)

- **Impact Assessment** (`/api/admin/deletions/:deletion_id/assess-impact`):
  - Auto-triggered for instructors
  - Manual button click for admin to review
  - Checks:
    1. **Courses**: Count published courses, list them
    2. **Enrollments**: Count enrolled learners, by course
    3. **Payouts**: Check pending payouts
       - If pending: block completion until processed
       - Show payout details (amount, date due)
       - Button: "Process Pending Payouts"
    4. **Disputes**: Check active payment disputes
       - If active: block completion, show dispute details
       - Allow admin to manually resolve or escalate
    5. **Earnings**: Total lifetime earnings (informational only)
  - Assessment result displayed:
    ```
    Impact Assessment Results
    ✓ Courses: 3 published courses will be unpublished
    ✓ Learners: 47 enrolled learners will be notified
    ✓ Payouts: 2 pending payouts ($1,234.56) - PROCESSING
    ✓ Disputes: None active
    ✓ Earnings: $12,456.78 total (retained)
    [Finalize Deletion] or [Cancel]
    ```

- **Finalize Deletion** (`/api/admin/deletions/:deletion_id/finalize`):
  - Multi-step confirmation process:
    1. Display final warning:

       ```
       This action will immediately:
       - Anonymize user profile (irreversible)
       - Delete sessions and tokens (user logged out)
       - Delete learning progress (cannot be recovered)
       - Unpublish courses (if instructor)
       - Notify enrolled learners (if instructor)

       Are you ready to proceed?
       ```

    2. Confirmation checkboxes (must check all):
       - [ ] "I have reviewed the impact assessment"
       - [ ] "I understand this action is irreversible"
       - [ ] "All payouts have been processed" (if instructor)
       - [ ] "No active disputes exist" (if instructor)
    3. Final confirmation button: "Finalize Deletion"
       - Button disabled until all checkboxes checked
       - Requires admin password/2FA for security

  - On confirm:
    1. Update deletion_requests status to "processing"
    2. Queue QStash job for anonymization
    3. Mark deletion as "completed"
    4. Create audit log entry
    5. Send confirmation email to support team
    6. Display success message with job ID

- **Cancel Deletion** (`/api/admin/deletions/:deletion_id/cancel`):
  - Only allowed if grace period not yet expired
  - Form asking:
    - Reason for cancellation (dropdown):
      - "User requested re-activation"
      - "Policy violation resolved"
      - "Account recovered (hack)"
      - "System error"
      - "Other"
    - Admin notes (optional)
  - Cancellation requires confirmation:
    ```
    This will restore the user's account and stop the deletion process.
    They will be able to log in again.
    Are you sure?
    ```
  - On confirm:
    1. Update deletion_requests status to "cancelled"
    2. Cancel any scheduled QStash jobs
    3. Create audit log entry
    4. Send email to user: "Your account deletion has been cancelled"

- **Database Schema**:

  ```
  deletion_audit_log table:
  - id: UUID (primary key)
  - deletion_id: UUID (foreign key to deletion_requests)
  - user_id: UUID (foreign key to users)
  - action: enum (
      request_created,
      impact_assessed,
      payouts_processed,
      courses_unpublished,
      learners_notified,
      finalization_started,
      anonymization_queued,
      anonymization_completed,
      cancelled,
      error_occurred
    )
  - admin_id: UUID (nullable, admin performing action)
  - timestamp: timestamp with timezone
  - ip_address: string
  - details: jsonb (action-specific data):
    {
      // For impact_assessed:
      courses_count: integer,
      learners_count: integer,
      payouts_pending: { count: integer, total: decimal },
      disputes_active: boolean,

      // For anonymization_queued:
      qstash_job_id: string,

      // For error_occurred:
      error_message: string,

      // For cancelled:
      cancellation_reason: enum,
      cancellation_notes: string
    }
  - status: enum (success, error, warning)
  - error_message: text (nullable)

  deletion_requests table (additions):
  - assessment_completed_at: timestamp with timezone (nullable)
  - assessment_by_admin_id: UUID (nullable)
  - assessment_details: jsonb (stored impact assessment)
  - finalization_started_at: timestamp with timezone (nullable)
  - finalization_by_admin_id: UUID (nullable)
  - anonymization_job_id: string (nullable, QStash message ID)
  - anonymization_completed_at: timestamp with timezone (nullable)
  ```

- **Processing Workflow**:
  1. Grace period expires → deletion shows in "pending" list
  2. Admin clicks "View Details" → sees impact and options
  3. For instructors:
     a. Admin clicks "Assess Impact" → impact calculated
     b. If payouts pending: admin manually triggers payout processing
     c. After payouts: impact assessment complete
  4. Admin reviews final details, checkboxes
  5. Admin clicks "Finalize Deletion"
  6. Multi-step confirmation completed
  7. QStash job queued for anonymization
  8. User anonymized asynchronously
  9. Audit log shows completion

- **Instructor-Specific Processing**:
  - Impact assessment auto-triggers on "Assess Impact" click
  - Cannot finalize until all impacts processed:
    - Payouts must be completed (or manually marked as n/a)
    - No active disputes
  - Before finalization:
    - Checkbox: "All payout processing complete"
    - Checkbox: "No active disputes"
  - After finalization (triggered by anonymization job):
    - Courses unpublished
    - Learners notified of instructor departure

- **Error Handling**:
  - If payout processing fails: show error, don't allow finalization
  - If QStash job fails to queue: show error, retry available
  - If anonymization fails: manual retry available in audit log
  - All errors logged in deletion_audit_log

- **Audit & Reporting**:
  - All deletion actions immutable
  - Audit log shows who processed deletion, when, why
  - Compliance report includes: deletions processed, by admin, timeline
  - Failed deletions tracked (for investigation)

- **Notifications**:
  1. **Admin confirmation** (when finalization complete):
     - Email to processing admin: "Deletion finalized, awaiting anonymization"
     - Job ID provided for tracking
  2. **Completion notification** (after anonymization):
     - Email to support team: "Account anonymized, deletion complete"
     - User ID and anonymization hash provided

- **Performance & Scalability**:
  - Deletion processing should not be blocking (uses QStash)
  - Impact assessment cached for 30 minutes
  - Batch processing available for admins (select multiple, process)
  - Expected processing time: 2-15 minutes for anonymization

## Acceptance Criteria

- [ ] Pending deletions dashboard lists expired grace periods
- [ ] Deletions sorted by end date (oldest first)
- [ ] Status indicators show assessment readiness
- [ ] Filters working (user type, status, date)
- [ ] Deletion details view shows full context
- [ ] Impact assessment calculates correctly for instructors
- [ ] Payout pending status blocks finalization
- [ ] Dispute status checked and displayed
- [ ] Finalization requires multi-step confirmation
- [ ] All checkboxes must be checked before finalizing
- [ ] Admin password/2FA required for final confirmation
- [ ] QStash job queued correctly with deletion_id
- [ ] Audit log entries created for all actions
- [ ] Cancellation available before grace period expires
- [ ] Cancellation reason captured
- [ ] User receives re-activation email when cancelled
- [ ] Courses unpublished after anonymization (instructor)
- [ ] Learners notified of instructor deletion
- [ ] All audit log entries immutable
- [ ] deletion_audit_log shows complete timeline
- [ ] Error messages clear and actionable
- [ ] Retry mechanism available for failed jobs
- [ ] Batch deletion processing available
- [ ] Performance acceptable (not blocking)
- [ ] Compliance report includes deletion metrics
- [ ] Email notifications sent correctly
- [ ] Admin who processed deletion tracked
- [ ] Processing IP address recorded
- [ ] Database constraints prevent inconsistencies
- [ ] Soft failures don't block UI (graceful degradation)

## Dependencies

- **Account Deletion - Learner/Instructor** - creates deletion requests
- **Automated Anonymization** - completes deletion process
- **Admin Dashboard** - UI for deletion processing
- **Background Jobs (QStash)** - async anonymization
- **Email Service** - notifications

## Technical Notes

- Deletion processing should be idempotent (safe to retry)
- Implement optimistic locking to prevent race conditions
- Cache impact assessment (5-min TTL) to reduce database load
- QStash job should be high priority (deleted users need prompt handling)
- Use transaction isolation (SERIALIZABLE) for finalization
- Log all admin actions with IP and timestamp
- Consider "soft finalization" - mark ready but require second admin approval
- Implement approval workflow for GDPR requests
- Archive completed deletions after 2 years
- Monitor deletion queue depth (SLA: process within 48 hours of grace expiration)
- Test with various failure scenarios (network, database)
- Ensure deletion cannot be reversed (truly irreversible)
- Document deletion procedure for support team
- Implement dashboard metrics: deletion processing rate, average time
- Consider separate audit trail for high-value accounts (instructors)
- Implement notification to instructor before course unpublishing
- Test performance with thousands of pending deletions
- Ensure error handling doesn't leak user data
- Consider rollback capability (before anonymization only)
