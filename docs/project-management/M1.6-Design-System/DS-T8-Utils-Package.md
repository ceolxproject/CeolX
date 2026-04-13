# DS-T8 · Utils Package — Shared Helper Functions

| Field          | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages                            |
| **Status**     | ✅ Done                                                           |
| **Depends on** | M1-T10 (packages/shared scaffold)                                 |
| **PRD Ref**    | Section 10.1 (packages/shared), Section 5 (Map), Section 9 (GDPR) |

---

## Description

Create reusable utility functions in `packages/shared/src/utils/` covering date formatting (Irish locale), coordinate helpers, event display utilities, and type guards. These eliminate duplication across `apps/native` and `apps/admin` and ensure consistent formatting of dates, distances, and Irish place names throughout the app.

---

## Affected Apps / Packages

| App / Package     | Role                               |
| ----------------- | ---------------------------------- |
| `packages/shared` | Exports all utility functions      |
| `apps/native`     | Imports utils for display logic    |
| `apps/admin`      | Imports utils for table formatting |
| `apps/api`        | May import coordinate + slug utils |

---

## Requirements

### Date & Time Utilities

- Format event dates in Irish locale: `"Sat, 5 Apr · 8:00pm"`
- Relative time: `"2 hours ago"`, `"in 3 days"` (using `date-fns`)
- ISO 8601 parse to `Date` object
- Check if an event is today, upcoming, or past
- Format date range: `"5–7 Apr 2026"` (for multi-day events)
- All times displayed in `Europe/Dublin` timezone

### Irish Geography Utilities

- Map of Irish county names and their abbreviations
- `getCountyFromCoords(lat, lng)` — approximate county lookup (bounding boxes)
- Validate that coordinates are within Ireland's bounding box (lat: 51.3–55.5, lng: -10.7 to -5.9)
- `formatIrishAddress(address)` — capitalise county names correctly (e.g. "Co. Cork" not "co. cork")

### Event Display Utilities

- `getEventStatusLabel(status)` — human-readable label: `"Pending Review"`, `"Live"`, `"Rejected"`
- `getEventStatusColour(status)` — hex colour for status (maps to CeolX brand colours)
- `truncateText(text, maxLength)` — truncate with ellipsis, respect word boundaries
- `formatCategory(category)` — display-friendly category name: `"trad_session"` → `"Trad Session"`

### Coordinate & Map Utilities

- `distanceBetween(lat1, lng1, lat2, lng2)` — haversine distance in km
- `formatDistance(km)` — `"0.3km"` under 1km, `"2.4km"` otherwise
- `getBoundingBox(lat, lng, radiusKm)` — returns `{ swLat, swLng, neLat, neLng }` for viewport queries
- `clampToIreland(lat, lng)` — clamp coordinates to Ireland's bounding box

### Type Guards & Utilities

- `isArtistProfile(profile)` — type guard
- `isVenueProfile(profile)` — type guard
- `isEventActive(event)` — returns true if status is `active` and date hasn't passed
- `generateSlug(text)` — URL-safe slug: `"Trad Night at O'Brien's"` → `"trad-night-at-obriens"`
- `cn(...classes)` — `clsx` + `tailwind-merge` helper (shared between admin and mobile)

---

## Acceptance Criteria

- [ ] `formatEventDate(isoString)` returns `"Sat, 5 Apr · 8:00pm"` in Europe/Dublin timezone
- [ ] `isWithinIreland(lat, lng)` returns `false` for London coordinates
- [ ] `distanceBetween` returns correct km between Dublin and Cork (~258km)
- [ ] `getBoundingBox` returns correct SW/NE corners for a 25km radius
- [ ] `formatCategory('trad_session')` returns `'Trad Session'`
- [ ] `generateSlug("Trad Night at O'Brien's")` returns `'trad-night-at-obriens'`
- [ ] `truncateText('Long text...', 50)` never cuts mid-word
- [ ] All functions exported from `packages/shared/src/utils/index.ts`
- [ ] All functions have TypeScript types — no `any`

---

## Dependencies

### Upstream

- M1-T10 (packages/shared scaffold)

### Downstream

