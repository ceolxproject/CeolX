# M6-T3 · Follow System

| Field | Value |
|-------|-------|
| **Milestone** | M6 — Profiles & Social |
| **Status** | 🔲 To Do |
| **Depends on** | M6-T1 (Artist profile), M6-T2 (Venue profile) |
| **PRD Ref** | Section 5.1 (End User Features), Section 9.3 (Data Model — follows table) |

---

## Description
Users can follow Artists and Venues. Following affects the Discover feed algorithm (followed accounts ranked higher) and enables inline promotional posts from followed accounts in the feed.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Follow/unfollow endpoints, follower count queries |
| `apps/mobile` | Follow button on Artist/Venue profiles, Following list in Profile tab |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/follows` | Follow an Artist or Venue |
| DELETE | `/follows/:followee_id` | Unfollow |
| GET | `/follows` | Get list of accounts the authenticated user follows |

---

## Requirements
- R1: Any authenticated user can follow any Artist or Venue (all personas)
- R2: A user cannot follow themselves
- R3: Follow is unidirectional — no mutual follow requirement
- R4: `follows` table: `follower_id` (user FK), `followee_id` (user FK) — composite unique constraint prevents duplicate follows
- R5: Follower count shown on Artist and Venue profile pages
- R6: Following list accessible from the user's own Profile tab
- R7: Follow status (following / not following) reflected on the follow button when viewing a profile
- R8: Follows feed into the Discover feed algorithm (M3-T4) — followed accounts get +20% ranking weight

---

## Acceptance Criteria
- [ ] Follow button on Artist profile → follow created; button toggles to "Following"
- [ ] Follow button on Venue profile → follow created; button toggles to "Following"
- [ ] Unfollowing updates button state and decrements follower count
- [ ] Follower count displayed on profile updates in real time (or on refresh)
- [ ] User's Following list in Profile tab shows all followed Artists/Venues
- [ ] Attempting to follow self returns an error
- [ ] Duplicate follow attempt returns an error (or silently succeeds if already following)

---

## Technical Notes
- `follows` table uses a composite unique constraint on `(follower_id, followee_id)` — enforces one follow per pair at DB level
- Follower count can be a cached value updated by a DB trigger or computed on each `GET /artists/:id` query — V1 scale (under 1,000 users) makes real-time computation fine
- The follow system feeds into the M3-T4 feed algorithm's social graph weight (20%)
