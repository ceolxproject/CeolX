# M1-T10 · Shared Package Scaffolding (`packages/shared`)

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                 |
| **Status**     | 🔲 To Do                                            |
| **Depends on** | M1-T1 (Turborepo monorepo init)                     |
| **PRD Ref**    | Section 10.1 (Monorepo Structure — packages/shared) |

---

## Description

Create the `packages/shared` package that provides TypeScript types, enums, utility functions, and constants shared across all three apps (`apps/api`, `apps/admin`, `apps/mobile`). This package is the single source of truth for domain types and business constants — defining it early prevents type drift between the API and clients throughout all future milestones.

---

## Affected Apps / Packages

| App / Package     | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `packages/shared` | Output — exports all shared types, enums, utilities         |
| `apps/api`        | Consumer — imports event status, user role enums, API types |
| `apps/admin`      | Consumer — imports enums for table filters, form validation |
| `apps/mobile`     | Consumer — imports enums for navigation, display logic      |

---

## API Endpoints

None — this is a package scaffolding task.

---

## Requirements

### Directory Structure

```
packages/shared/
├── src/
│   ├── index.ts              # Barrel export — re-exports all public APIs
│   ├── enums.ts              # All domain enums
│   ├── types.ts              # Shared TypeScript interfaces and types
│   ├── constants.ts          # Business rule constants
│   └── utils/
│       ├── index.ts          # Utils barrel export
│       ├── string.ts         # String helpers
│       ├── date.ts           # Date formatting helpers
│       └── geo.ts            # Lat/lng / bounding box helpers
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@ceolx/shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./enums": "./src/enums.ts",
    "./types": "./src/types.ts",
    "./constants": "./src/constants.ts",
    "./utils": "./src/utils/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### src/enums.ts

All domain enums used across the platform:

```typescript
// User roles — maps to users.current_role column
export enum UserRole {
  Spectator = "spectator",
  Artist = "artist",
  Venue = "venue",
}

// Event lifecycle states — maps to events.status column
export enum EventStatus {
  Draft = "draft",
  PendingReview = "pending_review",
  Active = "active",
  Rejected = "rejected",
  Archived = "archived",
}

// Booking state machine
export enum BookingStatus {
  Pending = "pending",
  Accepted = "accepted",
  Rejected = "rejected",
  Cancelled = "cancelled",
}

// Booking direction
export enum BookingDirection {
  VenueToArtist = "venue_to_artist",
  ArtistToVenue = "artist_to_venue",
}

// Venue subscription
export enum VenueSubscriptionStatus {
  Inactive = "inactive",
  Active = "active",
  Cancelled = "cancelled",
  PastDue = "past_due",
}

// Irish music event categories (pre-seeded, subject to client sign-off)
export enum EventCategory {
  Traditional = "Traditional",
  Contemporary = "Contemporary",
  Fusion = "Fusion",
  Celtic = "Celtic",
  Folk = "Folk",
  Session = "Session",
}

// Notification persona targeting
export enum NotificationPersona {
  Artist = "artist",
  Venue = "venue",
  Spectator = "spectator",
}
```

### src/types.ts

Shared TypeScript interfaces:

```typescript
import type {
  EventStatus,
  EventCategory,
  BookingStatus,
  BookingDirection,
  UserRole,
  VenueSubscriptionStatus,
} from "./enums";

// --- Geo types ---

export interface BoundingBox {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// --- Pagination ---

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// --- API Response envelope ---

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  message: string;
  statusCode: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// --- Domain types (lightweight, for client use) ---

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  dateStart: string; // ISO 8601
  dateEnd?: string; // ISO 8601
  lat: number;
  lng: number;
  venueAddress?: string;
  category: EventCategory;
  status: EventStatus;
  isGigOpportunity: boolean;
  coverImageUrl?: string;
  ticketLink?: string;
  createdAt: string;
}

export interface ArtistSummary {
  id: string;
  displayName: string;
  bio?: string;
  genres: EventCategory[];
  profileImageUrl?: string;
  location?: string;
}

export interface VenueSummary {
  id: string;
  name: string;
  description?: string;
  address: string;
  lat: number;
  lng: number;
  subscriptionStatus: VenueSubscriptionStatus;
  profileImageUrl?: string;
}

