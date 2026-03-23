# Consent Logging System

## Description

Implement an immutable, append-only consent logging system that records every consent action taken by users. This is the authoritative audit trail for GDPR compliance, tracking all consent grants, revocations, and re-consents. Every entry is immutable and includes full context: user, action, policy version, timestamp, IP address, and device metadata.

The system serves as proof of consent for regulatory audits and enables re-consent workflows when policies change.

## Affected Apps/Packages

- **API Server** - middleware for consent checks and logging
- **Database** - append-only consent_log and consent_preferences tables
- **Background Jobs** - QStash for policy version change detection
- **Compliance Dashboard** - admin view of consent records

## API Endpoints

- `POST /api/consent/log` - Internal endpoint to log consent action
- `GET /api/consent/audit-trail/:user_id` - Get user's full consent history
- `GET /api/consent/policy-versions` - List all policy versions with dates
- `POST /api/consent/check-policy-change` - QStash job to detect policy changes
- `GET /api/admin/consent-reports` - Admin reporting on consent compliance

## Requirements

- **Consent Log Structure**:
  - **Append-only table** (no UPDATE or DELETE operations)
  - Every change creates new log entry
  - Previous entries never modified
  - Timestamp immutable (set at insert, not updatable)

- **consent_log Table Schema**:

  ```
  id: UUID (primary key)
  consent_id: string (unique identifier for this consent action, UUID or similar)
  user_id: UUID (nullable for anonymous users)
  consent_type: enum (
    cookie_consent,
    marketing_consent,
    analytics_consent,
    email_marketing_consent,
    data_processing_consent
  )
  action: enum (
    grant,           # User explicitly granted
    revoke,          # User explicitly revoked
    re_grant,        # User granted again after revocation
    policy_update,   # System auto-triggered by policy version change
    admin_override,  # Admin changed consent for user
    admin_revoke     # Admin revoked for compliance
  )
  policy_version: string (e.g., "2025-02-18", for reference)
  timestamp: timestamp with timezone (auto-set, immutable)
  ip_address: string (anonymized after 90 days)
  user_agent: string
  device_metadata: jsonb (contains):
    {
      browser_name: string,
      browser_version: string,
      os_name: string,
      os_version: string,
      device_type: enum (mobile, tablet, desktop, unknown),
      screen_width: integer,
      screen_height: integer,
      language: string,
      timezone: string
    }
  source: enum (web, ios_app, android_app, api)
  additional_context: jsonb (optional, action-specific data):
    {
      // For policy_update action:
      old_policy_version: string,
      new_policy_version: string,
      changed_sections: string[],

      // For admin actions:
      admin_id: UUID,
      admin_email: string,
      reason: string,

      // For grant/revoke:
      categories_affected: string[]
    }
  ```

- **consent_preferences Table** (authoritative current state):

  ```
  id: UUID (primary key)
  user_id: UUID (nullable for anonymous)
  cookie_id: string (for anonymous users, nullable)
  necessary: boolean (always true, read-only)
  analytics: boolean
  marketing: boolean
  email_marketing: boolean
  data_processing: boolean
  current_policy_version: string
  last_updated_at: timestamp with timezone
  last_consent_log_id: UUID (foreign key to consent_log)
  consent_timestamp: timestamp with timezone (first consent)
  updated_at: timestamp with timezone
  ip_address: string
  user_agent: string
  source: enum (web, ios_app, android_app)
  ```

- **Consent Checking Middleware**:
  - Middleware function that runs on all authenticated routes
  - Checks user's current consent_preferences
  - Populates req.consent object with current state
  - No blocking (consent violations are logged but not preventing access)
  - Logs every consent check for audit trail (optional, can be high volume)
  - Example middleware:

    ```javascript
    async function consentCheckMiddleware(req, res, next) {
      const userId = req.user?.id;
      const cookieId = req.cookies.__mentor_consent_anon;

      // Fetch or refresh consent state
      const consent = userId
        ? await db.consent_preferences.findOne({ user_id: userId })
        : await db.consent_preferences.findOne({ cookie_id: cookieId });

      if (!consent) {
        // First visit or anonymous user with no consent yet
        req.consent = {
          necessary: true,
          analytics: false,
          marketing: false,
          email_marketing: false,
          data_processing: false,
          policyVersion: CURRENT_POLICY_VERSION,
          isConsented: false,
        };
      } else {
        req.consent = {
          necessary: consent.necessary,
          analytics: consent.analytics,
          marketing: consent.marketing,
          email_marketing: consent.email_marketing,
          data_processing: consent.data_processing,
          policyVersion: consent.current_policy_version,
          isConsented: true,
          lastUpdatedAt: consent.last_updated_at,
        };

        // Check if re-consent needed
        if (consent.current_policy_version !== CURRENT_POLICY_VERSION) {
          req.consent.requiresReConsent = true;
          req.consent.newPolicyVersion = CURRENT_POLICY_VERSION;
        }
      }

      next();
    }
    ```

- **Logging Consent Actions**:
  - Every time user grants/revokes consent, create log entry
  - Include all context: IP, device metadata, policy version
  - IP anonymization happens in separate cron job (90 days after)
  - Log creation is synchronous (in-request) or queued to QStash
  - Retry logic if log creation fails (circuit breaker pattern)

- **Policy Version Change Detection**:
  - Stored in a `policy_versions` table or config file
  - QStash cron job checks daily for version changes
  - When new version detected:
    - Update CURRENT_POLICY_VERSION constant
    - Create log entries for all users with "policy_update" action
    - Mark all existing consent_preferences as requiring re-consent
    - Trigger re-consent flow (show banner on next page load)
    - Send notifications to users about policy change

