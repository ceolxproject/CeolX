# Admin Export Management

## Description

Implement an admin dashboard for managing user data export requests (GDPR Subject Access Requests). Admins review pending export requests, approve/process them, and track SLA compliance (30-day GDPR requirement). The system auto-generates data packages, uploads to R2, and notifies users when exports are ready.

This feature ensures timely compliance with GDPR Article 15 (Right to Access) and manages the data export pipeline.

## Affected Apps/Packages

- **Admin Dashboard** - export request management interface
- **API Server** - export approval and processing endpoints
- **Database** - data_export_requests table
- **Background Jobs (QStash)** - processing triggered from admin action
- **Email Service** - user notifications and SLA reminders

## API Endpoints

- `GET /api/admin/exports/pending` - List pending export requests
- `GET /api/admin/exports/:export_id` - Get export request details
- `POST /api/admin/exports/:export_id/approve` - Approve export request
- `POST /api/admin/exports/:export_id/process` - Manually trigger processing
- `GET /api/admin/exports/:export_id/status` - Check processing status
- `GET /api/admin/exports/history` - Completed exports audit log
- `GET /api/admin/exports/sla-tracking` - SLA compliance dashboard

## Requirements

- **Export Request Dashboard** (`/api/admin/exports/pending`):
  - List of data_export_requests with status = "pending" or "processing"
  - Sorted by requested_at (oldest first, for SLA priority)
  - SLA status indicators (color-coded):
    - Green: < 10 days remaining (on track)
    - Yellow: 10-15 days remaining (monitor)
    - Red: > 15 days remaining (urgent, escalate)
  - Card view showing:
    - User name and email
    - Account type (learner, instructor)
    - Request date
    - Days remaining to meet SLA
    - Format requested (JSON, CSV, both)
    - Current status
    - Actions: View Details, Approve, Process Now
  - Filters:
    - Status (pending, processing, completed, failed)
    - User type (learner, instructor)
    - Date range
    - SLA status (on_track, at_risk, overdue)
  - Bulk actions:
    - Select multiple requests
    - "Approve Selected" button
    - "Process Selected" button

- **Export Request Details** (`/api/admin/exports/:export_id`):
  - Full request context:
    - User profile (name, email, account type)
    - Request date and time
    - Format preference (JSON, CSV, both)
    - SLA deadline (30 days from request)
    - Days remaining (with visual countdown)
    - Reason for request (if provided by user)
    - Request source (web, mobile, support request)
  - Processing status:
    - Current stage (pending, approved, processing, completed, failed)
    - Started time (if processing)
    - Estimated completion time
    - Progress bar (if available)
  - Generated package info (if completed):
    - File size
    - Download link (R2 signed URL)
    - Link expiration date
    - Download count
    - Generated date
  - Actions available:
    - "Approve Request" (if pending)
    - "Process Now" (trigger background job)
    - "Retry Processing" (if failed)
    - "Download Package" (if completed, for admin verification)
    - "Resend Email" (if completed, resend download link)
    - "Cancel Request" (if not yet approved)

- **Approval Workflow**:
  - Admin clicks "Approve" on export request
  - Brief confirmation dialog:

    ```
    Approve Data Export Request
    User: john@example.com
    Account Type: Learner
    Format: JSON + CSV

    [Approve] [Cancel]
    ```

  - On approval:
    1. Update status to "approved"
    2. Record approver_id and approval_timestamp
    3. Optionally: queue for immediate processing or wait for admin to manually trigger
  - SLA clock starts from request_date (not approval_date)

- **Processing Trigger** (`/api/admin/exports/:export_id/process`):
  - Admin clicks "Process Now" to trigger background job
  - Optional: can set processing parameters
    - Priority (normal, high, low)
    - Estimated completion time
  - On trigger:
    1. Queue QStash job with export_id
    2. Update status to "processing"
    3. Record processing_started_at
    4. Display progress tracking page
  - QStash job handles:
    1. Aggregating user data
    2. Generating JSON/CSV files
    3. Creating ZIP archive
    4. Uploading to R2
    5. Generating signed URL
    6. Updating database
    7. Sending download email

- **SLA Tracking Dashboard** (`/api/admin/exports/sla-tracking`):
  - Real-time SLA compliance metrics:
    - Total pending exports
    - On-time percentage (< 30 days)
    - Average processing time
    - Overdue requests (> 30 days)
    - Pending approval (not yet triggered)
  - Breakdown by:
    - User type (learner, instructor)
    - Format (JSON, CSV, both)
    - Request source
  - Timeline chart:
    - Processing time distribution (histogram)
    - SLA deadline progress (funnel chart)
  - Alerts section:
    - Requests approaching deadline (7 days)
    - Overdue requests
    - Failed processing (with retry available)
  - Target SLA: Process all requests within 30 days
  - Weekly compliance report:
    - % of requests completed on time
    - Average processing time
    - Failed request count and reasons
    - Exported to compliance records

- **Completion & Notification**:
  - When QStash job completes:
    1. Update status to "completed"
    2. Store file_size_bytes, r2_url, url_expires_at
    3. Send download email to user
    4. Update admin dashboard to show "completed"
  - Admin sees completion notification:
    - Request now shows "Completed" with download link
    - Can verify quality by downloading package
    - Can resend email if needed
  - Email sent to user:
    - Standard format: "Your data export is ready"
    - Download link button
    - Expiration notice (7 days)
    - Support contact info

- **Error Handling & Retries**:
  - If processing fails:
    1. Log error in status message
    2. Update status to "failed"
    3. Admin notified via alert
    4. Admin can manually retry:
       - Button: "Retry Processing"
       - Queues new QStash job
       - Tracks retry count
  - Max 3 retry attempts
  - After 3 failures, escalate to engineering team
  - Failed exports don't count against SLA (grace period)

