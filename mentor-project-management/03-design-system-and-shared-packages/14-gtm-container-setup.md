# Google Tag Manager Container Setup

## Description

Setup Google Tag Manager (GTM) container for all three web applications (web-learner, web-instructor, web-admin). Create GTM container with data layer events, configure tags for Google Analytics 4 tracking, Facebook Pixel (if marketing campaigns apply), and conversion tracking. Establish triggers based on data layer events pushed from the analytics adapter package. Integrate cookie consent flow to ensure tags only fire when users have consented to analytics cookies via the banner implemented in milestone 13. Include container export/import workflow for consistent environment management (dev/staging/prod). This is web-only and does not apply to the mobile app (Firebase Analytics handles mobile in milestone 14, task 18).

## Affected Apps/Packages

- web-learner (web app)
- web-instructor (web app)
- web-admin (web app)
- analytics-adapter (shared package)
- cookie-consent-banner (shared component, milestone 13)

## API Endpoints

- Google Tag Manager API: `https://www.googleapis.com/tagmanager/v2/`
- GTM Container Tags Endpoint: `https://www.googleapis.com/tagmanager/v2/accounts/{accountId}/containers/{containerId}/tags`
- Google Analytics 4 Measurement Protocol: `https://www.google-analytics.com/mp/collect`
- Facebook Conversions API: `https://graph.facebook.com/v18.0/{{pixel_id}}/events`

## Requirements

### Google Tag Manager Setup

- Create GTM account (if not existing) for the organization
- Create separate containers for dev, staging, and production environments
- Use consistent naming convention: `[app-name]-[environment]` (e.g., `web-learner-prod`, `web-learner-staging`)
- Configure user permissions (contributors, publishers, read-only)
- Enable version history and backups for container changes
- Setup workspace for development before publishing to live

### GTM Container Configuration

- Install GTM script tag in all three web applications via analytics adapter
- Embed GTM container ID in environment config (REACT_APP_GTM_CONTAINER_ID)
- Initialize GTM script on application load (before React rendering)
- Implement GTM data layer initialization with default properties:
  - `user_id`: Current authenticated user ID
  - `user_type`: Type of account (learner, instructor, admin)
  - `app_name`: Application identifier (web-learner, web-instructor, web-admin)
  - `environment`: Current environment (dev, staging, prod)
  - `page_path`: Current page URL path
  - `page_title`: Current page title
  - `timestamp`: Event timestamp (milliseconds since epoch)

### Data Layer Events from Analytics Adapter

- Push events to GTM data layer whenever analytics adapter tracks an event
- Data layer event structure:
  ```
  window.dataLayer.push({
    event: 'event_name',
    eventCategory: 'course',
    eventAction: 'enrollment',
    eventLabel: 'course_title',
    eventValue: 99.99,
    userId: 'user_123',
    ...additionalProperties
  })
  ```
- Integrate with analytics adapter to push events to data layer automatically
- Ensure data layer push happens before GTM tag evaluation (200ms delay if needed)
- Document all available events and their properties in GTM

### Google Analytics 4 Integration

- Create or link existing Google Analytics 4 property
- Configure GA4 tag in GTM that listens to all data layer events
- Map data layer event names to GA4 event names
- Configure user properties in GA4:
  - `user_id`: Authenticated user ID
  - `user_type`: account_type (learner/instructor/admin)
  - `subscription_status`: subscription status
  - `language`: user language preference
  - `country`: user country
- Setup conversion tracking for key events:
  - `user_signed_up` → GA4 "sign_up" conversion
  - `payment_completed` → GA4 "purchase" conversion
  - `course_enrolled` → GA4 "subscribe" conversion
  - `course_completed` → GA4 "view_promotion" or custom conversion
- Enable enhanced e-commerce tracking (if applicable to product structure)
- Configure GA4 session timeout (default 30 minutes)

### Facebook Pixel Integration (Conditional)

- Create Facebook Pixel (if marketing campaigns exist)
- Add Facebook Pixel ID to environment config
- Create GTM tag for Facebook Pixel initialization
- Configure conversion tracking for marketing-critical events:
  - `user_signed_up` → "CompleteRegistration" conversion
  - `payment_completed` → "Purchase" conversion (with value)
  - `course_enrolled` → "AddToCart" conversion
- Map currency for purchase events (USD or appropriate currency)
- Test with Facebook Pixel Helper Chrome extension before production
- Document pixel restrictions and audience targeting rules

### Cookie Consent Integration

- Coordinate with cookie consent banner (milestone 13, task X)
- Implement cookie category consent: `analytics`, `marketing`, `functional`
- GTM should only fire tags if user grants consent:
  - `analytics`: GA4 tag fires
  - `marketing`: Facebook Pixel tag fires
  - `functional`: Session tracking allowed
- Update data layer with consent status when user interacts with banner:
  ```
  window.dataLayer.push({
    event: 'consent_update',
    analytics_consent: true,
    marketing_consent: false,
    functional_consent: true
  })
  ```
- Create GTM trigger conditions that check consent status before firing tags
- Persist user's consent choices to localStorage/cookies
- Provide "Manage Preferences" button in footer to change consent

### GTM Trigger Configuration

- **Page View Trigger**: Fire on all pages (for GA4 page tracking)
- **Scroll Depth Trigger**: Fire at 25%, 50%, 75%, 90% scroll depth (engagement metric)
- **Click Trigger**: Fire on specific CTA buttons (e.g., "Enroll Now", "Buy Course")
- **Form Submission Trigger**: Fire when user submits profile forms, search filters
- **Custom Event Trigger**: Listen for each data layer event (course_viewed, lesson_completed, etc.)
- **Consent Trigger**: Special trigger that only fires if user has granted analytics consent
- **Timing Trigger**: Fire after 2 minutes on page (engagement check)
- **Video Interaction Trigger**: Fire on video start/pause/resume (if video events available)

