# M2-T3 · Forgot Password Flow

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1 (email auth), M7-T3 (Postmark setup — can stub email for now) |
| **PRD Ref** | Section 4.1 (Forgot Password) |

---

## Description
Standard password reset via email link. Token-based, time-limited, single-use. User requests a reset link, opens it on their device, and is deep-linked back into the app to set a new password.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Reset token generation, validation, password update endpoints |
| `apps/mobile` | Forgot Password screen, deep link handler, New Password screen |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/forgot-password` | Generate reset token, send Postmark reset email |
| POST | `/auth/reset-password` | Validate token, update password hash, invalidate token |

---

## Requirements
- R1: `POST /auth/forgot-password` generates a UUID reset token, stores it with 15-minute expiry, sends Postmark email
- R2: `POST /auth/reset-password` validates token (exists + not expired + not yet used), updates password, marks token as used
- R3: Rate limit on `/auth/forgot-password` — max 3 requests per email per hour
- R4: Response to `/auth/forgot-password` is always a generic success message regardless of whether email exists (security: don't enumerate registered emails)
- R5: Reset email contains a deep link in the format `ceolx://reset-password?token=`
- R6: Deep link scheme registered in `app.config.ts` so the OS routes it to the app

---

## Acceptance Criteria
- [ ] "Forgot Password?" link visible on Sign In screen
- [ ] Submitting an email shows generic "Check your email" confirmation (whether email exists or not)
- [ ] Reset email received with working deep link
- [ ] Tapping deep link opens app on the New Password screen with token pre-populated
- [ ] Submitting a valid new password updates it and redirects to Sign In
- [ ] Expired token shows appropriate error
- [ ] Already-used token shows appropriate error
- [ ] Rate limit blocks excessive requests

---

## Technical Notes
- Show generic success even if email not found — security best practice to prevent email enumeration
- Deep link scheme must be registered in `app.config.ts` under `expo.scheme` (e.g. `ceolx`)
- The reset link format: `ceolx://reset-password?token=<uuid>` — the mobile app reads the `token` param and sends it to `/auth/reset-password`
- Token storage: store in a dedicated `password_reset_tokens` table (id, user_id, token, expires_at, used_at)
