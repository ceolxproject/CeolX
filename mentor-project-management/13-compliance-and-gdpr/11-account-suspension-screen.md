# Account Suspension Screen

## Description

Implement a clear, informative account suspension screen that displays when a suspended or banned user attempts to log in. The screen explains the reason for suspension, duration, and how to appeal. Users are prevented from accessing any content or community features while suspended.

This feature provides transparency and fair process for users facing account enforcement actions.

## Affected Apps/Packages

- **Web App** (Next.js) - suspension screen component
- **Mobile Apps** (iOS/Android) - native suspension screen
- **API Server** - account status checking
- **Authentication** - session handling for suspended users
- **Database** - account suspension tracking

## API Endpoints

- `GET /api/account/status` - Check account status (suspended/banned)
- `POST /api/account/suspension/appeal` - Submit appeal request
- `GET /api/account/suspension-details` - Get suspension info for display
- `POST /api/admin/account/suspend` - Admin suspend user
- `POST /api/admin/account/unsuspend` - Admin unsuspend user
- `GET /api/admin/suspensions` - List active suspensions

## Requirements

- **Suspension Detection**:
  - Check during login (before successful authentication)
  - Check before allowing any content access
  - Check on every API request for suspended users (who may have session)
  - account_status field in users table: enum (active, suspended, banned, deleted)
  - account_suspension_reason field: enum (repeated_violations, harassment, policy_violation, abuse_report, payment_fraud, other)
  - suspended_until field: timestamp (nullable for permanent bans)
  - suspended_at field: timestamp
  - suspended_by_admin_id field: UUID (admin who suspended)

- **Suspension Screen** (When suspended user logs in):
  - Displayed before login completes
  - Cannot be dismissed or skipped
  - Cannot navigate to other pages
  - Clear, professional design
  - Includes:
    1. **Title**: "Account Suspended"
    2. **Explanation**:
       ```
       Your Mentor account has been suspended due to:
       [Reason in plain language]
       ```
    3. **Duration**:

       ```
       This suspension expires on: [Date]
       Your account will be automatically reactivated at that time.

       OR (for permanent bans):
       This is a permanent suspension of your account.
       ```

    4. **Reason Details**:
       - Specific violation (e.g., "Posted harassment content", "Multiple policy violations")
       - Date of suspension
       - Number of days remaining (if temporary)
    5. **What's Restricted**:
       - Cannot access courses
       - Cannot participate in community/forums
       - Cannot create content
       - Cannot purchase courses
       - Existing enrollments become view-only (if applicable)
    6. **Appeal Option**:
       - Button: "Appeal This Suspension"
       - Text: "Believe this was a mistake? Submit an appeal below."
       - Link to support contact: "Contact support@example.com"
    7. **Additional Resources**:
       - Link to Community Guidelines
       - Link to Terms of Service
       - Link to Support Center
       - Email: support@example.com
       - Phone: +1-XXX-XXX-XXXX (if available)

- **Suspension Reasons** (User-friendly explanations):
  - **Repeated Violations**: "You've violated our Community Guidelines multiple times. Review the guidelines and appeal if you believe this is a mistake."
  - **Harassment**: "Your account was suspended for posting harassment or abusive content toward other users."
  - **Policy Violation**: "Your account was suspended for violating our Terms of Service. Review the terms and appeal if you disagree."
  - **Abusive Report**: "Your account was suspended following a report of abusive behavior. We investigate all reports seriously."
  - **Payment Fraud**: "Your account was suspended due to a payment-related issue. Contact support to resolve."
  - **Other**: "Your account was suspended. Contact support for more information."

- **Database Schema**:

  ```
  users table (additions):
  - account_status: enum (active, suspended, banned, deleted) (default: active)
  - account_suspension_reason: enum (repeated_violations, harassment, policy_violation, abuse_report, payment_fraud, other)
  - suspended_until: timestamp with timezone (nullable, null = permanent)
  - suspended_at: timestamp with timezone (nullable)
  - suspended_by_admin_id: UUID (nullable)
  - suspension_notes: text (nullable, admin use)

  account_suspensions table (audit log):
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - reason: enum
  - suspended_at: timestamp with timezone
  - suspended_by_admin_id: UUID
  - suspended_until: timestamp with timezone (nullable)
  - notes: text
  - status: enum (active, appealed, lifted, expired)
  - appeal_submitted_at: timestamp with timezone (nullable)
  - appeal_decision_at: timestamp with timezone (nullable)
  - appeal_approved: boolean (nullable)
  - appeal_response: text (nullable)
  - appeal_reviewer_id: UUID (nullable)
  ```

- **Appeal System**:
  - Form appears on suspension screen
  - Fields:
    - "Why should we reconsider?" (required, text area, 50-500 chars)
    - "Additional information" (optional, text area, max 1000 chars)
    - Email contact (pre-filled from account, can change)
  - Submit button creates appeal record
  - Confirmation message: "Thank you for your appeal. We'll review it and contact you within 48 hours."
  - User cannot submit multiple appeals for same suspension (1 appeal max)
  - Appeal goes to admin review queue with high priority

- **Admin Appeal Review** (`/api/admin/appeals`):
  - Dashboard showing pending appeals
  - Appeal details:
    - User who submitted appeal
    - Original suspension reason
    - User's appeal text
    - Suspension date and duration
    - Original admin action
  - Actions:
    - "Approve Appeal" (unsuspends account)
    - "Deny Appeal" (keep suspension, provide explanation)
    - "Request More Info" (send email asking for clarification)
  - Response email sent to user with decision
  - SLA: 48 hours to respond
  - Audit log tracks all appeal decisions

