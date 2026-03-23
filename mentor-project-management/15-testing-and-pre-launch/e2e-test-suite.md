# End-to-End Test Suite

## Description

Comprehensive E2E testing strategy covering web and mobile applications using Playwright for web apps (Learner Web, Mentor Web, Admin Web) and Detox/Maestro for mobile (React Native Expo). Tests critical user flows including authentication, course discovery, video playback, payments, and community interactions. Full CI/CD integration with test data management and reporting.

## Affected Apps/Packages

- **Learner Web** (Next.js)
- **Mentor Web** (Next.js)
- **Admin Web** (Next.js)
- **Learner Mobile** (React Native Expo)
- **Shared UI Components** (@mentor/design-system)
- **API** (Hono on Vercel)

## Requirements

### Framework & Tools

- **Web E2E**: Playwright (v1.40+)
  - Browser coverage: Chrome, Firefox, Safari
  - Viewport coverage: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- **Mobile E2E**: Detox (v20+) for iOS, Maestro (latest) for Android
- **Test Environment**: Staging environment with seeded test data
- **CI/CD**: GitHub Actions with Playwright in Docker containers
- **Reporting**: HTML reports, video recordings of failures, trace files

### Test Data Management

- Seed script to provision test DB with:
  - 3 test learner accounts (free, pro, premium tiers)
  - 3 test mentor accounts with published courses
  - 3 test admin accounts (levels: moderator, operator, super-admin)
  - 5 test courses with progressive completion states (0%, 50%, 100%)
  - 10+ video clips with various durations and qualities
  - Test payment methods (Stripe test cards)
  - Test community posts and comments
- Data reset script for clean test runs
- User session management for multi-user flows

### Performance Expectations

- Page load: < 3 seconds
- Navigation transitions: < 500ms
- Video playback initialization: < 2 seconds
- API responses: < 500ms uncached
- No layout shifts during interactions (CLS < 0.1)

## Acceptance Criteria

- [ ] All critical flows pass E2E tests with >95% reliability
- [ ] E2E test suite runs in < 15 minutes (parallel execution)
- [ ] Video playback E2E tests validate start < 2s, smooth playback (0% stuttering)
- [ ] Payment flow E2E tests cover subscription and course purchase with Stripe test cards
- [ ] Mobile E2E tests run on iOS and Android with >90% pass rate
- [ ] Test failures capture screenshots, video recordings, and trace files for debugging
- [ ] CI/CD integration: All E2E tests run on PR branches and block merge if failed
- [ ] Test reports generated automatically in HTML format with historical trends
- [ ] Cross-browser testing validates desktop/tablet/mobile viewports
- [ ] Community engagement flows (post, comment, like, follow) fully tested
- [ ] Authentication flows (signup, login, password reset, social auth) 100% coverage
- [ ] Accessibility checks integrated (WCAG 2.1 AA via Axe)

## Dependencies

### External Services

- Stripe test account with test cards provisioned
- Mux API for video test generation
- Firebase for notification testing (if mobile notifications enabled)
- Mailhog or similar for email verification flows

### Internal Systems

- Staging DB with seeded test data (managed by seed script)
- Test Hono API instance with all endpoints working
- Test Typesense instance with courses indexed
- Mux test videos ready for playback
- Vercel staging environment deployed

### Tools

- Docker for CI container consistency
- Node.js 20+
- Browser drivers (chromium, firefox, webkit via Playwright)
- Android emulator / iOS simulator for mobile

## Technical Notes

### Playwright Web E2E Structure

