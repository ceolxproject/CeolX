# IP Anonymization Cron Job

## Description

Implement a daily QStash cron job that automatically anonymizes IP addresses from consent records after 90 days of retention. This process finds all logged IP addresses older than 90 days and sets the last octet to 0 (e.g., 203.0.113.123 → 203.0.113.0), effectively anonymizing the address while preserving approximate geographic location.

This feature ensures GDPR compliance with IP data retention policies and demonstrates privacy-by-design principles.

## Affected Apps/Packages

- **Background Jobs (QStash)** - cron job execution
- **Database** - IP anonymization updates
- **Compliance Logging** - audit trail of anonymization actions
- **Email Service** - optional compliance reports

## API Endpoints

- `POST /api/cron/anonymize-ips` - Cron job handler (internal)
- `GET /api/admin/ip-anonymization-status` - View anonymization status (admin only)
- `GET /api/admin/ip-anonymization-history` - Audit trail of anonymizations

## Requirements

- **Cron Job Setup** (QStash):
  - Scheduled: Daily at 2:00 AM UTC (off-peak)
  - Handler: `/api/cron/anonymize-ips`
  - Timeout: 30 minutes (increase if needed for large tables)
  - Retry: Max 3 retries on failure (exponential backoff)
  - Idempotent: Safe to run multiple times on same day

