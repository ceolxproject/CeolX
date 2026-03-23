# Pre-Launch Comprehensive Checklist

## Description

Complete pre-launch checklist derived from PRD Section 18 covering all aspects of public launch preparation. Includes legal compliance, infrastructure readiness, payment processing, content verification, app store submissions, testing validation, security hardening, and analytics setup. Ensures platform is secure, compliant, performant, and ready for launch day.

## Affected Apps/Packages

- All production systems and apps

## Requirements

This checklist covers 8 major categories from PRD Section 18, with verification steps for each.

## Legal & Compliance

### Privacy & Data Protection

- [ ] **Privacy Policy** written and legally reviewed
  - Contains clear description of data collection
  - Explains third-party integrations (Stripe, Mux, Firebase)
  - Includes GDPR & CCPA compliance sections
  - Document location: `https://app.mentor.example.com/privacy`
  - Accessible from app settings (Settings → Privacy Policy)

- [ ] **Terms of Service** written and reviewed
  - Usage restrictions and user obligations
  - Liability limitations
  - Intellectual property rights
  - Account termination policy
  - Document location: `https://app.mentor.example.com/terms`
  - In-app accessible (Settings → Terms of Service)

- [ ] **Cookie Consent** implemented
  - Banner shows on first visit
  - Allows opt-out of analytics cookies
  - Preference persisted
  - Implementation: Axios interceptor checks `acceptedCookies` flag
  - Test: Load app in private mode, verify banner appears

- [ ] **Data Processing Agreement (DPA)** signed (if EU users)
  - Signed with Vercel (infrastructure provider)
  - Signed with Stripe (payment processor)
  - Signed with Mux (video hosting)
  - Signed with Firebase (analytics/messaging)
  - File location: `/legal/dpa-*.pdf`

- [ ] **User Data Access & Deletion**
  - `GET /api/users/:id/data` exports user data in JSON format
  - `POST /api/users/:id/delete` deletes all user data permanently
  - Deletion completed within 30 days
  - Test: Create test user, request data export, verify content

- [ ] **GDPR Right to Erasure**
  - Implement `/api/auth/account/delete` endpoint
  - Deletes: user record, enrollments, certificates, posts, payment history
  - Keeps: anonymized analytics, transaction logs (for legal compliance)
  - No data recovery possible
  - Test: Delete account, verify data removed from database

### Regulatory Compliance

- [ ] **Content Rating Compliance**
  - IARC rating determined (3+, 7+, 12+, 16+, 18+)
  - If makeup content includes mature topics, rated appropriately
  - Content descriptors disclosed
  - Applied to both iOS and Android submissions

- [ ] **Accessibility Compliance (WCAG 2.1 AA)**
  - Color contrast ≥ 4.5:1 for text
  - All interactive elements keyboard accessible
  - Proper heading hierarchy (h1, h2, h3)
  - Alt text for all images
  - Test: Use axe DevTools, Wave, or manual testing

- [ ] **Age Verification (if required)**
  - If serving users under 13, verify parental consent
  - COPPA compliance if US-based
  - Age gate at signup if 13+ restricted
  - Test: Attempt signup with birth date < 13 years old

### Intellectual Property

- [ ] **Instructor Content Rights**
  - All instructors signed content agreements
  - Mentor retains distribution rights
  - Attribution requirements documented
  - Test: Review instructor database for signed agreements

- [ ] **Third-Party Content Licenses**
  - Music/sound effects licensed for streaming
  - Background footage/images licensed
  - Citation/credits visible where required
  - Test: Search for any unlicensed content

- [ ] **Trademark & Branding**
  - Logo registered or trademark acknowledged
  - Brand guidelines documented
  - No trademark infringement risks verified
  - Test: Google search for "Mentor cosmetics" - no major conflicts

---

## Infrastructure & Operations

### Environment Setup

- [ ] **Production Environment Configured**
  - Vercel project deployed with all apps
  - Database: Neon PostgreSQL prod instance
  - Environment variables set in Vercel dashboard
  - No hardcoded secrets
  - Backup: Daily automated backups scheduled

