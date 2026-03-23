# Instructor Approval Management

## Description

Workflow to review and approve/reject pending instructor applications. Admins review applicant profiles, portfolios, identity documents, and credentials. Supports approve/reject with feedback, email notifications, and batch operations. Maintains audit trail of decisions.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)
- Email: `packages/email-service` or similar

## API Endpoints

- `GET /api/admin/instructor-applications` — List pending applications with pagination
- `GET /api/admin/instructor-applications/:id` — Get full application details
- `POST /api/admin/instructor-applications/:id/approve` — Approve application, send email
- `POST /api/admin/instructor-applications/:id/reject` — Reject application with feedback
- `POST /api/admin/instructor-applications/batch-approve` — Bulk approve multiple IDs
- `POST /api/admin/instructor-applications/batch-reject` — Bulk reject multiple IDs
- `GET /api/admin/instructor-applications/:id/documents` — Get signed URLs for identity docs

## Requirements

- Pending applications list with columns: applicant name, email, application date, status
- Search/filter by name, email, date range, status (pending, approved, rejected)
- Sortable columns (name, date, status)
- Detailed application view showing:
  - Profile information (name, email, bio, website, social links)
  - Portfolio (list of portfolio items: projects, achievements, certifications)
  - Identity documents (photo ID, proof of address) with signed URLs for secure viewing
  - Teaching experience and qualifications
  - Proposed course topics/subjects
- Approve button: prompts for optional feedback/notes, approves and sends welcome email
- Reject button: requires feedback text, rejects and sends decline email
- Batch actions: select multiple applications and approve/reject in bulk
- Audit trail: track who approved/rejected and when
- Email templates for approval and rejection
- Toast/notification on action completion
- Rate limiting: prevent rapid-fire approvals

## Acceptance Criteria

- [ ] Pending applications list displays with pagination (25 per page)
- [ ] Search filters by name, email, date range
- [ ] Sort by name (A-Z), application date (newest/oldest), status
- [ ] Detail view loads full applicant profile without page refresh
- [ ] Portfolio items display with descriptions and links
- [ ] Identity documents load with signed URLs (expires after 1 hour)
- [ ] Approve action sends welcome email and marks application status=approved
- [ ] Reject action requires feedback text (min 20 chars), sends decline email
- [ ] Batch approve: select multiple rows, approve all with single action
- [ ] Batch reject: select multiple rows, reject all (each can have same or different feedback)
- [ ] Approval/rejection audit trail stored with admin_id and timestamp
- [ ] Email notifications sent asynchronously (no blocking on approval)
- [ ] Toast notification confirms action success
- [ ] Empty state message when no pending applications
- [ ] Mobile: list is scrollable, detail view is readable

## Dependencies

- Database tables: instructor_applications, instructor_application_documents, user_profiles, audit_logs
- Email service for sending approval/rejection emails
- File storage service (S3, GCS) for document URLs and signed URL generation
- User authentication context

## Technical Notes

- **Application Status**: Enum values: pending, approved, rejected, under_review
- **Documents**: Store file_path in database, generate signed URLs with 1-hour expiry for security
- **Audit Log**: Log every approval/rejection in audit_logs table with action='instructor_application_approved|rejected', admin_id, application_id, details (feedback text)
- **Email Templates**: Create templates for approval (welcome instructor, next steps) and rejection (provide feedback, opportunity to reapply)
- **Batch Operations**: Use transactions to ensure atomic batch approve/reject; if any fails, rollback all
- **Rate Limiting**: Allow max 10 approvals/rejections per minute per admin to prevent accidental spam
- **Notification to Applicant**: When approved, set user.role='instructor', send email with login link and onboarding steps
- **Portfolio Validation**: Ensure portfolio items have title, description, optional URL/image
- **Document Verification**: Request all required documents before allowing approval (photo ID required)
