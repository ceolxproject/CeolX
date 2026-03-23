# Project Progress

## Milestone 01: Repo & Infra Setup

- [x] 01 — Turborepo monorepo init
- [x] 02 — App scaffolding
- [x] 03 — Package scaffolding — PR #1
- [x] 04 — TypeScript config — PR #2
- [x] 05 — ESLint, Prettier, EditorConfig — PR #3
- [x] 06 — Husky, CommitLint, Lint-Staged
- [x] 07 — GitHub Actions CI/CD — PR #3
- [x] 08 — Vercel project setup — PR #3
- [x] 09 — Neon database provisioning
- [x] 09b — CORS configuration — PR #6
- [x] 10 — Cloudflare R2 setup — PR #3
- [x] 11 — Environment variables
- [x] 12 — Sentry error tracking — PR #3
- [x] 13 — API rate limiting middleware — PR #5
- [x] 14 — QStash background jobs
- [x] 15 — Postmark email service — PR #7

## Milestone 02: Database Schema

- [x] 01 — Drizzle ORM setup and configuration — PR #4
- [x] 02 — Users and profiles tables — PR #4
- [x] 03 — Authentication sessions and OAuth tables — PR #4
- [x] 04 — RBAC roles and permissions tables — PR #4
- [x] 05 — Instructor applications table — PR #4
- [x] 06 — Courses, modules, and lessons tables — PR #4
- [x] 07 — Categories and tags tables — PR #4
- [x] 08 — Resources and assignments tables — PR #4
- [x] 09 — Enrollments and progress tracking tables — PR #4
- [x] 10 — Subscriptions and payments tables — PR #4
- [x] 11 — Community tables — PR #4
- [x] 12 — Notifications tables — PR #4
- [x] 13 — Audit logs tables — PR #4
- [x] 14 — Consent records table — PR #4
- [x] 15 — Data export and account deletion tables — PR #4
- [x] 16 — Team management tables — PR #4
- [x] 17 — Seed data and migration strategy — PR #8

## Milestone 03: Design System & Shared Packages

- [x] 01 — Tailwind CSS v4 configuration
- [x] 02 — shadcn/ui initialization and brand theme
- [x] 03 — Shared web components library — PR #10
- [x] 04 — UniWind CSS setup for React Native
- [x] 05 — Shared React Native components library — PR #14, PR #17
- [x] 06 — Validators package (Zod schemas) — PR #11
- [x] 07 — i18n package scaffold
- [x] 08 — API client package
- [x] 09 — Analytics adapter package
- [x] 10 — Cache adapter package
- [x] 11 — Utilities package
- [x] 12 — Analytics event tracking
- [x] 13 — Google Tag Manager setup

## Milestone 04: Authentication & Onboarding

- [x] 01 — BetterAuth core setup — PR #12
- [x] 02 — Email/password signup — PR #18
- [x] 03 — Email verification
- [x] 04 — Email/password sign-in
- [ ] 05 — Google sign-in
- [ ] 06 — Apple sign-in
- [x] 07 — Forgot password flow
- [x] 09 — Account lockout
- [ ] 10 — Session management
- [x] 11 — RBAC roles setup — PR #36
- [x] 12 — Learner onboarding wizard — PR #37
- [x] 13 — Instructor application form — PR #40
- [x] 14 — Instructor approval flow — PR #42
- [x] 15 — Privacy & terms acceptance
- [x] 16 — Re-verification for sensitive actions — PR #43

## Milestone 05: Course Management

- [x] course-creation-api — Course creation API — PR #44
- [x] module-management — Module management — PR #45
- [x] lesson-management — Lesson management — PR #46
- [x] course-builder-ui-lesson — Course builder UI (lesson type)
- [x] course-builder-ui-masterclass — Course builder UI (masterclass type) — PR #54
- [x] video-upload-mux-direct — Video upload (Mux direct)
- [x] course-thumbnail-upload — Course thumbnail upload
- [x] resource-upload-management — Resource upload and management — PR #48
- [x] r2-signed-urls-resources — R2 signed URLs for resources
- [x] draft-save-functionality — Draft save functionality
- [x] drag-drop-reordering — Drag-and-drop reordering
- [x] publish-validation-flow — Publish validation flow
- [x] published-course-editing — Published course editing
- [x] course-unpublish-archive — Course unpublish and archive
- [x] video-replacement-flow — Video replacement flow
- [x] assignment-mcq-creation — Assignment/MCQ creation
- [x] community-settings-per-course — Community settings per course
- [x] course-analytics-instructor — Course analytics (instructor) — PR #65

