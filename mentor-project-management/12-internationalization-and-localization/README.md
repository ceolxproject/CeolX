# Internationalization & Localization Milestone (12-i18n-l10n)

## Overview

Complete internationalization and localization implementation for Mentor by Mentor, supporting 4 languages: English (EN), Spanish (ES), French (FR), Russian (RU).

**Key Principles:**

- Zero hardcoded strings - all UI text via react-i18next keys
- URL-based locale routing for web SEO (/en/, /es/, /fr/, /ru/)
- Multi-track audio dubbing via ElevenLabs API
- Independent caption/subtitle tracks in Mux
- Fully localized transactional emails and push notifications

---

## Task Files (10 Total - 6,810 Lines)

### 1. React-i18next Setup (347 lines)

**File:** `01-react-i18next-setup.md`

Core i18n infrastructure initialization across all apps:

- Configure react-i18next for Next.js and React Native
- Language detection: URL for web, device locale for mobile
- Namespace setup (common, auth, course, mentor, admin, notification)
- SSR support with hydration safety
- Client-side language switching without reload

**Key Deliverables:**

- i18n initialized with 4 languages in all apps
- Namespace loading and fallback to EN
- Language switching hooks
- Testing configuration

---

### 2. Locale Files Scaffold (705 lines)

**File:** `02-locale-files-scaffold.md`

Complete JSON locale file structure for 500+ UI strings:

- Directory structure: `locales/{en,es,fr,ru}/{namespace}.json`
- 6 namespaces: common, auth, course, mentor, admin, notification
- EN fully populated with professional copy
- ES/FR/RU with preliminary translations
- Key naming convention: camelCase hierarchy (e.g., `button.save`, `error.validation.email.invalid`)
- Translation guidelines for localization team

**Key Deliverables:**

- 24 locale JSON files (4 languages × 6 namespaces)
- 500+ keys with English and translated values
- Validation script for JSON syntax and completeness

---

### 3. ESLint No-Hardcoded-Strings (554 lines)

**File:** `03-eslint-no-hardcoded-strings.md`

ESLint enforcement preventing any hardcoded UI strings:

- Configure `eslint-plugin-i18next/no-literal-string` across all apps
- Error-level rule: CI/CD fails on violations
- Whitelist for technical strings (CSS classes, URLs, etc.)
- Pre-commit hook integration
- Auto-fix suggestions and team documentation

**Key Deliverables:**

- ESLint rule enforced across monorepo
- CI/CD pipeline fails on hardcoded strings
- Team guidelines and examples
- Gradual adoption strategy for existing codebases

---

### 4. URL-Based Locale Routing (578 lines)

**File:** `04-url-based-locale-routing.md`

Next.js middleware for /en/, /es/, /fr/, /ru/ URL prefixes:

- Locale detection from URL, user preference, Accept-Language header
- Middleware redirect to default/preferred locale
- SEO: hreflang tags, locale-specific sitemaps
- Deep linking with language preservation
- LocalizedLink component for automatic locale preservation

**Key Deliverables:**

- All routes support locale prefixes
- SEO compliance: hreflang, sitemaps
- Deep linking works correctly
- User language preference saved

---

### 5. Language Switcher UI (755 lines)

**File:** `05-language-switcher-ui.md`

Reusable language switcher component with 3 variants:

- Dropdown, button group, and radio button styles
- Flag icons (🇬🇧 🇪🇸 🇫🇷 🇷🇺) for visual identification
- Web: Changes URL locale prefix, updates i18n
- Mobile: Updates AsyncStorage, saves to user profile
- Loading states, error handling, retry logic
- Analytics event tracking

**Key Deliverables:**

- Reusable component in packages/ui-components
- Works in Settings and Onboarding
- API integration for preference persistence
- Mobile and web implementations

---

### 6. ElevenLabs Dubbing Pipeline (874 lines)

**File:** `06-elevenlabs-dubbing-pipeline.md`

Automated video localization via ElevenLabs Dubbing API:

- Extract EN audio → submit to ElevenLabs → get ES/FR/RU audio
- Gender-consistent AI voice selection
- QStash background job processing
- Webhook + polling for completion handling
- Dubbed audio stored in R2, attached to Mux assets
- Exponential backoff error/retry logic

**Key Deliverables:**

- ElevenLabs API integration
- Dubbing pipeline with error handling
- QStash job processing
- Webhook handler with signature validation
- Admin dashboard for dubbing status

