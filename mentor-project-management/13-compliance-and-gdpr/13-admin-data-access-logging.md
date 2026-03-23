# Admin Data Access Logging

## Description

Implement comprehensive audit logging of all admin access to user data, with immutable records of every view, edit, export, and login-as action. Every access requires documented justification, and the system maintains a 2-year retention policy for compliance. Weekly compliance reports are auto-generated to track admin activity and identify potential misuse.

This feature ensures accountability and meets GDPR data controller responsibilities.

## Affected Apps/Packages

- **Admin Dashboard** - primary interface for admin actions
- **API Server** - logging middleware
- **Database** - admin_action_logs table (immutable)
- **Background Jobs (QStash)** - weekly compliance report generation
- **Email Service** - compliance report distribution

## API Endpoints

- `POST /api/admin/logs/action` - Log admin action (internal)
- `GET /api/admin/logs` - List admin actions (audit trail view)
- `GET /api/admin/logs/by-admin/:admin_id` - View actions by specific admin
- `GET /api/admin/logs/by-user/:user_id` - View actions targeting specific user
- `GET /api/admin/compliance-report` - Weekly compliance report
- `GET /api/admin/logs/search` - Search audit logs

## Requirements

- **Admin Action Logging**:
  - Every access to user data creates immutable log entry
  - Actions include: view, edit, export, delete, suspend, delete_account, login_as_mentor
  - Immutable table (no UPDATE/DELETE operations)
  - Entries cannot be modified after creation

- **admin_action_logs Table Schema**:

  ```
  id: UUID (primary key)
  admin_id: UUID (foreign key to users table, admin performing action)
  target_user_id: UUID (nullable, user whose data was accessed)
  action: enum (
    view_profile,
    view_enrollment,
    view_payments,
    view_consent,
    view_email,
    view_personal_data,
    edit_user_data,
    edit_course,
    delete_user_account,
    suspend_account,
    unsuspend_account,
    export_user_data,
    login_as_user,
    view_reports,
    update_report_status,
    bulk_export,
    view_financial_records,
    modify_account_status,
    other
  )
  timestamp: timestamp with timezone (auto-set, immutable)
  ip_address: string
  user_agent: string
  fields_accessed: string[] (which specific fields: email, name, phone, address, etc.)
  action_details: jsonb (contextual information):
    {
      // For view actions:
      view_context: string, // e.g., "customer_support", "fraud_investigation"

      // For edit/delete actions:
      changes: object, // { field: { old_value, new_value } }
      reason: string,

      // For login_as_user:
      duration_minutes: integer,
      reason: string,
      ip_accessed_from: string,

      // For exports:
      file_size_bytes: integer,
      file_name: string,
      exported_fields: string[],

      // For suspension:
      suspension_reason: enum,
      suspension_duration: string
    }
  status: enum (success, failed, cancelled)
  error_message: text (nullable, if status = failed)
  justification_required: boolean
  justification_provided: text (nullable)
  reviewed_by_manager_id: UUID (nullable, manager who reviewed this action)
  ```

- **Logging Middleware**:
  - Intercepts all admin API calls
  - Extracts admin_id, action, target_user_id, fields_accessed
  - Logs IP address and user agent
  - Timestamp set server-side (not client)
  - Action logged synchronously (blocking) or queued to database write queue
  - Logging failures don't break admin workflow (async queue with retry)

- **Field Access Tracking**:
  - When admin views user profile, log specific fields accessed:
    ```javascript
    fields_accessed: ["name", "email", "phone", "address", "profile_photo_url"];
    ```
  - Granular tracking enables detection of unusual access patterns
  - Example: admin views only user email 50 times = suspicious

- **Justification Requirement**:
  - High-risk actions require documented reason:
    - Viewing user's email address
    - Viewing payment information
    - Deleting user account
    - Logging in as user
    - Exporting data
    - Suspending account
  - Popup form before action completes:
    ```
    "Why are you accessing this data?"
    [Customer Support / Fraud Investigation / Compliance Check / Other]
    [Description text field, required]
    [OK / Cancel]
    ```
  - Justification stored with log entry
  - Cannot proceed with action without justification

