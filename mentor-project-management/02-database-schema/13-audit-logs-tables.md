# Task 13: Audit Logs Tables

## Description

Create comprehensive audit logging tables for tracking all platform activities and admin actions. Includes general audit logs for all user actions and specialized logging for admin data access. Both tables are append-only for compliance and security purposes, immutable after creation.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (audit log creation on all operations)
- `apps/web-admin` (audit log viewing and searching)

## Requirements

### Audit Logs Table

Create table `audit_logs` for comprehensive activity tracking:

| Column             | Type           | Constraints                | Description                                                     |
| ------------------ | -------------- | -------------------------- | --------------------------------------------------------------- |
| `id`               | `UUID`         | PK, Default: `uuid_v7()`   | Unique log entry identifier                                     |
| `actor_id`         | `UUID`         | FK → users(id), NOT NULL   | User performing action (or system)                              |
| `action_type`      | `VARCHAR(100)` | NOT NULL                   | Enum: create, read, update, delete, publish, suspend, ban, etc. |
| `target_type`      | `VARCHAR(50)`  | NOT NULL                   | Enum: user, course, post, comment, payment, subscription, etc.  |
| `target_id`        | `UUID`         | NOT NULL                   | ID of affected resource                                         |
| `target_user_id`   | `UUID`         | NULL                       | If target is user action (for filtering)                        |
| `resource_name`    | `VARCHAR(255)` | NULL                       | Human-readable name of target                                   |
| `status`           | `VARCHAR(50)`  | DEFAULT: 'success'         | Enum: success, failure, partial                                 |
| `error_message`    | `TEXT`         | NULL                       | Error details if status=failure                                 |
| `metadata`         | `JSONB`        | NULL                       | Additional context (changes, details, etc.)                     |
| `changes`          | `JSONB`        | NULL                       | Before/after snapshots for updates                              |
| `ip_address`       | `INET`         | NOT NULL                   | IP address of request origin                                    |
| `user_agent`       | `TEXT`         | NULL                       | User-Agent header                                               |
| `http_method`      | `VARCHAR(10)`  | NULL                       | HTTP method (GET, POST, PATCH, DELETE)                          |
| `http_status_code` | `INTEGER`      | NULL                       | HTTP response status                                            |
| `api_endpoint`     | `VARCHAR(255)` | NULL                       | API endpoint accessed                                           |
| `request_id`       | `VARCHAR(100)` | NULL                       | Request ID for tracing                                          |
| `duration_ms`      | `INTEGER`      | NULL                       | Request duration in milliseconds                                |
| `session_id`       | `VARCHAR(255)` | NULL                       | Session identifier                                              |
| `timestamp`        | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Log creation time (UTC)                                         |

### Constraints and Properties for Audit Logs

- No UPDATE or DELETE operations allowed (append-only)
- Use `CHECK (false)` after INSERT to prevent modifications
- Implement in application layer: never allow updates

### Indexes for Audit Logs Table

- Primary Key: `id`
- Index: `(actor_id)` - find user's actions
- Index: `(target_type, target_id)` - find actions on specific resource
- Index: `(target_user_id)` - find actions affecting specific user
- Index: `(action_type)` - filter by action
- Index: `(timestamp)` - chronological queries
- Index: `(actor_id, timestamp)` - user activity timeline
- Index: `(target_type, timestamp)` - resource activity timeline
- Composite Index: `(target_type, target_id, timestamp)` - resource history
- Index: `(status)` - find failed operations

### Changes JSON Structure

For update actions, store before and after snapshots:

```json
{
  "before": {
    "title": "Old Course Title",
    "status": "draft",
    "price": 49.99
  },
  "after": {
    "title": "New Course Title",
    "status": "published",
    "price": 79.99
  },
  "changed_fields": ["title", "status", "price"]
}
```

### Metadata JSON Structure

For additional context without creating new columns:

