# Instructor Profile Management (Post-Approval)

## Description

Implement the instructor/mentor profile editing and management interface for the web-mentor application. After an instructor's application is approved (Milestone 04: `14-instructor-approval-flow.md`), they need the ability to update their public profile information, teaching expertise, portfolio, social links, and account settings. The profile information is displayed on the learner-facing course detail pages and instructor bio sections. This task covers the ongoing profile management — not the initial application form (which is Milestone 04: `13-instructor-application-form.md`).

## PRD Reference

- Section 5.3 — Instructor/Mentor Web App: Instructors manage their profile, expertise, and public-facing information
- Section 5.3.2 — Course Management: Instructor bio displayed on course detail pages
- Section 4.4 — Mentor Persona: "experienced beauty professionals with 5+ years expertise, active on social media"

## Affected Apps/Packages

- `apps/web-mentor` (Next.js) — Profile management pages and forms
- `apps/api` (Hono) — Profile update endpoints
- `packages/db` — Users/profiles tables (Drizzle schema)
- `packages/validators` — Zod schemas for profile update payloads
- `packages/ui` — Shared form components
- Cloudflare R2 — Avatar and portfolio file storage

## API Endpoints

- `GET /api/instructors/me/profile` — Fetch current instructor profile
- `PUT /api/instructors/me/profile` — Update profile information
  - Request: `{ "firstName": "...", "lastName": "...", "bio": "...", "expertise": [...], "socialLinks": {...}, ... }`
  - Response: `{ "success": true, "profile": {...} }`
- `POST /api/instructors/me/avatar` — Upload/update profile avatar
  - Request: multipart/form-data with image file
  - Response: `{ "avatarUrl": "https://..." }`
- `DELETE /api/instructors/me/avatar` — Remove profile avatar
- `PUT /api/instructors/me/social-links` — Update social media links
- `GET /api/instructors/:instructorId/public-profile` — Public profile view (for learner-facing pages)

## Requirements

### 1. Profile Overview Page

- Accessible from mentor dashboard sidebar: "My Profile"
- Display current profile information in a read-only card view:
  - Avatar (with "Edit" overlay on hover)
  - Full name
  - Professional title / tagline (e.g., "Master Nail Technician & Educator")
  - Bio / About section
  - Expertise tags (e.g., "Nail Art", "Hair Coloring", "Makeup Artistry")
  - Years of experience
  - Social links (Instagram, YouTube, TikTok, LinkedIn, Website)
  - Location / Country
  - Languages spoken
  - Member since date
  - Verification status badge (Verified Instructor)
- "Edit Profile" button opens edit form
- "Preview Public Profile" button shows how learners see it

### 2. Edit Profile Form

- **Personal Information**:
  - First Name (required, max 50 chars)
  - Last Name (required, max 50 chars)
  - Professional Title / Tagline (optional, max 100 chars)
  - Bio / About (required, max 2000 chars, character counter, supports basic formatting)
  - Country (dropdown, required)
  - City (optional, max 100 chars)
  - Languages Spoken (multi-select: EN, ES, FR, RU + others)
- **Expertise & Specialization**:
  - Expertise Tags (multi-select from predefined categories + custom tags, max 10)
  - Years of Experience (number input, 1-50)
  - Specialization areas (checkboxes: Nail Art, Hair, Makeup, Skincare, etc.)
- **Social Links**:
  - Instagram URL (validated format)
  - YouTube URL (validated format)
  - TikTok URL (validated format)
  - LinkedIn URL (validated format)
  - Personal Website URL (validated format)
  - All optional; show icon indicators for populated links
- **Avatar Upload**:
  - Accept: JPEG, PNG, WebP (max 5MB)
  - Preview before upload
  - Auto-resize to 400x400px
  - Crop tool (square crop)
  - Fallback: initials avatar if none uploaded
  - Upload to R2 via signed URL
- Client-side validation with real-time feedback
- Server-side validation with sanitization (prevent XSS)
- Save button with loading state
- Cancel button discards unsaved changes (with confirmation if changes exist)
- Success toast: "Profile updated successfully"

