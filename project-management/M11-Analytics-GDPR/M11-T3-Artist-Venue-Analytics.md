# M11-T3 · Artist & Venue In-App Analytics

| Field | Value |
|-------|-------|
| **Milestone** | M11 — Analytics & GDPR |
| **Status** | 🔲 To Do |
| **Depends on** | M6-T1 (Artist profile), M6-T2 (Venue profile), M4-T1 (events), M6-T4 (posts), M5 (bookings) |
| **PRD Ref** | Section 6.1 (Artist Features — Analytics), Section 7.1 (Venue Features — Analytics) |

---

## Description
Artists and Venues get a basic analytics tab on their own profile showing content performance metrics — post engagement, event reach, and booking activity. This is creator-facing only (not visible to other users). Gives creators actionable insight during the controlled launch phase.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Aggregation queries per profile; cached results |
| `apps/mobile` | Analytics tab on Artist profile and Venue profile (visible to creator only) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/artists/me/analytics` | Artist analytics data |
| GET | `/venues/me/analytics` | Venue analytics data |

---

## Requirements

### Artist Analytics
- R1: **Post engagement**: total likes across all posts; likes per post (top 3 posts by likes)
- R2: **Event reach**: total views on active events (tracked as a simple view counter on `GET /events/:id`)
- R3: **Event saves**: total number of times an Artist's events have been saved by other users (count of rows in `saved_events` where `event_id` belongs to this artist)
- R4: **Follower count**: total followers — pulled from `follows` table
- R5: **Booking activity**: count of bookings by status (Pending / Accepted / Rejected / Cancelled)

### Venue Analytics
- R6: All Artist analytics metrics above (posts, event reach, event saves, followers, bookings)
- R7: **Artist applications received**: total applications received per gig opportunity event (`is_gig_opportunity = true`)
- R8: Subscription status badge (Active / Inactive) shown prominently at the top of the analytics screen

### General
- R9: Analytics data is aggregated server-side and cached for 30 minutes — no real-time updates needed at V1 scale
- R10: Analytics tab is visible **only to the profile owner** — not shown when another user views the same profile
- R11: No historical trend charts in V1 — flat stat cards only

---

## Acceptance Criteria
- [ ] Analytics tab visible on Artist's own profile; hidden when viewing another artist's profile
- [ ] Analytics tab visible on Venue's own profile; hidden when viewing another venue's profile
- [ ] Post likes total and top 3 posts by likes displayed
- [ ] Event saves count displayed
- [ ] Follower count matches the count shown on the public profile
- [ ] Booking counts shown broken down by status
- [ ] Venue sees artist application counts per gig opportunity event
- [ ] Analytics data loads within 2 seconds
- [ ] No analytics data visible to Spectators on any profile

---

## Technical Notes
- Event view counting: increment `events.view_count` (add this column to the events table) on each `GET /events/:id` call from a non-creator user — simple integer counter, no deduplication needed in V1
- Cache analytics responses per profile ID with a 30-minute TTL; invalidate on new post, new booking, or follow event
- All queries are straightforward aggregations on indexed columns — no separate analytics DB or event stream needed at V1 scale (under 1,000 users)
- Do NOT expose another user's analytics — the endpoints use the authenticated user's identity from the session, not a profile ID param
