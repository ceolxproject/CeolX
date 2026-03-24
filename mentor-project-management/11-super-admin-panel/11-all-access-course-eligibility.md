# All Access Course Eligibility

## Description

Configuration interface for All Access subscription plan course eligibility. Admins include or exclude specific courses from All Access, preview impact on subscribers and learners, manage grandfathering rules (started courses retain access), and view audit trail of eligibility changes. Changes apply forward-only to new subscribers.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/all-access/courses` — List all courses with eligibility status
- `GET /api/admin/all-access/settings` — Get All Access plan settings
- `POST /api/admin/all-access/include/:course_id` — Include course in All Access
- `POST /api/admin/all-access/exclude/:course_id` — Exclude course from All Access
- `GET /api/admin/all-access/impact` — Preview impact of changes (active subs affected, in-progress learners)
- `POST /api/admin/all-access/apply-grandfathering` — Apply grandfathering rules
- `GET /api/admin/all-access/impact-preview` — Preview all-access impact before change
- `GET /api/admin/all-access/change-history` — View changelog of eligibility changes

## Requirements

- All Access eligibility dashboard showing:
  - Summary: total courses in All Access, total courses excluded, affected subscribers count
  - Toggle: enable/disable All Access feature entirely
- Courses list with columns: title, instructor, all-access eligible (yes/no toggle), students affected if removed, revenue impact
- Search/filter: by instructor, category, eligible status, revenue
- Include/exclude toggle: click to toggle course eligibility
  - If excluding: show impact preview (how many active All Access subscribers would lose access, which learners in progress)
  - Option to apply grandfathering (allow started learners to continue)
- Impact preview modal showing:
  - Active All Access subscribers affected
  - In-progress learners (enrolled, not completed) who would lose access
  - Estimated revenue impact (if excluding paid course)
  - Recommendation: apply grandfathering to minimize user churn
- Grandfathering settings:
  - Enable/disable grandfathering globally
  - Rule: learner who started (enrolled before change date) retains access even if course excluded
  - Exclude option per course: "Apply grandfathering" checkbox when excluding course
- Change history: log showing all include/exclude changes with admin_id, date, courses affected, grandfathering applied
- Audit trail: all changes logged
- Bulk actions: select multiple courses and include/exclude in bulk with impact preview

## Acceptance Criteria

- [ ] All Access eligibility dashboard displays with course list
- [ ] Course list shows all courses with eligible/not-eligible toggle
- [ ] Click toggle to include/exclude course
- [ ] Excluding course shows impact preview (subscribers and learners affected)
- [ ] Grandfathering option appears in impact preview
- [ ] Impact preview includes affected subscriber count, in-progress learner count, revenue impact
- [ ] Grandfathering checkbox: when checked, keeps in-progress learners' access
- [ ] Change history table shows past changes with course, admin, date, grandfathering status
- [ ] Audit trail logs all include/exclude actions with impact summary
- [ ] Bulk select multiple courses, exclude with single action and impact preview
- [ ] Summary card shows total eligible courses, total excluded, total subscribers affected
- [ ] All-Access feature toggle enable/disable works
- [ ] Changes apply only to new subscriptions (existing subscribers unaffected until next renewal)
- [ ] Grandfathering: learner who started course keeps access after course excluded from All-Access
- [ ] Mobile: list is scrollable, toggles are touch-friendly, impact preview is readable

## Dependencies

- Database tables: all_access_courses, all_access_eligibility_changes, subscriptions, course_enrollments
- Course and subscription management systems
- Audit log system

## Technical Notes

- **All Access Plan**: Special subscription_tier with all courses included by default initially
- **Eligibility Table**: Create all_access_courses table with columns: id, course_id, eligible, eligible_since, eligible_until (nullable)
- **Exclusion vs Inclusion**: Default to inclusion (all courses). Exclusions stored explicitly.
  - Query: SELECT courses.\* FROM courses LEFT JOIN all_access_courses aac ON (courses.id = aac.course_id) WHERE aac.course_id IS NULL OR aac.eligible = true
- **Impact Query**:
  - Affected subscribers: COUNT DISTINCT subscriptions.user_id WHERE subscription_tier.name='All Access' AND subscriptions.status='active' AND subscriptions.created_at < change_date
  - In-progress learners: COUNT DISTINCT course_enrollments.user_id WHERE course_enrollments.course_id=course.id AND course_enrollments.progress < 100 AND course_enrollments.created_at < change_date
- **Grandfathering**: Create all_access_grandfathering table with columns: id, user_id, course_id, granted_at, reason
  - When excluding course with grandfathering enabled, insert rows for all in-progress learners
  - In access check: if learner in all_access_grandfathering, grant access even if course.eligible=false
- **Change History**: Log to all_access_eligibility_changes table with: id, course_id, action (include/exclude), eligible_before, eligible_after, grandfathering_applied, changed_by, changed_at
- **Effective Date**: Changes apply immediately to new subscriptions; existing subscriptions respect old eligibility until renewal
  - Can implement using eligible_until timestamp if backdating changes
- **Bulk Operations**: Limit to 50 courses per bulk operation; validate impact for each before applying
- **Audit Trail**: Log all changes to audit_logs with admin_id, action type, course, impact summary
- **Notification**: Consider notifying affected subscribers if course excluded without grandfathering (optional)
