# Learner Profile Page - Web

## Description

Create a comprehensive Learner Profile and Settings page for the web-learner application. The page displays user profile information (name, avatar, bio, country, language preference), enrolled courses with progress indicators, subscription status and management links, notification preferences, language preference selector, data export request functionality, account deletion request functionality, and logout button. Design must be responsive and match the mobile profile page implementation (milestone 14, task 13). Include edit profile form with client and server-side validation. Implement secure password change functionality with current password verification. The page serves as the central hub for user account management and personalization settings.

## Affected Apps/Packages

- web-learner (web app)
- backend API (user service, auth service)
- stripe-integration (subscription management)
- design-system (responsive components)
- analytics-adapter (event tracking for profile interactions)

## API Endpoints

- `GET /api/users/:userId` - Fetch user profile details
- `PUT /api/users/:userId` - Update user profile information
- `POST /api/auth/change-password` - Change user password
- `POST /api/auth/verify-password` - Verify current password
- `POST /api/users/:userId/export-data` - Initiate GDPR data export
- `POST /api/users/:userId/delete-account` - Request account deletion
- `GET /api/users/:userId/enrollments` - Fetch enrolled courses with progress
- `GET /api/subscriptions/:userId` - Fetch subscription status
- `POST /api/subscriptions/customer-portal` - Create Stripe customer portal session
- `PUT /api/users/:userId/notification-preferences` - Update notification settings
- `GET /api/notifications/preferences` - Fetch current notification settings

## Requirements

### Page Structure & Layout

- Responsive design: desktop (1200px+), tablet (768px-1199px), mobile (< 768px)
- Two-column layout on desktop: left sidebar (navigation/menu) + right content area
- Single-column stack on mobile/tablet
- Sticky header with user name and logout button
- Navigation sidebar with sections:
  - Profile Information
  - My Courses
  - Subscription & Billing
  - Notification Preferences
  - Account Settings
  - Privacy & Security
  - Help & Support (link to FAQ/support portal)

### Profile Information Section

- Display user avatar (image upload with preview)
- Edit button to open edit profile modal/form
- Show profile fields:
  - Full name (first + last name)
  - Email address (read-only, with option to verify)
  - Bio/About section (optional text, max 500 chars)
  - Country (dropdown or searchable select)
  - Date joined (display only, non-editable)
  - Profile completeness indicator (% filled)
- Profile avatar upload:
  - Accept image formats: JPEG, PNG, WebP (max 5MB)
  - Image cropping tool (optional, nice-to-have)
  - Auto-resize to 200x200px after upload
  - Show fallback avatar (initials) if not provided

### Edit Profile Form

- Modal or dedicated form page with:
  - First Name input (required, max 50 chars, validation)
  - Last Name input (required, max 50 chars, validation)
  - Bio textarea (optional, max 500 chars, character counter)
  - Country dropdown (required, all countries listed)
  - Language preference dropdown (English, Spanish, French, etc.)
  - Avatar upload field
- Client-side validation:
  - Required fields marked clearly
  - Real-time validation feedback (error messages)
  - Character counter for bio and name
  - Prevent submit if validation fails
- Server-side validation:
  - Validate all fields on API endpoint
  - Sanitize text inputs (prevent XSS)
  - Verify user has permission to update (own profile only)
  - Rate limit: max 10 profile updates per hour per user
- Save button with loading state
- Cancel button to close form without saving
- Success toast message on save
- Error handling with specific error messages (e.g., "Email already in use")

### My Courses Section

- Display grid/list of enrolled courses:
  - Course thumbnail image (course cover)
  - Course title
  - Instructor name
  - Course category badge
  - Progress bar (% of lessons completed)
  - Completion status badge (In Progress, Completed, Not Started)
  - Last accessed date (e.g., "Accessed 2 days ago")
  - Link to resume course (button or card click)
- Filter/sort options (optional but nice-to-have):
  - Filter by status (In Progress, Completed, Not Started)
  - Sort by (Recently Accessed, Course Title, Progress)
