# M8-T2 · Subscription Status & In-App Pending State (Venue)

| Field | Value |
|-------|-------|
| **Milestone** | M8 — Venue Subscription |
| **Status** | 🔲 To Do |
| **Depends on** | M8-T1 (Stripe subscription flow must be wired), M2-T4 (venue persona) |
| **PRD Ref** | Section 9.8 (Venue Subscription Flow) |

---

## Description
The mobile app experience for a Venue whose subscription is not yet active. The app must communicate clearly that the profile is invisible until subscription is complete, and provide a way to resend the activation email — without showing any external payment URL inside the app.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Subscription status check on `/users/me`, resend activation email endpoint |
| `apps/mobile` | Pending activation banner/screen, Resend Email button, profile visibility gating |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/venues/resend-activation-email` | Resend the Postmark activation email to the Venue |
| GET | `/users/me` | Returns `subscription_status` in venue profile data |

---

## Requirements
- R1: When Venue persona is active and `subscription_status = inactive`, show a persistent in-app message: *"Your profile is not yet visible to artists. Check your email to activate."*
- R2: Message includes a **Resend Email** button that calls `POST /venues/resend-activation-email`
- R3: No external URL (`ceolx.ie/subscribe` or any Stripe URL) is shown or linked inside the app — the link lives only in the email
- R4: When `subscription_status` changes to `active` (detected via polling `GET /users/me`), the pending state disappears and the Venue profile becomes fully functional
- R5: Poll interval: every 30 seconds while the pending state is shown — stop polling once activated
- R6: Resend Email is rate-limited to prevent abuse — max 3 resends per hour per Venue

---

## Acceptance Criteria
- [ ] Venue with inactive subscription sees pending activation message in app
- [ ] No payment URL or external link visible inside the app
- [ ] Resend Email button triggers Postmark email and shows confirmation toast
- [ ] Rate limit on Resend Email works (4th attempt within an hour returns an error/message)
- [ ] App detects subscription activation within ~30 seconds of webhook firing and removes pending state
- [ ] Fully activated Venue sees their profile and can create events

---

## Technical Notes
- Poll `GET /users/me` every 30 seconds using a `setInterval` while the pending activation screen is shown; clear the interval on activation or unmount
- This is intentionally simple for V1 — WebSocket push could replace polling post-launch for a better UX
- The restriction on showing `ceolx.ie/subscribe` in-app is to comply with Apple App Store guidelines (Rule 3.1.1) — never display, link to, or mention external payment URLs inside the app