- [ ] **Domain & DNS**
  - Primary domain: `app.mentor.example.com` (or live domain)
  - DNS records configured (A, CNAME, TXT)
  - SSL/TLS certificate valid (auto-managed by Vercel)
  - Email domain for notifications: `noreply@mentor.example.com`
  - Test: `curl -I https://app.mentor.example.com` returns 200

- [ ] **CDN & Global Performance**
  - Vercel Edge Network enabled
  - Static assets served from CDN (images, JS bundles)
  - Cache headers configured (Cache-Control, ETag)
  - Test: Check from different global regions via SpeedCurve or Cloudflare

- [ ] **Email Service**
  - SMTP configured (SendGrid, AWS SES, or similar)
  - Email templates created and tested
  - Test email account provisioned
  - Sender reputation monitored
  - Test: Send welcome email to test@mailinator.com

### Monitoring & Observability

- [ ] **Error Tracking (Sentry)**
  - Sentry project created for each app
  - DSN configured in production builds
  - Release versions tagged
  - Slack integration set up for critical errors
  - Test: Trigger error in staging, verify appears in Sentry

- [ ] **Uptime Monitoring (BetterStack)**
  - Synthetic monitoring endpoints created
  - Monitoring 5+ critical endpoints
  - Alert channels configured (Slack, email, SMS)
  - Response time SLA: < 2 seconds
  - Uptime target: 99.5%
  - Test: Stop a service, verify alert triggers

- [ ] **Application Performance Monitoring (Vercel Analytics)**
  - Web Vitals tracking enabled
  - Analytics dashboard accessible
  - Real user monitoring active
  - Test: Load app, check Vercel Analytics dashboard after 5 minutes

- [ ] **Video Analytics (Mux Data)**
  - Mux Data enabled in video player
  - Tracking: start, play, buffering, error events
  - Dashboard created for video metrics
  - Alerts set for error rate > 1%
  - Test: Watch video, check Mux Data dashboard

- [ ] **Database Monitoring**
  - Neon dashboard monitoring enabled
  - Query logs reviewed for slow queries
  - Connection pool monitored
  - Backup status verified
  - Test: View Neon dashboard, verify all metrics green

- [ ] **QStash Job Monitoring**
  - Queue monitoring enabled
  - Failed jobs alerting configured
  - Retry policies set appropriately
  - Dashboard accessible for job status
  - Test: Trigger background job, verify in QStash dashboard

### Disaster Recovery

- [ ] **Database Backup Strategy**
  - Automated backups: Daily at 2 AM UTC
  - Retention: 30-day backup history
  - Backup tested for restoration
  - Restore procedure documented
  - Test: Restore backup to test environment

- [ ] **Disaster Recovery Plan**
  - RTO (Recovery Time Objective): 4 hours
  - RPO (Recovery Point Objective): 1 hour
  - Failover procedures documented
  - Team trained on incident response
  - Test: Simulate data loss, practice recovery

---

## Payment Processing

### Stripe Setup

- [ ] **Stripe Production Account**
  - Live API keys configured in production
  - Webhook secret stored securely (env var)
  - Webhook endpoints registered:
    - `https://api.mentor.example.com/webhooks/stripe` (charge, subscription events)
  - Test: Create test charge, verify webhook received

- [ ] **Product & Price Configuration**
  - Pro subscription: $9.99/month (or regional pricing)
  - Premium subscription: $19.99/month
  - Prices created for all regions (USD, EUR, GBP, etc.)
  - Test: Attempt purchase on staging, verify in Stripe dashboard

- [ ] **Payment Method Validation**
  - Cards accepted: Visa, Mastercard, Amex, Discover
  - Mobile payment: Apple Pay, Google Pay enabled
  - Declined card handling: Clear error messages
  - Test: Use test card 4242 4242 4242 4242

- [ ] **Subscription Lifecycle**
  - Renewal billing configured
  - Cancellation at end of period works
  - Immediate cancellation with refund option
  - Upgrade/downgrade between tiers supported
  - Test: Create subscription, upgrade, cancel

- [ ] **Invoice & Receipts**
  - Invoices generated automatically
  - Email receipts sent to customer
  - Receipt contains: order ID, amount, date, items
  - Test: Purchase course, verify email receipt

- [ ] **PCI Compliance**
  - Card data never handled by Mentor servers (use Stripe.js)
  - No card data in logs
  - PCI compliance verified
  - Compliance certification documented