- Pagination: show 6-12 courses per page
- Empty state: "You have no enrolled courses. Browse courses." with CTA button
- If user has > 1000 courses (unlikely): implement virtual scrolling or pagination
- Course card interactions:
  - Click card to go to course detail page
  - "Resume" button if in progress
  - "View Certificate" link if completed
  - "Drop Course" button with confirmation modal (if allowed per business rules)

### Subscription & Billing Section

- Display current subscription status:
  - Subscription plan name (e.g., "Pro Plan", "All-Access", "Free")
  - Billing cycle (Monthly, Annual)
  - Renewal date (e.g., "Renews on March 15, 2024")
  - Current price or "Free Plan" badge
  - Auto-renewal status (Enabled/Disabled)
- Subscription management:
  - "Manage Billing" button → opens Stripe Customer Portal (secure, pre-authenticated)
    - User can update payment method, view invoices, change billing cycle
    - Initiated via API: `POST /api/subscriptions/customer-portal`
    - Opens in new window/modal (Stripe hosted page)
  - "Cancel Subscription" button (if subscribed) → confirmation → initiates cancellation
  - "Upgrade Plan" button (if free user) → navigate to pricing/upgrade page
  - "View Billing History" link → list of past invoices with download links
- Billing history table:
  - Invoice date
  - Invoice amount
  - Status (Paid, Pending)
  - Download link (PDF)
  - Pagination: 10 invoices per page
- If subscription recently expired: warning banner "Your subscription has expired"
- Integration with Stripe: verify authentication before allowing portal access

### Notification Preferences Section

- Notification categories with toggle switches:
  - Email notifications enabled/disabled
    - Subcategories: Course updates, New instructor messages, Payment receipts, Promotions
  - In-app notifications enabled/disabled
  - Push notifications (mobile only, not applicable on web, but keep structure)
- Per-course notifications (advanced, optional):
  - Checkbox to select which enrolled courses to receive notifications from
  - Bulk actions: "Notify all" / "Notify none"
- Frequency selection:
  - Daily digest (send all notifications once daily)
  - As it happens (real-time notifications)
  - Weekly digest
- Save preferences button
- Success message when preferences saved
- Preferences persist on backend: `PUT /api/users/:userId/notification-preferences`

### Language Preference Section

- Dropdown selector with supported languages: English, Spanish, French, German, etc.
- Display current language selection
- Save button (or auto-save)
- Note: changing language preference triggers app reload/language switch
- Stored in user profile: `language_preference` field
- Coordinate with i18n system in app for consistency

### Privacy & Security Section

- **Password Change**:
  - "Change Password" button → opens form in modal
  - Form fields:
    - Current Password (masked input, required)
    - New Password (masked input, required, with strength indicator)
    - Confirm New Password (masked input, required)
  - Validation:
    - Current password must be correct (server-side verification)
    - New password must meet security requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    - New password cannot be same as current password
    - Confirm password must match new password
  - Error handling: specific error messages (e.g., "Incorrect current password")
  - Success message: "Password changed successfully"
  - API endpoint: `POST /api/auth/change-password` with current + new password (HTTPS only)
  - Rate limit: max 5 password changes per day per user

- **Two-Factor Authentication (2FA)** (if implemented):
  - "Enable 2FA" / "Disable 2FA" button
  - Setup flow: QR code generation, seed backup codes, verification
  - Not required for MVP, but design for future inclusion

- **Connected Apps/Sessions**:
  - Show list of active login sessions (browser/device/location)
  - Ability to logout other sessions ("End Session" button)
  - Show last activity timestamp per session
  - API: `GET /api/auth/sessions`, `POST /api/auth/sessions/:sessionId/logout`

### Data Export (GDPR)

