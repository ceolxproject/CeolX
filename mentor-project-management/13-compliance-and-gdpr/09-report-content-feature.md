# Report Content Feature

## Description

Implement a content reporting system allowing users to report inappropriate, misleading, spammy, or harassing content across courses, instructor profiles, forum posts, and comments. Reports are queued for admin review with categorization and details. Complies with Apple App Store Guideline 1.2 (User-Generated Content and Curation).

Users can report courses, instructor profiles, forum posts, and comments with pre-defined categories and free-text description. Reports are reviewed by admins in a dashboard with moderation tools.

## Affected Apps/Packages

- **Web App** (Next.js) - report UI components
- **Mobile Apps** (iOS/Android) - native report UI
- **API Server** - report submission and management
- **Admin Dashboard** - report review interface
- **Email Service** - report confirmation and admin notification
- **Database** - content_reports table

## API Endpoints

- `POST /api/reports/create` - Submit content report
- `GET /api/reports/:id` - Get report details (admin only)
- `GET /api/admin/reports` - List reports for review
- `POST /api/admin/reports/:id/update-status` - Update report status
- `POST /api/admin/reports/:id/action` - Take moderation action
- `GET /api/reports/my-reports` - User's submitted reports (self-service)

## Requirements

- **Report Trigger Points**:
  - Course detail page: "Report Course" button (three-dot menu or dedicated button)
  - Instructor profile: "Report Profile" button
  - Forum post: "Report" option in post action menu
  - Comment: "Report" option in comment action menu
  - User profile (public): "Report Profile" option

- **Report Categories** (pre-defined):
  1. **Inappropriate Content**
     - Sexually explicit material
     - Violent or graphic content
     - Hate speech or discrimination
     - Harassment or bullying
  2. **Misleading Information**
     - False claims about effectiveness
     - Fake credentials
     - Dangerous misinformation
     - Misrepresented content
  3. **Spam**
     - Promotional spam
     - Repetitive posts
     - Unrelated content
     - Advertisement links
  4. **Harassment or Abuse**
     - Targeted harassment
     - Cyberbullying
     - Threats or intimidation
     - Doxxing attempts
  5. **Intellectual Property**
     - Copyright infringement
     - Trademark infringement
     - Unauthorized use of materials
  6. **Other**
     - Custom reason (requires description)

- **Report Form** (Modal/Sheet):
  - Content preview (title, author, snippet of content)
  - Category dropdown (required)
  - Description text field (required, min 20 chars, max 500 chars)
  - "Provide additional details" text area (optional, max 1000 chars)
  - Option to report anonymously (if not authenticated)
  - "Report" button (disabled until category + description filled)
  - "Cancel" button
  - Success confirmation: "Thank you. We'll review this report and take action if needed."
  - Option to view report status later

- **Report Status Tracking**:
  - User can view status of reports they've submitted
  - Statuses: submitted, under_review, action_taken, dismissed, resolved
  - Timeline shown (submitted date, action date if applicable)
  - User notified via email when report acted upon
  - Reason for dismissal provided (if dismissed)

- **Database Schema**:

  ```
  content_reports table:
  - id: UUID (primary key)
  - report_type: enum (course, instructor_profile, forum_post, comment, user_profile)
  - content_id: UUID (foreign key to reported content)
  - content_title: string (snapshot at time of report)
  - content_author_id: UUID (foreign key)
  - content_author_name: string (snapshot)
  - reporter_id: UUID (nullable for anonymous reports)
  - category: enum (inappropriate, misleading, spam, harassment, ip_infringement, other)
  - description: text (required, user-provided reason)
  - details: text (optional, additional context)
  - status: enum (submitted, under_review, action_taken, dismissed, resolved)
  - created_at: timestamp with timezone
  - submitted_ip_address: string (anonymized after 90 days)
  - user_agent: string
  - is_anonymous: boolean
  - reported_at: timestamp with timezone
  - first_reviewed_at: timestamp with timezone (nullable)
  - last_updated_at: timestamp with timezone
  - admin_id: UUID (nullable, admin who reviewed)
  - admin_action: enum (none, content_removed, account_suspended, account_warned, content_edited, other) (nullable)
  - action_reason: text (nullable)
  - action_taken_at: timestamp with timezone (nullable)
  - internal_notes: text (nullable, for admin use)
  - related_reports: UUID[] (array, for grouping similar reports)

  report_actions_log table:
  - id: UUID
  - report_id: UUID (foreign key)
  - admin_id: UUID
  - action: enum (status_updated, content_removed, account_warned, etc.)
  - timestamp: timestamp with timezone
  - details: jsonb (action-specific data)
  ```

- **Admin Review Dashboard** (`/api/admin/reports`):
  - List of pending reports sorted by severity/date
  - Filters:
    - Status (submitted, under_review, action_taken, dismissed)
    - Category (inappropriate, spam, harassment, etc.)
    - Report type (course, profile, post, comment)
    - Date range
    - Reporter (authenticated/anonymous)
  - Report card showing:
    - Content preview (title, snippet)
    - Author name and ID
    - Category and description
    - Reporter info (name if authenticated, otherwise "Anonymous")
    - Created date
    - Current status
    - Related reports count (if grouped)
  - Actions available:
    - "View Content" (link to actual content)
    - "View Reporter" (link to reporter profile, if authenticated)
    - "View Author" (link to reported user/instructor)
    - "Dismiss Report" (with reason dropdown)
    - "Mark as Reviewed" (without action)
    - "Take Action..." (dropdown for moderation)
    - "Add Internal Note"
    - "Link Similar Reports" (for grouping)

