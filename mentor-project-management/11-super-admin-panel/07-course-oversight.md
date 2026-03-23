# Course Oversight

## Description

Admin management interface for all courses on the platform. Admins can view courses in various statuses (published, unpublished, draft, archived), flag problematic content, remove or unpublish courses, filter and sort by status/instructor/category, and view detailed course analytics and metadata. Includes bulk actions and comprehensive audit trail.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/courses` — List all courses with pagination, filters, sorting
- `GET /api/admin/courses/:id` — Get full course details and analytics
- `GET /api/admin/courses/:id/videos` — List all videos in course
- `GET /api/admin/courses/:id/enrollments` — List student enrollments
- `POST /api/admin/courses/:id/flag` — Flag course as problematic with reason
- `POST /api/admin/courses/:id/unflag` — Remove flag from course
- `POST /api/admin/courses/:id/unpublish` — Unpublish course (draft state)
- `POST /api/admin/courses/:id/archive` — Archive course (hidden from catalog)
- `DELETE /api/admin/courses/:id` — Permanently delete course
- `GET /api/admin/courses/:id/flag-history` — Get flag and action history

## Requirements

- Course list table with columns: course title, instructor name, status (published/draft/unpublished/archived), enrolled students, revenue, created date, category
- Filters: by status, instructor, category, created date range, flagged status
- Search box: search by course title or instructor name
- Sortable columns: title, instructor, students, revenue, created date
- Pagination: 30 courses per page
- Course detail view showing:
  - Metadata: title, description, category, tags, thumbnail, language
  - Instructor: name, profile link
  - Content: video count, total duration, lesson count
  - Enrollment: total enrollments, active learners, completion rate
  - Revenue: total revenue, average price, refunds
  - Settings: visibility status, published date, updated date
  - Videos list with view count, watch time, completion rate
  - Flagged status with reason history
- Flag button: prompts for reason (dropdown + optional notes), marks course flagged
- Unflag button: removes flag status
- Unpublish button: moves published course to draft/unpublished state with optional reason
- Archive button: hides course from catalog but preserves data
- Delete button: requires confirmation, permanently removes course and enrollments
- Bulk actions: select multiple courses and flag/unpublish/archive
- Flagged indicator visible in list view (warning icon, color change)
- Empty state when no courses match filters

## Acceptance Criteria

- [ ] Course list displays 30 per page with pagination controls
- [ ] Filter by status (published/draft/unpublished/archived), instructor, category, flagged
- [ ] Search by course title and instructor name (real-time with debounce)
- [ ] Columns sortable by title, instructor, enrollments, revenue, date
- [ ] Click row or title opens detail view without page reload
- [ ] Detail view shows all metadata, content, enrollment, and revenue data
- [ ] Flag button opens modal with reason dropdown (plagiarism, explicit content, low quality, etc.) and optional notes
- [ ] Flag reason and notes logged to course.flag_history
- [ ] Flagged courses display warning icon in list view
- [ ] Unflag button removes flag, logs action
- [ ] Unpublish button requires confirmation, moves course to draft state
- [ ] Archive button hides course from catalog, keeps data intact
- [ ] Delete button requires confirmation, permanently removes course
- [ ] Bulk select: checkbox on each row, bulk flag/unpublish/archive actions
- [ ] Video list shows thumbnail, title, view count, watch time, completion %
- [ ] Enrollment list shows student name, enrollment date, progress, completion status
- [ ] All actions logged to audit trail
- [ ] Mobile: list is scrollable, detail view is readable

## Dependencies

- Database tables: courses, course_videos, course_enrollments, course_flags, audit_logs
- File storage service for course thumbnails
- Category/tag system

## Technical Notes

- **Course Status**: Enum: draft, published, unpublished, archived, deleted
- **Flag System**: Create course_flags table with columns: id, course_id, reason, notes, flagged_by, flagged_at, unflagged_by, unflagged_at
- **Flag Reasons**: Enum: PLAGIARISM, EXPLICIT_CONTENT, LOW_QUALITY, INCOMPLETE, COPYRIGHT_VIOLATION, MISINFORMATION, OTHER
- **Unpublish**: Set courses.status='unpublished', store reason, disable access for learners with in-progress enrollments (send notification)
- **Archive**: Set courses.status='archived', hide from catalog queries, but allow active learners to continue
- **Delete**: Mark courses.deleted_at=now (soft delete), cascade to enrollments (soft delete), preserve data for 90 days before hard delete
- **Revenue Calculation**: Sum payments where course_id=course.id, status=completed
- **Enrollment**: COUNT distinct user_id from course_enrollments where course_id=course.id and status=active
- **Completion Rate**: AVG(progress) from course_enrollments where course_id=course.id
- **Video Metrics**: Pull from video_analytics table (views, watch_time, completion_rate)
- **Bulk Operations**: Limit to 50 courses per bulk action; use async job queue
- **Audit Trail**: Log flag, unflag, unpublish, archive, delete with admin_id, reason, timestamp
- **Notification**: When unpublishing, notify active learners with reason
