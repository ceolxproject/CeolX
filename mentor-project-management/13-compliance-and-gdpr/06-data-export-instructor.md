# Data Export - Instructor

## Description

Implement instructor data export using the same asynchronous pipeline as learner export, with additional data categories specific to instructors. Instructors can export their profile, course metadata (not video files), earnings and payout history, team member information, community participation, and consent records.

Uses shared ZIP generation and R2 upload infrastructure with learner exports. Same 7-day link expiration and 48-hour processing time apply. Rate limited to 1 export per 7 days.

## Affected Apps/Packages

- **Web App** (Next.js) - export request UI in Instructor Dashboard
- **Instructor Dashboard** - data export section
- **API Server** - instructor-specific export endpoints
- **Background Jobs** - QStash for ZIP generation (shared handler)
- **Storage** - Cloudflare R2 (shared with learner exports)
- **Email Service** - download link notification
- **Database** - instructor-specific data queries

## API Endpoints

- `POST /api/instructor/data-export/request` - Request instructor data export
- `GET /api/instructor/data-export/status` - Check export status
- `GET /api/instructor/data-export/list` - List previous exports
- `DELETE /api/instructor/data-export/:id` - Delete export from R2 (admin only)

## Requirements

- **Export Request UI** (Instructor Dashboard > Settings > Privacy & Data):
  - Button "Request Data Export"
  - Clear explanation of included data (profile, courses, earnings, team, etc.)
  - Notice that video files are NOT included (only metadata)
  - Confirmation modal before submission
  - Form fields:
    - Email address (pre-filled, instructor can change)
    - Format preference (JSON, CSV, or both)
    - Optional: Include earnings detail level (summary vs. detailed)
  - Submission button disabled if recent request exists
  - Success message with estimated completion time

- **Data Included in Export**:
  1. **Profile Data** (JSON + CSV):
     - User ID, email, name, phone
     - Account creation date, last login
     - Bio, expertise areas, profile photo URL
     - Verification status, ratings/reviews
     - Social media links
     - Account status (active, suspended, etc.)

  2. **Course Metadata** (JSON + CSV):
     - Course ID, title, description
     - Category, difficulty level
     - Creation date, last modified date
     - Publication status (draft, published, archived)
     - Enrollment count, rating, review count
     - Course thumbnail URL
     - Course duration (hours)
     - Pricing info (free vs. paid, price, currency)
     - Course content outline (chapter/lesson titles, no video URLs)
     - Note: Video files NOT included, only metadata

  3. **Earnings & Payouts** (JSON + CSV):
     - **Summary**: Lifetime earnings, total payouts, pending balance
     - **Detailed** (if requested):
       - Transaction ID, date, amount, currency
       - Type (sale, refund, adjustment, fee)
       - Course involved
       - Student count for period
       - Payment gateway fee
       - Net amount received
     - Payout history:
       - Payout ID, date, amount
       - Payment method (last 4 digits masked)
       - Status (pending, completed, failed)
       - Transaction reference

  4. **Team Members** (JSON only):
     - Team member name, email, role
     - Add date, last active date
     - Courses they have access to
     - Permission level

  5. **Community Participation** (JSON + CSV):
     - Instructor posts in forums (title, content, date, engagement)
     - Comments on community discussions
     - Community badges earned
     - Total followers/following

  6. **Consent Records** (JSON only):
     - All consent preferences
     - Consent timestamps and policy versions
     - Change history

  7. **Account Activity Log** (JSON only):
     - Login history (dates, IPs - anonymized)
     - Course creation/modification history
     - Team member invitations sent
     - Payout processing history
     - Admin interactions with account

- **Export Format Specifications**:
  - **JSON**: Nested structure with instructor-specific categories
    ```json
    {
      "profile": {...},
      "courses": [...],
      "earnings": {
        "summary": {...},
        "detailed_transactions": [...],
        "payout_history": [...]
      },
      "team_members": [...],
      "community": {...},
      "consent": [...],
      "activity_log": [...]
    }
    ```
  - **CSV**: Separate files for tabular data
  - **ZIP Structure**:
    ```
    mentor-instructor-export-[instructor_id]-[date].zip
    ├── README.txt (explanation + video note)
    ├── profile.json
    ├── profile.csv
    ├── courses.json
    ├── courses.csv
    ├── earnings_summary.json
    ├── earnings_detailed.json (if requested)
    ├── earnings_detailed.csv (if requested)
    ├── payouts.json
    ├── payouts.csv
    ├── team_members.json
    ├── community.json
    ├── community.csv
    ├── consent.json
    └── activity_log.json
    ```

- **Processing Pipeline** (shared with learner):
  1. Instructor clicks "Request Data Export" → validation and rate limit check
  2. Create data_export_request record with user_type="instructor"
  3. Queue QStash job (up to 48 hours, suggest 4 hours for larger datasets)
  4. Return request ID and estimated completion time
  5. QStash handler:
     - Fetch all instructor-specific data
     - Generate JSON/CSV files with proper structure
     - Include earnings data (summary or detailed based on preference)
     - Exclude video file URLs, API keys, sensitive tokens
     - Create ZIP archive
     - Upload to R2 with signed URL
     - Update database with completion details
     - Send email notification
  6. Instructor receives email with download link
  7. Link expires after 7 days

