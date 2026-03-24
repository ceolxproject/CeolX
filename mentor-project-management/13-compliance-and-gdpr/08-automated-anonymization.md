# Automated Anonymization

## Description

Implement an automated anonymization pipeline that runs after account deletion grace period expires (30 days). When a learner or instructor's account deletion is finalized, all personally identifiable information (PII) is irreversibly anonymized using a QStash background job. This ensures GDPR compliance while preserving essential business records (financial, legal).

The anonymization is irreversible - once completed, original identity cannot be recovered. Completion is logged for compliance audit.

## Affected Apps/Packages

- **API Server** - anonymization coordinator and validation
- **Background Jobs (QStash)** - async anonymization execution
- **Database** - updates to all user-related tables
- **Storage (Cloudflare R2)** - deletion of identity documents
- **Email Service** - notification of completion
- **Compliance Dashboard** - anonymization audit log

## API Endpoints

- `POST /api/admin/anonymize-user` - Manually trigger anonymization (admin only)
- `GET /api/admin/anonymization-queue` - View pending anonymizations
- `GET /api/admin/anonymization-history` - Audit log of completed anonymizations

## Requirements

- **Trigger Points**:
  - Automatic: QStash job scheduled from deletion_requests table (grace_period_ends_at)
  - Manual: Admin can trigger immediately for compliance requests
  - Cannot be triggered for active users (safety check)
  - Only for users with deletion_status="pending" (grace period expired)

- **Data Anonymization Rules**:
  1. **Personal Identification**:
     - name → "Deleted User [8-char hash]"
       - Hash = first 8 chars of SHA-256(user_id + original_name)
       - Example: "Deleted User a1b2c3d4"
     - email → "deleted\_[8-char hash]@anonymized.local"
       - Hash = first 8 chars of SHA-256(user_id + original_email)
       - Example: "deleted_a1b2c3d4@anonymized.local"
     - phone → NULL
     - profile_photo → NULL (file deleted from R2)
     - bio → NULL
     - date_of_birth → NULL
     - address fields → NULL

  2. **Account Metadata**:
     - Display names → same as name (Deleted User [hash])
     - Social media links → NULL
     - Website URL → NULL
     - Verification status → kept (for historical record)
     - Account creation date → kept (not PII if not connected to identity)

  3. **Community Content**:
     - Forum posts/comments: Content PRESERVED, author name anonymized
       - Posts.author_name → "Deleted User [hash]"
       - Posts.author_id → kept (for referential integrity)
       - User photo removed from posts
     - Comments: Same anonymization
     - Discussion forums: same
     - User profiles on posts changed to "Deleted User [hash]"

  4. **Learning Progress**:
     - Learning history → anonymized (identify user only by hash)
     - Quiz scores → anonymized but aggregated data preserved
     - Certificate records → still issued but to "Deleted User [hash]"
     - Video watch history → cleared
     - Course progress → cleared
     - Notes → cleared

  5. **Financial Records** (RETAINED):
     - Transaction records → KEPT (required for tax/legal)
     - Invoice numbers → KEPT
     - Payout history → KEPT
     - Refund records → KEPT
     - Subscription/enrollment records → anonymized user, kept transaction
     - Order amounts and dates → KEPT
     - Payment gateway references → KEPT

  6. **Identity Documents**:
     - ID documents (tax forms, etc.) → PERMANENTLY DELETED from R2
     - Verification documents → DELETED
     - Government ID scans → DELETED
     - No archival or backup (permanent deletion)

  7. **Sessions & Tokens**:
     - Active sessions → DELETED
     - Refresh tokens → DELETED
     - API keys → DELETED
     - Session cookies → INVALIDATED
     - Logout all devices immediately

  8. **Consent Records**:
     - Kept (immutable audit trail, but user_id can be cleared)
     - Timestamp and action kept for compliance
     - user_id field can be set to NULL (depends on consent log design)