### GTM Tags Configuration

- **GA4 Configuration Tag**:
  - Tag Type: Google Analytics 4 - Google Analytics
  - Measurement ID: From GA4 property
  - Settings Variable: Built-in GA4 settings
  - Trigger: All pages (Page View)
  - Enable Enhanced E-commerce (if applicable)

- **GA4 Event Tags** (for key conversions):
  - Create separate tag per conversion event
  - Map to appropriate GA4 event name
  - Include event parameters (event_label, event_value, currency)
  - Trigger: Custom event trigger for specific event

- **Facebook Pixel Tag**:
  - Tag Type: Facebook Pixel
  - Pixel ID: From Facebook Business Manager
  - Trigger: Consent trigger (marketing_consent == true)
  - Configure conversion tracking per event

- **Consent Update Tag** (if applicable):
  - Notify tags of consent changes
  - Re-initialize tags based on new consent status

### Variables & Lookups

- Create lookup table for event name mapping (GTM event → GA4 event name)
- Create custom JavaScript variables for:
  - `getCookieValue(cookieName)`: Retrieve specific cookie
  - `getDataLayerValue(path)`: Safely access data layer properties
  - `getUserConsent()`: Check if user has analytics consent
- Create user-defined variables:
  - `User ID` (from data layer)
  - `User Type` (from data layer)
  - `Subscription Status` (from data layer)

### Container Import/Export Process

- Export container as JSON after each stable configuration
- Version exports with date and change summary (e.g., `gtm-web-learner-prod-2024-02-18-ga4-update.json`)
- Store exports in version control (with sensitive IDs removed or encrypted)
- Document import process: Settings → Container → Import Container → Upload JSON
- Test container updates in staging before importing to production
- Setup rollback procedure: keep previous container version for quick restoration

### Multi-App Container Strategy

- Decide: Single GTM container for all three apps vs. separate containers
- Recommended: Single production container to consolidate analytics, with environment suffix for staging/dev
- Use data layer `app_name` property to segment data in GA4
- Apply appropriate scope to tags (e.g., GA4 tag applies to all apps, Facebook Pixel only to web-learner)
- Document which tags apply to which app in container notes

### Testing & Validation

- Use Google Tag Manager Preview & Debug mode:
  - Enable preview in GTM UI
  - Open app in browser and verify events appear in debug panel
  - Validate data layer structure and event properties
- Test with Google Tag Assistant (Chrome extension):
  - Verify GTM container loads correctly
  - Check that GA4 and FB Pixel tags fire
- Test consent flow:
  - Reject all cookies → no tags fire except functional
  - Accept analytics → GA4 fires
  - Accept marketing → Facebook Pixel fires
- Create test checklist with key user journeys:
  - Signup → sign_up conversion
  - Course enrollment → conversion
  - Payment → purchase conversion
- Performance testing: Ensure GTM doesn't slow down page load (should add <100ms)

## Acceptance Criteria

- [x] GTM account created with separate containers for dev, staging, production
- [x] GTM script installed in web-learner, web-instructor, web-admin via analytics adapter
- [x] Data layer initialization configured with default properties (user_id, app_name, environment)
- [x] Data layer events pushed from analytics adapter on every event (integration verified)
- [x] Google Analytics 4 property created and linked to GTM container
- [x] GA4 tag configured to listen to all data layer events
- [x] GA4 user properties configured (user_id, user_type, subscription_status, language, country)
- [x] Conversion events configured in GA4 (sign_up, purchase, subscribe, course_completed)
- [x] Facebook Pixel integrated (if marketing campaigns exist) with appropriate conversions
- [x] Cookie consent integration implemented: tags only fire with user consent
- [x] Consent data layer push implemented (consent_update event)
- [x] GTM triggers created for page views, custom events, scroll depth, clicks
- [x] GTM variables created for event mapping, consent checks, user data
- [x] Container export/import workflow documented and tested
- [x] Debug mode tested: events visible in GTM preview and GA4 real-time dashboard
- [x] Tag firing verified in Chrome extensions (Tag Assistant, Pixel Helper)
- [x] Consent flow tested: tags fire correctly based on user choices
- [x] Performance impact measured: page load impact < 100ms
- [x] Fallback plan documented if GTM container unavailable
- [x] Documentation created: GTM structure, tag purposes, modification process
- [x] Staging environment tested with production-like events before go-live

## Dependencies

- Google Tag Manager account (free tier sufficient)
- Google Analytics 4 property
- Facebook Pixel ID (if marketing integrations needed)
- Analytics adapter package (milestone 13, task 13) pushing data layer events
- Cookie consent banner (milestone 13)
- Environment variable configuration system
- Chrome browser extensions (Tag Assistant, Pixel Helper) for testing

## Technical Notes

- GTM adds ~20KB to page (after gzip); consider impact on mobile bandwidth
- Data layer should be pushed to `window.dataLayer` array before GTM script executes
- GA4 events may have 24-48 hour delay before appearing in conversion reports (real-time data available within seconds)
- Facebook Pixel requires user consent in GDPR jurisdictions; consent checks are mandatory
- GTM container versions are immutable; publish a new version to make changes
- Use GTM workspaces to test changes before publishing (avoids live impact)
- Event deduplication: ensure data layer doesn't push same event twice (check adapter logic)
- Custom dimensions in GA4 limited to 25 free dimensions; plan property mapping carefully
- Test consent banner rejection flow: ensure no tracking cookies set if user rejects all
- Consider implementing consent banner CMP integration (e.g., OneTrust, Termly) for enterprise compliance
- GTM timing: container loads async, may introduce 100-200ms tracking delay (acceptable)
