# M12-T2 · App Store & Play Store Submissions

| Field | Value |
|-------|-------|
| **Milestone** | M12 — QA & Launch |
| **Status** | 🔲 To Do |
| **Depends on** | M12-T1 (QA passed), M1-T4 (EAS Build configured) |
| **PRD Ref** | Section 10.1 (Mobile App — Expo EAS) |

---

## Description
Prepare and submit the app to Apple App Store and Google Play Store. Covers metadata, screenshots, privacy declarations, and compliance checks — particularly Apple's requirements around Apple Sign-In and payment rules.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/mobile` | Production EAS Build, `app.config.ts` finalisation |

---

## API Endpoints
None — submission/operations task.

---

## Requirements
- R1: Production EAS Build created with `eas build --profile production` for both iOS and Android — zero errors
- R2: iOS: bundle ID, app name, version, build number set correctly in `app.config.ts`
- R3: iOS: all required permissions declared with usage descriptions (`NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`)
- R4: Apple App Store metadata: app name, subtitle, description, keywords, support URL, privacy policy URL, age rating
- R5: App Store screenshots for required device sizes (iPhone 6.9", iPhone 6.5", iPad Pro if applicable)
- R6: Apple Privacy Nutrition Label completed — data types collected: location, email, name, user content
- R7: Apple Sign-In capability added in Apple Developer Portal; provisioning profiles regenerated
- R8: Google Play metadata: title, short description, full description, screenshots, content rating questionnaire
- R9: Google Play: data safety section completed to match Apple privacy declarations
- R10: Both stores: Privacy Policy URL and Terms of Service URL live and accessible before submission

---

## Acceptance Criteria
- [ ] Production EAS build for iOS succeeds and installs on a physical device
- [ ] Production EAS build for Android succeeds and installs on a physical device
- [ ] iOS submission passes Apple's automated pre-review checks
- [ ] All required App Store metadata and screenshots uploaded
- [ ] Privacy Nutrition Label completed accurately
- [ ] Google Play submission passes automated checks
- [ ] Both Privacy Policy and Terms of Service documents live at accessible URLs

---

## Technical Notes
- Apple review typically takes 1–3 business days for a new app — submit well in advance of the planned launch date
- Google Play review for a new app typically takes 1–7 days
- The Privacy Policy and Terms of Service must be drafted and hosted before submission — flag this dependency to the client early
- Ensure `ceolx.ie/subscribe` is live and accessible before iOS submission — Apple reviewers may attempt to access it
- Apple Sign-In must be working on a TestFlight build before production submission — do not skip TestFlight testing