### Refund Policy

- [ ] **Refund Process**
  - Refund policy documented on website
  - Refund request form accessible
  - Manual refund process: Admin approves, Stripe processes
  - Refunds processed within 5-7 business days
  - Test: Request refund, verify receipt in Stripe

---

## Content & Courses

### Pilot Courses

- [ ] **Course Content Quality**
  - Minimum 5 complete pilot courses
  - Each course: 8-12 high-quality lessons
  - Video quality: 1080p minimum, optimized for streaming
  - Duration: 20-45 minutes per course
  - Test: Enroll in pilot course, watch all lessons, verify playback

- [ ] **Curriculum Content**
  - Course titles clear and descriptive
  - Descriptions include learning outcomes
  - Prerequisites listed (if any)
  - Difficulty level marked (beginner, intermediate, advanced)
  - Test: View course details, verify all metadata

- [ ] **Video Transcoding**
  - All videos transcoded via Mux
  - Multiple quality options: 480p, 720p, 1080p
  - Adaptive bitrate streaming (HLS/DASH) working
  - Video duration tracking accurate
  - Test: Play video, switch quality, verify smooth transition

- [ ] **Closed Captions**
  - All videos have accurate captions
  - Captions auto-generated + manually reviewed
  - Caption upload in Mux completed
  - Captions toggle working in player
  - Test: Enable captions, verify accuracy

### Instructional Materials

- [ ] **Course PDFs/Resources**
  - Downloadable resources available for each course
  - Files: makeup guides, product lists, reference PDFs
  - Storage: Cloud storage (S3/GCS)
  - Test: Download resource, verify file integrity

- [ ] **Practice Exercises**
  - Each course includes 2-5 practice exercises
  - Exercises have clear instructions
  - Submission and feedback mechanism working
  - Test: Submit practice exercise, verify instructor notification

### Email Templates

- [ ] **Welcome Email**
  - Sent on account creation
  - Template: `welcome.html`
  - Contains: welcome message, getting started guide, support link
  - Test: Create account, verify email received

- [ ] **Course Enrollment Email**
  - Sent when user enrolls
  - Contains: course title, first lesson link, completion guide
  - Test: Enroll in course, verify email

- [ ] **Certificate Email**
  - Sent on course completion
  - Contains: certificate preview/PDF, social share options
  - Test: Complete course, verify certificate email

- [ ] **Password Reset Email**
  - Sent on password reset request
  - Contains: reset link (valid for 15 minutes), security notice
  - Test: Request password reset, click link, reset password

- [ ] **Subscription Confirmation Email**
  - Sent on successful subscription
  - Contains: subscription details, cancellation link, invoice
  - Test: Subscribe, verify email

- [ ] **Email Template Testing**
  - All templates tested on desktop/mobile email clients
  - No broken images or links
  - Responsive design verified
  - Test: Open in Gmail, Outlook, Apple Mail

### Community & Moderation

- [ ] **Community Guidelines**
  - Posted publicly on website and in app
  - Clear expectations for user behavior
  - Prohibited content list: harassment, spam, violence
  - Violation consequences explained
  - Test: Read guidelines, acknowledge before posting

- [ ] **Content Moderation System**
  - Report button on all user content
  - Admin dashboard shows flagged content
  - Moderation queue reviewed daily
  - Response time: flag reviewed within 24 hours
  - Test: Flag a post, verify in admin dashboard

- [ ] **Dubbing/Translation Pipeline**
  - If applicable: Dubbing for non-English content ready
  - Translation API (Mux captions) configured
  - Regional pricing for translated content
  - Test: Verify foreign language course available

---

## App Store Submissions

### iOS (Apple App Store)

- [ ] **App Store Connect Account**
  - Account created and team members added
  - Bundle ID registered: `com.example.mentor`
  - Provisioning profiles created
  - Certificates current and valid

- [ ] **App Metadata Complete**
  - App name, subtitle, description finalized
  - Keywords selected (max 100 chars)
  - Screenshots (6 per language) uploaded
  - App preview video (optional)
  - Privacy policy URL provided

- [ ] **Privacy & Legal**
  - Privacy Policy linked in App Store Connect
  - Terms of Service in app or linked
  - Age rating completed (IARC)
  - Data Safety form completed