- M3 (Map uses coordinate utils, `getBoundingBox` used in viewport query)
- M4 (Event feed uses date formatting, `formatCategory`, `getEventStatusColour`)
- M9 (Admin dashboard uses date formatting, `getEventStatusLabel`)
- All apps benefit from shared type guards

---

## Technical Notes

### Date Utilities

```typescript
// packages/shared/src/utils/date.ts

import { format, formatDistanceToNow, isToday, isFuture, isPast } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const IRELAND_TZ = 'Europe/Dublin';

export const formatEventDate = (isoString: string): string => {
  const date = toZonedTime(new Date(isoString), IRELAND_TZ);
  return format(date, 'EEE, d MMM · h:mmaaa'); // "Sat, 5 Apr · 8:00pm"
};

export const formatRelativeTime = (isoString: string): string =>
  formatDistanceToNow(new Date(isoString), { addSuffix: true });

export const formatDateRange = (start: string, end?: string): string => {
  const s = toZonedTime(new Date(start), IRELAND_TZ);
  if (!end) return format(s, 'd MMM yyyy');
  const e = toZonedTime(new Date(end), IRELAND_TZ);
  if (format(s, 'MMM yyyy') === format(e, 'MMM yyyy')) {
    return `${format(s, 'd')}–${format(e, 'd MMM yyyy')}`;
  }
  return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`;
};

export const isEventUpcoming = (dateStart: string) => isFuture(new Date(dateStart));
export const isEventPast = (dateStart: string) => isPast(new Date(dateStart));
export const isEventToday = (dateStart: string) => isToday(new Date(dateStart));
```

### Coordinate Utilities

```typescript
// packages/shared/src/utils/coordinates.ts

const IRELAND_BOUNDS = { minLat: 51.3, maxLat: 55.5, minLng: -10.7, maxLng: -5.9 };

export const isWithinIreland = (lat: number, lng: number): boolean =>
  lat >= IRELAND_BOUNDS.minLat &&
  lat <= IRELAND_BOUNDS.maxLat &&
  lng >= IRELAND_BOUNDS.minLng &&
  lng <= IRELAND_BOUNDS.maxLng;

export const distanceBetween = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

export const getBoundingBox = (lat: number, lng: number, radiusKm: number) => {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    swLat: lat - latDelta,
    swLng: lng - lngDelta,
    neLat: lat + latDelta,
    neLng: lng + lngDelta,
  };
};
```

### Event Display Utilities

```typescript
// packages/shared/src/utils/events.ts

import type { EventStatus } from '../enums';

export const getEventStatusLabel = (status: EventStatus): string =>
  ({
    draft: 'Draft',
    pending_review: 'Pending Review',
    active: 'Live',
    rejected: 'Rejected',
    archived: 'Archived',
  })[status];

export const getEventStatusColour = (status: EventStatus): string =>
  ({
    draft: '#662FFF', // blue-10 (primary)
    pending_review: '#F59E0B',
    active: '#662FFF', // blue-10 (primary) — live events use brand primary
    rejected: '#EF4444',
    archived: '#8D8D8D', // gray-10
  })[status];

export const formatCategory = (category: string): string =>
  category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, text.lastIndexOf(' ', maxLength)) + '…';
};

export const generateSlug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/-+/g, '-') // collapse hyphens
    .trim();
```

### Barrel Export

```typescript
// packages/shared/src/utils/index.ts
export * from './date';
export * from './coordinates';
export * from './events';
export * from './typeGuards';
```

---

## Common Gotchas

- **`date-fns-tz` for Irish timezone**: Always use `toZonedTime` before formatting — without it, dates display in the server/device timezone, which may not be `Europe/Dublin`.
- **Haversine accuracy**: Good enough for UI display (event distance from user). Not suitable for navigation or precise GIS work.
- **`generateSlug` and Irish characters**: Irish uses fadas (á, é, í, ó, ú) — the `normalize('NFD')` step strips them correctly, so `"Ó Briain"` → `"o-briain"`.
- **`cn()` in shared**: The `cn` utility uses `clsx` + `tailwind-merge`. Both must be added to `packages/shared` as dependencies, not dev dependencies.
- **Status colours match Figma brand tokens**: `active` and `draft` both map to `#662FFF` (blue-10 primary). Do not use `#00a86b` — that is not in the Figma design system.

---