## Milestone 06: Course Discovery & Browsing

- [x] 01 — Course catalog API — PR #75
- [x] 02 — Course catalog UI (learner web) — PR #76
- [x] 03 — Course catalog UI (React Native mobile) — PR #77
- [x] 04 — Typesense search setup — PR #80
- [x] 05 — Search as-you-type — PR #81
- [x] 06 — Category filters — PR #81
- [x] 07 — Free/paid filter — PR #81
- [x] 08 — Course detail page (learner web) — PR #79
- [x] 09 — Course detail page (React Native mobile) — PR #84
- [x] 10 — Interested count feature — PR #81
- [x] 11 — Related courses feature — PR #85
- [x] 12 — SEO landing pages — PR #88
- [x] 13 — Learner profile page (web) — PR #96

## Milestone 07: Video Player & Learning

- [x] mux-player-integration-web — Mux player integration (web) — PR #89
- [x] mux-player-integration-mobile — Mux player integration (mobile) — PR #95
- [x] drm-setup-widevine — DRM setup: Widevine — PR #99
- [x] drm-setup-fairplay — DRM setup: FairPlay — PR #101
- [x] drm-setup-playready — DRM setup: PlayReady — PR #104
- [x] mux-signed-urls — Mux signed URLs and video security — PR #99
- [x] progress-tracking-api — Progress tracking API
- [x] lesson-completion-logic — Lesson completion logic — PR #105
- [x] resume-playback — Resume playback — PR #111
- [x] playback-speed-control — Playback speed control — PR #120
- [x] transcripts-display — Transcripts display and search — PR #121
- [x] caption-language-selection — Caption/subtitle language selection — PR #124
- [x] audio-language-selection — Audio language selection (multi-dub) — PR #128
- [x] notes-per-lecture — Personal notes per lecture — PR #132
- [x] bookmarks-feature — Course bookmarks — PR #134
- [x] lesson-comments — Lesson comments — PR #138
- [x] assignment-submission-web — Assignment/MCQ submission (web) — PR #137
- [x] course-completion-flow — Course completion flow — PR #136

## Milestone 08: Payments & Subscriptions

- [x] 01 — Stripe Billing setup — PR #50
- [x] 02 — Subscription plans API — PR #51
- [x] 03 — Stripe Checkout one-time purchase — PR #56
- [x] 04 — Free course enrollment — PR #57
- [x] 05 — Promo code application — PR #58
- [x] 06 — Stripe Customer Portal integration — PR #59
- [x] 07 — Payment history API — PR #60
- [x] 08 — Stripe webhook handlers — PR #61
- [x] 09 — Subscription upgrade/downgrade — PR #62
- [x] 10 — Subscription cancellation — PR #63
- [x] 11 — Failed payment handling and recovery — PR #64

## Milestone 09: Community & Engagement

- [x] 01 — Community feed API — PR #102
- [x] 02 — Community feed UI (web) — PR #103
- [x] 03 — Community feed UI (React Native mobile) — PR #108
- [x] 04 — Post interactions (like, comment, hide) — PR #110
- [x] 05 — Q&A system on lessons — PR #123
- [ ] 06 — FCM push notifications setup
- [ ] 07 — In-app notification inbox
- [ ] 08 — Notification preferences and GDPR compliance
- [ ] 09 — Grouped and batched notifications
- [ ] 10 — Community guidelines screen
- [ ] 11 — Mentor community management tools

## Milestone 10: Instructor Dashboard & Revenue

- [x] 01 — Earnings dashboard API — PR #89
- [x] 02 — Earnings dashboard UI — PR #90
- [x] 03 — Revenue calculation: single purchase (70/30 split) — PR #91
- [x] 04 — Revenue calculation: All Access subscription pool — PR #97
- [x] 05 — Stripe Connect onboarding — PR #98
- [x] 06 — Payout history — PR #118
- [x] 07 — Team invite flow — PR #126
- [ ] 08 — Team member onboarding
- [x] 09 — Team dashboard (includes edit team member) — PR #131
- [ ] 10 — Activity logs (mentor-side)
- [ ] 11 — Instructor profile management (post-approval)
- [ ] 12 — Instructor learner management