- [ ] **Technical Requirements**
  - Target iOS 14+, compiled with Xcode 15+
  - Universal app (iPhone + iPad support)
  - Orientation: portrait + landscape supported
  - No external links to payment (App Store policy)

- [ ] **In-App Purchase Setup**
  - Subscription products created in App Store Connect
  - Prices set for all regions
  - Renewal rates correct
  - Test: Test purchase with sandbox account

- [ ] **TestFlight Beta**
  - TestFlight build uploaded
  - Internal testers added
  - 24-hour processing wait completed
  - External testers invited (up to 10K)
  - Feedback collected, critical issues fixed

- [ ] **App Review Submission**
  - All checklist items completed
  - Demo account provided for reviewers
  - Video showing core features recorded
  - Submitted to App Review
  - Status monitored in App Store Connect

### Android (Google Play Store)

- [ ] **Google Play Console**
  - Developer account created
  - App registered: `com.example.mentor`
  - Signing key generated and uploaded

- [ ] **Store Listing**
  - App description (4K chars) complete
  - Short description (80 chars) compelling
  - Keywords selected
  - Screenshots (2-8) uploaded for phone/tablet
  - Feature graphic uploaded (1024x500)

- [ ] **Data Safety Form**
  - Data collection questionnaire completed
  - All permissions justified
  - Third-party integrations disclosed
  - User consent mechanisms implemented

- [ ] **Content Rating**
  - IARC questionnaire completed
  - Age rating determined and set
  - Content descriptors selected

- [ ] **In-App Purchase**
  - Subscription products created in Google Play
  - Pricing set by region
  - Sandbox account created for testing
  - Test: Test purchase on staging

- [ ] **Internal Testing**
  - Build uploaded to internal test track
  - Internal team has APK
  - No crashes after 24 hours of testing
  - Verified on target API levels (24+)

- [ ] **Closed Testing**
  - Build promoted to closed test track
  - External testers invited (up to 1K)
  - 7-day testing period
  - Feedback collected, issues fixed

- [ ] **Play Store Submission**
  - Build ready for production release
  - All metadata reviewed
  - Pre-launch report checked (no critical issues)
  - Submitted for review

---

## Testing & Quality Assurance

### Test Coverage

- [ ] **Unit Tests**
  - Coverage ≥ 85% for shared packages
  - Coverage ≥ 90% for critical API paths
  - All tests passing in CI

- [ ] **Integration Tests**
  - API endpoints tested with real database
  - Payment flows tested with Stripe sandbox
  - Video flows tested with Mux test assets
  - All tests passing

- [ ] **E2E Tests**
  - Critical flows tested: auth, discovery, video, payment
  - Cross-browser testing (Chrome, Firefox, Safari)
  - Mobile E2E tests for learner app
  - All tests passing with >95% reliability

- [ ] **Load Testing**
  - API tested with 500+ concurrent users
  - Video streaming tested with 100+ concurrent streams
  - No errors under load (< 0.1% error rate)
  - Performance targets met under load

- [ ] **Accessibility Testing**
  - WCAG 2.1 AA compliance verified
  - Screen reader testing (NVDA, JAWS, VoiceOver)
  - Color contrast verified
  - Keyboard navigation functional

- [ ] **Security Testing**
  - OWASP Top 10 audit completed
  - SQL injection testing passed
  - XSS vulnerability scan clean
  - Dependency vulnerability scan passed
  - Penetration testing completed

### Device & Platform Testing

- [ ] **iOS Device Testing**
  - iPhone 13, 14, 15 tested
  - iPad Pro tested
  - iOS 14, 15, 16, 17 tested
  - No crashes observed
  - Performance acceptable

- [ ] **Android Device Testing**
  - Tested on API level 24, 29, 34
  - Samsung Galaxy S21, S23, S24
  - Google Pixel 7, 8
  - No crashes
  - Performance acceptable

- [ ] **Web Browser Testing**
  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest)
  - Edge (latest)
  - Mobile browsers (Chrome Mobile, Safari iOS)

- [ ] **Network Condition Testing**
  - Slow 3G tested (video buffering acceptable)
  - 4G/5G tested
  - Offline mode tested (cached data shown)
  - Network failure recovery tested

### User Acceptance Testing