export interface BookingSummary {
  id: string;
  status: BookingStatus;
  direction: BookingDirection;
  artistId: string;
  venueId: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Notification payload shape ---

export interface NotificationPayload {
  title: string;
  body: string;
  persona: string; // artist | venue | spectator
  route: string; // deep link route e.g. /events/123
  data?: Record<string, string>;
}
```

### src/constants.ts

Business rule constants from the PRD — centralised so they don't drift across apps:

```typescript
// Map configuration
export const MAP_MAX_PINS_PER_FETCH = 50;
export const MAP_DEBOUNCE_MS = 400;

// Silent radius expansion for empty map states
export const MAP_EXPAND_RADIUS_KM = [5, 25, 100] as const;

// Ireland geographic centre (fallback when GPS + IP both fail)
export const IRELAND_CENTER_LAT = 53.1424;
export const IRELAND_CENTER_LNG = -7.6921;

// Event moderation
export const MAX_REJECTION_REASON_LENGTH = 500;

// GDPR
export const INACTIVE_ACCOUNT_FLAG_MONTHS = 24;
export const ACCOUNT_ANONYMIZE_DELAY_DAYS = 30;

// Venue subscription
export const VENUE_SUBSCRIPTION_URL = "https://ceolx.ie/subscribe";

// FCM
export const FCM_NOTIFICATION_CLICK_ACTION = "FLUTTER_NOTIFICATION_CLICK";

// API pagination defaults
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
```

### src/utils/string.ts

```typescript
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}
```

### src/utils/date.ts

```typescript
export function toISOString(date: Date): string {
  return date.toISOString();
}

export function isEventUpcoming(dateStart: string): boolean {
  return new Date(dateStart) > new Date();
}

export function isEventPast(dateStart: string): boolean {
  return new Date(dateStart) <= new Date();
}

export function formatEventDate(dateStart: string, dateEnd?: string): string {
  const start = new Date(dateStart);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  };
  const formatted = start.toLocaleDateString("en-IE", options);
  if (!dateEnd) return formatted;
  const end = new Date(dateEnd);
  const endTime = end.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
  return `${formatted} – ${endTime}`;
}
```

### src/utils/geo.ts

```typescript
import type { BoundingBox, LatLng } from "../types";

export function isWithinBoundingBox(point: LatLng, box: BoundingBox): boolean {
  return (
    point.lat >= box.swLat &&
    point.lat <= box.neLat &&
    point.lng >= box.swLng &&
    point.lng <= box.neLng
  );
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const x =
    sin1 * sin1 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sin2 *
      sin2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
```

### src/index.ts (barrel)

```typescript
export * from "./enums";
export * from "./types";
export * from "./constants";
export * from "./utils/string";
export * from "./utils/date";
export * from "./utils/geo";
```

---

## Acceptance Criteria

- [ ] `packages/shared` directory created with all files above
- [ ] `package.json` uses `@ceolx/shared` name and correct exports map
- [ ] `tsconfig.json` extends root config; `tsc --noEmit` passes with no errors
- [ ] All enums from the PRD domain model are defined (UserRole, EventStatus, BookingStatus, etc.)
- [ ] Constants reflect PRD values (map limits, Ireland coordinates, GDPR timings)
- [ ] `import { UserRole } from "@ceolx/shared"` resolves correctly in `apps/api`
- [ ] `import { EventStatus } from "@ceolx/shared"` resolves correctly in `apps/admin`
- [ ] `import { MAP_MAX_PINS_PER_FETCH } from "@ceolx/shared"` resolves correctly in `apps/mobile`
- [ ] Turborepo includes `packages/shared` in the workspace dependency graph
- [ ] No circular imports (package has no internal workspace dependencies)
- [ ] README.md documents purpose and public API surface

---

## Technical Notes

### Why a Single Shared Package

CeolX's monorepo has only one shared package — `packages/shared` — rather than the fine-grained packages a larger monorepo might use. This is intentional for a V1 solo-developer project:

- Less configuration overhead — one `tsconfig.json` instead of ten
- Simpler dependency graph — no risk of circular imports between packages
- Faster iteration — add a type once, consume it everywhere immediately
- All apps in CeolX are owned by the same developer; no independent versioning is needed

If the project grows (e.g., separate frontend team, public SDK), splitting into `@ceolx/types`, `@ceolx/utils`, `@ceolx/api-client` is a straightforward future step.

### Workspace Reference

In each consumer app's `package.json`:

```json
{
  "dependencies": {
    "@ceolx/shared": "workspace:*"
  }
}
```

Turborepo automatically builds `packages/shared` before building dependent apps.

### Enum vs String Literal Unions

Prefer TypeScript `enum` for domain concepts that map to database column values (EventStatus, UserRole, etc.) — the string values are stable and match the Drizzle schema. For one-off, non-persisted unions (e.g., a component prop), prefer `type X = 'a' | 'b'`.

### Constants vs Environment Variables

Constants in this package are **business rule values from the PRD** (e.g., max pins, Ireland centre). They do not change per environment. Runtime configuration (API URLs, API keys) belongs in `.env` files, not here.

---

## Common Gotchas

- **`"type": "module"` in package.json** — required for ESM imports with Turborepo; without it, `tsc` may resolve incorrectly in consuming apps
- **Exports map** — the `"exports"` field in `package.json` must match the file structure; TypeScript 5.x respects this for path resolution
- **Enum value casing** — database columns use lowercase strings (`spectator`, `artist`); enum values must match exactly or Drizzle comparisons will fail silently
- **`packages/shared` has no runtime dependencies** — if you find yourself adding `drizzle-orm` or `hono` to this package, the logic belongs in `apps/api` instead

---
