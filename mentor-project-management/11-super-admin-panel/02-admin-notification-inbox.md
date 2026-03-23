# Admin Notification Inbox

## Description

Centralized notification system for super-admin users. Receives batched, grouped notifications about platform events: mentor applications, course publications, content reports, payout requests, and system alerts. Features grouped views, mark as read/unread, filtering by notification type, and timestamp sorting.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/notifications` — Fetch paginated notifications, with filters and sorting
- `GET /api/admin/notifications/count` — Unread notification count
- `POST /api/admin/notifications/:id/read` — Mark single notification as read
- `POST /api/admin/notifications/read-all` — Mark all notifications as read
- `POST /api/admin/notifications/:id/unread` — Mark notification as unread
- `GET /api/admin/notifications/summary` — Grouped summary (e.g., 3 mentor apps, 2 course reports)
- `DELETE /api/admin/notifications/:id` — Delete single notification

## Requirements

- Inbox displays notifications in reverse chronological order
- Notifications grouped by type with batch counts (e.g., "3 new mentor applications", "2 course reports")
- Notification types: MENTOR_APPLICATION, COURSE_PUBLISHED, CONTENT_REPORT, PAYOUT_REQUEST, SYSTEM_ALERT
- Each notification shows: type icon, title, preview text, timestamp (relative, "2 hours ago")
- Unread notifications have visual indicator (bold text, background highlight, or badge)
- Filter dropdown to show all/unread/by type
- Mark individual notifications read/unread via checkbox or button
- Mark all as read quick action
- Pagination (20 per page) or infinite scroll
- Notifications should persist across sessions
- Click notification to navigate to relevant page (e.g., mentor app → instructor approval page)
- Empty state message when no notifications
- Mobile-responsive inbox view

## Acceptance Criteria

- [x] Notifications display in reverse chronological order
- [x] Unread notifications visually distinguished (bold, highlight, badge)
- [~] Group notifications by type with collapsed/expandable groups (flat list with type filter; getSummary endpoint available)
- [x] Filter dropdown: All, Unread, Mentor Apps, Course Published, Content Reports, Payout Requests, System Alerts
- [x] Mark as read/unread toggles individual notification state instantly
- [x] Mark all as read quick action updates all visible notifications
- [x] Clicking notification navigates to relevant admin section
- [x] Unread badge on inbox icon in header shows count (60s polling)
- [x] Timestamps display relative time (2 hours ago) with hover showing full date/time
- [x] Pagination or infinite scroll with load more
- [x] Empty state displays when no notifications match filter
- [x] Performance: load < 1 second with pagination
- [x] Mobile: inbox readable on small screens, touch-friendly buttons

## Dependencies

- Database table: admin_notifications (id, admin_id, type, title, description, data_json, read_at, created_at)
- Real-time notification service (event listeners on mentor apps, course pub, reports, etc.)
- User authentication context to filter notifications by admin_id

## Technical Notes

- **Notification Types**: Enum in shared types package with values: MENTOR_APPLICATION, COURSE_PUBLISHED, CONTENT_REPORT, PAYOUT_REQUEST, SYSTEM_ALERT
- **Batch Logic**: Group notifications by type, show count (e.g., "3 new mentor applications"). Expand/collapse to show individual items
- **Real-time Updates**: Use WebSocket or Server-Sent Events (SSE) to push new notifications to connected admin clients
- **Read Status**: Store read_at timestamp (null = unread). Query unread_count as COUNT(\*) WHERE read_at IS NULL AND admin_id = current_admin
- **Data Storage**: Store reference IDs in data_json (e.g., {mentor_application_id: 123}) for navigation on click
- **Retention**: Keep notifications for 90 days, soft-delete or archive older ones
- **Notification Creation**: Trigger notifications on: instructor_applications status=pending, courses status=published, content_reports created, payouts created, system events
