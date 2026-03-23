# User Management CRUD

## Description

Comprehensive user management dashboard for all platform users. Admins can view, search, filter, and manage user accounts across all roles (learner, instructor). Features include detailed user profiles, subscription/payment history, activity tracking, user editing, and account deactivation/reactivation. Supports pagination, sorting, and CSV export.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/users` — List all users with pagination, filters, sorting
- `GET /api/admin/users/:id` — Get full user profile with related data
- `GET /api/admin/users/:id/courses` — List courses user is enrolled in or has taught
- `GET /api/admin/users/:id/subscriptions` — List active and past subscriptions
- `GET /api/admin/users/:id/payments` — List payment history
- `GET /api/admin/users/:id/activity` — List user activity (logins, course access, etc.)
- `PATCH /api/admin/users/:id` — Edit user profile (name, email, status, metadata)
- `POST /api/admin/users/:id/deactivate` — Deactivate user account
- `POST /api/admin/users/:id/reactivate` — Reactivate user account
- `GET /api/admin/users/export` — Export users list as CSV

## Requirements

- User list table with columns: name, email, role, signup date, last login, status (active/inactive), subscription status
- Search box: search by name or email (real-time or on-submit)
- Filters: by role (learner/instructor), status (active/inactive), signup date range, subscription status, country/region
- Sortable columns: name, email, signup date, last login
- Pagination: 50 users per page
- Detail view accessible via row click showing:
  - Profile: name, email, avatar, bio, country, phone, signup date, last login
  - Account status: active/inactive, deactivation reason (if applicable)
  - Courses: enrolled courses (learner), taught courses (instructor), with progress
  - Subscriptions: active subscription plan, renewal date, subscription history
  - Payments: payment history with method, amount, date, status
  - Activity timeline: logins, course accesses, payments, and other key events
- Edit user dialog: update name, email, bio, status, account metadata
- Deactivate button: requires confirmation, optional reason text, disables account access
- Reactivate button: re-enables deactivated account
- Export to CSV: download user list with filters applied
- Audit trail: all edits/deactivations logged to admin activity log
- Bulk actions: select multiple users and deactivate/reactivate
- Empty state when no users match filters

## Acceptance Criteria

- [ ] User list displays 50 per page with pagination controls
- [ ] Search by name/email filters results in real-time (with debounce)
- [ ] Filter by role, status, signup date, subscription status
- [ ] Columns sortable by name, email, signup date, last login
- [ ] Click row opens detail view without page reload (modal or side panel)
- [ ] Detail view shows profile, courses, subscriptions, payments, activity
- [ ] Edit user dialog allows updating name, email, bio
- [ ] Deactivate confirms action, requires optional reason, disables login
- [ ] Reactivate re-enables login, clears deactivation reason
- [ ] CSV export includes all visible columns with current filters applied
- [ ] Bulk select: checkbox on each row, "select all" option, bulk action buttons
- [ ] Bulk deactivate/reactivate actions with confirmation
- [ ] All actions logged to audit trail with admin_id, timestamp, changes
- [ ] Loading states on list and detail view
- [ ] Error handling with retry for failed actions
- [ ] Mobile: list is scrollable horizontally, detail view is readable

## Dependencies

- Database tables: users, user_profiles, user_subscriptions, payments, course_enrollments, user_activity
- Audit log system for tracking admin actions
- Authentication context for current admin user

## Technical Notes

- **User Status**: Values: active, inactive, suspended, deleted. Only active users can login
- **Deactivation**: Set users.status='inactive', store reason in user_metadata, revoke active sessions
- **Activity Tracking**: Pull from user_activity table; track: login, course_access, payment, profile_update
- **Last Login**: Store in users.last_login_at, update on every successful authentication
- **Subscriptions**: Query subscriptions table where status='active' OR status='past'; show renewal date for active
- **Payments**: Query payments table ordered by created_at DESC; show method (credit_card, paypal, etc.), status
- **Courses**: For learners, query course_enrollments; for instructors, query courses where instructor_id=user_id
- **Edit Audit**: Log changes to audit_logs with field names and old/new values
- **Export**: Use CSV library (papaparse, fast-csv); include name, email, role, status, signup_date, last_login
- **Bulk Operations**: Limit to 100 users per bulk action to prevent performance issues; use async job queue if needed
- **Search Optimization**: Index users table on (email, first_name, last_name) for fast searches