- [ ] **Stakeholder Sign-Off**
  - Product owner: approved all features
  - Design lead: UX/UI finalized
  - Legal: compliance verified
  - Operations: readiness confirmed
  - Finance: payment processing validated

---

## Security & Data Protection

### Security Hardening

- [ ] **SSL/TLS**
  - HTTPS enforced on all traffic
  - TLS 1.2+ required
  - HSTS header set: `max-age=31536000; includeSubDomains`
  - Certificate auto-renewal configured
  - Test: `curl -I https://app.mentor.example.com` shows HTTPS

- [ ] **Authentication**
  - Passwords hashed with bcrypt (12+ salt rounds)
  - JWT tokens expire after 24 hours
  - Refresh tokens implemented
  - Session timeout: 30 minutes inactivity
  - Test: Login, wait 25+ hours, verify re-authentication required

- [ ] **Authorization**
  - Role-based access control (RBAC) implemented
  - API endpoints enforce authorization
  - Learner cannot access mentor data
  - Mentor cannot access admin panels
  - Test: Login as learner, attempt admin endpoint, get 403

- [ ] **API Security**
  - Rate limiting: 100 requests/minute per IP
  - Input validation: all user inputs sanitized
  - CORS configured: whitelist specific origins
  - SQL injection prevention: parameterized queries (Drizzle ORM)
  - Test: Attempt SQL injection, verify blocked

- [ ] **Secrets Management**
  - No secrets hardcoded in code
  - Environment variables used for all secrets
  - Vercel secrets manager used
  - Secret rotation policy documented
  - Test: Code review shows no API keys

- [ ] **Data Encryption**
  - Sensitive data encrypted at rest (AES-256)
  - Payment data handled by Stripe (no storage)
  - Database connections encrypted (TLS)
  - Test: Database logs show no plaintext sensitive data

- [ ] **Logging & Monitoring**
  - Security events logged: auth, authorization, data access
  - Logs retained for 90 days
  - Log aggregation via Sentry/logging service
  - Alerts set for suspicious activity
  - Test: Attempt unauthorized access, verify logged

### DRM & Content Protection

- [ ] **FairPlay DRM (iOS)**
  - FairPlay configured in Mux for all videos
  - Playback ID policy restricts to iOS apps
  - License server responding correctly
  - Test: iOS device plays video, browser cannot

- [ ] **Widevine DRM (Android)**
  - Widevine L3 configured in Mux for all videos
  - Package name whitelist: `com.example.mentor`
  - License server responding correctly
  - Test: Android device plays video, other apps cannot

- [ ] **Web Video Protection**
  - Video URLs not directly accessible
  - Mux signed URLs expire after 24 hours
  - Test: Share video URL with non-authenticated user, access denied

---

## Analytics & Events

### Event Tracking

- [ ] **User Events**
  - Signup tracked
  - Login tracked
  - Course enrollment tracked
  - Video start/completion tracked
  - Instructor followed tracked
  - Post created/liked tracked
  - Test: Create event, verify in analytics dashboard

- [ ] **Business Events**
  - Subscription started tracked
  - Subscription canceled tracked
  - Course purchased tracked
  - Payment succeeded/failed tracked
  - Test: Complete payment, verify in analytics

- [ ] **Technical Events**
  - Page load time tracked (Web Vitals)
  - API response time tracked
  - Video playback quality tracked
  - Buffering events tracked
  - Test: Load page, check Vercel Analytics

- [ ] **Analytics Dashboard**
  - Google Analytics configured (UA or GA4)
  - Custom dimensions: user_type, subscription_tier, video_quality
  - Conversion funnels set up: signup → enrollment → subscription
  - Test: Create test event, verify appears in dashboard after 24 hours

### Performance Metrics

- [ ] **Web Vitals Monitoring**
  - TTFB < 800ms monitored
  - LCP < 2.5s monitored
  - FID < 100ms monitored
  - CLS < 0.1 monitored
  - Alerts set if metrics exceed thresholds
  - Test: Monitor Vercel Analytics dashboard

- [ ] **API Metrics**
  - Response time p95 < 500ms (uncached) monitored
  - Response time p95 < 200ms (cached) monitored
  - Error rate < 0.1% monitored
  - Test: Run load test, verify metrics in Sentry

