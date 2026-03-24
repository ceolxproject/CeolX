# Task 15: Data Export and Account Deletion Tables

## Description

Create tables for managing user data access requests (GDPR/CCPA), data export operations, and account deletion workflows. Supports compliance requirements for user data portability (right to access) and right to be forgotten (account deletion with grace period for recovery).

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (export and deletion request endpoints)
- `apps/web-learner` (account settings and data download)
- `apps/web-admin` (request processing and tracking)

## Requirements

### Data Export Requests Table

Create table `data_export_requests`:

| Column             | Type          | Constraints                  | Description                                            |
| ------------------ | ------------- | ---------------------------- | ------------------------------------------------------ |
| `id`               | `UUID`        | PK, Default: `uuid_v7()`     | Unique export request identifier                       |
| `user_id`          | `UUID`        | FK → users(id), NOT NULL     | User requesting export                                 |
| `format`           | `VARCHAR(50)` | NOT NULL                     | Enum: json, csv                                        |
| `include_sections` | `TEXT[]`      | DEFAULT: ARRAY[]::TEXT[]     | Sections to include (profile, courses, payments, etc.) |
| `status`           | `VARCHAR(50)` | NOT NULL, DEFAULT: 'pending' | Enum: pending, processing, completed, failed           |
| `file_url`         | `TEXT`        | NULL                         | R2 URL to exported file (secure, private)              |
| `file_size_bytes`  | `INTEGER`     | NULL                         | Size of exported file                                  |
| `error_message`    | `TEXT`        | NULL                         | If failed, error details                               |
| `retry_count`      | `INTEGER`     | DEFAULT: 0                   | Number of retry attempts                               |
| `requested_at`     | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`   | When user requested export                             |
| `started_at`       | `TIMESTAMP`   | NULL                         | When processing started                                |
| `completed_at`     | `TIMESTAMP`   | NULL                         | When export completed                                  |
| `expires_at`       | `TIMESTAMP`   | NULL                         | When download link expires (7 days)                    |
| `downloaded_at`    | `TIMESTAMP`   | NULL                         | When user downloaded file                              |
| `notified_at`      | `TIMESTAMP`   | NULL                         | When user was notified of completion                   |
| `created_at`       | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`   | Record creation time                                   |

### Data Export Request Status Lifecycle

- **pending** - Created, queued for processing
- **processing** - Currently exporting user data
- **completed** - Export successful, file ready
- **failed** - Export failed, user should retry

### Indexes for Data Export Requests Table

- Primary Key: `id`
- Index: `(user_id)` - find user's export requests
- Index: `(status)` - find requests needing processing
- Index: `(requested_at)` - recent requests
- Index: `(expires_at)` - find expired downloads
- Partial Index: `(user_id, status)` WHERE `status IN ('pending', 'processing')` - active requests
- Partial Index: `(status)` WHERE `status IN ('pending', 'processing')` - processing queue

### Data Sections for Export

Common sections to include:

- **profile** - User profile, preferences, account settings
- **courses** - Enrolled courses, completion status, progress
- **assignments** - Assignment submissions and grades
- **notes** - User's notes on lessons
- **payments** - Payment history and invoices
- **subscriptions** - Subscription history
- **community** - Posts, comments, likes
- **consent** - Consent records and preferences

### Account Deletion Requests Table

Create table `account_deletion_requests`:

| Column                              | Type           | Constraints                  | Description                                                   |
| ----------------------------------- | -------------- | ---------------------------- | ------------------------------------------------------------- |
| `id`                                | `UUID`         | PK, Default: `uuid_v7()`     | Unique deletion request identifier                            |
| `user_id`                           | `UUID`         | FK → users(id), NOT NULL     | User requesting deletion                                      |
| `status`                            | `VARCHAR(50)`  | NOT NULL, DEFAULT: 'pending' | Enum: pending, grace_period, processing, completed, cancelled |
| `reason`                            | `TEXT`         | NULL                         | Reason provided by user                                       |
| `requested_at`                      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`   | When user requested deletion                                  |
| `grace_period_ends_at`              | `TIMESTAMP`    | NOT NULL                     | When grace period expires (14 days)                           |
| `grace_period_notification_sent_at` | `TIMESTAMP`    | NULL                         | When user was notified of pending deletion                    |
| `cancellation_code`                 | `VARCHAR(100)` | NULL                         | Code if cancellation link used                                |
| `processed_at`                      | `TIMESTAMP`    | NULL                         | When account actually deleted                                 |
| `processed_by`                      | `UUID`         | FK → users(id), NULL         | Admin who processed deletion                                  |
| `anonymization_completed_at`        | `TIMESTAMP`    | NULL                         | When anonymization finished                                   |
| `data_archived_at`                  | `TIMESTAMP`    | NULL                         | When data archived for legal hold                             |
| `created_at`                        | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`   | Record creation time                                          |