- **Anonymization Process** (QStash Job):

  ```javascript
  async function anonymizeUser(userId) {
    // 1. Validate user is marked for deletion
    const deletion_request = await db.deletion_requests.findOne({
      user_id: userId,
      status: 'pending',
      grace_period_ends_at: { $lte: now }
    });
    if (!deletion_request) throw new Error('User not eligible');

    // 2. Generate hash for anonymization
    const hash = hashForAnonymization(userId);

    // 3. Anonymize personal data
    await db.users.update(
      { id: userId },
      {
        name: `Deleted User ${hash}`,
        email: `deleted_${hash}@anonymized.local`,
        phone: null,
        profile_photo_url: null,
        bio: null,
        date_of_birth: null,
        address: null,
        social_links: null,
        website_url: null,
        anonymized_at: now,
        anonymization_status: 'completed'
      }
    );

    // 4. Delete profile photo from R2
    if (user.profile_photo_url) {
      await r2.delete(user.profile_photo_url);
    }

    // 5. Anonymize community content author
    await db.forum_posts.updateMany(
      { author_id: userId },
      { author_name: `Deleted User ${hash}` }
    );
    await db.forum_comments.updateMany(
      { author_id: userId },
      { author_name: `Deleted User ${hash}` }
    );

    // 6. Clear learning progress
    await db.course_progress.deleteMany({ user_id: userId });
    await db.quiz_attempts.deleteMany({ user_id: userId });
    await db.video_watch_history.deleteMany({ user_id: userId });

    // 7. Delete identity documents from R2
    const docs = await db.id_documents.find({ user_id: userId });
    for (const doc of docs) {
      await r2.delete(doc.file_path);
    }
    await db.id_documents.deleteMany({ user_id: userId });

    // 8. Delete sessions and tokens
    await db.sessions.deleteMany({ user_id: userId });
    await db.refresh_tokens.deleteMany({ user_id: userId });
    await db.api_keys.deleteMany({ user_id: userId });

    // 9. Create anonymization audit log
    await db.anonymization_audit_log.insert({
      id: generateUUID(),
      user_id: userId,
      completed_at: now,
      hash_used: hash,
      data_deleted: [
        'phone', 'profile_photo', 'bio', 'dob', 'address',
        'social_links', 'website_url', 'id_documents', 'sessions',
        'tokens', 'learning_progress'
      ],
      data_retained: [
        'transactions', 'payouts', 'enrollments', 'community_content_body'
      ],
      r2_deletions: docs.length + 1, // ID docs + profile photo
      status: 'completed'
    });

    // 10. Update deletion_requests status
    await db.deletion_requests.update(
      { user_id: userId },
      { status: 'completed', completed_at: now }
    );

    // 11. Send notification email (to anonymized email address)
    // Send to last known email before anonymization
    const lastEmail = await getLastKnownEmail(userId);
    await sendEmail(lastEmail, 'Account Deleted and Anonymized', {...});

    // 12. Log to compliance system
    await logToComplianceSystem({
      action: 'user_anonymization_completed',
      user_id: userId,
      timestamp: now,
      hash: hash
    });

    return { success: true, user_id: userId, hash };
  }
  ```

- **Database Schema** (anonymization audit table):

  ```
  anonymization_audit_log table:
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - completed_at: timestamp with timezone
  - hash_used: string (first 8 chars of SHA-256)
  - data_deleted: string[] (array of field names)
  - data_retained: string[] (array of field names)
  - r2_deletions: integer (count of files deleted from R2)
  - files_deleted: jsonb (list of R2 keys deleted)
  - status: enum (completed, failed, partial)
  - error_message: text (nullable, if failed)
  - completed_by: enum (system_scheduled, admin_manual)
  - admin_id: UUID (nullable, if manual trigger)
  - notes: text (nullable)
  - verified_at: timestamp with timezone (nullable, for manual verification)
  - verification_details: jsonb (nullable)

  users table (modifications):
  - anonymized_at: timestamp with timezone (nullable)
  - anonymization_status: enum (pending, completed, failed) (default: pending)
  - anonymization_hash: string (nullable, used for historical reference only)
  ```

- **Error Handling & Retries**:
  - If any part fails, entire anonymization fails and retries
  - Max 5 retry attempts with exponential backoff
  - Circuit breaker if R2 deletion fails repeatedly
  - On failure, send alert to compliance team
  - Partial anonymization not allowed (all-or-nothing)
  - If failure after 5 retries, flag for manual review

- **Irreversibility Proof**:
  - Original data cannot be recovered after anonymization
  - Hashes are one-way (cannot reverse to get original email/name)
  - Deleted files from R2 unrecoverable (no backup)
  - Database updates delete records (not soft-delete)
  - Anonymization_audit_log is immutable proof of completion