- **Login-as-User (Mentor Access)**:
  - Admin can log in as another user for support/testing
  - Requires password or 2FA from admin account
  - Requires justification: customer support issue, debugging, etc.
  - Timestamps login and logout
  - Track which features were accessed while logged in
  - Time limited (max 30 minutes per login-as session)
  - User is NOT notified (privacy for support)
  - Separate audit trail for login-as actions (very sensitive)
  - Activity while logged in is visible to admin, not attributed to user

- **login_as_user_trail Table**:

  ```
  id: UUID
  admin_id: UUID
  target_user_id: UUID
  logged_in_at: timestamp with timezone
  logged_out_at: timestamp with timezone (nullable)
  duration_minutes: integer (calculated)
  justification: text (required)
  ip_address: string
  actions_while_logged_in: string[] (e.g., ["view_course", "update_profile"])
  status: enum (active, completed, timed_out, cancelled_by_admin)
  ```

- **Audit Trail Retrieval** (`/api/admin/logs`):
  - Available to compliance officer and super admin only
  - Can filter by:
    - Admin ID (who took action)
    - Target user ID (whose data)
    - Action type
    - Date range
    - Status (success/failed)
  - Results paginated (100 per page)
  - Can be exported as CSV for reporting
  - Example response:
    ```json
    {
      "entries": [
        {
          "id": "log_xyz",
          "admin_id": "admin_123",
          "admin_email": "support@example.com",
          "target_user_id": "user_456",
          "target_user_email": "user@example.com",
          "action": "view_profile",
          "timestamp": "2025-02-18T10:15:00Z",
          "fields_accessed": ["name", "email", "phone"],
          "justification": "Customer service inquiry",
          "status": "success",
          "ip_address": "203.0.113.0"
        }
      ],
      "total": 1245,
      "page": 1,
      "per_page": 100
    }
    ```

- **Weekly Compliance Report** (QStash job, Mondays 8am UTC):
  - Auto-generated report sent to compliance officer
  - Includes:
    1. **Summary**:
       - Total actions this week
       - By action type (breakdown)
       - By admin (top users accessing data)
       - Success vs. failure rate
    2. **Anomalies**:
       - Admins accessing unusual amounts of data
       - Unusual access patterns (e.g., viewing same user 100+ times)
       - Access from unusual IPs
       - Failed login-as attempts
       - Actions without justification
    3. **High-Risk Actions**:
       - All account deletions
       - All account suspensions
       - All login-as sessions
       - All bulk exports
    4. **Permission Changes**:
       - New admin accounts created
       - Admin permission level changes
       - Admin accounts deactivated
    5. **Retention**:
       - Total log entries retained
       - Entries scheduled for deletion (2-year retention)

- **Metrics & Dashboard** (`/api/admin/compliance-report`):
  - Real-time dashboard showing:
    - Number of admin actions (daily trend)
    - Actions by admin (leaderboard style)
    - Most accessed user IDs (identify patterns)
    - Action breakdown (pie chart)
    - Unusual access patterns (flagged)
    - Failed actions (for troubleshooting)
  - Can filter by date range and specific admins
  - Exportable as PDF for compliance archive

- **Immutability Enforcement**:
  - Database constraints prevent UPDATE/DELETE on admin_action_logs
  - Application code only allows INSERT
  - Admin panel has no delete functionality for logs
  - Changes require direct database access (audit trail of that change)
  - Log deletion requires DBA approval and documented justification

- **Data Retention**:
  - All logs retained for 2 years minimum (GDPR requirement)
  - Logs older than 2 years can be archived (not deleted)
  - Archive maintained for 5+ years (litigation hold)
  - Deletion only on explicit legal request
  - Retention policy documented in privacy policy

- **Sensitive Data Handling**:
  - Action log does NOT store actual user data (email, phone, etc.)
  - Only metadata about access (which fields, when, who)
  - User identifiers (ID, email) stored for traceability
  - Large data exports not logged (too large), instead log that export occurred