### Account Deletion Status Lifecycle

- **pending** - Deletion just requested, grace period active
- **grace_period** - User can still cancel during grace period
- **processing** - Grace period ended, deletion in progress
- **completed** - Account fully deleted and anonymized
- **cancelled** - User cancelled deletion request

### Grace Period Details

- Default 14 days before actual deletion (GDPR right to withdraw)
- User can cancel deletion by clicking link in email
- After grace period, data permanently deleted/anonymized
- Send email confirmation at request and at end of grace period

### Anonymization Strategy

After grace period, instead of hard delete:

- Anonymize PII fields (name, email, phone)
- Soft-delete user records (set status='pending_deletion')
- Keep anonymized data for analytics (no personal identifiers)
- Keep audit logs for legal compliance
- Delete sensitive data (passwords, tokens, payments)

### Indexes for Account Deletion Requests

- Primary Key: `id`
- Index: `(user_id)` - find deletion request for user
- Index: `(status)` - filter by status
- Index: `(requested_at)` - recent deletions
- Index: `(grace_period_ends_at)` - find deletions to process
- Composite Index: `(status, grace_period_ends_at)` - find pending deletions ready to process
- Index: `(processed_at)` - track completed deletions
- Partial Index: `(user_id)` WHERE `status IN ('pending', 'grace_period')` - active deletion requests

### Anonymization Tracking Table

Create table `user_anonymizations`:

| Column                   | Type        | Constraints                                  | Description                      |
| ------------------------ | ----------- | -------------------------------------------- | -------------------------------- |
| `id`                     | `UUID`      | PK, Default: `uuid_v7()`                     | Unique anonymization record      |
| `original_user_id`       | `UUID`      | NOT NULL                                     | Original user ID (never updated) |
| `anonymized_user_id`     | `UUID`      | FK → users(id), NULL                         | New anonymized user record       |
| `deletion_request_id`    | `UUID`      | FK → account_deletion_requests(id), NOT NULL | Related deletion request         |
| `anonymized_fields`      | `TEXT[]`    | NOT NULL                                     | Fields that were anonymized      |
| `archived_data_location` | `TEXT`      | NULL                                         | S3/R2 location of archived data  |
| `anonymized_at`          | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`                   | When anonymization occurred      |
| `legal_hold_until`       | `TIMESTAMP` | NULL                                         | Data retained for legal hold     |

### Indexes for Anonymization Tracking

- Primary Key: `id`
- Index: `(original_user_id)` - track original user
- Index: `(deletion_request_id)` - link to deletion request
- Index: `(anonymized_at)` - track anonymization timeline

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE data_export_format AS ENUM ('json', 'csv');
CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE deletion_status AS ENUM ('pending', 'grace_period', 'processing', 'completed', 'cancelled');
```

### Drizzle Schema Definition

In `packages/db/src/schema/dataRequests.ts`:

- Define `dataExportRequests` table
- Define `accountDeletionRequests` table
- Define `userAnonymizations` table
- Relations:
  - users ↔ dataExportRequests (one-to-many)
  - users ↔ accountDeletionRequests (one-to-many)
  - accountDeletionRequests → dataExportRequests (1:N)

## Database Tables

### data_export_requests

- **Purpose**: Track GDPR/CCPA data access requests
- **Row estimate**: ~1K-10K requests (annually, ~1% of users)
- **Retention**: Keep for 2 years (legal compliance)
- **Key relationships**: N:1 with users

### account_deletion_requests

- **Purpose**: Track account deletion workflows with grace period
- **Row estimate**: ~10K-100K requests (varies by churn rate)
- **Retention**: Keep for 7 years (compliance)
- **Key relationships**: N:1 with users

### user_anonymizations

- **Purpose**: Track anonymized users for legal hold
- **Row estimate**: Matches deletion requests
- **Retention**: 7 years
- **Key relationships**: References both original and anonymized users

## Acceptance Criteria

- [ ] `data_export_requests` table created with format and status enums
- [ ] Export supports JSON and CSV formats
- [ ] Export includes all user data sections
- [ ] File URL points to secure R2 object (private, expires after 7 days)
- [ ] `account_deletion_requests` table created with grace period
- [ ] Grace period enforced (14 days minimum)
- [ ] User can cancel deletion during grace period
- [ ] Status transitions enforced (pending → grace_period → processing → completed)
- [ ] Anonymization strategy implemented (PII redacted)
- [ ] Audit logs preserved after deletion
- [ ] All timestamps in UTC timezone
- [ ] Cancellation code generated for secure cancellation link
- [ ] Email notifications sent at request and grace period end
- [ ] Background job processes expired grace periods
- [ ] Test data with various export formats
- [ ] Test deletion and cancellation flows
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- All other schema tasks (for comprehensive data export)
- Background job system for processing deletions