---

### 7. Mux Multi-Track Audio (757 lines)

**File:** `07-mux-multi-track-audio.md`

Attach dubbed audio tracks to Mux video assets:

- Create Mux text tracks for ES/FR/RU audio
- Mux Player built-in audio selector UI
- Fallback to EN if dubbed unavailable
- Seamless audio switching without buffering
- Analytics for audio selection
- Mobile player audio support

**Key Deliverables:**

- Mux Create Asset Track API integration
- Audio selector in player
- Fallback strategy implemented
- Multi-device testing passed

---

### 8. Captions SRT/VTT Generation (736 lines)

**File:** `08-captions-srt-vtt-generation.md`

Independent caption track generation in all 4 languages:

- Extract EN transcripts from Mux auto-transcription
- Translate ES/FR/RU via Google Translate API
- Generate VTT files (SRT optional)
- Proper timing sync: HH:MM:SS.mmm format
- Max 2 lines, 42 chars per line enforced
- Upload to Mux as text tracks
- WCAG 2.1 Level AA accessibility compliance

**Key Deliverables:**

- Transcription extraction from Mux
- Translation service integration
- VTT file generation with proper formatting
- Caption reflow for line length constraints
- Mux text track attachment

---

### 9. Email Template Localization (657 lines)

**File:** `09-email-template-localization.md`

Postmark transactional email templates (4 languages × 10 types):

- 40 total templates: verify, password reset, welcome, payment, enrollment, payout, renewal, completion, deletion, and more
- Dynamic variables: names, amounts, dates, links
- Template ID registry for easy lookup
- Automatic template selection per user language
- HTML + plain-text fallback
- Fallback to EN if translation unavailable

**Key Deliverables:**

- 40 Postmark email templates (documented)
- Email service with template registry
- Helper functions for currency/date formatting
- API endpoints for each email type
- Template tested in major email clients

---

### 10. Push Notification Localization (847 lines)

**File:** `10-push-notification-localization.md`

Firebase Cloud Messaging (FCM) for mobile + web notifications:

- 14 notification types × 4 languages (56 total)
- Template registry system
- FCM integration for Android, iOS, Web
- Device token management (multi-device support)
- Deeplinks with correct language locale
- Topic-based broadcast notifications
- Delivery + open/click analytics

**Key Deliverables:**

- FCM setup for mobile and web
- Notification template registry (56 templates)
- Service for sending localized notifications
- Mobile Expo push setup
- Web service worker integration

---

## Quick Reference

### Languages Supported

| Code | Language | Flag | Locale Code |
| ---- | -------- | ---- | ----------- |
| en   | English  | 🇬🇧   | en-US       |
| es   | Español  | 🇪🇸   | es-ES       |
| fr   | Français | 🇫🇷   | fr-FR       |
| ru   | Русский  | 🇷🇺   | ru-RU       |

### Namespaces (6 Total)

- **common** - General UI labels, buttons, navigation
- **auth** - Login, signup, password reset
- **course** - Course browsing, enrollment, learning
- **mentor** - Course creation, instructor features
- **admin** - Super admin panel
- **notification** - Toasts, alerts, messages

### Apps Affected

- `apps/web` (Next.js platform)
- `apps/mobile` (React Native Expo)
- `apps/admin` (Next.js super admin)
- `apps/instructor` (Next.js instructor dashboard)
- All supporting packages

### External Integrations

- **react-i18next** - Core i18n library
- **next-i18next** - Next.js i18n
- **ElevenLabs API** - Video dubbing
- **Mux API** - Video hosting + multi-track audio
- **Google Translate API** - Caption translation
- **Postmark** - Transactional emails
- **Firebase Cloud Messaging (FCM)** - Push notifications
- **QStash** - Background job processing
- **Cloudflare R2** - Media file storage

---

## Implementation Sequence

### Phase 1: Core Infrastructure (Tasks 1-3)

1. ✓ React-i18next setup
2. ✓ Locale files scaffold
3. ✓ ESLint no-hardcoded-strings

**Result:** All UI strings managed via i18n, hardcoded strings prevented

### Phase 2: Web Localization (Tasks 4-5)

4. ✓ URL-based locale routing
5. ✓ Language switcher UI

**Result:** Web app fully localized with URL-based routing and language switcher

