# Account Deletion - Learner

## Description

Implement learner account deletion flow allowing users to request account deletion from Settings. The process includes:

1. Re-verification of identity (password or email confirmation)
2. 30-day grace period with cancellation option
3. Clear explanation of what data will be deleted vs. retained
4. Automatic anonymization after grace period expires
5. Confirmation email with secure cancellation link

This is a critical privacy feature meeting GDPR Article 17 (Right to be Forgotten) requirements.

## Affected Apps/Packages

- **Web App** (Next.js) - deletion UI in Settings
- **Mobile Apps** (iOS/Android) - account deletion in settings
- **API Server** - deletion endpoints and background job
- **Background Jobs** - QStash for grace period management and anonymization
- **Email Service** - confirmation and cancellation emails

## API Endpoints

- `POST /api/account/deletion-request` - Initiate deletion request (requires re-verification)
- `GET /api/account/deletion-status` - Check deletion request status
- `POST /api/account/deletion-cancel` - Cancel pending deletion (within grace period)
- `POST /api/account/verify-deletion` - Re-verify before initiating deletion
- `GET /api/account/data-retained` - Explain what data is retained after deletion

## Requirements

- **Deletion Request UI** (Settings > Account):
  - Clear warning about consequences
  - List of data to be deleted
  - List of data to be retained (financial records, etc.)
  - Option to download data export before deletion
  - Re-verification step (password or email confirmation)
  - Explicit confirmation checkbox ("I understand this is irreversible")
  - Submit button only enabled when confirmation checked

- **Re-Verification**:
  - Require password entry if user has password auth
  - OR send confirmation email with unique token if no password
  - Token must be single-use and expire in 24 hours
  - Log verification attempt with timestamp
  - Rate limit: max 3 attempts per hour

- **30-Day Grace Period**:
  - Email sent immediately with cancellation link
  - Cancellation link includes secure token (JWT, expires in 30 days)
  - Grace period start and end timestamps recorded
  - Cron job queued to complete deletion after grace period
  - User can still log in during grace period
  - User cannot create new courses if deletion pending
  - User cannot purchase courses during grace period
  - Clear "Deletion Pending" status in account settings

- **Data Deletion Behavior**:
  - **Deleted**: personal data (name, email, photo), progress records, learning history, community posts (content preserved but author anonymized)
  - **Anonymized**: display name → "Deleted User [8-char hash]", email → "deleted\_[hash]@anonymized.local", profile photo removed, session tokens deleted
  - **Retained**: financial records (for tax/legal), course enrollment records (anonymized), transaction history (anonymized)

- **Cancellation During Grace Period**:
  - One-click cancellation via email link
  - Alternative: manual cancellation in Settings if user logs in
  - Cancellation requires user to enter password again
  - Confirmation email sent when cancellation completed
  - Deletion scheduled job removed/cancelled
  - Account restored to normal state

- **Confirmation Emails**:
  1. **Initial Request**: Contains cancellation link (valid 30 days), explains grace period, lists data being deleted
  2. **Grace Period Reminder**: Sent at day 25, final warning before deletion
  3. **Cancellation Confirmation**: If cancelled, confirms deletion was stopped
  4. **Completion Notification** (if not cancelled): Confirms account fully deleted

- **Database Schema**:

  ```
  deletion_requests table:
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - status: enum (pending, cancelled, completed)
  - requested_at: timestamp with timezone
  - grace_period_ends_at: timestamp with timezone (requested_at + 30 days)
  - cancelled_at: timestamp with timezone (nullable)
  - completed_at: timestamp with timezone (nullable)
  - cancellation_token: string (secure, single-use)
  - cancellation_token_expires_at: timestamp with timezone
  - verification_method: enum (password, email)
  - notes: text (admin use)
  - reason: text (optional user-provided reason)

  deletion_audit_log table:
  - id: UUID
  - user_id: UUID
  - action: enum (request, cancel, complete)
  - timestamp: timestamp with timezone
  - ip_address: string
  - details: jsonb
  ```

## Acceptance Criteria

- [ ] Settings UI has "Delete Account" option under Account section
- [ ] Deletion request form shows clear warning about irreversibility
- [ ] Data to be deleted clearly itemized (name, email, photo, etc.)
- [ ] Data to be retained clearly itemized (financial records)
- [ ] Option to download data export before deletion
- [ ] Re-verification required (password or email confirmation)
- [ ] Explicit confirmation checkbox required (unchecked by default)
- [ ] Submit button disabled until checkbox is checked
- [ ] deletion_requests table created with all required fields
- [ ] 30-day grace period enforced (grace_period_ends_at = now + 30 days)
- [ ] Confirmation email sent immediately with cancellation link
- [ ] Cancellation token is secure, single-use, expires in 30 days
- [ ] Cancellation link works one-click (no re-authentication required)
- [ ] Alternative manual cancellation in Settings requires password
- [ ] Deletion scheduled job (QStash) created with correct delay
- [ ] Grace period reminder email sent at day 25
- [ ] User account status shows "Deletion Pending" in Settings
- [ ] User cannot purchase courses during grace period
- [ ] User cannot create courses during grace period (if applicable)
- [ ] User can still log in during grace period
- [ ] Cancellation removes QStash deletion job
- [ ] Deletion audit log entries created for all state changes
- [ ] After grace period, anonymization automatically triggered
- [ ] IP address recorded in deletion_audit_log
- [ ] Rate limiting on re-verification attempts (max 3/hour)
- [ ] Email links include utm_source=deletion_management for tracking

## Dependencies

- **Automated Anonymization** - triggers after grace period
- **IP Anonymization Cron** - anonymizes IPs in deletion logs
- **Email Service** - sending confirmation/cancellation/completion emails
- **Background Jobs (QStash)** - scheduling deletion and reminders
- **Data Export** - optional before deletion
- **Consent Logging** - records deletion request as data processing action

## Technical Notes

- Store deletion_requests in same database as users for consistency
- Use QStash (or similar) for grace period scheduling - don't use setTimeout
- Implement exponential backoff for email retries
- Consider soft delete initially (deleted_at field) before hard delete
- Log all deletion operations for audit trail
- Test cancellation link functionality thoroughly
- Use strong token generation (crypto.randomBytes)
- Implement webhook to notify admins of deletion requests
- Create data retention policy audit for compliance
- Consider GDPR SAR (Subject Access Request) interaction - allow export before deletion
- Implement feature flag to gradually roll out deletion feature
- Test with various user states (courses, enrollments, payments)
- Store reason for deletion (optional) for product insights
- Implement deletion analytics to track cancellation rate
- Consider notifying parent/guardian if user is minor (if applicable)
- Email template should be clear and emotionally sensitive
- Implement database constraints to prevent inconsistent states
- QStash job name should include user_id for traceability
- Consider privacy: don't log personal data in deletion_audit_log after deletion
