# M2-T2 · Google Sign-In + Apple Sign-In (iOS)

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1 (BetterAuth must be configured first) |
| **PRD Ref** | Section 4.1 — Apple Sign-In is mandatory for App Store compliance |

---

## Description
Social login methods as an alternative to email/password. Google Sign-In works on both platforms. Apple Sign-In is a hard App Store requirement — Apple rejects apps that offer any third-party social login without also offering Apple Sign-In.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | BetterAuth Google + Apple OAuth provider config |
| `apps/mobile` | OAuth flow implementation, social login buttons on Sign Up/Sign In screens |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/auth/google` | Initiate Google OAuth redirect |
| GET | `/auth/google/callback` | Handle Google OAuth callback |
| GET | `/auth/apple` | Initiate Apple Sign-In redirect |
| GET | `/auth/apple/callback` | Handle Apple Sign-In callback |

---

## Requirements
- R1: Google OAuth 2.0 credentials configured — separate client IDs for iOS, Android, and Web
- R2: Google provider configured in BetterAuth
- R3: Apple Sign-In configured in Apple Developer Portal (Identifiers + Service ID)
- R4: Apple provider configured in BetterAuth
- R5: First social sign-in creates a `users` row and skips email verification step
- R6: Same email from different provider → link providers to one account (no duplicate accounts)
- R7: Apple Sign-In button shown on iOS only — not rendered on Android

---

## Acceptance Criteria
- [ ] "Continue with Google" works on both iOS and Android — user lands in app after OAuth
- [ ] "Continue with Apple" works on iOS (tested on real device via TestFlight)
- [ ] Apple Sign-In button is absent on Android
- [ ] New social sign-in creates a user account without requiring email verification
- [ ] Signing in with the same email via a different provider links to the existing account
- [ ] Social sign-in session persists across app restarts (same as email/password)

---

## Technical Notes
- Apple Sign-In does NOT work in Simulator — must test on a physical device via TestFlight. Budget time for a TestFlight build in this sprint.
- Use `expo-apple-authentication` for Apple Sign-In and `expo-auth-session` + `expo-web-browser` for Google OAuth
- Google requires separate client IDs for iOS and Android — do not share them
- Account merging must be handled server-side in BetterAuth — never merge on the client