## Technical Notes

### Data Export Process

```typescript
// Initiate data export
const requestDataExport = async (userId, format) => {
  const request = await db.insert(dataExportRequests).values({
    userId,
    format,
    includeSections: ["profile", "courses", "payments", "consent"],
    status: "pending",
    requestedAt: NOW,
    createdAt: NOW,
  });

  // Queue background job
  await queueJob("export-user-data", {
    requestId: request.id,
    userId,
    format,
  });

  // Send confirmation email
  await sendEmail(user.email, {
    subject: "Data Export Request Received",
    body: "Your data export has been requested. You will receive a download link within 24 hours.",
  });
};
```

### Data Export Background Job

```typescript
// Background worker processing exports
const exportUserData = async (requestId, userId, format) => {
  const request = await db.update(dataExportRequests)
    .set({ status: 'processing', startedAt: NOW })
    .where(eq(dataExportRequests.id, requestId))
    .returning();

  try {
    // Gather user data
    const userData = await gatherUserData(userId);

    // Convert to format
    const fileContent = format === 'json'
      ? JSON.stringify(userData, null, 2)
      : convertToCSV(userData);

    // Upload to R2
    const fileUrl = await uploadToR2(
      `exports/${userId}/${requestId}.${format === 'json' ? 'json' : 'csv'}`,
      fileContent
    );

    // Update request
    await db.update(dataExportRequests)
      .set({
        status: 'completed',
        fileUrl,
        fileSizeBytes: fileContent.length,
        completedAt: NOW,
        expiresAt: NOW + INTERVAL '7 days'
      })
      .where(eq(dataExportRequests.id, requestId));

    // Send download link
    await sendEmail(user.email, {
      subject: 'Your Data Export is Ready',
      body: `Download your data: ${fileUrl} (expires in 7 days)`
    });

  } catch (error) {
    await db.update(dataExportRequests)
      .set({
        status: 'failed',
        errorMessage: error.message,
        retryCount: request.retryCount + 1
      })
      .where(eq(dataExportRequests.id, requestId));

    // Retry up to 3 times
    if (request.retryCount < 3) {
      await queueJob('export-user-data', {
        requestId,
        userId,
        format
      }, { delayMs: 3600000 }); // Retry in 1 hour
    }
  }
};
```

### Account Deletion Request Flow

```typescript
// User requests account deletion
const requestAccountDeletion = async (userId, reason) => {
  // Check for active subscriptions
  const activeSubscription = await hasActiveSubscription(userId);
  if (activeSubscription) {
    throw new Error('Cannot delete account with active subscription. Cancel subscription first.');
  }

  const gracePeriodEndsAt = NOW + INTERVAL '14 days';

  const deletion = await db.insert(accountDeletionRequests).values({
    userId,
    status: 'pending',
    reason,
    requestedAt: NOW,
    gracePeriodEndsAt,
    createdAt: NOW
  });

  // Generate cancellation code
  const cancellationCode = crypto.randomBytes(32).toString('hex');

  // Send notification email with cancellation link
  const cancellationLink = `${APP_URL}/account/cancel-deletion?code=${cancellationCode}`;

  await sendEmail(user.email, {
    subject: 'Your Mentor Account Will Be Deleted',
    body: `Your account will be permanently deleted on ${gracePeriodEndsAt}.
           Click here to cancel: ${cancellationLink}`
  });
};
```

### Cancel Deletion During Grace Period

```typescript
const cancelDeletion = async (cancellationCode) => {
  const deletion = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.cancellationCode, cancellationCode),
        eq(accountDeletionRequests.status, "grace_period"),
      ),
    )
    .limit(1);

  if (!deletion) {
    throw new Error("Invalid or expired cancellation code");
  }

  await db
    .update(accountDeletionRequests)
    .set({ status: "cancelled" })
    .where(eq(accountDeletionRequests.id, deletion[0].id));

  // Send confirmation
  await sendEmail(deletion[0].user.email, {
    subject: "Account Deletion Cancelled",
    body: "Your account has been saved. Account deletion was cancelled.",
  });
};
```

### Process Expired Grace Periods (Background Job)