- **Admin Permission Model**:
  - Separate role: "Compliance Officer" (read audit logs only)
  - Separate role: "Data Access Manager" (approve high-risk access)
  - Super admin has full access to logs
  - Regular support staff cannot view their own access logs
  - Logging works for all admin roles

- **Alerting & Escalation**:
  - Automated alerts for:
    - Same user accessed by 3+ different admins in 1 hour
    - Single admin accessing 50+ users in 1 day
    - Login-as session exceeds 1 hour
    - Access from IP outside approved ranges
    - High-risk action without justification
  - Alerts sent to compliance officer
  - Escalation to manager if pattern continues

## Acceptance Criteria

- [ ] admin_action_logs table created with immutable structure
- [ ] Every admin action logged (view, edit, export, delete, suspend, login_as)
- [ ] Logs include: admin_id, target_user_id, action, timestamp, ip_address, fields_accessed
- [ ] Timestamps set server-side (UTC)
- [ ] Justification required for high-risk actions
- [ ] Justification stored with log entry
- [ ] Login-as-user requires password/2FA from admin
- [ ] Login-as-user limited to 30 minutes
- [ ] login_as_user_trail table tracks all sessions
- [ ] Audit trail accessible to compliance officer
- [ ] Audit trail filterable by admin, user, action, date
- [ ] Audit trail exportable as CSV
- [ ] Weekly compliance report auto-generated (Mondays 8am UTC)
- [ ] Compliance report includes summary, anomalies, high-risk actions
- [ ] Dashboard shows real-time admin activity metrics
- [ ] Immutability enforced at database level
- [ ] Application prevents UPDATE/DELETE on logs
- [ ] Data retention policy enforced (2 years minimum)
- [ ] Sensitive user data not stored in logs (only field names)
- [ ] Alerts generated for unusual access patterns
- [ ] Alert notifications sent to compliance officer
- [ ] Separate compliance officer role functional
- [ ] Regular admins cannot view other admins' access logs
- [ ] IP addresses included in all logs
- [ ] Failed actions logged with error messages
- [ ] Action details (changes) captured for edit actions
- [ ] Field access granular (specific fields, not just "user_data")
- [ ] Login-as activity attributed correctly (not to target user)
- [ ] Performance acceptable (logging doesn't slow down admin UI)

## Dependencies

- **Authentication System** - admin user context
- **Admin Dashboard** - action trigger point
- **Background Jobs (QStash)** - weekly report generation
- **Email Service** - compliance report distribution
- **IP Anonymization Cron** - separate (logs retain IPs for 2 years)

## Technical Notes

- Use database triggers to prevent UPDATE/DELETE on logs (PostgreSQL)
- Logging should be asynchronous to avoid blocking admin actions
- Implement circuit breaker for logging failures (don't break admin UI)
- Create database indexes on: admin_id, target_user_id, action, timestamp
- Consider partitioning admin_action_logs table by date (for performance)
- Log write failures to separate error queue for alerting
- Justification validation: min 10 characters, max 500 characters
- IP address extraction use X-Forwarded-For header (behind proxy)
- User agent extraction: use request headers
- Timestamp precision: millisecond accuracy for ordering
- Archive old logs quarterly (after 2 years)
- Implement log export function for GDPR requests
- Test with high volume (1000s of admin actions per day)
- Monitor log table growth (expect ~100-200 entries per active admin per month)
- Consider separate logging service (e.g., Datadog, LogRocket)
- Implement compliance report scheduling (QStash CRON)
- Test anomaly detection thresholds (tune to reduce false positives)
- Dashboard should update real-time (WebSocket or polling)
- Access to logs requires additional authentication (separate session)
- Consider encryption for justification field (sensitive)
- Document admin logging in security policy
- Test with various admin actions (exhaustive test cases)
- Ensure email of compliance report includes executive summary
- Consider Slack integration for alerts
- Archive compliance reports as PDFs (compliance record)
- Monitor for log tampering attempts (alerting)