- **Admin Moderation Actions**:
  - **No Action Required**: Dismiss with reason (reason: "false_report", "already_addressed", "content_acceptable", "user_request", "other")
  - **Warn User**: Send warning email to content author, flag account
  - **Remove Content**: Delete/hide the reported content
  - **Suspend Account**: Temporarily suspend reported user's account (1 week to 30 days)
  - **Ban Account**: Permanently ban user from platform
  - **Edit Content**: Edit content to remove problematic parts (for posts/comments)
  - **Other**: Custom action with description

- **Reporter Notifications**:
  - Email sent when report submitted: "We've received your report and will review it"
  - Email sent when action taken: "Thank you for reporting. We've taken action and removed the content."
  - Email sent when dismissed: "We reviewed your report and determined it doesn't violate our guidelines. Here's why: [reason]"
  - Email sent when user has multiple reports against them: "Due to multiple reports, we've suspended this account for 7 days"
  - Notifications do not reveal other reporters (privacy)

- **Content Author Notifications** (if action taken):
  - Email: "Your content has been removed for violating community guidelines"
  - Email: "Your account has been suspended for [duration] due to [reason]"
  - Email: "Your content has been edited for violating community guidelines"
  - Email includes: reason, appeal process, support contact
  - Can appeal action (separate flow, reviewed by senior admin)

- **Apple App Store Compliance** (Guideline 1.2):
  - Report mechanism clearly visible and accessible
  - Option to report without creating account (anonymous)
  - Categories cover common issues (harassment, IP, etc.)
  - Response to reports in reasonable timeframe (30 days SLA)
  - Actions documented for consistency
  - Ability to appeal moderation actions
  - Support contact for users contesting removal

- **Spam Detection & Anti-Abuse**:
  - Rate limit: max 5 reports per user per day
  - Detect multiple reports of same content (flag as priority)
  - Detect user reporting own content (warn)
  - Detect report flooding (max 20 reports per minute globally)
  - Verify reporter is not the content author

- **Appeal Process**:
  - Content author can appeal removal/suspension
  - Appeal form in email or account settings
  - Appeal reviewed by different admin (not original reviewer)
  - SLA: 14 days for appeal decision
  - Notification of appeal outcome via email

- **Metrics & Reporting**:
  - Reports per category (weekly)
  - Action rate (% of reports that result in action)
  - Average review time (SLA)
  - Repeat offenders (users with multiple infractions)
  - False report rate (dismissed / total)
  - Common violation types

## Acceptance Criteria

- [ ] Report button visible on course pages, profiles, posts, comments
- [ ] Report modal/sheet shows content preview
- [ ] Category dropdown includes 6 options (inappropriate, misleading, spam, harassment, IP, other)
- [ ] Description field required (min 20 chars)
- [ ] Anonymous reporting option available for unauthenticated users
- [ ] Report submitted successfully to database
- [ ] Reporter receives confirmation email
- [ ] content_reports table created with all required fields
- [ ] Admin dashboard lists pending reports with filters
- [ ] Admin can view content and reporter details
- [ ] Admin can take actions (dismiss, warn, remove, suspend, ban)
- [ ] Action taken email sent to content author
- [ ] Dismissal email sent to reporter with reason
- [ ] Report status visible to reporter
- [ ] Internal notes can be added by admins
- [ ] Multiple reports can be linked/grouped
- [ ] Rate limiting prevents report flooding
- [ ] Report cannot be submitted for own content (validation)
- [ ] Appeals system functional (form, tracking, notifications)
- [ ] Metrics dashboard shows reports by category and action
- [ ] SLA tracking (30-day response time)
- [ ] Content author can appeal moderation action
- [ ] Appeal reviewed by different admin
- [ ] Related reports grouped automatically (same content, multiple reporters)
- [ ] IP address recorded (anonymized after 90 days)
- [ ] Audit log of all admin actions on reports
- [ ] False positive rate tracked
- [ ] Responsive design on mobile

## Dependencies

- **Community and Forum** - posting system for reports
- **User Profiles** - linking to reporters and authors
- **Email Service** - notifications to reporters and authors
- **IP Anonymization Cron** - anonymize report IPs after 90 days
- **Admin Dashboard** - report management interface
- **Authentication** - optional anonymous reporting

## Technical Notes

- Report type determines which foreign key to use (course_id, post_id, etc.)
- Content snapshot prevents showing deleted content to reporters
- Anonymous reports stored with reporter_id = NULL
- IP address useful for fraud detection (repeated reports from same IP)
- Use hashing on reporter + content_id to detect duplicate reports
- Implement exponential backoff if user reports too frequently
- Related reports can be found by grouping on content_id and status
- Admin actions should be reversible where possible (except content deletion)
- Archive reports after 2 years (keep for compliance)
- Consider ML/sentiment analysis for auto-categorization (future)
- Category enum should be easily extensible
- Report form should prevent multiple submissions (debounce)
- Consider report severity levels (low, medium, high, critical)
- Implement report trending (sudden spike in reports for one course)
- Test with various content lengths and special characters
- Ensure content preview doesn't expose sensitive data
- Apple App Store Guideline 1.2 requires clear appeal process
- Document moderation policy publicly in community guidelines
- Consider gamification: reward users for helpful reports (future)
- Implement report notification webhooks for third-party moderation
- GDPR: reporter data retained only as long as report is under review
- Consider bot detection for low-quality reports
- Implement moderation queue prioritization (harassment reports first)