- "Request Data Export" button
- Click triggers: explanation modal → "Confirm Export" button
- Backend initiates data export job:
  - Fetch all user data (profile, courses, progress, payments, messages)
  - Generate JSON file
  - Email download link to user (valid for 7 days)
  - API: `POST /api/users/:userId/export-data`
- Status: "Export requested" → after complete: "Download link sent to [email]"
- Note: "You'll receive an email with a download link within 24 hours"

### Account Deletion (GDPR)

- "Delete Account" button (red/warning color)
- Click triggers: confirmation modal with warnings:
  - "This action is permanent"
  - "All your data will be deleted"
  - "You cannot undo this action"
  - "You will need to create a new account to continue"
- Require user to:
  - Type confirmation text: "DELETE MY ACCOUNT" (case-sensitive)
  - Re-enter password to confirm identity
  - Check checkbox: "I understand this is permanent"
- Only then enable "Permanently Delete Account" button
- On confirm:
  - Show loading state
  - Send: `POST /api/users/:userId/delete-account`
  - Backend job: delete all user data (async, within 30 days per GDPR)
  - Redirect to homepage after successful deletion
  - Success message: "Your account has been deleted. We're sad to see you go!"

### Logout Button

- Prominent logout button (sticky header or footer)
- Clicking triggers logout:
  - Clear auth tokens (localStorage, cookies)
  - Call API: `POST /api/auth/logout` (for session invalidation)
  - Redirect to login/homepage
- Confirmation optional but recommended: "Are you sure you want to logout?"

### Responsive Design

- Desktop (1200px+):
  - Two-column layout: sidebar (25%) + content (75%)
  - Course grid: 3 columns
  - Form modals: centered overlay
  - All sections visible without heavy scrolling
- Tablet (768px-1199px):
  - Collapse sidebar to hamburger menu or stack vertically
  - Course grid: 2 columns
  - Full-width forms
  - Touch-friendly button sizes (min 44px)
- Mobile (< 768px):
  - Full-width single column
  - Sidebar collapses to bottom tab/drawer navigation
  - Course grid: 1 column or 2 columns (depending on space)
  - Larger touch targets (min 48px)
  - Larger text and spacing
  - Modals take full screen on mobile
- Test responsiveness on common breakpoints: 1920px, 1200px, 768px, 375px

### Performance & UX

- Page load: use skeleton loaders for initial content (profile, courses, subscription)
- Optimize images: use WebP format, lazy loading for course thumbnails
- Profile avatar: use CDN with caching (1 year expiry)
- Prefetch Stripe customer portal session to reduce latency
- Debounce form inputs to prevent excessive validation/API calls
- Persist unsaved form state (localStorage) to recover if browser closes
- Add breadcrumbs: Home > Profile
- Loading states: show spinner/skeleton for async operations
- Error states: show error messages with retry buttons
- Empty states: clear CTA buttons guiding users to next action
- Analytics: track profile interactions (form submit, export request, etc.)

### Accessibility (a11y)

- WCAG 2.1 AA compliance
- Semantic HTML: use `<form>`, `<label>`, `<button>`, `<section>`
- ARIA labels for form fields and buttons
- Keyboard navigation: Tab through all interactive elements in logical order
- Focus indicators: visible outline on focused elements
- Color contrast: min 4.5:1 for text, 3:1 for large text
- Modals: trap focus inside modal (Tab stays within modal)
- Form validation: announce errors to screen readers
- Image alt text: describe avatars and course thumbnails
- Test with screen reader (NVDA, JAWS, VoiceOver)

### Security

- All password inputs use `type="password"` (masked)
- Verify user identity before allowing account deletion (require password re-entry)
- Rate limit sensitive endpoints (password change, delete account, export data)
- HTTPS only: ensure all requests are encrypted
- CSRF protection: include CSRF token in forms
- No sensitive data in localStorage beyond auth token
- Sanitize user input to prevent XSS attacks
- Validate file uploads (avatar image only, max 5MB)
- Verify user owns profile before allowing updates (check auth context)

## Acceptance Criteria

