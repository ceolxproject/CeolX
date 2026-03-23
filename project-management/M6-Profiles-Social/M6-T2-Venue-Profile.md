# M6-T2 · Venue Profile (Public + Edit)

| Field | Value |
|-------|-------|
| **Milestone** | M6 — Profiles & Social |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T4 (venue onboarding), M8-T1 (subscription must be active for profile to be visible), M4-T1 (events linked to profile) |
| **PRD Ref** | Section 7.1 (Venue Features), Section 9.3 (Data Model), Section 9.8 (Subscription) |

---

## Description
The Venue's public profile — visible to Artists and Spectators. Shows the venue's identity, upcoming events, and gig opportunities. Only visible when the Venue subscription is active. Venue can edit their own profile at any time without moderation.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Venue profile get/update endpoints, subscription status check |
| `apps/mobile` | Public Venue Profile screen, Edit Profile screen (Venue persona only) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/venues/:id` | Get public venue profile |
| PATCH | `/venues/:id` | Edit venue profile (own profile only) |

---

## Requirements
- R1: Public profile displays: venue name, profile image, bio, address, upcoming active events, gig opportunities posted, follow button
- R2: Venue profile is publicly visible only when `subscription_status = active` — inactive subscription → 404 for other users; pending activation message shown to the Venue owner
- R3: Venue can edit: venue name, bio, address, profile image — no moderation required
- R4: Profile image uploaded to AWS S3, stored as CloudFront CDN URL
- R5: Upcoming events section shows only `status = active` events
- R6: Gig opportunities section shows `is_gig_opportunity = true` events — visible to Artists; hidden from Spectators
- R7: Follow button visible to all personas; Venue cannot follow themselves
- R8: Follower count shown on profile

---

## Acceptance Criteria
- [ ] Venue profile visible publicly when subscription is active
- [ ] Inactive subscription → profile returns 404 (other users) / pending activation message (own view)
- [ ] All profile fields display correctly
- [ ] Edit Profile available to Venue owner only
- [ ] Gig opportunities section visible to Artists; hidden from Spectators
- [ ] Follow button and follower count work correctly
- [ ] Profile image upload and display works

---

## Technical Notes
- `venue_profiles.subscription_status` must be checked on every `GET /venues/:id` request — don't cache stale status
- Address stored as a free-text string — no structured address fields in V1
- Profile edits are NOT moderated — only events go through moderation
- When a Venue switches away from Venue persona, `is_active = false` — same 404 behaviour for public access; subscription billing continues