- **Database Schema**:

  ```
  data_export_requests table (additional fields):
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - user_type: enum (learner, instructor)
  - status: enum (pending, approved, processing, completed, failed, cancelled, expired)
  - requested_at: timestamp with timezone
  - sla_deadline: timestamp with timezone (requested_at + 30 days)
  - approved_at: timestamp with timezone (nullable)
  - approved_by_admin_id: UUID (nullable)
  - processing_started_at: timestamp with timezone (nullable)
  - completed_at: timestamp with timezone (nullable)
  - format: enum (json, csv, both)
  - file_size_bytes: bigint (nullable)
  - r2_url: string (nullable)
  - r2_key: string (nullable)
  - url_expires_at: timestamp with timezone (nullable)
  - download_count: integer (default 0)
  - first_downloaded_at: timestamp with timezone (nullable)
  - last_downloaded_at: timestamp with timezone (nullable)
  - error_message: text (nullable)
  - error_count: integer (default 0, retry tracking)
  - qstash_message_id: string (nullable)
  - request_source: enum (web, mobile, support_request)
  - requested_email: string
  - requested_by_admin_id: UUID (nullable, if admin requested on behalf)

  export_audit_log table:
  - id: UUID (primary key)
  - export_id: UUID (foreign key)
  - action: enum (
      requested,
      approved,
      processing_started,
      processing_completed,
      processing_failed,
      email_sent,
      download,
      retry_scheduled,
      cancelled,
      expired
    )
  - admin_id: UUID (nullable, admin who took action)
  - timestamp: timestamp with timezone
  - details: jsonb
  - ip_address: string (nullable)
  ```

- **Compliance Reporting**:
  - Admin can export SLA tracking report (CSV/PDF)
  - Report includes:
    - Request date, completion date, processing time
    - User ID (not email, for privacy)
    - Format, file size
    - Status (completed, failed)
    - Days to complete vs. SLA
  - Schedule weekly report generation (every Monday)
  - Archive reports for 3+ years (compliance)
  - Compliance officer reviews reports monthly

- **Batch Processing**:
  - Admin can select multiple export requests
  - "Approve Selected" button approves all at once
  - "Process Selected" queues batch job
  - Batch job processing one request at a time (sequential, not parallel)
  - User notifications staggered to avoid email flooding
  - Progress tracking for batch operations

- **Rate Limiting & Quotas**:
  - Max 10 processing jobs running simultaneously (to prevent resource exhaustion)
  - Queue positions visible in dashboard
  - Admin can prioritize high-priority requests
  - Long-running exports (> 2 hours) flagged for investigation

- **Notifications to Admin**:
  - Alert on request approaching SLA deadline (7 days remaining)
  - Alert on overdue request (past SLA deadline)
  - Alert on processing failure (retries available)
  - Daily digest: number of pending requests, SLA status

## Acceptance Criteria

- [ ] Export request dashboard lists pending requests
- [ ] Sorted by requested_at (oldest first)
- [ ] SLA status color-coded (green/yellow/red)
- [ ] Days remaining calculated and displayed
- [ ] Details view shows full request context
- [ ] Approval workflow functional
- [ ] Admin can approve individual requests
- [ ] Admin can bulk approve requests
- [ ] Processing triggered by admin click or automatic
- [ ] QStash job queued with export_id
- [ ] Status updated to "processing"
- [ ] Progress tracking available
- [ ] Completion email sent to user
- [ ] Admin sees completion notification
- [ ] Package download link valid (R2 signed URL)
- [ ] SLA deadline = requested_at + 30 days
- [ ] SLA tracking dashboard shows compliance %
- [ ] Alerts for approaching/overdue requests
- [ ] Error handling with retry mechanism
- [ ] Max 3 retry attempts enforced
- [ ] Failed exports escalate after max retries
- [ ] Audit log tracks all actions
- [ ] Batch processing of multiple requests
- [ ] Queue position visible for pending jobs
- [ ] Weekly compliance report generated
- [ ] Export reports archived (3+ years)
- [ ] Rate limiting prevents resource exhaustion
- [ ] Admin notifications sent correctly
- [ ] Data accuracy verified (spot-check)
- [ ] Performance acceptable (100+ pending requests)

## Dependencies

- **Data Export - Learner** - shared data aggregation logic
- **Data Export - Instructor** - shared data aggregation logic
- **Background Jobs (QStash)** - processing execution
- **Email Service** - notifications
- **Cloudflare R2** - package storage
- **Admin Dashboard** - UI

## Technical Notes

- SLA deadline should be immutable (set at request creation)
- Use database views for SLA metrics (performance optimization)
- QStash processing can be high-priority queue
- Batch processing should be sequential (avoid resource contention)
- Consider caching SLA dashboard (5-min TTL)
- Implement webhook for job status updates
- Admin can download completed packages for verification (don't upload to user yet)
- Archive completed exports from R2 after 7 days (move to cold storage)
- Monitor processing queue depth (SLA: process within 30 days)
- Alert if average processing time exceeds 1 week
- Track failed export reasons (data issues, system errors)
- Implement duplicate request detection (prevent resubmission)
- Compliance report should be generated automatically (no manual step)
- Consider pagination for large export lists (100+ items)
- Test with various data volumes (small to large accounts)
- Ensure data accuracy (spot-check exported data)
- Monitor R2 storage costs (consider archival strategy)
- Implement export data retention policy (7-day download window, then delete)
- Consider admin preview of generated package (verification step)
- Track export metrics: processing time, failure rate
- Implement alerts for unusual patterns (high failure rate)
- Archive export requests after 3 years