```
tests/e2e/
├── learner/
│   ├── auth.spec.ts (signup, login, logout, password reset)
│   ├── course-discovery.spec.ts (search, filter, pagination)
│   ├── video-playback.spec.ts (play, pause, seek, quality, captions)
│   ├── course-progress.spec.ts (complete lesson, track progress, completion badge)
│   ├── payments.spec.ts (subscribe, purchase course, billing)
│   ├── community.spec.ts (create post, comment, like, follow mentor)
│   ├── profile.spec.ts (edit profile, preferences, certificates)
│   └── mobile.spec.ts (responsive, touch interactions, offline mode)
├── mentor/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts (view analytics, revenue, student list)
│   ├── course-creation.spec.ts (create, edit, publish course)
│   ├── video-management.spec.ts (upload, transcode progress, settings)
│   ├── community-moderation.spec.ts (respond to posts, moderate comments)
│   └── student-management.spec.ts (enroll, track, message)
├── admin/
│   ├── auth.spec.ts
│   ├── user-management.spec.ts (search, suspend, restore users)
│   ├── content-moderation.spec.ts (flag/approve community content)
│   ├── payments-monitoring.spec.ts (revenue reports, dispute handling)
│   ├── system-settings.spec.ts (feature flags, email templates, DRM settings)
│   └── analytics-verification.spec.ts (event tracking, user metrics)
└── shared/
    ├── performance.spec.ts (Web Vitals validation)
    ├── accessibility.spec.ts (WCAG 2.1 AA)
    └── error-handling.spec.ts (error pages, network failures)
```

### Test Scenarios by Flow

**Authentication Flow**

1. Signup with email validation
2. Social signup (Google, Apple if applicable)
3. Login with valid/invalid credentials
4. Logout and session cleanup
5. Password reset flow with email link
6. Session timeout handling

**Course Discovery**

1. Load course listing without filters
2. Search by title, instructor name
3. Filter by category, difficulty, price
4. Pagination and load more
5. Course detail page loads video preview
6. Add course to wishlist (authenticated user)

**Video Playback**

1. Click play, video initializes < 2 seconds
2. Playback controls: pause, resume, seek, fullscreen
3. Quality selection (480p, 720p, 1080p if available)
4. Closed captions toggle and styling
5. Playback speed adjustment (0.75x, 1x, 1.25x, 1.5x)
6. Progress bar shows correct duration and current time
7. Next/previous lesson navigation

**Payment Flow (Stripe Test Card)**

1. Subscription upgrade (free → pro, pro → premium)
2. One-time course purchase
3. Payment processing with test card
4. Invoice email received
5. Subscription cancellation
6. Refund handling (if applicable)

**Community Engagement**

1. Create post with text/image
2. Comment on mentor's post
3. Like/unlike post
4. Follow mentor, see notifications
5. Messaging between learner and mentor
6. Report inappropriate content

**Admin Moderation**

1. View flagged community content
2. Approve/reject flagged posts
3. Suspend abusive user
4. View detailed user profile
5. Review payment disputes
6. Toggle feature flags

### Mobile E2E (Detox/Maestro)

**Detox Configuration (iOS)**

```javascript
// e2e/config.js
module.exports = {
  testRunner: "jest",
  apps: {
    ios: {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Release-iphonesimulator/Mentor.app",
      build:
        "xcodebuild -workspace ios/Mentor.xcworkspace -scheme Mentor -configuration Release -derivedDataPath ios/build -destination generic/platform=iOS",
    },
  },
  configurations: {
    ios: {
      device: {
        type: "iPhone 14",
      },
      app: "ios",
    },
  },
  testRunner: "jest",
};
```

**Maestro Configuration (Android/iOS)**

```yaml
# e2e/maestro/flows/auth_login.yaml
appId: com.example.mentor
---
- launchApp
- tapOn:
    id: "email_field"
- inputText: "test@example.com"
- tapOn:
    id: "password_field"
- inputText: "password123"
- tapOn:
    text: "Login"
- waitForAnimationToEnd
- assertVisible:
    text: "Welcome back"
```

**Mobile Test Scenarios**

1. Touch and swipe gestures (pull-to-refresh, horizontal scroll)
2. Portrait/landscape orientation changes
3. Keyboard handling (email input, comment textarea)
4. Offline mode (API failures, cached data)
5. Push notification tapping
6. Deep linking to course/lesson
7. Device back button handling
8. Memory/battery consumption profiling