## Milestone 11: Super Admin Panel

- [ ] 01 — Admin authentication and password management
- [x] 02 — Admin dashboard metrics — PR #113
- [x] 03 — Admin notification inbox — PR #116
- [x] 04 — Instructor approval management — PR #125
- [ ] 05 — User management CRUD (includes user status management)
- [ ] 06 — Login as mentor (impersonation)
- [ ] 07 — Course oversight
- [ ] 08 — Category and tag management
- [ ] 09 — Promo banner management
- [x] 10 — Subscription tier configuration — PR #115
- [ ] 11 — All Access course eligibility
- [ ] 12 — Team plan visibility
- [x] 13 — Coupon management — PR #122
- [ ] 14 — Payout processing
- [ ] 15 — Onboarding settings configuration
- [ ] 16 — Activity logs (admin)
- [ ] 17 — Web course visibility controls
- [ ] 18 — Admin deactivate instructor flow
- [ ] 19 — All-Access change notifications

## Milestone 12: Internationalization & Localization

- [ ] 01 — Configure react-i18next across all apps
- [ ] 02 — Create all JSON locale files scaffold
- [ ] 03 — Configure ESLint no-hardcoded-strings rule
- [ ] 04 — URL-based locale routing for Next.js
- [ ] 05 — Language switcher UI component
- [ ] 06 — ElevenLabs dubbing pipeline
- [ ] 07 — Attach dubbed audio tracks to Mux assets
- [ ] 08 — Generate and attach localized caption tracks
- [ ] 09 — Localize Postmark email templates
- [ ] 10 — Localize FCM push notifications

## Milestone 13: Compliance & GDPR

- [ ] 01 — Cookie consent banner
- [ ] 02 — Cookie consent storage and enforcement
- [ ] 03 — Account deletion (learner)
- [ ] 04 — Account deletion (instructor)
- [ ] 05 — Data export (learner)
- [ ] 06 — Data export (instructor)
- [ ] 07 — Consent logging system
- [ ] 08 — Automated anonymization
- [ ] 09 — Report content feature
- [ ] 10 — Block user feature
- [ ] 11 — Account suspension screen
- [ ] 12 — Push notification permission flow
- [ ] 13 — Admin data access logging
- [ ] 14 — Admin deletion processing
- [ ] 15 — Admin export management
- [ ] 16 — IP anonymization cron job
- [ ] 17 — Explicit consent for instructor ID upload

## Milestone 14: Mobile App

- [x] 01 — Expo project setup — PR #106
- [x] 02 — Mobile navigation structure — PR #106
- [x] 03 — Mobile auth screens — PR #106
- [x] 04 — Mobile onboarding flow (delegated to web via in-app browser) — PR #106
- [x] 05 — Mobile course catalog — PR #77
- [x] 06 — Mobile course detail — PR #84
- [x] 07 — Mobile video player — PR #95
- [x] 08 — Mobile progress tracking — PR #112
- [x] 09 — Mobile transcripts and notes — PR #119
- [ ] 10 — Mobile bookmarks and assignments
- [ ] 11 — Mobile community
- [ ] 12 — Mobile payments and deep linking
- [x] 13 — Mobile profile and settings (includes data export request) — PR #107
- [ ] 14 — Mobile push notifications
- [ ] 15 — Mobile DRM implementation
- [ ] 16 — Mobile deep linking
- [ ] 17 — Mobile App Store compliance
- [ ] 18 — Mobile Firebase Analytics setup

## Milestone 15: Testing & Pre-Launch

- [ ] e2e-test-suite — End-to-end test suite
- [ ] unit-integration-tests — Unit and integration tests
- [ ] performance-benchmarks — Performance benchmarks and load testing
- [ ] security-audit — Security audit and compliance
- [ ] uat-plan — User acceptance testing plan
- [ ] monitoring-alerting-setup — Monitoring and alerting setup
- [ ] apple-app-store-submission — Apple App Store submission
- [ ] google-play-store-submission — Google Play Store submission
- [ ] pre-launch-checklist — Pre-launch comprehensive checklist
