# M12-T1 · Performance Testing & QA

| Field | Value |
|-------|-------|
| **Milestone** | M12 — Launch Readiness |
| **Status** | 🔲 To Do |
| **Depends on** | All M1–M11 tasks completed and deployed to staging environment |
| **PRD Ref** | Section 5 (Testing Strategy) |

---

## Description

Comprehensive QA before production launch, covering unit tests, API integration tests, mobile regression testing on real devices, performance benchmarking, and end-to-end persona workflows. The goal is a stable, crash-free launch on both iOS and Android that meets performance targets (map viewport query < 200ms, feed load < 500ms) and handles edge cases gracefully. This task is the final gate before go-live; all critical issues must be resolved before launch, and all acceptance criteria must pass.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | Unit tests (Jest), integration tests (Hono test client), performance benchmarks (k6), Stripe webhook simulation |
| `apps/mobile` | Unit tests (Jest, React Native Testing Library), E2E flows on iOS and Android real devices, performance profiling (React DevTools, Xcode Instruments) |
| `apps/admin` | Functional testing (Playwright E2E), admin dashboard smoke tests |
| `packages/shared` | Unit tests for shared utilities and types |

---

## API Endpoints

No new endpoints. All existing endpoints require integration tests covering happy path and error cases.

---

## Requirements

### Unit Tests

- R1: `apps/api`: Jest tests for all utility functions, helpers, and business logic
  - Target: minimum 80% code coverage for critical paths (auth, events, bookings)
  - Test files: `*.test.ts` or `*.spec.ts` alongside source files
  - Run: `pnpm test` from `apps/api` directory
- R2: `apps/mobile`: Jest + React Native Testing Library for components and hooks
  - Target: 70% coverage for UI components, critical hooks
  - Test critical screens: EventDetail, BookingFlow, ProfileSettings, MapViewport
  - Run: `pnpm test` from `apps/mobile` directory
- R3: `packages/shared`: Jest tests for utilities, validators, type checks
  - Run: `pnpm test` from `packages/shared` directory

### API Integration Tests

