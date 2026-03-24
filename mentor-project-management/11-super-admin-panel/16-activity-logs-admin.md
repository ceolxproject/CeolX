# Activity Logs (Admin)

## Description

Comprehensive searchable and filterable audit log system tracking all platform activities: user logins, course access, payments, content changes, and admin actions. Supports export to CSV, configurable retention period, and time-range filtering for compliance and investigation purposes.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/activity-logs` — Fetch paginated activity logs with filters
- `GET /api/admin/activity-logs/search` — Search logs by keyword
- `GET /api/admin/activity-logs/:id` — Get single log entry details
- `GET /api/admin/activity-logs/export` — Export logs as CSV
- `GET /api/admin/activity-logs/stats` — Get activity stats (logins per day, etc.)
- `PATCH /api/admin/settings/log-retention` — Configure log retention period

## Requirements

- Activity logs page with:
  - Large search box for keyword search (user name, email, action type, entity)
  - Advanced filters sidebar showing:
    - Date range picker (default: last 30 days)
    - Activity type: Login, Course Access, Payment, Content Change, Admin Action, System Event
    - User (searchable dropdown or input)
    - Entity type: User, Course, Payment, Subscription, Content
    - Status (if applicable): success, failed, pending
    - Admin user (if filtering by who performed action)
  - Activity logs table with columns:
    - Timestamp (date/time, sortable)
    - User (who performed action, with profile link)
    - Action (verb describing what happened)
    - Entity (what was affected)
    - Details (brief description)
    - Status (success/failed/pending)
  - Click row to expand/view full log entry details
- Full log entry view showing:
  - Timestamp
  - User (name, email, ID)
  - Action type
  - Entity type and ID
  - Full description/notes
  - Request/response data (JSON, optional)
  - IP address (if available)
  - User agent (if available)
  - Related users (if applicable)
- Pagination: 50 logs per page
- Sortable columns: timestamp, user, action, status
- Export to CSV: download filtered logs with all columns
- Search: real-time keyword search across user names, actions, descriptions
- Log retention settings:
  - Configure retention period (30, 60, 90, 180, 365 days, or infinite)
  - Show current storage size of logs
  - Auto-purge frequency
- Activity type examples:
  - Login: user logged in, logout, failed login, password reset
  - Course Access: course view, video play, course completion
  - Payment: payment made, subscription created, refund issued, coupon redeemed
  - Content Change: course published, course unpublished, video uploaded, content removed
  - Admin Action: user deactivated, course flagged, payout processed, coupon created
  - System Event: scheduled job ran, error occurred, alert triggered

## Acceptance Criteria

- [ ] Activity logs page loads with list of recent activities
- [ ] Search box searches across all text fields (real-time with debounce)
- [ ] Date range picker filters logs by timestamp (default last 30 days)
- [ ] Activity type filter shows: Login, Course Access, Payment, Content Change, Admin Action
- [ ] User filter: searchable dropdown or text input
- [ ] Entity type filter: User, Course, Payment, Subscription, Content
- [ ] Status filter: success, failed, pending
- [ ] All filters can be combined (AND logic)
- [ ] Columns sortable by timestamp, user, action, status
- [ ] Pagination works (50 per page)
- [ ] Click row to expand and show full log entry
- [ ] Full log entry shows: timestamp, user, action, entity, description, request/response data
- [ ] Export to CSV: download with all visible columns and current filters applied
- [ ] CSV includes: timestamp, user, action, entity, status, description
- [ ] Retention settings page shows configurable retention period (30-365 days or infinite)
- [ ] Retention settings show current log storage size
- [ ] Auto-purge configured (e.g., daily cleanup of logs older than retention period)
- [ ] Search performance: results < 1 second for 1M+ log entries
- [ ] Mobile: search and filters are usable, list is scrollable

## Dependencies

- Database table: activity_logs (indexed for performance)
- Search infrastructure (Elasticsearch, or native database search)
- File storage for CSV exports (optional, or stream directly)
- Scheduled job for log retention cleanup

## Technical Notes

- **Activity Log Schema**: Create activity_logs table with columns:
  - id (PK)
  - timestamp (indexed, high-cardinality)
  - user_id (FK to users, indexed)
  - action (enum or string, indexed)
  - entity_type (enum: user, course, payment, subscription, content, etc.)
  - entity_id (indexed)
  - description (text)
  - status (enum: success, failed, pending)
  - request_data (JSON, optional)
  - response_data (JSON, optional)
  - ip_address (string, optional)
  - user_agent (string, optional)
  - created_at (indexed)
- **Indexing Strategy**: Composite indexes on (created_at DESC, user_id), (action, created_at), (entity_type, entity_id, created_at) for fast filtering
- **Action Types**: Enum values: USER_LOGIN, USER_LOGOUT, FAILED_LOGIN, PASSWORD_RESET, COURSE_VIEW, VIDEO_PLAY, COURSE_COMPLETION, PAYMENT_CREATED, SUBSCRIPTION_CREATED, REFUND_ISSUED, COUPON_REDEEMED, COURSE_PUBLISHED, COURSE_UNPUBLISHED, VIDEO_UPLOADED, CONTENT_REMOVED, USER_DEACTIVATED, COURSE_FLAGGED, PAYOUT_PROCESSED, COUPON_CREATED, etc.
- **Event Logging**: On every significant action in the system, log to activity_logs table:
  - User auth service: user_login, user_logout, failed_login
  - Course service: course_published, course_unpublished, course_flagged
  - Video service: video_uploaded, video_deleted
  - Payment service: payment_created, refund_issued, coupon_redeemed
  - Subscription service: subscription_created, subscription_canceled
  - Admin service: user_deactivated, payout_processed
- **Search**: Use full-text search index on description, user name, action. Consider Elasticsearch for fast search on large datasets, or native PostgreSQL full-text search
- **Export**: Stream CSV to client or store in S3 and provide download link; include timestamp in filename
- **Retention Policy**: Scheduled job (daily) to delete logs older than retention_days setting
  - DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL retention_days DAY
- **Query Optimization**: Use WHERE clauses with indexed columns (created_at, user_id, action, entity_type) before pagination
- **Large Results**: For exports with many rows, use async job queue and email CSV link to admin
- **Privacy**: Consider what data to log (avoid logging passwords, tokens, sensitive data)
- **Performance**: Activity_logs table can grow large; consider partitioning by date (monthly or yearly)
- **Retention Settings Storage**: Store in admin_settings table with key='log_retention_days'
