# M12-T2 · iOS App Store & Android Play Store Submissions

| Field | Value |
|-------|-------|
| **Milestone** | M12 — Launch Readiness |
| **Status** | 🔲 To Do |
| **Depends on** | M12-T1 (QA passed on real devices), M1-T4 (EAS Build configured) |
| **PRD Ref** | Section 4.1 (Mobile App — Expo EAS), Section 10.2 (Infrastructure), GDPR (Privacy Policy) |

---

## Description

Submit the CeolX mobile app to Apple App Store (iOS) and Google Play Store (Android). This requires production EAS builds, platform-specific metadata and screenshots, privacy declarations, and strict compliance with Apple and Google platform rules (particularly Apple Rule 3.1.1 prohibiting third-party payment processors for in-app digital purchases, which CeolX satisfies via web-only Stripe subscription). The task is gated by QA passing and both legal documents (Privacy Policy, Terms of Service) being live. Submissions typically take 1–3 days (Apple) and 1–7 days (Google); submit well in advance of the launch date to allow for review iterations.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/mobile` | Production builds, app configuration, permissions, metadata |
| `apps/admin` | Privacy Policy and Terms of Service pages (ceolx.ie/privacy, ceolx.ie/terms) must be live |

---

## API Endpoints

No new endpoints. No API changes required for app store submission.

---

## Requirements

### EAS Build Configuration

- R1: Production EAS builds created for both iOS and Android using `eas build --platform all --profile production`
  - No build errors; build logs archived for troubleshooting
  - iOS build ID and Android build ID recorded for submission tracking
- R2: Both builds tested on real devices before submission (part of M12-T1)
  - iOS: installed via EAS CLI or TestFlight
  - Android: installed via EAS CLI or direct APK download

### iOS App Configuration (app.config.ts / eas.json)

- R3: **Bundle identifier**: `ie.ceolx.app` (must match Apple Developer provisioning profiles)
- R4: **App name**: "CeolX" (consistent across icon labels, App Store name, home screen)
- R5: **Version number**: semantic versioning (e.g., 1.0.0)
- R6: **Build number**: incremented for each build (e.g., 1, 2, 3 for production)
- R7: **Permissions declared** in `app.json` with usage descriptions:
  - `NSLocationWhenInUseUsageDescription`: "CeolX uses your location to find live music events near you."
  - `NSCameraUsageDescription`: "Camera access is required to record video for promotional posts."
  - `NSPhotoLibraryUsageDescription`: "We need access to your photos to upload profile images and event covers."
  - `NSPhotoLibraryAddOnlyUsageDescription`: "Permission to save event details and tickets to Photos."
- R8: **Minimum iOS version**: iOS 14.0 or later (supports wide device range; Expo default is 13.4)
- R9: **Expo SDK version**: pinned in `package.json` (e.g., 51.0.0); consistent with build configuration
- R10: **App Icon**: 1024x1024 PNG (AppIcon.png in assets folder); no rounded corners (App Store rounds them)
- R11: **Launch screen**: must be provided (Expo generates default; can be customized)

### iOS App Store Submission Metadata

- R12: **App name**: "CeolX" (exactly as it appears on home screen and App Store)
- R13: **Subtitle**: "Discover Live Irish Music" (optional but recommended for discoverability)
- R14: **Description**: 2-3 sentences describing the app, target audience, key features
  - Example: "Explore live Irish music events near you. Connect with musicians and venues, discover sessions, and book performances. Available across Ireland."
- R15: **Keywords**: max 100 characters, comma-separated
  - Example: "Irish music, live events, trad, céilí, sessions, booking, musicians"
- R16: **Support URL**: `https://ceolx.ie/support` (must be live and working)
- R17: **Privacy Policy URL**: `https://ceolx.ie/privacy` (must be live, detailed, and compliant with GDPR)
- R18: **Terms of Service URL**: `https://ceolx.ie/terms` (must be live; referenced from privacy policy)
- R19: **Copyright**: "© 2026 Chongie Entertainment Services" (or client's legal entity)
- R20: **Contact email**: support contact for App Store reviews (e.g., support@ceolx.ie)

### iOS Privacy Nutrition Label (App Privacy)

- R21: Complete the **App Privacy** section in App Store Connect with accurate data collection declarations:
  - **Location Data**: Collected (user's precise location for event discovery), not linked to identity, used to find nearby events
  - **Email Address**: Collected, linked to identity, used for account management and notifications
  - **Name**: Collected, linked to identity, used for profile and identity
  - **User Content**: Photos and videos uploaded as profile/event images and posts, linked to identity
  - **Usage Data**: Minimal (no tracking of page views in V1 except event view_count for analytics)
  - **Tracking**: No third-party tracking (no ad networks, no analytics services tracking user behavior)
- R22: Privacy declarations must match actual data collection in the app; false declarations cause App Store rejection

### iOS App Store Compliance Checklist

- R23: **Apple Sign-In**: Implement required by Apple (Rule 4.8). Verify working on TestFlight build before submission
- R24: **Third-party payment processing**: FORBIDDEN for digital goods (Rule 3.1.1). CeolX uses Stripe for Venue subscriptions VIA WEB ONLY (ceolx.ie/subscribe). Ensure:
  - No in-app Stripe payment UI
  - Email contains external link only; no custom URL scheme to bypass app review
  - Stripe payment page opens in web browser via `Linking.openURL()`, not in-app WebView
  - Terms of Service clearly state: "Subscriptions are managed on our website at ceolx.ie/subscribe"
- R25: **Jailbreak detection**: Not required for this app; user location is not a security-critical feature
- R26: **Cryptocurrency/NFT**: Not applicable
- R27: **Gambling**: Not applicable
- R28: **Age rating**: Set to 4+ (no adult content, violence, or misinformation); accurate for Irish music discovery app

### iOS Screenshots

- R29: **Required device sizes**: iPhone 6.5" (standard), iPhone 5.5" (minimum), iPad 12.9" (if supporting iPad)
- R30: **Required count**: minimum 2 screenshots per device size (up to 10 recommended)
- R31: **Screenshot guidelines**:
  - Show key features: map discovery, event detail, artist profile, booking/subscription flow
  - Use real app content, not mock-ups
  - Overlays with descriptive text are allowed (e.g., "Discover live Irish music near you")
  - No marketing jargon; focus on user benefit
- R32: **Screenshot sequence** (recommended order):
  1. Map with event pins (discoveryability)
  2. Event detail (what user sees when tapping pin)
  3. Artist/Venue profile
  4. Booking or subscription flow
  5. Notifications or user profile

### Android Google Play Store Submission

- R33: **Application ID (package name)**: `ie.ceolx.app` (matches bundle ID for consistency)
- R34: **App name**: "CeolX"
- R35: **Short description**: max 80 characters
  - Example: "Discover live Irish music events and book performances"
- R36: **Full description**: 4000 characters max
  - Similar to iOS but expanded; highlight key personas (spectators, musicians, venues)
- R37: **Screenshots**:
  - Required: minimum 2, maximum 8 (at least 1 showing gameplay/core feature)
  - Device sizes: any of the following are acceptable: 7" or 10" tablets, Nexus 5/6 phones
  - Same sequence as iOS (map, event, profile, booking/subscription)
- R38: **Feature image**: 1024x500 PNG (promotional header image)
- R39: **Icon**: 512x512 PNG (Google Play uses a copy of app icon)
- R40: **Content rating**: Complete the IARC questionnaire (Google's content classification system)
  - Target audience: 12+
  - Declarations: no alcohol, no gambling, no violence, no hate speech

### Android Google Play Store Compliance

- R41: **Data safety form**: Complete in Google Play Console
  - Data collected: email, name, profile images, location, video/audio files (user-generated)
  - Data sharing: only with Firebase (push notifications) and Stripe (for subscription data via web)
  - Data retention: user can delete data via app settings (GDPR deletion)
  - Data encryption: in transit (HTTPS), at rest on Neon (encrypted by Neon)
- R42: **Permissions justified**: in app.json, declare only required permissions
  - `INTERNET`: required for API calls
  - `ACCESS_FINE_LOCATION`: required for map, user consent requested at runtime
  - `ACCESS_COARSE_LOCATION`: implied by fine location
  - `CAMERA`: required for video upload, user consent requested at runtime
  - `READ_EXTERNAL_STORAGE` / `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`: required for image/video picker
  - No unused permissions
- R43: **Targeting API level**: minimum API level 30 (Android 11), target API level 34 (Android 14) or later
  - Expo manages this; verify in build configuration

### Privacy Policy & Terms of Service (Legal Requirement)

- R44: **Privacy Policy** hosted at `https://ceolx.ie/privacy`
  - Required sections (GDPR + App Store + Google Play):
    - Data collected (location, email, name, profile images, videos)
    - How data is used (event discovery, user communication, analytics)
    - Third parties (Firebase, Stripe, Mux, Postmark, CloudFront) and their privacy policies
    - User rights (access, deletion, portability) — link to in-app GDPR flows
    - Data retention policy
    - Cookies (if applicable; mobile app has no cookies, but explain if web portal does)
    - Contact info for privacy inquiries
  - **Client responsibility**: Draft with legal counsel; flag as a blocker dependency early
- R45: **Terms of Service** hosted at `https://ceolx.ie/terms`
  - Required sections:
    - Acceptable use (no hate speech, no spam, no misinformation)
    - User-generated content licensing (users grant CeolX license to display their events/posts)
    - Limitation of liability
    - Dispute resolution (arbitration vs court)
    - Termination conditions
  - **Client responsibility**: Draft with legal counsel

### Submission Tracking & Timeline

- R46: **iOS submission**: Submit to App Store Connect 5–7 days before planned launch
  - Expected review time: 24 hours to 3 days
  - Common rejection reasons: privacy label inaccuracy, jailbreak detection, third-party payment, missing privacy policy
  - Resubmission time: 1–2 days per iteration
- R47: **Android submission**: Submit to Google Play Console 3–5 days before planned launch
  - Expected review time: 2–7 hours to 2 days (much faster than iOS)
  - Common rejection reasons: data safety form issues, policy violations, crashes on test device
- R48: **Contingency**: If reviews take longer than expected, be prepared to delay launch by 3–5 days
- R49: **Communication**: Keep Chongie Entertainment Services informed of submission status; share links to App Store Connect and Play Console for monitoring

---

## Acceptance Criteria

- [ ] iOS production EAS build succeeds (build ID recorded)
- [ ] Android production EAS build succeeds (build ID recorded)
- [ ] Both builds install and run on real devices without crashes
- [ ] All iOS app.config.ts permissions and metadata set correctly
- [ ] All Android app.json and build.gradle configurations set correctly
- [ ] iOS App Store Connect submission completed with all required metadata and screenshots
- [ ] iOS Privacy Nutrition Label completed and accurate
- [ ] Apple Sign-In verified on TestFlight build
- [ ] iOS submission passes automated pre-review checks (no immediate rejections)
- [ ] Android Google Play Console submission completed with metadata and screenshots
- [ ] Android data safety form completed and submitted
- [ ] Privacy Policy live at ceolx.ie/privacy and accessible from app
- [ ] Terms of Service live at ceolx.ie/terms and accessible from app
- [ ] Stripe web subscription page (ceolx.ie/subscribe) live and accessible (Apple will verify)
- [ ] iOS review result: approved or awaiting feedback
- [ ] Android review result: approved or awaiting feedback

---

## Dependencies

- **Upstream**: M12-T1 (QA passed on real devices); Privacy Policy and Terms of Service drafted and reviewed by legal team
- **Downstream**: M12-T3 (production deployment); app can go live once both stores approve
- **External services**: Apple App Store Connect, Google Play Console, Apple Developer Program (fee: $99/year), Google Play Developer account (fee: $25 one-time)

---

## Technical Notes

### EAS Build Configuration (eas.json)

```json
{
  "build": {
    "production": {
      "ios": {
        "buildType": "release"
      },
      "android": {
        "buildType": "release",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

### app.config.ts Permissions Example

```typescript
export default {
  expo: {
    name: 'CeolX',
    slug: 'ceolx',
    version: '1.0.0',
    ios: {
      bundleIdentifier: 'ie.ceolx.app',
      buildNumber: '1',
      privacyManifest: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
      },
    },
    android: {
      package: 'ie.ceolx.app',
      versionCode: 1,
    },
    plugins: [
      'expo-apple-authentication',
      'expo-image-picker',
    ],
    permissions: [
      'ios.NSLocationWhenInUseUsageDescription',
      'ios.NSCameraUsageDescription',
      'ios.NSPhotoLibraryUsageDescription',
    ],
  },
};
```

### Linking to External Stripe Subscription Page (React Native)

```typescript
import { Linking } from 'react-native';

const openStripeSubscription = async () => {
  const url = 'https://ceolx.ie/subscribe';
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.error('Cannot open URL:', url);
    }
  } catch (error) {
    console.error('Error opening URL:', error);
  }
};
```

---

## Common Gotchas

- **Apple Rule 3.1.1 (Payment Processing)**: Apple does NOT allow in-app third-party payment processors (Stripe, PayPal, etc.) for digital goods. CeolX bypasses this by using web-only Stripe (ceolx.ie/subscribe opened in web browser). Ensure the in-app email with the subscription link does NOT include a custom URL scheme (e.g., don't use `ceolx://subscribe`) — App Store reviewers will block it. Email links to https://ceolx.ie/subscribe are allowed.

- **Privacy Label accuracy**: If you declare collecting location data but don't request location permission in the app, Apple will reject. Be brutally honest in the Privacy Nutrition Label.

- **TestFlight build**: Before submitting to the App Store, always test on a TestFlight build on real devices. Simulator/emulator behavior differs; Apple Sign-In only works on real devices.

- **Build number increments**: Each submission to App Store must have an incremented build number (e.g., 1 → 2 → 3). If you submit the same build number twice, App Store rejects it.

- **Screenshots and localization**: For the initial launch in English-only, screenshots in English are sufficient. If localized later, provide localized screenshots and metadata in each language.

- **Icon edge case**: Make sure the 1024x1024 icon has no rounded corners or safe zones removed — App Store auto-crops and rounds. Test with the official App Store icon preview tool.

- **Support URL must respond**: Apple reviewers attempt to access the Support URL. Ensure ceolx.ie/support is live and returns a meaningful page (not 404).

- **Staging vs Production credentials**: Ensure EAS builds use production API keys (Stripe live keys, Firebase production project, Mux production API). Do NOT use test keys in the production build.