```json
{
  "reason": "User reported spam",
  "reported_by": "user_id",
  "previous_status": "active",
  "suspension_days": 7,
  "notification_sent": true,
  "ip_changed_from": "192.168.1.1",
  "ip_changed_to": "203.0.113.45"
}
```

### Admin Data Access Logs Table

Create table `admin_data_access_logs` for tracking sensitive data access:

| Column                     | Type           | Constraints                | Description                                                |
| -------------------------- | -------------- | -------------------------- | ---------------------------------------------------------- |
| `id`                       | `UUID`         | PK, Default: `uuid_v7()`   | Unique access log identifier                               |
| `admin_user_id`            | `UUID`         | FK → users(id), NOT NULL   | Admin accessing data                                       |
| `target_user_id`           | `UUID`         | FK → users(id), NOT NULL   | User data being accessed                                   |
| `action_type`              | `VARCHAR(100)` | NOT NULL                   | Enum: view_profile, view_payment, export_data, view_id_doc |
| `data_fields_accessed`     | `TEXT[]`       | NOT NULL                   | Array of field names accessed                              |
| `justification`            | `TEXT`         | NULL                       | Admin's reason for access (required for sensitive)         |
| `access_approved_by`       | `UUID`         | FK → users(id), NULL       | Super-admin approving access if needed                     |
| `access_approval_required` | `BOOLEAN`      | DEFAULT: FALSE             | Was approval needed                                        |
| `access_approved_at`       | `TIMESTAMP`    | NULL                       | When access was approved                                   |
| `ip_address`               | `INET`         | NOT NULL                   | IP address of admin                                        |
| `user_agent`               | `TEXT`         | NULL                       | User-Agent header                                          |
| `session_id`               | `VARCHAR(255)` | NULL                       | Session identifier                                         |
| `result`                   | `VARCHAR(50)`  | DEFAULT: 'granted'         | Enum: granted, denied, pending_approval                    |
| `denial_reason`            | `TEXT`         | NULL                       | If denied, why                                             |
| `timestamp`                | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Log creation time (UTC)                                    |

### Constraints and Properties for Admin Data Access Logs

- No UPDATE or DELETE operations allowed (append-only)
- `justification` required if accessing sensitive fields (payment, ID, email)
- Auto-flag for review if accessing payment or identity data
- Super-admin can approve/deny access retroactively

### Indexes for Admin Data Access Logs

- Primary Key: `id`
- Index: `(admin_user_id)` - find admin's accesses
- Index: `(target_user_id)` - find who accessed user's data
- Index: `(action_type)` - filter by action
- Index: `(timestamp)` - chronological queries
- Index: `(result)` - find denied/pending accesses
- Composite Index: `(target_user_id, timestamp)` - user data access timeline
- Index: `(admin_user_id, timestamp)` - admin activity timeline

### Sensitive Fields List

Fields requiring access justification:

