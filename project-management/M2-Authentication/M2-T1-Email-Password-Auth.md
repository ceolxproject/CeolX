# M2-T1 · Email/Password Sign-Up + Email Verification

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T2 (DB schema), M1-T3 (API scaffold), M1-T4 (mobile scaffold) |
| **PRD Ref** | Section 4.1 (Authentication) |

---

## Description
Implement the base authentication method — email/password sign-up, email verification via Postmark, sign-in, and logout. This is the foundation that all other sign-in flows build on. Users must verify their email before accessing any protected features.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | BetterAuth config, sign-up/sign-in/logout endpoints, email verification logic |
| `apps/mobile` | Sign Up screen, Sign In screen, email confirmation screen, session persistence |
| `packages/shared` | Shared error codes used in API responses and parsed by mobile |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/sign-up` | Create user row, trigger Postmark verification email |
| GET | `/auth/verify-email?token=` | Mark user as verified |
| POST | `/auth/sign-in` | Validate credentials, return BetterAuth session |
| POST | `/auth/logout` | Terminate session |

---

## Requirements
- R1: BetterAuth installed and configured in `apps/api`
- R2: `POST /auth/sign-up` creates a `users` row and sends a Postmark verification email
- R3: `GET /auth/verify-email?token=` marks the user as verified; token expires after 24 hours
- R4: `POST /auth/sign-in` returns a session token; unverified accounts are blocked with a clear error
- R5: Session token stored securely on device using `expo-secure-store`
- R6: Session persists across app restarts — user stays logged in
- R7: `POST /auth/logout` terminates the BetterAuth session and clears the stored token

---

## Acceptance Criteria
- [ ] User can sign up with email + password — verification email received via Postmark
- [ ] Clicking verification link marks account as verified
- [ ] Verified user can sign in and reach the main app
- [ ] Unverified user sees "Check your email" prompt, not a generic error
- [ ] Resend verification email option works
- [ ] User remains logged in after closing and reopening the app
- [ ] Logout clears session and returns user to Sign In screen
- [ ] Duplicate email registration returns a clear error message

---

## Technical Notes
- BetterAuth handles session token management — do not implement custom JWT logic
- Store the session token with `expo-secure-store`, not AsyncStorage (AsyncStorage is not encrypted)
- Error codes from the API must follow the agreed format: `{ error, code, message }` — mobile parses `code` to show user-facing messages
- Postmark template for verification email must be created and the template ID stored as an env var