- **Data Candidates for Anonymization**:
  - consent_preferences table: ip_address field
  - consent_log table: ip_address field
  - deletion_requests table: deletion_audit_log entries with ip_address
  - content_reports table: submitted_ip_address field
  - user_blocks table: no IP field (N/A)
  - admin_action_logs table: ip_address field (SENSITIVE - don't anonymize, longer retention)
  - device_tokens table: no IP field (N/A)
  - account_suspensions table: no IP field (typically N/A)

- **Anonymization Logic**:
  - Find all IP addresses older than 90 days from creation
  - Calculation: created_at < NOW() - INTERVAL '90 days'
  - Anonymization: Replace last octet with 0
    - IPv4: 203.0.113.123 → 203.0.113.0
    - IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334 → 2001:0db8:85a3:0000:0000:8a2e:0370:0000
  - Set field value to anonymized version
  - Mark as anonymized (optional: add is_ip_anonymized flag)

- **Processing Pipeline**:

  ```javascript
  async function anonymizeOldIPs() {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const startTime = Date.now();

    try {
      // 1. consent_preferences table
      const consentRows = await db.consent_preferences
        .find({
          created_at: { $lt: cutoffDate },
          ip_address: { $ne: null },
          ip_anonymized: { $ne: true }, // Only if not yet anonymized
        })
        .select("id ip_address");

      const consentAnonymized = await batchAnonymizeIPs(
        "consent_preferences",
        consentRows,
        cutoffDate,
      );

      // 2. consent_log table
      const logRows = await db.consent_log
        .find({
          timestamp: { $lt: cutoffDate },
          ip_address: { $ne: null },
          ip_anonymized: { $ne: true },
        })
        .select("id ip_address");

      const logAnonymized = await batchAnonymizeIPs(
        "consent_log",
        logRows,
        cutoffDate,
      );

      // 3. content_reports table
      const reportRows = await db.content_reports
        .find({
          created_at: { $lt: cutoffDate },
          submitted_ip_address: { $ne: null },
          ip_anonymized: { $ne: true },
        })
        .select("id submitted_ip_address");

      const reportAnonymized = await batchAnonymizeIPsWithField(
        "content_reports",
        reportRows,
        cutoffDate,
        "submitted_ip_address",
      );

      // 4. deletion_audit_log (via deletion_requests)
      // Note: Not directly anonymizing deletion audit logs (longer retention)
      // But could do if policy permits

      // 5. Create audit log entry
      const totalAnonymized =
        consentAnonymized + logAnonymized + reportAnonymized;
      await db.ip_anonymization_audit_log.insert({
        id: generateUUID(),
        job_run_at: startTime,
        cutoff_date: cutoffDate,
        tables_processed: [
          "consent_preferences",
          "consent_log",
          "content_reports",
        ],
        total_ips_anonymized: totalAnonymized,
        breakdown: {
          consent_preferences: consentAnonymized,
          consent_log: logAnonymized,
          content_reports: reportAnonymized,
        },
        processing_time_seconds: (Date.now() - startTime) / 1000,
        status: "completed",
        error_message: null,
        qstash_execution_id: process.env.QSTASH_MESSAGE_ID,
      });

      // 6. Send completion notification (optional)
      await sendComplianceNotification(
        "IP Anonymization Complete",
        `Anonymized ${totalAnonymized} IP addresses from records older than 90 days.`,
      );

      return {
        success: true,
        totalAnonymized,
        processingTimeSeconds: (Date.now() - startTime) / 1000,
      };
    } catch (error) {
      // 7. Error handling
      await logIPAnonymizationError(error, cutoffDate);
      throw error; // QStash will retry
    }
  }

  function anonymizeIPAddress(ip) {
    if (!ip) return null;

    if (ip.includes(":")) {
      // IPv6: set last group to 0000
      const parts = ip.split(":");
      parts[parts.length - 1] = "0000";
      return parts.join(":");
    } else {
      // IPv4: set last octet to 0
      const parts = ip.split(".");
      parts[3] = "0";
      return parts.join(".");
    }
  }

  async function batchAnonymizeIPs(table, rows, cutoffDate) {
    let count = 0;
    const batchSize = 1000; // Process in batches to avoid memory issues

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const updates = batch.map((row) => ({
        id: row.id,
        ip_address: anonymizeIPAddress(row.ip_address),
      }));

      await db[table].bulkWrite(
        updates.map((update) => ({
          updateOne: {
            filter: { id: update.id },
            update: {
              $set: {
                ip_address: update.ip_address,
                ip_anonymized: true,
              },
            },
          },
        })),
      );

      count += batch.length;
    }

    return count;
  }
  ```

- **Database Schema** (additions):

  ```
  ip_anonymization_audit_log table:
  - id: UUID (primary key)
  - job_run_at: timestamp with timezone
  - cutoff_date: timestamp with timezone
  - tables_processed: string[] (array of table names)
  - total_ips_anonymized: integer
  - breakdown: jsonb
    {
      consent_preferences: integer,
      consent_log: integer,
      content_reports: integer
    }
  - processing_time_seconds: decimal
  - status: enum (completed, failed, partial)
  - error_message: text (nullable)
  - qstash_execution_id: string (for tracing)
  - created_at: timestamp with timezone (auto-set)

  Tables modified (add field):
  - consent_preferences: ip_anonymized boolean (default false)
  - consent_log: ip_anonymized boolean (default false)
  - content_reports: ip_anonymized boolean (default false)
  ```

- **Performance Considerations**:
  - Use database indexes: (created_at, ip_anonymized) for each table
  - Batch updates (1000 at a time) to avoid locks
  - Consider table partitioning by date if very large
  - Parallel processing across tables (not within same table)
  - Expected duration: < 5 minutes for typical dataset

- **Idempotency**:
  - Track ip_anonymized flag: only process if not yet anonymized
  - Safe to run multiple times on same day (no-op if already done)
  - Safe to re-run if cron job fails

- **Retention Policies by Table**:
  - consent_preferences: Anonymize after 90 days, retain 3+ years
  - consent_log: Anonymize after 90 days, retain 3+ years (immutable, audit trail)
  - content_reports: Anonymize after 90 days, retain 2+ years
  - deletion_audit_log: Do NOT anonymize (sensitive compliance record, longer retention)
  - admin_action_logs: Do NOT anonymize (sensitive compliance record, 2-year retention)

- **Admin Dashboard** (`/api/admin/ip-anonymization-status`):
  - Shows:
    - Last anonymization run (date, time, duration)
    - Total IPs anonymized (lifetime)
    - Total IPs awaiting anonymization (next 90 days)
    - Breakdown by table
    - Next scheduled run (time)
    - Failed runs (if any) with error details
  - Actions:
    - "Run Now" button (manually trigger cron)
    - "View History" link to audit log

- **Audit Trail** (`/api/admin/ip-anonymization-history`):
  - List of all anonymization runs
  - Sortable by date, table, count
  - Shows:
    - Run date and time
    - Total IPs anonymized
    - Breakdown by table
    - Processing time
    - Status (success/failure)
    - Error message (if failed)
  - Exportable as CSV for compliance reports

- **Monitoring & Alerts**:
  - Alert if cron job fails 3 times in a row (escalate)
  - Alert if processing time exceeds 10 minutes (performance degradation)
  - Alert if fewer IPs anonymized than expected (data issues)
  - Metrics dashboard:
    - IPs anonymized per day (trend)
    - Success rate (% of runs completed)
    - Average processing time (trend)

- **Compliance & Documentation**:
  - Log entries immutable (proof of compliance)
  - Include QSTASH_MESSAGE_ID for tracing
  - Document IP anonymization policy in privacy policy
  - Include in GDPR compliance reports
  - Demonstrate compliance in data protection impact assessment (DPIA)

- **Error Handling**:
  - If database error: log and retry (QStash handles)
  - If partial failure: log partial completion and retry
  - After 3 retries: escalate to engineering team
  - Continue processing other tables if one fails
  - Report any errors in compliance notification

- **Testing**:
  - Test with sample data (ensure IP anonymization correct)
  - Test idempotency (run twice, results should be same)
  - Test with various IP formats (IPv4 with different octets, IPv6)
  - Test with NULL IPs (should skip)
  - Test with already-anonymized IPs (should be no-op)
  - Performance test with 1M+ records

## Acceptance Criteria

- [ ] QStash cron job scheduled for daily execution
- [ ] Scheduled time: 2:00 AM UTC
- [ ] Handler: `/api/cron/anonymize-ips`
- [ ] Finds IPs older than 90 days
- [ ] IPv4 last octet set to 0
- [ ] IPv6 last group set to 0000
- [ ] consent_preferences IPs anonymized
- [ ] consent_log IPs anonymized
- [ ] content_reports IPs anonymized
- [ ] Batch processing implemented (1000 at a time)
- [ ] Processing time acceptable (< 10 minutes)
- [ ] ip_anonymized flag set correctly
- [ ] Idempotent (safe to run multiple times)
- [ ] Audit log entry created
- [ ] QSTASH_MESSAGE_ID recorded
- [ ] Total count tracked
- [ ] Breakdown by table included
- [ ] Error handling with retries
- [ ] Failed runs logged with error message
- [ ] Admin dashboard shows status
- [ ] History viewable in audit log
- [ ] Manual trigger available ("Run Now")
- [ ] Alerts for failed runs (3+ failures)
- [ ] Performance monitored
- [ ] Compliance documentation included
- [ ] NULL IPs handled gracefully
- [ ] Already-anonymized IPs skipped
- [ ] IP format validation working
- [ ] Database indexes created for performance
- [ ] Test suite covers edge cases

## Dependencies

- **Background Jobs (QStash)** - cron execution
- **Consent Logging System** - main data source
- **Report Content Feature** - report IPs
- **IP Anonymization Tracking** - ip_anonymized flag
- **Compliance Reporting** - audit trail

## Technical Notes

- Use QSTASH API for cron scheduling
- Cron job should be idempotent (run safely multiple times)
- Index strategy: (created_at, ip_anonymized) for fast queries
- Consider table partitioning if very large (millions of records)
- Batch size of 1000 is conservative (can increase if needed)
- IPv6 anonymization: last 64 bits set to 0 (more aggressive than IPv4)
- Don't anonymize admin_action_logs (separate policy)
- Cleanup: archive old audit logs after 2 years
- Monitor: set alert if < 100 IPs anonymized (unusual)
- Monitor: set alert if > 1M IPs anonymized (unusual volume)
- Consider separate cron for different tables (parallelization)
- Use database transactions for atomicity (per batch)
- Implement timeout (30 minutes) to prevent runaway jobs
- Log start/end time for performance analysis
- Consider notification to compliance officer with summary
- Archive cron execution logs (for audit)
- Test with production-like data volumes
- Implement health check: verify anonymized IPs actually anonymized
- Consider data retention policy review: adjust 90-day threshold if needed
- Document in privacy policy: when IPs are anonymized
- GDPR: demonstrate proportionate data retention (90 days + anonymization)