- **Earnings Data Privacy**:
  - Include full transaction details (for instructor's own records)
  - Exclude student names from transaction details (only counts)
  - Include course titles but not student emails
  - Show full payout amounts (already received)
  - Show pending payouts with schedule
  - Tax-relevant information (dates for tax year organization)

- **Rate Limiting**:
  - Same as learner: 1 export per 7 days
  - Applied per instructor account
  - Admin can override for compliance requests

- **Database Schema**:

  ```
  data_export_requests table (shared with learner):
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - user_type: enum (learner, instructor)
  - status: enum (pending, processing, completed, failed, expired)
  - requested_at: timestamp with timezone
  - started_at: timestamp with timezone (nullable)
  - completed_at: timestamp with timezone (nullable)
  - format: enum (json, csv, both)
  - earnings_detail_level: enum (summary, detailed) (nullable, for instructor only)
  - file_size_bytes: bigint (nullable)
  - r2_url: string (nullable)
  - r2_key: string (nullable)
  - url_expires_at: timestamp with timezone (nullable)
  - download_count: integer (default 0)
  - first_downloaded_at: timestamp with timezone (nullable)
  - error_message: text (nullable)
  - ip_address: string
  - requested_email: string
  - qstash_message_id: string (nullable)
  ```

- **Email Notification**:
  - Subject: "Your Mentor Instructor Data Export is Ready"
  - Content:
    - Personal greeting
    - Download link with button
    - Expiration notice (7 days)
    - Note about video files not included
    - How to use earnings data
    - Support contact
  - Sent to requested_email

- **Error Handling**:
  - Same as learner: max 3 retry attempts
  - Exponential backoff between retries
  - Email notification on failure
  - Support contact provided for failed exports

- **Security**:
  - No API keys or sensitive tokens in export
  - IP addresses anonymized
  - No student personal information beyond course enrollment
  - Earnings data not shared publicly
  - R2 signed URLs with short expiration
  - Access logging for audit trail

## Acceptance Criteria

- [ ] Data Export button present in Instructor Dashboard Settings
- [ ] Export form shows instructor-specific categories
- [ ] Clear note that video files NOT included
- [ ] Earnings detail level preference (summary/detailed) available
- [ ] Rate limiting enforces 1 export per 7 days per instructor
- [ ] Estimated completion time shown (4 hours suggested)
- [ ] data_export_requests table properly tracks instructor exports
- [ ] JSON export includes all 7 instructor-specific categories
- [ ] Course metadata includes outline but not video URLs
- [ ] Earnings data includes transaction details and payouts
- [ ] Team members list included with permissions
- [ ] CSV files generated for profile, courses, earnings, payouts, community
- [ ] ZIP file created with correct instructor structure
- [ ] File uploaded to R2 with signed URL
- [ ] Email notification sent with download link
- [ ] Export status page shows previous requests
- [ ] Failed exports show error and support contact
- [ ] Rate limit message accurate for instructors
- [ ] Admin can override rate limit
- [ ] Download count tracked
- [ ] IP address recorded
- [ ] Earnings detail level preferences respected
- [ ] Student names NOT included in transaction details
- [ ] Full earnings amounts shown (instructor's own data)
- [ ] Payout history complete with method and status
- [ ] Consent records included
- [ ] Team member data properly formatted
- [ ] Performance tested with instructors with many courses
- [ ] Data accuracy verified for earnings calculations

## Dependencies

- **Data Export - Learner** - shared ZIP/R2 infrastructure
- **Background Jobs (QStash)** - asynchronous processing
- **Email Service** - notification emails
- **Cloudflare R2** - file storage (shared)
- **Instructor Database Schema** - proper foreign keys

## Technical Notes

- Reuse ZIP generation handler from learner export (add user_type param)
- R2 key naming: `exports/instructor/[user_id]/[timestamp].zip`
- Earnings queries require proper date range filtering (all-time by default)
- Test with instructors who have hundreds of courses and thousands of transactions
- Earnings data export useful for tax reporting, document for users
- Consider adding "Tax Year Summary" helper in earnings export
- Include payout method info for accounting (bank transfer, PayPal, etc.)
- Anonymize IPs in activity log
- Team member data should not include personal emails (only names/roles)
- Consider separate bulk export option for admins (future)
- CSV files should maintain referential integrity (course IDs, team member IDs)
- Earnings CSV useful for importing to accounting software
- Document expected file sizes for instructors (for download planning)
- Create data dictionary in README explaining all fields
- Consider encryption for earnings data (future enhancement)
- Test with various character sets in course titles/descriptions
- Ensure dates are consistently formatted (ISO 8601)
- Provide sample export in documentation
- Monitor job execution time for performance optimization
- Consider progress notifications if processing > 6 hours
- Implement instructor-specific cleanup cron job for old exports