- **Verification & Audit**:
  - All anonymization entries logged with timestamp
  - Manual anonymizations require admin_id and justification
  - Verification step: confirm user is anonymized before marking complete
  - Spot-check: randomly verify 5% of anonymizations for completeness
  - Monthly compliance report of anonymizations performed
  - GDPR SAR responses show anonymized user data (immutable proof)

- **Learner-Specific Anonymization**:
  - Same as above

- **Instructor-Specific Anonymization**:
  - Same as above, plus:
  - Course created_by field: keep course_id but clear instructor reference
  - Instructor earnings records: keep anonymized (user can't be identified)
  - Payout records: anonymize payment details
  - Team member invitations sent: anonymize (clear inviter_id, keep timestamp)

- **Performance Considerations**:
  - Job runs async, don't block deletion confirmation
  - Delete operations in batches (max 10k records per batch)
  - R2 deletion can be parallelized (5 concurrent)
  - Index on user_id for fast lookups
  - Transaction isolation: set to SERIALIZABLE for anonymization
  - Expected duration: 2-15 minutes depending on user data volume

## Acceptance Criteria

- [ ] QStash job scheduled automatically when grace period expires
- [ ] Manual admin trigger available for compliance requests
- [ ] User name anonymized to "Deleted User [hash]"
- [ ] Email anonymized to "deleted\_[hash]@anonymized.local"
- [ ] Phone, bio, address, DOB all set to NULL
- [ ] Profile photo deleted from R2
- [ ] Community posts preserved with anonymized author name
- [ ] Learning progress records deleted
- [ ] Quiz/video history deleted
- [ ] Identity documents permanently deleted from R2
- [ ] Sessions and tokens deleted (user logged out everywhere)
- [ ] Financial records preserved with original timestamps
- [ ] Transaction history unchanged
- [ ] Payout records retained
- [ ] Anonymization audit log created
- [ ] deletion_requests status updated to "completed"
- [ ] Hash is one-way (cannot reverse to original data)
- [ ] deleted_photo_url R2 key recorded in audit log
- [ ] Manual anonymizations logged with admin_id
- [ ] Spot-check verification works (sample anonymizations checked)
- [ ] Exponential backoff retry logic functional
- [ ] Circuit breaker activates on repeated R2 failures
- [ ] All-or-nothing atomicity enforced (no partial anonymization)
- [ ] Immutable audit log prevents post-anonymization data recovery claims
- [ ] Performance acceptable (2-15 min for typical user)
- [ ] Concurrent R2 deletions working without conflicts
- [ ] Email sent to last known address confirming anonymization
- [ ] Compliance reporting shows anonymization metrics

## Dependencies

- **Account Deletion - Learner/Instructor** - triggers this pipeline
- **IP Anonymization Cron** - separate but similar process
- **Email Service** - confirmation emails
- **Background Jobs (QStash)** - async execution
- **Cloudflare R2** - file deletion
- **Database Transaction Support** - SERIALIZABLE isolation

## Technical Notes

- Hash function: use SHA-256(user_id + original_name), take first 8 chars
- Ensure hash is deterministic (same input always produces same hash)
- R2 deletion should use versioning if configured (handle gracefully)
- Store R2 deletion results in audit log for verification
- Consider archiving deleted user record before hard delete (compliance backup)
- Use database TRANSACTION to ensure atomicity
- Log every SQL statement executed for compliance audit
- Implement metrics: avg time to anonymize, failure rate, retry count
- Consider separate job queue for anonymization (priority queue)
- Test with production data volumes (stress test with 100k+ users)
- Verify that anonymization doesn't break any foreign key constraints
- Check for orphaned records after anonymization
- Implement health check: periodically verify anonymized users are actually anonymized
- Document irreversibility clearly for legal team
- Create playbook for handling failed anonymizations
- Consider GDPR SAR scenario: what happens if SAR request comes during anonymization?
- Test edge cases: users with special characters in names, emojis
- Verify hash collisions don't occur (even with 1M+ users, probability ~0)
- Implement circuit breaker pattern for R2 operations
- Create dashboard showing anonymization queue depth and processing rate
- Consider eventual consistency: some systems may see unanonymized data briefly
- Use strong hashing (SHA-256, not MD5 or CRC)
- Document in privacy policy that anonymization is irreversible