- **policy_versions Table**:

  ```
  id: UUID
  version: string (e.g., "2025-02-18")
  effective_date: timestamp with timezone
  description: text (what changed)
  created_at: timestamp with timezone (auto-set)
  is_current: boolean

  // One entry per policy version, ever
  // is_current set to true only for latest
  ```

- **Re-Consent Workflow**:
  1. Policy version changes → all users marked as needs_reconsent=true
  2. On next app visit, re-consent banner shown (not dismissible)
  3. User must grant/revoke consent again
  4. New log entry created with action="re_grant" or similar
  5. consent_preferences updated with new policy_version
  6. needs_reconsent flag cleared

- **Audit Trail Retrieval** (`/api/consent/audit-trail/:user_id`):
  - Returns all log entries for user, ordered by timestamp DESC
  - Includes policy context from policy_versions table
  - Example response:
    ```json
    {
      "user_id": "user_123",
      "entries": [
        {
          "consent_id": "con_xyz789",
          "action": "grant",
          "timestamp": "2025-02-18T10:30:00Z",
          "policy_version": "2025-02-18",
          "categories": ["necessary", "analytics"],
          "ip_address": "203.0.113.xxx",
          "device": "Safari on macOS",
          "source": "web"
        },
        {
          "consent_id": "con_xyz456",
          "action": "revoke",
          "timestamp": "2025-02-15T14:20:00Z",
          "categories": ["marketing"],
          "ip_address": "203.0.113.xxx",
          "device": "Chrome on Windows",
          "source": "web"
        }
      ]
    }
    ```

- **Admin Consent Reporting** (`/api/admin/consent-reports`):
  - Dashboard showing:
    - Overall consent opt-in rates by category
    - Opt-in rate over time (daily/weekly)
    - Policy version change impact (before/after comparison)
    - List of users who haven't consented
    - Users with no consent records (new users)
    - Geographic distribution of consents (by anonymized IP)
  - Can filter by:
    - Date range
    - Policy version
    - User type (learner, instructor)
    - Device type
    - Consent category
  - Exportable as CSV for compliance reports

- **Immutability Enforcement**:
  - Database constraints prevent UPDATE/DELETE on consent_log
  - Application code only INSERT operations
  - Admin panel cannot modify consent logs (read-only)
  - Changes require system admin access to database directly (audit trail)
  - Log deletion requires explicit DBA action with audit

- **Data Retention**:
  - Consent logs retained for minimum 3 years (GDPR requirement)
  - Policy versions retained indefinitely (for historical context)
  - IPs anonymized after 90 days (separate cron job)
  - Archived consent logs for deleted users retained with user_id nullified

## Acceptance Criteria

- [ ] consent_log table created with immutable structure (no UPDATE/DELETE)
- [ ] consent_preferences table created with current state
- [ ] policy_versions table created and populated
- [ ] Every consent grant/revoke creates log entry immediately
- [ ] Log entries include: consent_id, user_id, action, policy_version, timestamp, IP, device_metadata
- [ ] IP address stored initially, anonymized after 90 days
- [ ] Device metadata extracted correctly (browser, OS, device type, screen size)
- [ ] Consent check middleware implemented and runs on all routes
- [ ] req.consent object properly populated with current state
- [ ] Middleware detects policy version changes and flags re-consent needed
- [ ] Re-consent banner shown when new policy version detected
- [ ] Policy version change detected automatically (daily cron)
- [ ] All users receive "policy_update" log entries when version changes
- [ ] Audit trail API returns complete user consent history
- [ ] Audit trail includes policy context and device information
- [ ] Admin reporting dashboard shows opt-in rates and trends
- [ ] Admin can export consent reports as CSV
- [ ] Logging fails gracefully if database unavailable (circuit breaker)
- [ ] Log creation includes full context (no missing fields)
- [ ] Anonymous users get cookie_id and separate logging
- [ ] Log entries timestamped consistently (server time, UTC)
- [ ] Previous consent state preserved for historical audit
- [ ] Re-consent requirement properly cleared after new consent
- [ ] Immutability enforced at database level
- [ ] Application prevents UPDATE/DELETE operations on logs
- [ ] Admin cannot manually modify consent logs
- [ ] Consent state accessible to all parts of application
- [ ] Policy version mismatch detection working correctly

## Dependencies

- **Cookie Consent Banner** - logs all consent actions
- **IP Anonymization Cron** - anonymizes IPs after 90 days
- **Cookie Enforcement Middleware** - uses consent state from this system
- **Email Service** - notifications on policy changes
- **Background Jobs (QStash)** - policy change detection cron
- **Admin Dashboard** - for consent reporting

## Technical Notes

- Use database triggers to prevent UPDATE/DELETE on consent_log (PostgreSQL: create_immutable_trigger)
- Implement stored procedure for inserting consent logs (ensures all fields populated)
- Create database indexes on: user_id, timestamp, action, policy_version
- Consider partitioning consent_log by date for performance (large table)
- Use JSON/JSONB for device_metadata to avoid schema changes
- Implement exponential backoff for failed log writes
- Log write failures to separate error table for alerting
- Device metadata can be extracted using user-agent parsing library
- Policy version can be simple date string (YYYY-MM-DD) or semantic versioning
- Archive old consent logs to separate table annually (after 1 year)
- Create quarterly compliance reports showing log completeness
- Test immutability with attempted UPDATE/DELETE queries
- Monitor log table growth (expect ~1-2 entries per active user per month)
- Implement alerting if logs missing for extended period
- Create views for common audit queries (grouping by action, policy, etc.)
- Consider separating logs by user_type (learner/instructor) for performance
- Implement consent log export function for GDPR requests
- Test with malformed user agents and edge cases
- Store user_agent as-is (up to 500 chars) for future analysis
- Consider hashing IPs before storage (though log says before anonymization)
- Implement data lineage tracking (which system made which changes)