### 3. Profile Completeness Indicator

- Show profile completeness percentage (e.g., "Profile 75% complete")
- Checklist of what's missing:
  - ☑ Avatar uploaded
  - ☑ Bio filled out
  - ☐ Add at least 3 expertise tags
  - ☐ Add social media links
  - ☐ Add professional title
- Encourage 100% completion for better discoverability

### 4. Public Profile Preview

- "Preview as Learner" mode shows:
  - How the instructor's bio appears on course detail pages
  - Public profile card layout
  - Social links display
  - Course count and total students taught
- Side-by-side comparison: edit form + live preview

### 5. Notification Settings (Instructor-Specific)

- Notification preferences accessible from profile/settings:
  - New enrollment notifications (push + email)
  - New comment/question notifications (push + email)
  - Payout processed notifications (email)
  - Community activity notifications (push + email)
  - Platform announcements (email)
- Toggle switches per category
- GDPR compliance: Marketing/promotional opt-in/out; transactional always on
- Save preferences via API

### 6. Account Settings

- **Password Change**: Same flow as learner (current password → new password → confirm)
- **Connected Accounts**: Show OAuth connections (Google, Apple) with option to link/unlink
- **Data Export**: Link to request data export (GDPR Art. 20) — connects to Milestone 13: `06-data-export-instructor.md`
- **Account Deletion**: Link to request account deletion — connects to Milestone 13: `04-account-deletion-instructor.md`
- **Logout**: Clear session and redirect

### 7. Activity Log Integration

- "Recent Activity" section on profile page
- Shows last 10 actions by the instructor (course edits, publishes, community posts)
- Link to full activity log (Milestone 10: `10-activity-logs-mentor.md`)

## Acceptance Criteria

- [ ] Profile overview page displays all instructor information
- [ ] "Edit Profile" opens form with pre-populated current values
- [ ] All form fields validate client-side (required, max length, URL format)
- [ ] Server-side validation and sanitization on API endpoint
- [ ] Avatar upload: accepts JPEG/PNG/WebP, max 5MB, auto-resize, preview
- [ ] Avatar stored on R2 with CDN caching
- [ ] Expertise tags: multi-select with predefined + custom (max 10)
- [ ] Social links: URL format validation for each platform
- [ ] Profile completeness indicator with checklist
- [ ] "Preview as Learner" shows public-facing profile view
- [ ] Notification preferences with toggle switches per category
- [ ] GDPR-compliant notification settings (marketing opt-in/out)
- [ ] Password change with current password verification
- [ ] Data export and account deletion links functional
- [ ] Success/error toasts on save
- [ ] Unsaved changes warning on navigation away
- [ ] Rate limit: max 10 profile updates per hour
- [ ] Responsive design: desktop-optimized for mentor dashboard
- [ ] i18n: All strings use translation keys
- [ ] Audit log entry created on profile update
- [ ] Analytics event tracked: `instructor_profile_updated`

## Dependencies

- Milestone 04: `13-instructor-application-form.md` (initial profile data)
- Milestone 04: `14-instructor-approval-flow.md` (profile accessible only after approval)
- Milestone 02: `02-users-profiles-tables.md` (database schema)
- Milestone 13: `04-account-deletion-instructor.md` (deletion flow)
- Milestone 13: `06-data-export-instructor.md` (export flow)
- Milestone 10: `10-activity-logs-mentor.md` (activity integration)
- Cloudflare R2 for file storage
- Design system components

## Technical Notes

- Profile updates should invalidate cached instructor data on course detail pages
- Use R2 signed URLs for avatar upload (direct browser-to-R2 upload for performance)
- Bio field: consider basic markdown support (bold, italic, links) or plain text only
- Social links: validate URL format and optionally verify the link is accessible
- Expertise tags: sync with admin-managed category/tag system (Milestone 11: `08-category-tag-management.md`)
- Public profile data served via a separate read-optimized endpoint with Redis caching
- Profile changes logged in audit trail with before/after snapshots