- [ ] **Video Metrics**
  - Video start time < 2s monitored
  - Buffering rate < 1% monitored
  - Video error rate < 0.5% monitored
  - Test: Monitor Mux Data dashboard

---

## Launch Preparation

### Final Checks (48 hours before launch)

- [ ] **Database Health**
  - All migrations run successfully
  - No orphaned records
  - Indexes optimized
  - Backup recent and tested
  - Test: Query database, verify data integrity

- [ ] **Payment System**
  - Stripe live keys verified
  - Test charges processed successfully
  - Webhook endpoints responding
  - Email receipts sent correctly

- [ ] **Email Delivery**
  - Email service operational
  - SMTP credentials verified
  - Test emails delivered within 1 minute
  - Bounce handling configured

- [ ] **Monitoring Systems**
  - Sentry active and logging errors
  - Uptime monitoring running
  - Analytics tracking working
  - Alert channels tested (Slack, email)

- [ ] **CDN & Performance**
  - All static assets cached
  - Cache expiration headers set
  - Global CDN responding
  - Load test results acceptable

- [ ] **Documentation**
  - Runbook for common issues created
  - Emergency procedures documented
  - Contact information for escalation updated
  - Team trained on incident response

### Launch Day Checklist

- [ ] **Monitoring Active**
  - All monitoring tools running
  - Team members have dashboard access
  - Alert channels tested
  - War room established (Slack channel)

- [ ] **Gradual Rollout**
  - App rolled out to 10% of users
  - Monitor for 4 hours, check metrics
  - No critical issues found, proceed to 50%
  - Monitor 50% for 4 hours
  - Proceed to 100% if all clear

- [ ] **Communication**
  - Status page updated
  - Social media announcement ready
  - Support team briefed on common issues
  - Customer success team ready for user onboarding

- [ ] **Incident Management**
  - Incident response team on standby
  - Escalation procedures clear
  - Rollback procedures tested and ready
  - Communication templates prepared

### Post-Launch (First Week)

- [ ] **Daily Monitoring**
  - Crash rate < 0.1%
  - API response time acceptable
  - Video playback error rate < 0.5%
  - No database issues

- [ ] **User Feedback**
  - Support tickets monitored
  - Feedback collected via in-app surveys
  - Critical issues triaged and fixed
  - Hot fixes deployed as needed

- [ ] **Performance Optimization**
  - Database slow query log reviewed
  - Cache hit rates analyzed
  - Frontend performance optimized if needed
  - Video quality adjusted based on real-world playback

---

## Sign-Off

| Role              | Name       | Date   | Signature  |
| ----------------- | ---------- | ------ | ---------- |
| Product Manager   | **\_\_\_** | **\_** | **\_\_\_** |
| Engineering Lead  | **\_\_\_** | **\_** | **\_\_\_** |
| QA Lead           | **\_\_\_** | **\_** | **\_\_\_** |
| Security Lead     | **\_\_\_** | **\_** | **\_\_\_** |
| Legal/Compliance  | **\_\_\_** | **\_** | **\_\_\_** |
| Operations        | **\_\_\_** | **\_** | **\_\_\_** |
| Executive Sponsor | **\_\_\_** | **\_** | **\_\_\_** |

---

## Appendix: Critical Issues Resolution

If any critical issues are found during final checks:

1. **Severity Assessment**: Critical, High, Medium, Low
2. **Triage**: Assign to responsible engineer
3. **Fix & Test**: Fix issue, test in staging
4. **Verification**: QA validates fix
5. **Deployment**: Deploy to production
6. **Monitoring**: Monitor for regression
7. **Post-Mortem**: Document root cause and prevention

**Rollback Plan**: If major issue impacts launch

- Revert to last known good build
- Communicate delay to users
- Reschedule launch (48 hours minimum)
- Root cause analysis
- Fix and re-test
- New launch date announced

---

## Success Criteria

✓ All checklist items completed
✓ Zero critical/security issues
✓ Performance targets met under load
✓ All stakeholders signed off
✓ Monitoring systems operational
✓ Runbooks and procedures documented
✓ Team trained and ready
✓ Launch sequence tested
✓ Rollback procedures ready
✓ Communication plan finalized

**Launch approval: APPROVED / HOLD FOR FIXES**
