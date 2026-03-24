# Cookie Consent Banner

## Description

Implement a prominent, granular cookie consent banner displayed on first visit to the application. The banner must allow users to:

- Accept all cookies
- Reject non-essential cookies (only necessary cookies enabled)
- Customize cookie preferences with granular toggles

The banner cannot be dismissed without making an explicit choice. Once consent is provided, preferences are persisted in the database with a timestamp. When the cookie policy version changes, users must re-consent.

A "Manage Cookies" link must be available in the footer to allow users to change preferences at any time.

## Affected Apps/Packages

- **Web App** (Next.js) - primary implementation
- **Mobile Apps** (iOS/Android) - in-app web views handling consent
- **Design System** - CookieConsentBanner component

## API Endpoints

- `POST /api/consent/preferences` - Submit/update cookie preferences
- `GET /api/consent/current-policy-version` - Get latest policy version
- `GET /api/consent/user-preferences` - Fetch user's current preferences
- `POST /api/consent/re-consent` - Trigger re-consent flow on policy change

## Requirements

- **Display Rules**:
  - Show on first app visit (no prior consent recorded)
  - Show for returning users if policy version has changed
  - Modal/overlay style that cannot be dismissed by clicking outside
  - Center on desktop, full-screen on mobile
  - High z-index (1000+) to stay above all content
  - Responsive design, accessible (WCAG 2.1 AA)

- **Granular Toggle Options**:
  1. **Necessary Cookies** - always enabled, cannot be toggled
     - Session management, CSRF protection, security
  2. **Analytics Cookies** - opt-in, default OFF
     - Analytics tracking
  3. **Marketing Cookies** - opt-in, default OFF
     - Google Analytics 4, marketing pixels, retargeting

- **Button States**:
  - "Accept All" - enables all toggles, saves consent
  - "Reject Non-Essential" - disables Analytics & Marketing, keeps Necessary ON
  - "Customize" - expands granular toggle panel
  - "Save Preferences" (visible when in customize mode)
  - "Manage Cookies" (link) - opens preference modal from anywhere

- **Database Schema** (consent_preferences table):

  ```
  id: UUID
  user_id: UUID (nullable for anonymous)
  necessary: boolean (default true)
  analytics: boolean (default false)
  marketing: boolean (default false)
  policy_version: string (e.g., "2025-02-18")
  consent_timestamp: timestamp with timezone
  updated_at: timestamp with timezone
  ip_address: string (anonymized after 90 days)
  user_agent: string
  cookie_id: string (temporary ID for anonymous users)
  source: enum (web, ios, android)
  ```

- **UI Behavior**:
  - Display clear description of each cookie category
  - Show links to full privacy policy and cookie policy
  - Use color contrast meeting WCAG AA standards
  - Include toggle switches for each optional category
  - Display language in user's preferred locale
  - Show estimated time to process choice (< 1 second)

- **Technical Implementation**:
  - Store preference state in both httpOnly cookie and database
  - Use geolocation to determine if GDPR applies (EU) vs other regions
  - Set cookie_max_age based on policy (1 year typical)
  - Include data processing info for each category

## Acceptance Criteria

- [ ] CookieConsentBanner component created with granular toggles
- [ ] "Accept All" button saves all preferences to database with timestamp
- [ ] "Reject Non-Essential" button keeps only Necessary enabled
- [ ] "Customize" expands toggle panel with clear descriptions
- [ ] Necessary cookies toggle is disabled (read-only, always enabled)
- [ ] Banner cannot be dismissed without explicit choice
- [ ] Preferences saved to database with policy_version
- [ ] httpOnly cookie set with consent state after user choice
- [ ] "Manage Cookies" link in footer opens preference modal
- [ ] Re-consent triggered automatically when policy_version changes
- [ ] Existing users shown re-consent banner with clear explanation
- [ ] Anonymous users can provide consent (stored with cookie_id)
- [ ] Database records include consent_timestamp, ip_address, user_agent
- [ ] Mobile responsive design tested on iOS and Android
- [ ] WCAG 2.1 AA accessibility compliance verified
- [ ] Translations provided for all supported languages
- [ ] Clear visual distinction between necessary and optional cookies
- [ ] User can navigate back to manage preferences at any time
- [ ] Consent state reflects in middleware before script loading

## Dependencies

- **Consent Logging System** - logs all consent actions
- **Cookie Enforcement Middleware** - enforces consent state on script loading
- **IP Anonymization Cron** - anonymizes IPs after 90 days
- React/Next.js hooks for state management
- Database migrations for consent_preferences table

## Technical Notes

- Implement as a portal/modal to prevent content interaction
- Use React Context to share consent state across app
- Debounce preference save API calls (300ms)
- Lazy-load modal content to improve initial page load
- Consider using feature flag to control banner visibility
- Consent state must be checked before any tracking scripts load
- Log all consent state changes for audit trail
- Consider "Explain" links that expand descriptions inline
- Set secure and sameSite flags on consent cookies
- For anonymous users, generate unique cookie_id to track preferences