### Phase 3: Content Localization (Tasks 6-8)

6. ✓ ElevenLabs dubbing pipeline
7. ✓ Mux multi-track audio
8. ✓ Captions/subtitles generation

**Result:** All course videos dubbed and captioned in 4 languages

### Phase 4: Communication Localization (Tasks 9-10)

9. ✓ Email templates (Postmark)
10. ✓ Push notifications (FCM)

**Result:** All transactional and engagement messaging localized

---

## Acceptance Criteria Summary

### UI/UX

- [x] Zero hardcoded strings (enforced via ESLint)
- [x] URL-based routing (/en/, /es/, /fr/, /ru/)
- [x] Language switcher in settings + onboarding
- [x] Language persistence across sessions
- [x] RTL-ready architecture (not required V1)

### Content Localization

- [x] 4 languages supported (EN, ES, FR, RU)
- [x] All course videos dubbed
- [x] Independent audio track selection
- [x] EN captions + 3 translated caption tracks
- [x] Independent caption selection

### Backend/API

- [x] Locale detection (URL/device/header/user pref)
- [x] Template-based email system
- [x] Template-based notifications
- [x] User language preference persistence
- [x] API endpoints for localization

### Testing

- [x] All 4 languages tested
- [x] Email clients tested (Gmail, Outlook, Apple)
- [x] Mobile devices tested (iOS, Android)
- [x] Web browsers tested
- [x] WCAG 2.1 Level AA compliance verified

### Monitoring

- [x] Analytics: language selection tracking
- [x] Analytics: audio selection tracking
- [x] Analytics: notification delivery tracking
- [x] Error logging for failed dubbing
- [x] Delivery metrics for emails/notifications

---

## Team Workflows

### For Developers

- Use `t()` hook for all user-facing text
- Never hardcode strings (ESLint will catch it)
- Follow key naming convention
- Add new strings to appropriate namespace
- Test with all 4 languages

### For Translators

- Update locale JSON files (ES, FR, RU)
- 500+ keys to translate across 6 namespaces
- Guidelines in `02-locale-files-scaffold.md`
- Access: provided after locale structure created

### For Video Content Team

- Upload EN video to Mux
- System auto-initiates dubbing pipeline
- Dubbed audio attached within 1-2 hours
- Captions auto-generated and attached
- No manual audio/caption management needed

### For Marketing/Growth

- Template system for emails and notifications
- Language automatically selected per user
- No manual template switching
- A/B testing supported via template variants

---

## Troubleshooting

### Missing Translation Key

- Check locale JSON file for key
- Falls back to EN if not found
- Add key to all 4 language files

### Audio Not Attached to Mux

- Check dubbing pipeline status: `/api/videos/{videoId}/dubbing/status`
- Check R2 storage for audio files
- Check Mux asset for audio tracks

### Email Not Localized

- Verify user language in profile
- Check Postmark template ID in registry
- Verify template exists in Postmark account
- Check email service logs

### Push Notification Not Received

- Verify device token registered
- Check FCM credentials
- Check user notification preferences
- Check device has enabled notifications

---

## Performance Targets

- Page load time: <3s with all translations
- Language switch: <500ms (client-side)
- Email delivery: <5 minutes
- Push notification delivery: <30 seconds
- Video dubbing: <2 hours per 1-hour video
- Caption generation: <30 minutes

---

## File Structure

```
12-internationalization-and-localization/
├── README.md (this file)
├── 01-react-i18next-setup.md
├── 02-locale-files-scaffold.md
├── 03-eslint-no-hardcoded-strings.md
├── 04-url-based-locale-routing.md
├── 05-language-switcher-ui.md
├── 06-elevenlabs-dubbing-pipeline.md
├── 07-mux-multi-track-audio.md
├── 08-captions-srt-vtt-generation.md
├── 09-email-template-localization.md
└── 10-push-notification-localization.md
```

---

## Documentation Links

Each task file includes:

- Detailed description
- Affected apps/packages
- Complete requirements
- Acceptance criteria
- Technical implementation with code examples
- Testing strategies
- Deployment steps
- Troubleshooting notes

---

## Contact & Support

For questions on specific tasks:

- Task 1-5: Frontend/i18n team
- Task 6-8: Video processing/backend team
- Task 9-10: Communications/backend team

Last Updated: 2025-02-18
Total Lines of Documentation: 6,810+