- R4: All critical endpoints have integration tests covering **happy path** (200/201 responses) and **error paths** (400, 401, 403, 404, 422, 500):

  **Auth endpoints:**
  - POST `/auth/signup` (valid data, duplicate email, weak password, missing fields)
  - POST `/auth/login` (valid credentials, invalid password, user not found)
  - POST `/auth/forgot-password` (valid email, email not found)
  - POST `/auth/reset-password` (valid token, expired token, invalid token)
  - POST `/auth/google-signin` (valid token, invalid token)
  - POST `/auth/apple-signin` (valid token, invalid token)
  - POST `/auth/logout`

  **Event endpoints:**
  - POST `/events` (artist/venue create, missing fields, invalid location, oversized image)
  - GET `/events/:id` (found, not found, non-creator view increments view_count)
  - PUT `/events/:id` (own event, other's event, archived event)
  - DELETE `/events/:id` (soft delete, not owned, non-existent)
  - GET `/events?bounds=...` (map viewport query, empty results, 50+ pins)

  **Booking endpoints:**
  - POST `/bookings` (artist apply to gig, venue invite artist, duplicate booking)
  - PUT `/bookings/:id` (accept, reject, cancel)
  - GET `/bookings` (by status, artist vs venue view)

  **Admin endpoints:**
  - POST `/admin/auth/login` (valid, invalid credentials)
  - GET `/admin/stats` (authenticated, unauthenticated)
  - GET `/admin/events?status=pending_review` (pagination, sorting)
  - PUT `/admin/events/:id/approve` (with reason logged)
  - PUT `/admin/events/:id/reject` (with reason sent to creator)

  **Subscription endpoints:**
  - POST `/webhooks/stripe` (signature verified, tampered, unknown event type)

  **Webhook endpoints:**
  - POST `/webhooks/mux` (video.asset.ready, signature verified)

- R5: Tests use Hono test client for in-process testing; no need to spin up separate server
  - Example: `const res = await app.request(new Request('http://localhost:3000/api/v1/auth/login', { method: 'POST', body: JSON.stringify({...}) }))`
- R6: All tests mock external services (Stripe, Mux, Postmark, Firebase) using Jest mocks or testcontainers
- R7: Test database: use a separate test Neon branch or in-memory SQLite with Drizzle for speed
- R8: Run: `pnpm test:api` from monorepo root

### Mobile Regression Testing (Real Devices)

- R9: Test on **physical iOS device** (iPhone 13 or later, latest iOS 17+)
  - Cannot skip: Apple Sign-In only works on real devices in TestFlight
  - Install via EAS Build: `eas build --platform ios --profile staging` → install via TestFlight link
- R10: Test on **physical Android device** (Samsung Galaxy S21 or Pixel 6, Android 12+)
  - Install via EAS Build: `eas build --platform android --profile staging` → install via EAS CLI or APK download
- R11: Test scenarios on both iOS and Android:

  **Tab Navigation:**
  - [ ] Map tab loads; map renders with pins
  - [ ] Discover tab shows feed; swipe loads more items
  - [ ] Bookings tab shows bookings by status
  - [ ] Profile tab shows user's profile

  **Spectator Flow:**
  - [ ] Grant location permission → map centers on user location
  - [ ] Deny location permission → map shows Ireland default; IP geolocation fallback works
  - [ ] Search bar filters events by county/keyword
  - [ ] Tap event pin → event detail screen loads
  - [ ] Event detail shows all info (date, location, artist, ticket link)
  - [ ] Save event → appears in saved events
  - [ ] View another artist's profile → follow button works

  **Artist Flow:**
  - [ ] Persona switch to Artist → artist profile created
  - [ ] Edit artist profile (name, bio, profile image upload via S3 presigned URL)
  - [ ] Create event → upload cover image, set date/location, submit
  - [ ] Event enters pending_review → notification when approved
  - [ ] Event appears on map after approval
  - [ ] View own event → analytics tab shows metrics
  - [ ] Create post → upload image (S3) or video (Mux) → track upload progress

  **Venue Flow:**
  - [ ] Persona switch to Venue → prompt to subscribe
  - [ ] Tap "Activate Venue" → email link opens Stripe checkout in web browser
  - [ ] Complete Stripe payment (use test card 4242 4242 4242 4242)
  - [ ] Return to app → venue profile activated (visible to artists)
  - [ ] Create event (regular) → upload cover, appears on map
  - [ ] Create gig opportunity event (`is_gig_opportunity: true`) → artists can apply
  - [ ] View applications → invite/reject artists
  - [ ] Analytics tab shows subscription status and gig applications

  **Super Admin Flow:**
  - [ ] Navigate to admin dashboard (ceolx.ie/admin/login)
  - [ ] Log in with seeded admin credentials
  - [ ] Dashboard shows KPI cards with correct counts
  - [ ] Pending Moderation badge shows event count
  - [ ] Click pending events → queue page loads
  - [ ] Approve an event (fill reason) → creator notified, event goes live
  - [ ] Reject an event → creator notified with rejection reason
  - [ ] Users table loads; search by email works
  - [ ] Export CSV downloads

  **Booking Flow:**
  - [ ] Venue invites artist → artist gets push notification + in-app notification
  - [ ] Artist views booking → accept/reject
  - [ ] On accept → venue gets notified, event locked to artist
  - [ ] On reject → event reopened to other artists

  **Notifications:**
  - [ ] Push notification arrives for event approval (arrives within 5 seconds)
  - [ ] Push notification tapped → app opens, navigates to event (auto-switches persona if needed)
  - [ ] In-app notification inbox shows all unread notifications
  - [ ] Mark notification as read → inbox updates

  **Persona Switching:**
  - [ ] Settings > Switch Account Type → list of personas
  - [ ] Switch from Artist to Spectator → Spectator data loads, artist-only UI hidden
  - [ ] Switch back to Artist → artist profile restored
  - [ ] Notification routing on switch: receive Venue notification while in Spectator → switch to Venue, navigate to event

  **Edge Cases:**
  - [ ] No events in area → empty state shows auto-expand message (25 km, 100 km)
  - [ ] Search for non-existent county → "No events found"
  - [ ] Expired password reset token → error message
  - [ ] Duplicate booking attempt (artist applies twice to same gig) → rejected with error
  - [ ] Network disconnect during upload → retry button appears; retry on reconnect works
  - [ ] Logout → app returns to login screen
  - [ ] Delete account → anonymisation confirmed, no personal data visible

  **GDPR & Privacy:**
  - [ ] Account deletion: Settings > Delete Account → type "DELETE" → confirm → account anonymised
  - [ ] Data export: Settings > Export Data → JSON file downloads with all user data
  - [ ] Consent settings: Settings > Privacy → shows current consents

- R12: No crash-level bugs; app should not force-close on any of the above flows

### Performance Testing

- R13: **Map viewport query**: Map loads with 50 event pins → query completes in < 200ms (measured via network inspector or backend logs)
  - Test: navigate to Dublin area (50 pins in view) → measure time from request to response
- R14: **Feed load**: Discover feed shows 20 items → initial load < 500ms, scroll performance is smooth (60fps or close)
  - Test: open feed → measure Time to Interactive (TTI)
  - Test: scroll feed → no frame drops (use React DevTools Profiler or Xcode Instruments)
- R15: **Image load**: Uploaded cover images via CloudFront load in < 2 seconds
  - Test: view event detail with cover image → measure image load time
- R16: **Video playback**: Mux HLS video starts buffering within 2 seconds of play button tap
  - Test: view post with video → tap play → measure time to first bytes
- R17: Load testing with k6: simulate 100 concurrent users, 50 RPS on key endpoints
  - Target: API response time p95 < 500ms, p99 < 1000ms
  - No 5xx errors under load

### Stripe Webhook Testing

- R18: Stripe test mode webhook events fired and processed correctly:
  - `customer.subscription.created` → subscription_status = active
  - `customer.subscription.updated` → update billing details
  - `customer.subscription.deleted` → subscription_status = cancelled
  - `invoice.payment_failed` → subscription_status = past_due
- R19: Webhook signature verification works; tampered webhook rejected (401 or 403)
- R20: Test a real Stripe test charge (card 4242 4242 4242 4242) → confirm webhook fires → subscription activates

### Admin Functional Testing

- R21: Admin dashboard Playwright E2E tests:
  - [ ] Login page renders
  - [ ] Valid credentials → redirect to dashboard
  - [ ] KPI cards load and display numbers
  - [ ] Pending events queue shows pending events
  - [ ] Approve/reject moderation actions work
  - [ ] Users table loads and pagination works
  - [ ] CSV export downloads
  - [ ] Logout works
- R22: Run: `pnpm test:e2e` from `apps/admin` directory

---

## Acceptance Criteria

- [ ] All unit tests pass: `pnpm test` from all apps and packages
- [ ] All API integration tests pass: `pnpm test:api`
- [ ] All admin E2E tests pass: `pnpm test:e2e`
- [ ] Manual testing on iOS real device: all flows completed without crashes
- [ ] Manual testing on Android real device: all flows completed without crashes
- [ ] Apple Sign-In tested on iOS TestFlight build
- [ ] Google Sign-In tested on Android
- [ ] Map viewport query < 200ms (measured on staging environment)
- [ ] Feed load < 500ms and smooth scrolling (60fps)
- [ ] Stripe webhook test events processed correctly
- [ ] k6 load test: 100 concurrent users, 50 RPS, p95 < 500ms, no 5xx errors
- [ ] All critical bugs (crashes, data loss, wrong calculations) fixed; minor issues logged for post-launch
- [ ] GDPR deletion and export flows verified
- [ ] Test coverage >= 80% for critical API paths, >= 70% for mobile components
- [ ] Test report generated and reviewed by team

---

## Dependencies

- **Upstream**: All M1–M11 tasks deployed to staging environment (matching production config, database, external services)
- **Downstream**: M12-T2 (App Store submissions); M12-T3 (production deployment)
- **External services**: Stripe test mode, Mux test API, Firebase test project, Postmark test account, iOS TestFlight, Android test devices

---

## Technical Notes

### Jest Configuration (apps/api)

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Hono Test Example

```typescript
import { describe, it, expect } from '@jest/globals';
import app from '../src/app';

describe('POST /api/v1/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await app.request(
      new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@ceolx.ie',
          password: 'validPassword123!',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session).toBeDefined();
    expect(data.session.email).toBe('user@ceolx.ie');
  });

  it('should reject invalid password', async () => {
    const res = await app.request(
      new Request('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@ceolx.ie',
          password: 'wrongPassword',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid email or password');
  });
});
```

### k6 Load Test

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95th percentile < 500ms
    'http_err_rate': ['<0.1'],                        // Error rate < 10%
  },
};