- [ ] Profile information section displays: avatar, name, email, bio, country, date joined
- [ ] Edit profile form: first name, last name, bio, country, language, avatar upload
- [ ] Client-side validation: required fields, character limits, email format
- [ ] Server-side validation: sanitization, permission checks, rate limiting
- [ ] Save profile changes: API call, success toast, error handling
- [ ] My Courses section: grid/list with progress bars, status badges, last accessed
- [ ] Filter/sort courses (optional): by status, by date accessed, by title
- [ ] Course card interactions: click to open, resume button, drop course option
- [ ] Pagination: courses pagination if > 12 courses
- [ ] Subscription section: plan name, billing cycle, renewal date, status
- [ ] "Manage Billing" button: opens Stripe Customer Portal (authenticated session)
- [ ] Billing history: invoice list with dates, amounts, download links
- [ ] Notification preferences: toggles for email, in-app, per-course options
- [ ] Language preference: dropdown to select language, auto-save
- [ ] Password change: current password verification, strength indicator, validation
- [ ] Password change rate limit: max 5 per day, enforced on backend
- [ ] Data export (GDPR): request button, confirmation modal, email with link
- [ ] Account deletion (GDPR): confirmation, password re-entry, "DELETE MY ACCOUNT" confirmation text
- [ ] Account deletion: async job to delete all user data within 30 days
- [ ] Logout button: clears auth tokens, invalidates session, redirects to homepage
- [ ] Logout confirmation: optional confirmation modal
- [ ] Responsive design: tested on 1920px, 1200px, 768px, 375px breakpoints
- [ ] Mobile experience: matches milestone 14, task 13 (mobile profile page)
- [ ] Skeleton loaders: for profile, courses, subscription sections
- [ ] Error handling: specific error messages, retry buttons
- [ ] Empty states: clear CTA buttons guiding users
- [ ] Analytics tracking: profile events tracked (form submit, export, delete)
- [ ] Accessibility: WCAG 2.1 AA, keyboard navigation, screen reader tested
- [ ] Form state recovery: unsaved changes persist in localStorage
- [ ] Security: passwords masked, HTTPS only, CSRF protection, no PII in logs
- [ ] File upload validation: image only, max 5MB, auto-resize to 200x200px
- [ ] Breadcrumbs: Home > Profile navigation
- [ ] Testing: unit tests for form validation, integration tests for API calls
- [ ] Documentation: component API, state management, API integration guide

## Dependencies

- React Hook Form (form state management)
- Zod or Yup (schema validation)
- React Query or SWR (server state management, API calls)
- Stripe.js (customer portal integration)
- Image cropper library (optional, e.g., react-easy-crop)
- Analytics adapter (milestone 13, task 13) for event tracking
- Design system components (Button, Input, Modal, Card, Grid)
- i18n/localization library (language preferences)
- Toast notifications library (success/error messages)
- React Router (navigation to courses, pricing)

## Technical Notes

- Consider lazy loading courses section if user has many enrolled courses (1000+)
- Use Stripe Customer Portal for billing: more secure, always up-to-date with Stripe UI changes
- Password hashing: use bcrypt or argon2 on backend (never store plain text)
- Stripe portal URL: get from `POST /api/subscriptions/customer-portal` endpoint (server-side session creation)
- Avatar caching: use CDN with cache busting (append version query param on update)
- For large datasets (courses > 100): implement infinite scroll or cursor-based pagination
- Monitor password change endpoint for brute force attacks: implement rate limiting
- GDPR compliance: ensure data export includes all personal data user has generated
- GDPR compliance: ensure account deletion is irreversible (soft delete with 30-day grace period is acceptable)
- Notify user if suspicious account activity (e.g., failed login attempts)
- Store password change history: prevent reuse of last 5 passwords (configurable)
- Coordinate with email service: ensure transactional emails (password change, export ready) are sent immediately
- Test with slow network: ensure loading states appear correctly, forms don't double-submit