```typescript
// Run daily to process expired deletions
const processExpiredDeletions = async () => {
  const expired = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.status, "grace_period"),
        lt(accountDeletionRequests.gracePeriodEndsAt, NOW),
      ),
    );

  for (const deletion of expired) {
    await processAccountDeletion(deletion.id);
  }
};

const processAccountDeletion = async (deletionId) => {
  const deletion = await db
    .update(accountDeletionRequests)
    .set({ status: "processing" })
    .where(eq(accountDeletionRequests.id, deletionId))
    .returning();

  try {
    const user = await getUser(deletion.userId);

    // Archive sensitive data
    const archivedData = await archiveUserData(user.id);

    // Anonymize user
    await anonymizeUser(user.id, archivedData.location);

    // Delete sensitive data
    await deleteSensitiveData(user.id);

    // Update deletion request
    await db
      .update(accountDeletionRequests)
      .set({
        status: "completed",
        processedAt: NOW,
      })
      .where(eq(accountDeletionRequests.id, deletionId));

    // Send confirmation
    await sendEmail(user.email, {
      subject: "Account Permanently Deleted",
      body: "Your Mentor account and associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("Error processing deletion:", error);
    // Retry later
    await queueJob("process-deletion", { deletionId });
  }
};
```

### Anonymization Implementation

```typescript
const anonymizeUser = async (userId, archivedDataLocation) => {
  const user = await getUser(userId);

  // Update user record
  await db.update(users)
    .set({
      name: `Deleted User ${userId.substring(0, 8)}`,
      email: `deleted+${userId}@anonymous.local`,
      bio: null,
      photoUrl: null,
      status: 'pending_deletion'
    })
    .where(eq(users.id, userId));

  // Anonymize profile
  await db.update(userProfiles)
    .set({
      interests: [],
      companyName: null,
      jobTitle: null,
      phoneNumber: null,
      location: null,
      preferencesJson: {}
    })
    .where(eq(userProfiles.userId, userId));

  // Delete sensitive records
  await db.delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));

  await db.delete(fcmTokens)
    .where(eq(fcmTokens.userId, userId));

  // Keep anonymized data:
  // - audit_logs (for compliance)
  // - consent_records (for legal hold)
  // - payment history (for accounting)
  // - anonymized community posts/comments

  // Track anonymization
  await db.insert(userAnonymizations).values({
    originalUserId: user.id,
    anonymizedUserId: user.id,
    deletionRequestId,
    anonymizedFields: ['name', 'email', 'phone', 'bio', 'photo'],
    archivedDataLocation,
    anonymizedAt: NOW,
    legalHoldUntil: NOW + INTERVAL '7 years'
  });
};
```

### Data Gathering for Export

```typescript
const gatherUserData = async (userId) => {
  return {
    profile: await getUserProfile(userId),
    courses: await getUserCourses(userId),
    progress: await getUserProgress(userId),
    assignments: await getUserAssignments(userId),
    notes: await getUserNotes(userId),
    payments: await getUserPayments(userId),
    subscriptions: await getUserSubscriptions(userId),
    community: await getUserCommunityActivity(userId),
    consent: await getUserConsent(userId),
    bookmarks: await getUserBookmarks(userId),
  };
};
```

### Query Patterns

```typescript
// Find pending exports to process
const getPendingExports = () => {
  return db
    .select()
    .from(dataExportRequests)
    .where(eq(dataExportRequests.status, "pending"))
    .orderBy(asc(dataExportRequests.requestedAt));
};

// Find deletions ready to process
const getDeletionsReadyToProcess = () => {
  return db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.status, "grace_period"),
        lt(accountDeletionRequests.gracePeriodEndsAt, NOW),
      ),
    );
};

// Get user's deletion request status
const getDeletionStatus = (userId) => {
  return db
    .select()
    .from(accountDeletionRequests)
    .where(eq(accountDeletionRequests.userId, userId))
    .orderBy(desc(accountDeletionRequests.requestedAt))
    .limit(1);
};
```

### Testing Considerations

- Test data export with various formats
- Test export file generation and R2 upload
- Test deletion request creation and grace period
- Test cancellation during grace period
- Test anonymization of PII
- Test background job processing
- Test cascade effects (deleting user doesn't break exports)
- Test email notifications
- Test expired file link cleanup

### Compliance Notes

- GDPR: Support data portability (export in machine-readable format)
- GDPR: Support right to be forgotten (anonymize or hard delete)
- GDPR: 30-day deadline for data access requests (set grace period accordingly)
- CCPA: Similar rights plus data retention limitations
- Keep audit trail of all deletions
- Support legal holds for litigation/investigations
- Archive user data for minimum retention period
