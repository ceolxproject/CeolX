# Login as Mentor (Impersonation)

## Description

Super-admin impersonation feature allowing admins to preview mentor (instructor) experience. Requires justification text, creates separate audit trail, grants full access to mentor dashboard and course content, maintains visual indicator showing impersonation is active, and enforces time-limited sessions.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js), `apps/mentor-dashboard` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `POST /api/admin/impersonate/:user_id` — Start impersonation session with justification text
- `GET /api/admin/impersonate/verify` — Verify current impersonation session is valid
- `POST /api/admin/impersonate/end` — End impersonation session
- `GET /api/admin/impersonate/audit/:session_id` — Get audit trail for impersonation session

## Requirements

- Impersonation button on user detail page (only visible for instructor users)
- Modal/dialog prompts admin for justification text before impersonation (required, min 10 characters)
- Creates temporary session token granting admin full access to instructor account
- Session is time-limited (default 30 minutes, configurable)
- Visual indicator in mentor dashboard header: "You are viewing as [Mentor Name] (Admin)" with distinct styling
- Exit/End Impersonation button in mentor dashboard visible at all times
- All actions taken during impersonation are audited with original admin_id
- Cannot impersonate other admins or super-admin accounts
- Impersonation logs include: admin_id, instructor_id, justification, start_time, end_time, actions_taken
- Session expires after time limit or manual end
- If session expires, redirect to login or mentor dashboard

## Acceptance Criteria

- [ ] Impersonation button appears on instructor user detail view
- [ ] Clicking impersonation button opens modal with justification text area
- [ ] Justification text is required (min 10 chars) before proceeding
- [ ] Post-impersonation, user is logged in as target instructor with full permissions
- [ ] Mentor dashboard displays clear impersonation indicator with instructor name
- [ ] Exit Impersonation button visible at all times during impersonation
- [ ] Admin can access all mentor features: dashboard, courses, students, analytics, etc.
- [ ] Session token generated with 30-minute expiry (or configured TTL)
- [ ] All actions during impersonation logged with original admin_id and justification
- [ ] Cannot impersonate other admins or super-admin users
- [ ] Session expires automatically after time limit (user redirected to login)
- [ ] Clicking Exit Impersonation returns admin to web-admin panel
- [ ] Audit trail queryable showing all impersonations with justification and actions
- [ ] Mobile: buttons and modal are touch-friendly and readable

## Dependencies

- Database tables: impersonation_sessions, audit_logs
- User authentication/session management system
- User detail view component in web-admin
- Mentor dashboard components in mentor-dashboard
- Current user context to store impersonation state

## Technical Notes

- **Session Management**: Create impersonation_sessions table with columns: id, admin_id, instructor_id, justification, started_at, expires_at, ended_at, session_token
- **Token Generation**: Create JWT or secure random token with claims: admin_id, instructor_id, is_impersonation=true, exp=now+30min
- **Visual Indicator**: Add banner component to mentor-dashboard header when impersonation is active, styling: background-warning or background-danger, show admin name
- **Session Validation**: On every request from mentor-dashboard, verify is_impersonation claim and that session is not expired
- **Action Audit**: Log all actions (course_publish, student_upload, etc.) with action_source='impersonation' and impersonation_session_id
- **Exit Impersonation**: Clear session token, log session.ended_at=now, redirect to web-admin page
- **Time Limit**: Use configurable ENV variable IMPERSONATION_SESSION_TTL_MINUTES (default 30)
- **Security**: Only super-admin users can impersonate instructors
- **Cannot Impersonate**: Check user.role != 'admin' and user.role != 'super_admin' before allowing impersonation
- **Justification Audit**: Store justification in audit log for compliance and accountability
- **Rate Limiting**: Max 5 impersonation sessions per admin per hour to prevent abuse
