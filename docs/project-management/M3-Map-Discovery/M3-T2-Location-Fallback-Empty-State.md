# M3-T2 · Location Permission + Fallback Chain + Empty State

| Field | Value |
|-------|-------|
| **Milestone** | M3 — Map & Discovery |
| **Status** | 🔲 To Do |
| **Depends on** | M3-T1 (map must render first) |
| **PRD Ref** | Section 9.2.2 (Location Fallback), Section 9.2.3 (Empty State) |

---

## Description
Users are never blocked from the map regardless of their location permissions. Three-step fallback chain ensures a sensible map centre in all cases. Empty state auto-expands silently — the radius concept is never exposed to users.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | `/location/ip` endpoint for server-side IP geolocation lookup |
| `apps/mobile` | Permission request, fallback chain logic, banner UI, empty state floating card |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/location/ip` | Server-side IP geolocation (calls ipapi.co) — returns `{ lat, lng, city, county }` |

---

## Requirements
- R1: Location permission requested via `expo-location` on first map load
- R2: **Fallback Step 1 — GPS**: permission granted → centre map on device GPS coordinates
- R3: **Fallback Step 2 — IP Geolocation**: permission denied → call `GET /location/ip` → centre map on returned city/county; show subtle banner: *"Using approximate location — search to refine."*
- R4: **Fallback Step 3 — Ireland Default**: IP geolocation fails (VPN / private relay) → centre on `lat: 53.1424, lng: -7.6921`; show banner as per Step 2
- R5: Banner is dismissible by tapping; non-blocking
- R6: `/location/ip` is a server-side proxy — client never calls ipapi.co directly
- R7: **Empty State — Auto-Expand**: if bounding box query returns 0 results, silently retry at ~5 km, then 25 km, then 100 km from map centre — all retries are silent with no loading indicator or message
- R8: If still 0 results after 100 km retry → show a non-blocking floating card over the map: *"No events near here. Try searching for Dublin, Galway, or Cork."* + **Browse all upcoming events** button (switches to Discover tab)
- R9: Floating card is dismissible
- R10: The radius values (5 km, 25 km, 100 km) must NEVER appear in any UI label or message

---

## Acceptance Criteria
- [ ] App with GPS granted centres map on device location, no banner shown
- [ ] App with GPS denied falls back to IP geolocation; banner shown
- [ ] App with GPS denied + VPN falls back to Ireland centre (lat: 53.1424, lng: -7.6921); banner shown
- [ ] Banner is dismissible and non-blocking
- [ ] Area with 0 events triggers silent retries — no visible loader, no messaging during retries
- [ ] After 100 km retry still 0 results → floating card shown with correct copy
- [ ] "Browse all upcoming events" button on floating card switches to Discover tab
- [ ] No radius value is ever shown to the user in any UI element

---

## Technical Notes
- The IP geolocation endpoint must be called server-side (Hono backend calls ipapi.co using the incoming request IP). Do not expose the ipapi.co API key or URL to the mobile client.
- The banner should be small text at the top of the map — not a modal or full-screen overlay
- The auto-expand retry sequence is purely client-side: issue a new bounding box query with an expanded radius; do not tell the user it is happening