- Payment information (stripe_payment_intent_id, amount, billing_name, billing_email)
- Identity documents (photo_id_url, id_verification_status)
- Email address (if accessing other user's email)
- Phone number
- Personal notes
- User IP addresses

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE audit_action_type AS ENUM (
  'create', 'read', 'update', 'delete', 'publish', 'unpublish',
  'archive', 'restore', 'suspend', 'ban', 'unban', 'verify', 'approve',
  'reject', 'assign_role', 'remove_role', 'login', 'logout', 'password_reset',
  'email_verification', 'payment_processed', 'refund_issued', 'export', 'import'
);
CREATE TYPE audit_target_type AS ENUM (
  'user', 'course', 'lesson', 'module', 'post', 'comment', 'enrollment',
  'subscription', 'payment', 'coupon', 'report', 'admin_config', 'system'
);
CREATE TYPE audit_status AS ENUM ('success', 'failure', 'partial');
CREATE TYPE admin_data_action AS ENUM (
  'view_profile', 'view_payment', 'view_subscription', 'view_enrollment',
  'view_id_doc', 'export_data', 'view_analytics'
);
CREATE TYPE admin_access_result AS ENUM ('granted', 'denied', 'pending_approval');
```

### Drizzle Schema Definition

In `packages/db/src/schema/audit.ts`:

- Define `auditLogs` table as append-only (no update/delete)
- Define `adminDataAccessLogs` table as append-only
- No relations needed (these are standalone logging tables)
- Add comment: "Tables are immutable append-only; never update or delete"

## Database Tables

### audit_logs

- **Purpose**: Comprehensive activity audit trail
- **Row estimate**: ~10M-100M logs (high-volume platform)
- **Retention**: 7 years (compliance requirement)
- **Properties**: Append-only, immutable
- **Key relationships**: N:1 with users (actor_id)

### admin_data_access_logs

- **Purpose**: Sensitive data access tracking for compliance
- **Row estimate**: ~100K-1M logs (depends on admin activity)
- **Retention**: 7 years (compliance/legal hold)
- **Properties**: Append-only, immutable
- **Key relationships**: N:1 with users (admin and target user)

## Acceptance Criteria

- [ ] `audit_logs` table created with comprehensive fields
- [ ] No UPDATE or DELETE operations possible on audit_logs
- [ ] Changes JSONB captures before/after snapshots for updates
- [ ] Metadata JSONB stores additional context
- [ ] All IP addresses logged and indexed
- [ ] All timestamps in UTC timezone
- [ ] `admin_data_access_logs` table created for sensitive access
- [ ] Justification required for sensitive field access
- [ ] Super-admin approval workflow for high-risk access
- [ ] Sensitive fields list enforced in application logic
- [ ] All indexes created for efficient audit queries
- [ ] Partial indexes on failed operations
- [ ] Test data with various action and target types
- [ ] Test that updates/deletes are prevented (immutable)
- [ ] Test admin data access approval workflow
- [ ] Migration file generated and runnable
- [ ] Documentation of sensitive fields and access policies

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 06: Courses, Modules, and Lessons Tables
- All other schema tasks (for comprehensive logging)

## Technical Notes

### Append-Only Implementation

```typescript
// In application layer, NEVER update or delete
// Only INSERT is allowed

// Middleware to log all API calls
app.use(async (req, res, next) => {
  const startTime = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    // Log to audit_logs (INSERT ONLY)
    await db.insert(auditLogs).values({
      actorId: req.user?.id || "system",
      actionType: determineActionType(req),
      targetType: determineTargetType(req),
      targetId: extractTargetId(req),
      status: res.statusCode < 400 ? "success" : "failure",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      httpMethod: req.method,
      httpStatusCode: res.statusCode,
      apiEndpoint: req.path,
      requestId: req.id,
      durationMs: duration,
      sessionId: req.session?.id,
      timestamp: NOW,
    });

    return originalSend.call(this, data);
  };

  next();
});
```

### Change Tracking for Updates

```typescript
// When updating resource, track before/after
const updateCourse = async (courseId, updates) => {
  const before = await getCourse(courseId);

  // Perform update
  const after = await db
    .update(courses)
    .set(updates)
    .where(eq(courses.id, courseId))
    .returning();

  // Log changes
  await db.insert(auditLogs).values({
    actorId: req.user.id,
    actionType: "update",
    targetType: "course",
    targetId: courseId,
    resourceName: after.title,
    changes: {
      before: filterFields(before, Object.keys(updates)),
      after: filterFields(after, Object.keys(updates)),
      changedFields: Object.keys(updates),
    },
    ipAddress: req.ip,
    timestamp: NOW,
  });
};
```

### Sensitive Data Access Policy

```typescript
// Enforce justification for sensitive fields
const checkSensitiveAccess = (admin, targetUser, fieldsAccessed) => {
  const sensitiveFields = [
    "payment_information",
    "identity_documents",
    "email_address",
    "phone_number",
  ];

  const accessingSensitive = fieldsAccessed.some((f) =>
    sensitiveFields.includes(f)
  );

  if (accessingSensitive && !admin.isAdmin) {
    throw new Error("Sensitive field access denied");
  }

  // Log access with justification
  if (accessingSensitive && !admin.isSuperAdmin) {
    return {
      approved: false,
      requiresApproval: true,
      message: "This access requires super-admin approval",
    };
  }
};
```

### Admin Data Access Logging

```typescript
// Log when admin accesses sensitive user data
const logAdminDataAccess = async (admin, targetUser, action, fields) => {
  const isSensitiveAccess = fields.some((f) => SENSITIVE_FIELDS.includes(f));

  await db.insert(adminDataAccessLogs).values({
    adminUserId: admin.id,
    targetUserId: targetUser.id,
    actionType: action,
    dataFieldsAccessed: fields,
    justification: isSensitiveAccess ? req.body.justification : null,
    accessApprovalRequired: isSensitiveAccess,
    result: isSensitiveAccess ? "pending_approval" : "granted",
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    sessionId: req.session?.id,
    timestamp: NOW,
  });
};
```

### Audit Query Examples

```typescript
// Get all actions by user on specific resource
const getResourceAuditTrail = (targetType, targetId) => {
  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.targetType, targetType),
        eq(auditLogs.targetId, targetId)
      )
    )
    .orderBy(desc(auditLogs.timestamp));
};

