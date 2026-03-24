# M3-T3 · Pin Clustering + Search Bar (County / Artist / Category)

| Field          | Value                                            |
| -------------- | ------------------------------------------------ |
| **Milestone**  | M3 — Map & Discovery                             |
| **Status**     | 🔲 To Do                                         |
| **Depends on** | M3-T1 (map + pins must work)                     |
| **PRD Ref**    | Section 9.1 (Search), Section 9.2.1 (Clustering) |

---

## Description

Map usability features — clustering prevents pin overload at low zoom levels, and the search bar lets users navigate by county/location, artist, or event category. All UI must match the approved designs.

---

## Affected Apps / Packages

| App / Package | Role                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `apps/api`    | Artist search endpoint                                                                          |
| `apps/mobile` | Clustering config, search bar UI, Google Places Autocomplete integration, category filter sheet |

---

## API Endpoints

| Method | Path                 | Purpose                      |
| ------ | -------------------- | ---------------------------- |
| GET    | `/artists/search?q=` | Search artists by stage name |

---

## Requirements

- R1: Pin clustering enabled on the map — nearby pins merge into a count badge when zoomed out (e.g. "5")
- R2: Tapping a cluster zooms in to separate the individual pins
- R3: Cluster badge styled to match UI design (green circle with white count)
- R4: Search bar at top of map screen with placeholder: _"Search by county / artist / category"_
- R5: Filter icon button to the right of search bar — opens category filter bottom sheet
- R6: County/location search uses Google Places Autocomplete API restricted to Ireland (`componentRestrictions: { country: 'ie' }`)
- R7: Selecting a location result re-centres the map on that location and reloads pins
- R8: Artist search queries `GET /artists/search?q=` and shows results as a list — tapping navigates to Artist Profile
- R9: Category filter bottom sheet lists all pre-seeded event categories; selecting one filters visible map pins
- R10: Active category filter shown as an indicator on the filter icon; clear filter option provided

---

## Acceptance Criteria

- [ ] Multiple nearby pins at low zoom merge into a cluster badge
- [ ] Tapping a cluster zooms in and pins separate
- [ ] Cluster badge matches design (green circle, white count)
- [ ] Search bar visible at top of map with correct placeholder text
- [ ] Typing a county name (e.g. "Galway") shows Irish Places Autocomplete suggestions
- [ ] Selecting a location result re-centres map and reloads pins for that area
- [ ] Typing an artist name returns matching artist results; tapping navigates to their profile
- [ ] Category filter sheet opens from filter icon; selecting a category filters map pins
- [ ] Filter icon shows active indicator when a category filter is applied
- [ ] Clearing filter restores all pins

---

## Technical Notes

- Use `react-native-map-clustering` library or the built-in clustering prop depending on `react-native-maps` version compatibility
- Google Places API key must be restricted to Ireland (`componentRestrictions: { country: 'ie' }`) and have domain/app bundle restrictions to avoid unexpected billing
- Open Item #1 (default event categories) must be resolved before category filter is fully implemented — use placeholder categories in dev
- Artist search should debounce ~300ms to avoid firing on every keystroke
