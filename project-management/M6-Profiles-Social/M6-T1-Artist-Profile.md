# M6-T1 · Artist Profile (Public + Edit)

| Field | Value |
|-------|-------|
| **Milestone** | M6 — Profiles & Social |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T4 (artist onboarding creates the profile), M4-T1 (events linked to profile) |
| **PRD Ref** | Section 6.1 (Artist Features), Section 9.3 (Data Model) |

---

## Description
The Artist's public profile — visible to all users. Shows the artist's identity, genre, upcoming events, and social media links. The artist can edit their own profile at any time (no moderation required for profile edits).

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Artist profile get/update endpoints |
| `apps/mobile` | Public Artist Profile screen, Edit Profile screen (Artist persona only) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/artists/:id` | Get public artist profile |
| PATCH | `/artists/:id` | Edit artist profile (own profile only) |

---

## Requirements
- R1: Public profile displays: stage name, profile image, bio, genre, social media links (Spotify, Instagram, SoundCloud, etc.), upcoming active events, follow button
- R2: Artist can edit: stage name, bio, genre, profile image, social media links — no moderation required
- R3: Profile image uploaded to AWS S3, stored as CloudFront CDN URL
- R4: Upcoming events section shows only `status = active` events linked to this artist
- R5: Follow button visible to all personas; Artist cannot follow themselves
- R6: Follower count shown on profile
- R7: `is_active = false` profiles are not publicly accessible — return 404 for inactive profiles

---

## Acceptance Criteria
- [ ] Artist profile page renders with all fields (stage name, bio, genre, image, links)
- [ ] Upcoming events listed correctly (active events only)
- [ ] Edit Profile button visible only when viewing own profile as Artist persona
- [ ] Editing profile fields saves correctly without admin review
- [ ] Profile image upload replaces old image and displays new one
- [ ] Follow button works; follower count updates
- [ ] Inactive artist profile returns 404

---

## Technical Notes
- Social media links stored as a JSON object in `artist_profiles.links` — supports flexible list of platform → URL pairs
- Profile edits are NOT moderated — only events go through moderation
- When an Artist switches away from Artist persona, `is_active = false` but their profile page shows 404 publicly; their past events remain visible on the map/feed until date passes
