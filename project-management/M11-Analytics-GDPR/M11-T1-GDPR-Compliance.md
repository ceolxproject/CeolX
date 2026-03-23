# M11-T1 · GDPR Compliance (Irish Client — Mandatory)

| Field | Value |
|-------|-------|
| **Milestone** | M11 — Analytics & GDPR |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1 (auth), M2-T4 (persona system), M1-T2 (DB schema) |
| **PRD Ref** | Section 11 (GDPR) |

---

## Description
GDPR compliance is mandatory — CeolX is an Irish client and the platform collects personal data. Covers consent at sign-up, right to erasure (account deletion), data portability (export), and inactive account handling.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Account deletion (anonymisation), data export endpoint, consent storage |
| `apps/mobile` | Consent screen at sign-up, account deletion flow in Settings, data export request in Settings |
| `apps/admin` | No specific admin UI — handled server-side |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| DELETE | `/users/me` | Anonymise personal data (right to erasure) |
| GET | `/users/me/export` | Generate and return user's personal data export (JSON) |

---

## Requirements
- R1: Consent screen shown at sign-up for: data collection, location use, and marketing communications — opt-in checkboxes (not pre-checked)
- R2: Privacy Policy and Terms of Service links on the consent screen — must be accepted before proceeding
- R3: **Right to Erasure**: `DELETE /users/me` anonymises personal data (`name`, `email`, `avatar` nulled/replaced with anonymised placeholder) — non-personal content structures (events, posts) retained in DB but unlinked from identifiable user
- R4: **Right to Data Portability**: `GET /users/me/export` returns a JSON file of all personal data the platform holds for the user
- R5: Location data collected on-demand only (when map is opened) — not background tracking
- R6: Inactive accounts (no login for 24 months) flagged in DB for manual review — `users.flagged_inactive = true`
- R7: Cookie/tracking consent notice if any web analytics are added to `apps/admin`

---

## Acceptance Criteria
- [ ] Consent checkboxes shown at sign-up; user cannot proceed without accepting Privacy Policy + ToS
- [ ] Accepted consents stored with timestamp on user record
- [ ] Account deletion anonymises name, email, avatar; events/posts remain but show "Deleted User"
- [ ] Data export returns a downloadable JSON with the user's personal data
- [ ] No background location tracking — location only accessed when map screen is active
- [ ] Accounts inactive for 24 months have `flagged_inactive = true` set by a scheduled job

---

## Technical Notes
- Account deletion must be anonymisation, not hard deletion — non-personal content must be preserved to maintain event/booking history integrity
- The 24-month inactivity flag is set by a scheduled job (cron) — not a real-time check. Can be a simple DB query: `UPDATE users SET flagged_inactive = true WHERE last_login_at < NOW() - INTERVAL '24 months'`
- GDPR data export should include: profile info, events created, bookings, follows, posts — everything linked to the user's identity
- Privacy Policy and Terms of Service documents need to be drafted by the client/legal team before launch — flag as a dependency
