# Data Export - Learner

## Description

Implement learner data export (GDPR Article 20 - Right to Data Portability) allowing users to request and download their personal data in machine-readable formats (JSON and CSV). The export process is asynchronous with QStash background job, generating a ZIP file containing structured data about the learner's account, purchases, learning progress, community participation, and consent records.

Exported file is uploaded to Cloudflare R2, and users receive a signed download link via email. Links expire after 7 days. Users can request export maximum once per 7 days.

## Affected Apps/Packages

- **Web App** (Next.js) - export request UI in Settings
- **API Server** - export request endpoints
- **Background Jobs** - QStash for ZIP generation and upload
- **Storage** - Cloudflare R2 for file hosting
- **Email Service** - download link notification
- **Database** - data aggregation queries

## API Endpoints

- `POST /api/data-export/request` - Request data export
- `GET /api/data-export/status` - Check export request status
- `GET /api/data-export/list` - List previous exports
- `DELETE /api/data-export/:id` - Delete export from R2 (admin only)
- `POST /api/data-export/verify-ready` - Internal endpoint to check/resend download link

## Requirements

- **Export Request UI** (Settings > Privacy & Data):
  - Button "Request Data Export"
  - Clear explanation of included data (profile, purchases, progress, etc.)
  - Notice about processing time (up to 48 hours)
  - Confirmation modal before submission
  - Form fields:
    - Email address (pre-filled, user can change)
    - Format preference (JSON, CSV, or both)
  - Submission button disabled while processing if recent request exists
  - Success message with estimated completion time

- **Data Included in Export**:
  1. **Profile Data** (JSON + CSV):
     - User ID, email, name, phone
     - Account creation date, last login
     - Preferred language, timezone
     - Profile photo URL (if public)
     - Bio/bio text
     - Account status (active, suspended, etc.)

  2. **Purchase History** (JSON + CSV):
     - Order ID, course ID, course title
     - Purchase date, price, currency
     - Payment method (last 4 digits only)
     - Invoice URL
     - License validity period

  3. **Learning Progress** (JSON + CSV):
     - Course ID, course title, progress percentage
     - Enrollment date, last accessed date
     - Video watch history (timestamp, duration)
     - Quiz scores, completion status
     - Certificates earned (links)
     - Time spent per course, total study time

  4. **Community Participation** (JSON + CSV):
     - Posts created (title, content, date, likes)
     - Comments made (content, date, likes)
     - Discussions participated in
     - Followers/following counts
     - Community badges/achievements

  5. **Consent Records** (JSON only):
     - All consent preferences (necessary, analytics, marketing)
     - Consent timestamps, policy versions
     - Consent changes history
     - IP addresses (anonymized)

  6. **Account Activity Log** (JSON only):
     - Login history (dates, IPs)
     - Device information
     - Email change history
     - Password reset history
     - Deletion request history (if applicable)

- **Export Format Specifications**:
  - **JSON**: Nested structure with top-level categories
    ```json
    {
      "profile": {...},
      "purchases": [...],
      "learning_progress": [...],
      "community": {...},
      "consent": [...],
      "activity_log": [...]
    }
    ```
  - **CSV**: Separate files per category (profile.csv, purchases.csv, etc.)
  - **ZIP Structure**:
    ```
    mentor-data-export-[user_id]-[date].zip
    ├── README.txt (explanation of contents)
    ├── profile.json
    ├── profile.csv
    ├── purchases.json
    ├── purchases.csv
    ├── learning_progress.json
    ├── learning_progress.csv
    ├── community.json
    ├── community.csv
    ├── consent.json
    └── activity_log.json
    ```

- **Processing Pipeline**:
  1. User clicks "Request Data Export" → validation and rate limit check
  2. Create data_export_request record with status "pending"
  3. Queue QStash job to execute at specified delay (max 48 hours, suggest 2-4 hours)
  4. Return request ID and estimated completion time to user
  5. QStash job:
     - Fetch all required data from database
     - Generate JSON files with structured data
     - Generate CSV files with tabular data
     - Create ZIP archive
     - Upload to R2 with signed URL (7-day expiration)
     - Update database with completion status, file URL, size
     - Send email with download link
  6. User receives email with download link and storage location
  7. Link expires after 7 days or after first download (configurable)
  8. Expired exports can be re-requested

- **Rate Limiting**:
  - Maximum 1 export request per 7 days per user
  - If user requests export before 7 days elapse, show message "Next export available on [date]"
  - Allow admin override for compliance requests

