# Web Course Visibility Controls

## Description

Platform visibility configuration allowing admins to control which courses appear on web vs mobile-only. Provides per-course visibility toggle, bulk actions, and integration with course discovery pages. Enables strategic course positioning and device-specific catalog management.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js), `apps/web` (course catalog), mobile app (if applicable)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/courses/visibility` — List all courses with visibility settings
- `PATCH /api/admin/courses/:id/visibility` — Update course visibility
- `POST /api/admin/courses/visibility/bulk` — Bulk update visibility for multiple courses
- `GET /api/admin/courses/visibility/stats` — Get visibility stats (web vs mobile only courses)

## Requirements

- Course visibility dashboard showing:
  - Summary: total courses, visible on web, visible on mobile only
- Courses list with columns:
  - Course title
  - Instructor name
  - Enrollment count
  - Visibility status (Web, Mobile Only, Hidden)
  - Last modified (visibility changed date)
- Visibility toggle per course:
  - Dropdown or radio buttons: "Web", "Mobile Only", "Hidden"
  - Web: course appears on web and mobile
  - Mobile Only: course appears on mobile app only, not on web catalog
  - Hidden: course not visible on web or mobile catalog
- Search/filter:
  - Search by course title, instructor
  - Filter by visibility status (web, mobile only, hidden)
  - Filter by enrollment count range
- Bulk actions:
  - Select multiple courses (checkboxes)
  - Bulk visibility change: select new visibility status and apply to all selected
  - Show preview: "Setting X courses to Mobile Only will hide them from web catalog"
- Course detail integration:
  - On course detail/oversight page, show visibility status
  - Quick edit dropdown to change visibility
- Confirmation on change:
  - Changing to Mobile Only: confirm action, show impact (loses web visibility)
  - Changing to Hidden: confirm action, show impact (loses all visibility)
- Audit trail: log all visibility changes with admin_id, timestamp, old/new status
- Pagination: 50 courses per page

## Acceptance Criteria

- [ ] Visibility dashboard displays with summary and courses list
- [ ] Courses list shows title, instructor, enrollments, visibility, last modified
- [ ] Filter by visibility status (Web, Mobile Only, Hidden)
- [ ] Search by course title and instructor (real-time)
- [ ] Columns sortable by title, instructor, enrollments, visibility
- [ ] Click visibility dropdown to change status
- [ ] Changing to Mobile Only or Hidden shows confirmation with impact
- [ ] Confirmation requires explicit approval before changing
- [ ] After change, visibility status updates in list
- [ ] Bulk select: checkboxes, "select all" option, bulk action buttons
- [ ] Bulk visibility change applies to all selected courses
- [ ] Bulk change shows preview: "This will change X courses to Mobile Only"
- [ ] Audit trail logs all visibility changes with admin_id and timestamp
- [ ] Toast notifications confirm successful changes
- [ ] Pagination works (50 per page)
- [ ] Visibility respected in course discovery API (courses visible based on platform type)
- [ ] Mobile: list scrollable, visibility dropdown touch-friendly, bulk actions accessible
- [ ] On course detail page, visibility status visible and editable

## Dependencies

- Database table: courses (with visibility column or enum)
- Course discovery API (filters by visibility and platform type)
- Audit log system
- Web and mobile apps (respect visibility setting in catalog queries)

## Technical Notes

- **Visibility Field**: Add courses.visibility column with enum values: WEB, MOBILE_ONLY, HIDDEN
  - Default: WEB (all courses visible on web and mobile)
- **Discovery Queries**:
  - Web app: SELECT \* FROM courses WHERE visibility IN ('WEB') AND published = true
  - Mobile app: SELECT \* FROM courses WHERE visibility IN ('WEB', 'MOBILE_ONLY') AND published = true
  - Admin: SELECT \* FROM courses (all statuses)
- **Bulk Update**: Limit to 100 courses per bulk operation; use transaction to ensure atomic update
  - UPDATE courses SET visibility = ? WHERE course_id IN (...) AND visibility != new_visibility
- **Audit Log**: Log course_id, visibility_before, visibility_after, admin_id, timestamp
- **Impact Calculation**:
  - Web visibility change: show how many web visitors might be affected (optional analytics)
  - Mobile Only change: course still accessible on mobile, just not web
  - Hidden change: course fully hidden from catalog (but existing learners can still access if enrolled)
- **Confirmation Dialog**: Show course title, current visibility, new visibility, impact message, cancel/confirm buttons
- **UI Placement**: Visibility dropdown on each course row; can also be on course detail page under settings
- **Default**: Recommend all new courses default to WEB visibility
- **Notification**: Optional: notify instructor when visibility changes (informational, not blocking)