export default function () {
  // Test map viewport query
  const queryRes = http.get(
    'https://api.staging.ceolx.ie/api/v1/events?bounds=53.1,53.5,-7.8,-7.2',
    { headers: { Authorization: 'Bearer test_token' } }
  );

  check(queryRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

### Manual Testing Checklist

Create a shared Google Doc or markdown file tracking all test scenarios:

```markdown
# CeolX QA Test Plan

## Spectator Flow (iOS)
- [x] Grant location permission
- [x] Map loads with pins
- [ ] Search by county
- [ ] Tap event → detail loads
- [ ] Save event
- [ ] Follow artist

## Spectator Flow (Android)
- [ ] ... (same as iOS)

## Artist Flow (iOS)
- [ ] Switch to Artist persona
- [ ] Edit profile and upload image
- [ ] Create event with cover
- [ ] View event in pending queue
- [ ] Event approved → notification received
- [ ] Analytics tab shows views

## ... (continue for all flows)

## Issues Found
1. [BLOCKER] Login screen crashes on iOS when email contains special characters
   - Status: FIXED in commit abc123
   - Verified: 2026-03-22

2. [HIGH] Map scrolls with jank when 50+ pins visible
   - Status: IN PROGRESS (pin clustering fix)
```

---

## Common Gotchas

- **Real device testing is non-negotiable**: Simulator and emulator performance differ significantly from real devices. Apple Sign-In and some permissions only work on real devices.

- **Test database isolation**: Ensure test database is separate from staging/production. Use transactions to rollback test data after each test.

- **Mocking external services**: Never call real Stripe, Mux, or Postmark APIs in tests. Use Jest mocks (`jest.mock()`) or test doubles (fake implementations).

- **Performance measurement timing**: Measure from client request to server response; don't include network round-trip time in backend latency targets. Use network inspector or server-side timing headers.

- **Webhook signature verification**: Always test webhook signature verification; ensure both valid and tampered webhooks are handled correctly.

- **Map clustering performance**: With 50+ pins, ensure clustering is enabled and performant. Test with actual pin density expected in Dublin/Cork/Galway areas.

- **Location permission handling**: Test all three fallback chains: GPS granted, GPS denied (IP geolocation), IP fails (Ireland default). Each must work without crashing.