- **Database Schema**:

  ```
  data_export_requests table:
  - id: UUID (primary key)
  - user_id: UUID (foreign key, not null)
  - status: enum (pending, processing, completed, failed, expired)
  - requested_at: timestamp with timezone
  - started_at: timestamp with timezone (nullable)
  - completed_at: timestamp with timezone (nullable)
  - format: enum (json, csv, both)
  - file_size_bytes: bigint (nullable)
  - r2_url: string (nullable, signed URL)
  - r2_key: string (nullable, for deletion)
  - url_expires_at: timestamp with timezone (nullable)
  - download_count: integer (default 0)
  - first_downloaded_at: timestamp with timezone (nullable)
  - error_message: text (nullable)
  - ip_address: string
  - requested_email: string (may differ from user email)
  - qstash_message_id: string (nullable)
  ```

- **Email Notification**:
  - Subject: "Your Mentor Data Export is Ready"
  - Content includes:
    - Personal greeting
    - Download link (button + URL)
    - Expiration notice (7 days)
    - How to use the data
    - Re-request option
    - Support contact
  - Email sent to requested_email address (not necessarily primary email)
  - Email includes file size and download instructions

- **Error Handling**:
  - If QStash job fails, create error record and retry
  - Max 3 retry attempts with exponential backoff
  - Send notification email if export fails
  - Show error status in user's export history
  - Provide support contact for failed exports

- **Security & Privacy**:
  - Data aggregation queries should use indexes for performance
  - R2 URLs should be signed and have short expiration
  - Do not include sensitive data like passwords or API keys
  - Anonymize IP addresses in export
  - No PII should be logged in job metadata
  - Archive should be encrypted if possible (future enhancement)
  - Access to export URLs should be logged

## Acceptance Criteria

- [ ] Data Export button present in Settings > Privacy & Data
- [ ] Export request form collects email and format preference
- [ ] Confirmation modal shown before processing request
- [ ] Rate limiting enforces 1 export per 7 days
- [ ] User shown estimated completion time (2-4 hours suggested)
- [ ] data_export_requests table created with all fields
- [ ] QStash job queues successfully and processes at correct time
- [ ] JSON export includes all 6 data categories with correct structure
- [ ] CSV files generated for profile, purchases, progress, community
- [ ] ZIP file created with proper structure and README
- [ ] File uploaded to R2 with signed URL (7-day expiration)
- [ ] Download link sent via email
- [ ] Email includes file size, expiration date, re-request option
- [ ] Link expires after 7 days (verified in R2)
- [ ] User history shows previous export requests with status
- [ ] Export status page accessible in Settings
- [ ] Failed exports show error message and retry/support option
- [ ] Rate limit message shows next available request date
- [ ] Admin can override rate limit for compliance
- [ ] Download count tracked for audit
- [ ] IP address recorded with export request
- [ ] Error logs include job ID for debugging
- [ ] QStash retry logic works (max 3 attempts)
- [ ] Performance tested with large datasets (100k+ records)
- [ ] Data accuracy verified (spot-check samples)
- [ ] ZIP file integrity tested (no corrupted entries)
- [ ] Email deliverability verified
- [ ] R2 signed URLs properly restrict access
- [ ] Old expired exports cleaned up automatically

## Dependencies

- **Data Export - Instructor** - shared ZIP/R2 upload logic
- **Background Jobs (QStash)** - asynchronous processing
- **Email Service** - download link notification
- **Cloudflare R2** - file storage
- **Database Indexes** - performance optimization for data queries

## Technical Notes

- Use Vercel Functions or similar for QStash handler
- Implement database query optimization for large datasets
- Consider caching frequently-accessed data (last 7 days)
- R2 signed URLs: use crypto library to generate signatures
- Test ZIP file generation with various data sizes
- Implement proper error handling for database connection failures
- Use streaming for large dataset processing (avoid memory issues)
- Rate limiting can be stored in Redis for distributed systems
- Generate unique filenames to prevent collisions (include timestamp)
- Implement cleanup cron job to delete expired files from R2 after 7 days
- Log export requests (without PII) for compliance audit
- Consider GDPR SAR (Subject Access Request) as use case
- Test with various character sets and special characters
- Implement progress notifications if processing takes > 6 hours
- Consider pagination for very large exports (multiple ZIPs)
- Store hash of exported data for integrity verification
- CSV files should use consistent encoding (UTF-8)
- Exclude sensitive fields (password hashes, tokens, API keys)
- Document data export process in privacy policy
- Provide sample export to users in documentation
- Consider monthly export retention option (auto-request)
- Test email link rendering in various email clients
- Implement phone/SMS notification option (future)
