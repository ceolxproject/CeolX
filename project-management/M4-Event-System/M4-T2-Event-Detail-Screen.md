# M4-T2 · Event Detail Screen

| Field | Value |
|-------|-------|
| **Milestone** | M4 — Event System |
| **Status** | 🔲 To Do |
| **Depends on** | M4-T1 (events must exist), M3-T1 (map pins link to this screen) |
| **PRD Ref** | Section 5.1 (End User Features), Section 9.3 (Event Data Model) |

---

## Description
The full event detail view — accessible by tapping a map pin, a feed card, or a profile event listing. Shows all event information, artist/venue links, and context-aware actions based on the viewer's persona.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Event detail endpoint, view tracking (optional) |
| `apps/mobile` | Event Detail screen (stack screen within Map and Discover tabs), bottom sheet variant from map pin tap |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events/:id` | Get full event detail |
| POST | `/events/:id/save` | Save an event to the user's saved list |
| DELETE | `/events/:id/save` | Unsave an event |

---

## Requirements
- R1: Event Detail screen accessible from: map pin tap (bottom sheet), feed card tap (full screen), and profile event listing
- R2: Display fields: cover image, title, date/time, venue name or address, category, description, ticket link (external), collaborating artists (linked)
- R3: Ticket link opens external URL in browser (not in-app webview) — external links only, no in-app ticketing in V1
- R4: Tapping a collaborating artist name navigates to their Artist Profile
- R5: Tapping a venue name navigates to Venue Profile
- R6: Artist/Venue persona sees an **Edit** button on their own events (if status is `draft`, `pending_review`, or `rejected`)
- R7: Spectator sees no edit/manage controls
- R8: Gig opportunity events (`is_gig_opportunity: true`) show an "Apply" button for Artists (links to Booking flow, M5)
- R9: Events with `status = rejected` shown to their creator with rejection reason displayed
- R10: All authenticated users (all personas) can **Save** an event — inserts a row into `saved_events`; tapping again unsaves (deletes the row). Saved state persists across sessions.
- R11: **Save to Calendar** button exports event date/time, title, and location to the device's native calendar app (iOS Calendar / Google Calendar on Android) using `expo-calendar` — requires calendar permission
- R12: Save button and Save to Calendar button are visible on all event details for all personas

---

## Acceptance Criteria
- [ ] Tapping a map pin opens Event Detail bottom sheet with correct data
- [ ] Tapping a feed card opens full Event Detail screen
- [ ] All event fields display correctly (cover image, title, date, location, description, category)
- [ ] Ticket link button opens external URL in device browser
- [ ] Collaborating artist names navigate to Artist Profile
- [ ] Creator sees Edit button on their own editable events
- [ ] Gig opportunity events show "Apply" button to Artist persona
- [ ] Rejection reason shown to creator on rejected events
- [ ] Save/Unsave button visible on all event detail screens; state reflects whether user has already saved the event
- [ ] Saving an event persists across app restarts (backed by `saved_events` table)
- [ ] Save to Calendar button requests calendar permission if not already granted
- [ ] Save to Calendar adds event title, date/time, and location to device native calendar

---

## Technical Notes
- The bottom sheet variant (from map pin) should be a condensed view with a "See full details" option to expand to full screen
- Ticket link must open in the device's default browser — use `Linking.openURL()` in React Native, not a WebView
- `GET /events/:id` should return 404 if event is `archived` and viewer is not the creator
- Save event: `POST /events/:id/save` inserts into `saved_events(user_id, event_id)` — return 409 if already saved. `DELETE /events/:id/save` removes the row.
- Use `expo-calendar` for Save to Calendar — request `WRITE_CALENDAR` permission; gracefully handle denial (show info message rather than crash)
- The `GET /events/:id` response should include an `is_saved` boolean for the requesting user so the button renders the correct state on load
