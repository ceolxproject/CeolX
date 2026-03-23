# M7-T1 · Push Notifications (Firebase FCM)

| Field | Value |
|-------|-------|
| **Milestone** | M7 — Notifications & Emails |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T4 (persona system + FCM token registration stub), M4-T3 (event moderation notifications), M5-T1/T2 (booking notifications) |
| **PRD Ref** | Section 9.6 (Notifications), Section 4.3 (Notification Routing) |

---

## Description
Full Firebase FCM integration for push notifications. All in-app events that generate notifications funnel through this system. Notifications are persona-aware — the payload includes the target persona and a deep link route so the app auto-switches role and navigates correctly.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | FCM token storage endpoint, notification dispatch service |
| `apps/mobile` | FCM token registration on login, notification permission request, foreground/background tap handlers |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/users/fcm-token` | Store or update the device FCM token for the authenticated user |

---

## Requirements
- R1: FCM token registered on every login and stored on the `users` row
- R2: Notification permission requested on first app launch (after sign-in)
- R3: Notification payload structure: `{ title, body, data: { persona, route } }`
- R4: Foreground tap: if `persona` matches current role → navigate to `route`; if not → auto-switch role → navigate → show toast: *"Switched to [Role] mode"*
- R5: Background/cold start tap: read payload → set persona → open correct screen
- R6: Notification triggers to implement: event approved, event rejected (with reason), booking invitation received, booking accepted, booking rejected, booking cancelled
- R7: FCM token refreshed if the token rotates — app must handle `onTokenRefresh` and call `POST /users/fcm-token` again

---

## Acceptance Criteria
- [ ] FCM token stored on the user record after login
- [ ] Notification permission requested on first launch
- [ ] Event approval push notification received and displays correct title/body
- [ ] Tapping notification while in wrong persona auto-switches to correct persona and navigates
- [ ] Toast shown on auto-persona switch: "Switched to [Role] mode"
- [ ] Cold start (app closed) tap on notification opens app in correct persona and screen
- [ ] All 6 notification triggers fire correctly

---

## Technical Notes
- Use `expo-notifications` for FCM integration in React Native — it wraps FCM for both iOS and Android
- iOS requires explicit notification permission from the user — request after sign-in, not on cold launch
- Notification payload's `data.route` is a deep link path (e.g. `/events/123`, `/bookings/456`) — mobile navigator handles routing
- The `notifications` table in the DB records sent notifications with `user_id`, `type`, `payload (JSON)`, `read` — used for the in-app notification inbox (if built in a later milestone)