// Get all actions performed by admin
const getAdminActivity = (adminId, startDate) => {
  return db
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.actorId, adminId), gt(auditLogs.timestamp, startDate))
    )
    .orderBy(desc(auditLogs.timestamp));
};

// Get all failed operations
const getFailedOperations = (sinceDate) => {
  return db
    .select()
    .from(auditLogs)
    .where(
      and(eq(auditLogs.status, "failure"), gt(auditLogs.timestamp, sinceDate))
    )
    .orderBy(desc(auditLogs.timestamp));
};

// Get all admin accesses to user's sensitive data
const getAdminAccessToUser = (userId) => {
  return db
    .select()
    .from(adminDataAccessLogs)
    .where(eq(adminDataAccessLogs.targetUserId, userId))
    .orderBy(desc(adminDataAccessLogs.timestamp));
};
```

### Data Retention and Archival

```typescript
// Archive old audit logs (7 year retention requirement)
const archiveOldAuditLogs = async () => {
  const sevenYearsAgo = NOW - INTERVAL '7 years';

  // Move to archive (or delete if backup exists)
  const toArchive = await db.select()
    .from(auditLogs)
    .where(lt(auditLogs.timestamp, sevenYearsAgo));

  // Note: In practice, might copy to cold storage (S3) instead
  // Or use PostgreSQL partitioning by date
};
```

### Partitioning Strategy

For high-volume audit logs, consider table partitioning:

```sql
-- Partition audit_logs by month for performance
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- This enables efficient archival and cleanup
-- Old partitions can be detached and moved to cold storage
```

### Testing Considerations

- Test audit log creation on all CRUD operations
- Test that updates are prevented (append-only)
- Test before/after change tracking
- Test sensitive field access logging
- Test admin access approval workflow
- Test IP and user-agent capture
- Test request duration logging
- Test cascade behavior (logs stay when resource deleted)
- Test audit log queries and filtering

### Performance Optimization

- Index on (target_type, target_id, timestamp) for resource history
- Index on (actor_id, timestamp) for user activity
- Partial index on failures: `WHERE status = 'failure'`
- Consider time-partitioning for large tables
- Archive old logs to cold storage after retention period

### Compliance and Legal

- 7-year retention aligns with financial regulations
- Immutable logs prove non-repudiation
- Document all access to sensitive user data
- Support legal discovery (export entire audit trail)
- Maintain audit logs separately from application data
- Use separate user account for audit log access (read-only)

### GDPR Compliance

- Users can request audit logs showing their data
- Support deletion of audit logs after retention period
- Exclude personally identifiable info from non-sensitive audit logs
- Log deletion of user accounts in audit trail
- Support "right to be forgotten" with anonymization