### Test Data Management

**Seed Script Example** (`scripts/seed-test-data.ts`)

```typescript
import { db } from "@mentor/database";
import stripe from "stripe";

export async function seedTestData() {
  // Clear existing test data
  await db.delete(users).where(eq(users.email, like("test%@example.com")));

  // Create learners
  const learner1 = await db.insert(users).values({
    email: "learner1@example.com",
    name: "Test Learner",
    tier: "free",
    ...
  }).returning();

  // Create mentors with courses
  const mentor1 = await db.insert(users).values({
    email: "mentor1@example.com",
    name: "Test Mentor",
    role: "mentor",
    ...
  }).returning();

  // Create courses
  const course1 = await db.insert(courses).values({
    mentorId: mentor1.id,
    title: "Makeup Fundamentals",
    videoIds: ["mux-id-1", "mux-id-2", "mux-id-3"],
    ...
  }).returning();

  // Create enrollments
  await db.insert(enrollments).values({
    userId: learner1.id,
    courseId: course1.id,
    status: "active",
    ...
  });

  console.log("Test data seeded successfully");
}
```

### CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    paths:
      - "apps/**"
      - "packages/**"
      - "tests/e2e/**"
  push:
    branches: [main]

jobs:
  e2e-web:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: mentor_test
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build
      - run: npm run seed:test-data
      - run: npx playwright install --with-deps
      - run: npm run test:e2e:web
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  e2e-mobile:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build:mobile
      - run: npm run seed:test-data
      - run: npm run test:e2e:mobile:ios
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: detox-report
          path: artifacts/
          retention-days: 30
```

### Parallel Execution Strategy

```javascript
// playwright.config.ts
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
```

### Test Reporting

HTML reports should include:

- Overall pass/fail counts
- Execution time per test
- Screenshots of failures
- Video recordings of failed tests
- Trace files for debugging (via Playwright Inspector)
- Flaky test identification (runs multiple times)
- Browser/device matrix results

Historical trend tracking: Store results in database/artifact storage to track pass rate trends over time.

### Accessibility Testing Integration

```typescript
// tests/e2e/shared/accessibility.spec.ts
import { injectAxe, checkA11y } from "axe-playwright";

test("should pass WCAG 2.1 AA on learner dashboard", async ({ page }) => {
  await page.goto("/learner/dashboard");
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true },
  });
});
```

### Video Playback Validation

```typescript
// tests/e2e/learner/video-playback.spec.ts
test("video should start playing within 2 seconds", async ({ page }) => {
  const startTime = Date.now();
  await page.goto("/course/test-course/lesson/1");

  // Wait for video to have played bytes
  const videoElement = page.locator("video");
  await videoElement.evaluate((el: HTMLVideoElement) => {
    return new Promise((resolve) => {
      el.addEventListener("play", () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 2000);
    });
  });

  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(2000);
});
```

### Error Scenario Testing

Test network failure scenarios, timeouts, and graceful degradation:

- Network throttling (slow 3G, offline mode)
- API error responses (500, 503, rate limit)
- Video transcoding failures
- Payment processor timeouts
- Database connection failures

## Implementation Timeline

- **Week 1**: Set up Playwright infrastructure, write auth and discovery tests
- **Week 2**: Write video playback and payment E2E tests
- **Week 3**: Implement mobile E2E tests (Detox/Maestro)
- **Week 4**: CI/CD integration, test data seeding, reporting
- **Week 5-6**: Community and admin flows, accessibility testing, load testing integration

## Success Metrics

- **95%+ pass rate** on all E2E tests in CI
- **0 flaky tests** (tests must be deterministic)
- **< 15 minutes** full test suite execution
- **< 5 minutes** critical path tests (auth, video, payment)
- **100% coverage** of critical user flows
- **Videos capture failure** context for rapid debugging
- **Mobile tests** pass on both iOS and Android with >90% reliability
