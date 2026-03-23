# M1-T4 · React Native + Expo App Scaffold

| Field | Value |
|-------|-------|
| **Milestone** | M1 — Project Setup & Infrastructure |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T1 |
| **PRD Ref** | Section 10.1 (Mobile App), Section 5.1 (tab navigation structure) |

---

## Description
Bootstrap the mobile app with correct navigation structure, permissions config, and placeholder screens. The output is a runnable app on both platforms — no real features yet.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/mobile` | The entire React Native + Expo application |
| `packages/shared` | Enums + types imported for navigation typing |

---

## API Endpoints
None — this is a mobile scaffold task. API calls wired up in M2+.

---

## Requirements
- R1: Bottom tab navigator with four tabs: **Map | Discover | Bookings | Profile** — Map is the default/first tab (per UI designs)
- R2: Each tab has its own stack navigator for nested screens
- R3: Auth navigator (unauthenticated state) and Main navigator (authenticated state) — app switches based on session
- R4: All iOS + Android permissions declared in `app.config.ts` before any Play Store / App Store submissions
- R5: EAS Build configured for development, preview, and production profiles
- R6: Environment variable for API base URL configurable per build profile

---

## Acceptance Criteria
- [ ] App launches on iOS Simulator without errors
- [ ] App launches on Android Emulator without errors
- [ ] All four tabs visible and tappable — each shows a placeholder screen
- [ ] Navigating between tabs works without crashes
- [ ] Stack navigation works within at least one tab (e.g. Map → Event Detail placeholder)
- [ ] Auth screen shown when no session exists; Main tabs shown when session exists
- [ ] `eas build --profile development` completes without errors

---

## Technical Notes
- Use React Navigation v6+: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/stack`
- Tab icons should match the approved UI designs (map pin, discover/compass, bookings/calendar, profile/person)
- `expo-secure-store` must be installed now — used in M2 for session token storage
- Permissions to declare in `app.config.ts`:
  - iOS: `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`
  - Android: `ACCESS_FINE_LOCATION`, `CAMERA`, `READ_EXTERNAL_STORAGE`