- **Unsuspension**:
  - Automatic: When suspended_until timestamp reached
  - Manual: Admin approves appeal
  - Automatic: Support team manually lifts suspension
  - Email sent to user: "Your account suspension has been lifted. You can now access your account."
  - Account status set to "active"
  - suspended_until cleared
  - Audit entry created

- **Permanent Bans**:
  - suspended_until set to NULL (null = permanent)
  - "Permanent suspension of your account" message displayed
  - Appeal still available, but with different messaging
  - Admin approval required to lift permanent ban
  - Very rare, only for serious violations (repeated harassment, abuse, fraud)

- **Content Access During Suspension**:
  - Cannot log in (blocked at authentication)
  - Active sessions invalidated (if already logged in)
  - API requests return 403 Forbidden with suspension status
  - Error message: "Your account is suspended. [Reason]. Appeals available at: [link]"
  - Can view suspension details without logging in (with email/username verification)

- **Mobile App Specifics**:
  - Suspension screen shown as modal (cannot swipe away)
  - Uses native navigation, not web view
  - Appeal form uses native text input
  - Deep linking to suspension details shows screen
  - App doesn't allow logout (forces deal with suspension)

- **Notifications**:
  1. **Suspension Email** (sent immediately):
     - Reason for suspension
     - Duration (or permanent)
     - Appeal instructions
     - Support contact
     - Community guidelines link

  2. **Appeal Received Email**:
     - Confirmation that appeal was received
     - Expected response timeframe (48 hours)
     - Reference number for tracking

  3. **Appeal Approved Email**:
     - Account suspension lifted
     - Can log in again immediately
     - Apologetic tone (maybe overdue, but fair process)

  4. **Appeal Denied Email**:
     - Appeal was reviewed and denied
     - Brief explanation of decision
     - Offer to contact support if questions
     - Resubmission guidelines (wait X days before reappeal)

- **Instructor-Specific Considerations**:
  - Suspended instructors cannot create courses
  - Existing courses become "Author Suspended" (read-only for learners)
  - Learners notified of course suspension (same as instructor deletion)
  - Payouts suspended until unsuspension
  - Earnings still calculated for period before suspension

## Acceptance Criteria

- [ ] Suspension screen displayed on login for suspended users
- [ ] Suspension screen shows reason clearly
- [ ] Suspension screen shows duration (temporary) or "permanent"
- [ ] Cannot dismiss suspension screen
- [ ] Cannot navigate away from suspension screen
- [ ] Appeal form present on suspension screen
- [ ] Appeal submission creates record in database
- [ ] Confirmation message shown after appeal submission
- [ ] Cannot submit multiple appeals for same suspension
- [ ] Admin can view pending appeals in dashboard
- [ ] Admin can approve appeals (unsuspends account)
- [ ] Admin can deny appeals (provides explanation)
- [ ] Appeal decision email sent to user
- [ ] Account automatically unsuspended when suspension_until reached
- [ ] Sessions invalidated for suspended users
- [ ] API requests return 403 for suspended users
- [ ] Permanent bans display correctly (no end date)
- [ ] Instructor courses marked "Author Suspended" if instructor suspended
- [ ] Learners notified of course suspension
- [ ] account_suspensions table tracks all suspensions and appeals
- [ ] Audit log entry created for each suspension
- [ ] SLA tracking for appeal responses (48 hours)
- [ ] Support contact links working on suspension screen
- [ ] Community Guidelines link functional
- [ ] Mobile app shows suspension screen (not web view)
- [ ] Deep linking to suspension details works
- [ ] Suspension emails sent correctly
- [ ] Appeal confirmation emails sent correctly
- [ ] Decision emails formatted well
- [ ] Performance tested with mass suspensions (not expected, but test)

## Dependencies

- **Authentication System** - suspension checks during login
- **Account Deletion** - related account status changes
- **Report Content Feature** - triggering suspensions
- **Admin Dashboard** - appeal management
- **Email Service** - suspension and appeal notifications
- **Community Guidelines** - referenced in suspension screen

## Technical Notes

- Check suspension status early in auth middleware
- Use Redis cache for recent suspension status (5-min TTL)
- Implement background job to unsuspend when suspended_until reached
- Test with various suspension durations (1 day, 7 days, 30 days, permanent)
- Ensure appeals handled fairly (randomize reviewer to avoid bias)
- Consider graduated suspensions (1st offense: 3 days, 2nd: 7 days, etc.)
- Log all suspension decisions for auditing
- Sensitive: store admin reason (notes) for audit, don't show to user
- Consider timezone handling for suspension_until (use UTC)
- Implement metrics: suspension rate, appeal approval rate
- Monitor for unjust suspensions (appeal approval rate > 30% may indicate too harsh)
- Archive old suspension records after 2 years
- Consider appeal escalation: if user appeals multiple times, escalate to senior admin
- Test with various character encodings in appeal text
- Implement rate limiting on appeal submissions (1 per suspension)
- Consider fraud scoring: users with many appeals = potential issue
- Update community guidelines reference regularly
- Monitor appeal response time SLA (target: 24 hours)
- Consider scheduling appeal decisions (batch process daily)
- Test unsuspension workflow thoroughly (edge cases)
- Email template should be professional but empathetic
- Consider temporary "probation" status between suspension and full access (future)
