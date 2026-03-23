# M2-T4 · Persona Onboarding + Role Switching Logic

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1, M2-T2 (auth must work), M1-T2 (artist_profiles + venue_profiles tables) |
| **PRD Ref** | Section 4.2 (Onboarding), Section 4.3 (Persona Switching) |

---

## Description
The core persona system that governs all feature access in the app. Every screen, API route, and notification uses the user's current role. User selects their initial persona after first sign-up, and can switch at any time from Settings. This task must be implemented correctly — it underpins every other feature in M3+.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Role update endpoint, profile activation/deactivation logic, `GET /users/me` |
| `apps/mobile` | Onboarding screen, role-specific sub-flows, Settings > Switch Account Type screen, FCM notification tap routing |
| `packages/shared` | `UserRole` enum (`spectator | artist | venue`) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/users/role` | Update `current_role`, flip `is_active` on relevant profile |
| GET | `/users/me` | Return user with `current_role` and active profile data |

---

## Requirements
- R1: "Who are you?" onboarding screen shown once after first sign-up — three options: Spectator, Musician/Artist, Venue/Business
- R2: On persona selection: set `users.current_role`, create profile record (`artist_profiles` or `venue_profiles`) where applicable
- R3: Artist onboarding sub-flow collects: stage name, bio, genre, profile image
- R4: Venue onboarding sub-flow collects: venue name, address, bio, profile image → triggers Venue activation email via Postmark
- R5: Spectator skips onboarding sub-flow and goes straight to Map screen
- R6: Settings > Switch Account Type allows switching between roles at any time
- R7: First-time switch to a new role triggers that role's onboarding sub-flow; returning to a previously used role is a direct switch (no re-onboarding)
- R8: Switching TO Venue → `venue_profiles.subscription_status = inactive`; profile not visible until Stripe webhook confirms payment
- R9: Switching AWAY from Venue → `venue_profiles.is_active = false`; subscription stays active, billing continues
- R10: Switching AWAY from Artist → `artist_profiles.is_active = false`; past approved events stay live until date passes
- R11: Events in `pending_review` status stay in the admin queue regardless of creator's current role

---

## Acceptance Criteria
- [ ] Onboarding screen shown immediately after first sign-up on any auth method
- [ ] Selecting Spectator routes to Map screen with no further prompts
- [ ] Selecting Artist completes onboarding sub-flow and creates `artist_profiles` row
- [ ] Selecting Venue completes onboarding sub-flow, creates `venue_profiles` row (inactive), and triggers activation email
- [ ] Switch Account Type in Settings shows current role and available options
- [ ] Switching to Artist for the first time triggers Artist onboarding; switching back skips it
- [ ] Switching to Venue without subscription shows pending activation state in-app
- [ ] Switching away from Venue deactivates profile but does not cancel subscription
- [ ] `GET /users/me` returns correct `current_role` and relevant profile data
- [ ] Notification tap auto-switches role and navigates to the correct screen with a toast confirmation

---

## Technical Notes
- `users.current_role` is the single source of truth for feature access — never derive the role from the profile tables (`artist_profiles.is_active`, etc.)
- FCM notification payload must include: `{ persona, route }` — mobile reads these to auto-switch role on tap. Toast shown: "Switched to [Role] mode"
- On notification tap (cold start): read payload → set persona → open correct screen
- Venue activation email is sent via Postmark — template contains a link to `ceolx.ie/subscribe` (NOT an in-app link; Apple Rule 3.1.1)
