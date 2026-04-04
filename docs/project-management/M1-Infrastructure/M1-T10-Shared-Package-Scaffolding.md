# M1-T10 · Shared Package Scaffolding (`packages/shared`)

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Milestone**  | M1 — Project Setup & Infrastructure                                |
| **Status**     | ✅ Done (partial scaffold exists — see Pre-existing State below)   |
| **Depends on** | M1-T1 (Turborepo monorepo init), M1.5-T1 (packages/db enums exist) |
| **PRD Ref**    | Section 10.1 (Monorepo Structure — packages/shared)                |

---

## Description

Create the `packages/shared` package that provides TypeScript types, string literal union types, utility functions, and constants shared across all three apps (`apps/server`, `apps/admin`, `apps/native`). This package is the **single source of truth for domain enum values** — `packages/db` imports raw value arrays from here to construct its Drizzle `pgEnum` definitions, eliminating duplication and ensuring the TypeScript types and database schema never drift apart.

> **Note on app names**: The CLAUDE.md and PRD reference `apps/api` and `apps/mobile`. The actual repo directories are `apps/server` (Hono host) and `apps/native` (React Native + Expo). All acceptance criteria use the actual repo names.

---

## Pre-existing State (Partial Scaffold)

A minimal stub was created as a side-effect of earlier auth work. Before implementing this task, the following already exists:

| Path                                | State                                                                         | Action Required                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/shared/src/index.ts`      | 2-line stub — only re-exports `User` and `UserRole`                           | Replace with full barrel export                                                |
| `packages/shared/src/types/user.ts` | `UserRole` as inline union type + `User` interface                            | Migrate contents into `src/enums.ts` and `src/types.ts`, then delete this file |
| `packages/shared/package.json`      | Name and `tsconfig` correct; missing sub-path exports and `type-check` script | Update exports map and scripts                                                 |
| `packages/shared/tsconfig.json`     | Correct — extends `@CeolX/config/tsconfig.base.json`                          | No change needed                                                               |
| `packages/db/src/schema/enums.ts`   | All 5 shared enums hardcoded — no import from `@CeolX/shared`                 | Update to import from `@CeolX/shared`                                          |
| `packages/db/package.json`          | No `@CeolX/shared` dependency                                                 | Add `"@CeolX/shared": "workspace:*"`                                           |
| `apps/native/package.json`          | Already has `@CeolX/shared: workspace:*`                                      | No change needed                                                               |
| `apps/admin/package.json`           | Already has `@CeolX/shared: workspace:*`                                      | No change needed                                                               |
| `apps/server/package.json`          | No `@CeolX/shared` dependency                                                 | Add `"@CeolX/shared": "workspace:*"`                                           |

**Key structural deviation**: `UserRole` is currently defined as a plain inline union (`type UserRole = 'spectator' | ...`) in `src/types/user.ts`. It must be changed to the `as const` array + derived type pattern so `packages/db` can pass the array directly to `pgEnum()`.

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
  "name": "@CeolX/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./enums": "./src/enums.ts",
    "./types": "./src/types.ts",
    "./constants": "./src/constants.ts",
    "./utils": "./src/utils/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "devDependencies": {
    "@CeolX/config": "workspace:*",
    "typescript": "^5"
  }
}
```

> `@CeolX/shared` matches the monorepo name convention (`@CeolX/*`). No `drizzle-orm` dependency — ever. If you find yourself adding it, the logic belongs in `packages/db` or `apps/server`.

### src/enums.ts

Domain enum values defined as `as const` arrays. `packages/db` imports these arrays directly to construct Drizzle `pgEnum` definitions — this file is the **single source of truth** for all enum values across the stack.

```typescript
// User persona/role — imported by packages/db to build pgEnum("user_role")
export const USER_ROLES = ['spectator', 'artist', 'venue', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Event lifecycle states — imported by packages/db to build pgEnum("event_status")
export const EVENT_STATUSES = [
  'draft',
  'pending_review',
  'rejected',
  'active',
  'archived',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// Booking state machine — imported by packages/db to build pgEnum("booking_status")
export const BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Booking direction — imported by packages/db to build pgEnum("booking_direction")
export const BOOKING_DIRECTIONS = ['venue_to_artist', 'artist_to_venue'] as const;
export type BookingDirection = (typeof BOOKING_DIRECTIONS)[number];

// Venue subscription via Stripe — imported by packages/db to build pgEnum("subscription_status")
export const SUBSCRIPTION_STATUSES = ['inactive', 'active', 'past_due', 'cancelled'] as const;
export type VenueSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// Irish music event categories (pre-seeded, subject to client sign-off)
export const EVENT_CATEGORIES = [
  'Traditional',
  'Contemporary',
  'Fusion',
  'Celtic',
  'Folk',
  'Session',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// Notification persona targeting
export const NOTIFICATION_PERSONAS = ['artist', 'venue', 'spectator'] as const;
export type NotificationPersona = (typeof NOTIFICATION_PERSONAS)[number];
```

#### Why `as const` arrays + derived types instead of TypeScript `enum`

- **No enum-to-string conversion** — Drizzle stores and returns raw strings; string literal unions match exactly without any mapping step
- **`packages/db` can import the arrays directly** — `pgEnum("user_role", USER_ROLES)` works because Drizzle accepts `Readonly<[string, ...string[]]>`, which `as const` satisfies
- **One change propagates everywhere** — add `"moderator"` to `USER_ROLES` and both the TypeScript type and the next migration pick it up automatically
- **Runtime validation for free** — use `USER_ROLES.includes(value)` as a type guard at API boundaries without a separate enum lookup

#### Corresponding update to `packages/db`

First, add `@CeolX/shared` as a dependency in `packages/db/package.json`:

```json
{
  "dependencies": {
    "@CeolX/shared": "workspace:*"
  }
}
```

Then update `packages/db/src/schema/enums.ts` to import from `@CeolX/shared` instead of hardcoding values:

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';
import {
  USER_ROLES,
  EVENT_STATUSES,
  BOOKING_STATUSES,
  BOOKING_DIRECTIONS,
  SUBSCRIPTION_STATUSES,
} from '@CeolX/shared';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const eventStatusEnum = pgEnum('event_status', EVENT_STATUSES);
export const bookingStatusEnum = pgEnum('booking_status', BOOKING_STATUSES);
export const bookingDirectionEnum = pgEnum('booking_direction', BOOKING_DIRECTIONS);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);

// media_type and notification_type are db-internal — not needed in shared
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video', 'audio', 'text']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'event_approved',
  'event_rejected',
  'booking_invitation',
  'booking_update',
  'artist_message',
  'venue_message',
]);
```

> `mediaTypeEnum` and `notificationTypeEnum` are not in `packages/shared` because they are internal database concerns — no client app needs to reference media asset types or notification type strings directly.

### src/types.ts

Shared TypeScript interfaces:

```typescript
import type {
  UserRole,
  EventStatus,
  EventCategory,
  BookingStatus,
  BookingDirection,
  VenueSubscriptionStatus,
} from './enums';

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
export const VENUE_SUBSCRIPTION_URL = 'https://ceolx.ie/subscribe';

// FCM
export const FCM_NOTIFICATION_CLICK_ACTION = 'FLUTTER_NOTIFICATION_CLICK';

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
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin',
  };
  const formatted = start.toLocaleDateString('en-IE', options);
  if (!dateEnd) return formatted;
  const end = new Date(dateEnd);
  const endTime = end.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Dublin',
  });
  return `${formatted} – ${endTime}`;
}
```

### src/utils/geo.ts

```typescript
import type { BoundingBox, LatLng } from '../types';

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
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin2 * sin2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
```

### src/index.ts (barrel)

```typescript
export * from './enums';
export * from './types';
export * from './constants';
export * from './utils/string';
export * from './utils/date';
export * from './utils/geo';
```

---

## Acceptance Criteria

- [ ] `src/types/user.ts` removed — its `User` interface and `UserRole` migrated into `src/types.ts` and `src/enums.ts` respectively
- [ ] `packages/shared` contains all files: `src/enums.ts`, `src/types.ts`, `src/constants.ts`, `src/utils/string.ts`, `src/utils/date.ts`, `src/utils/geo.ts`, `src/utils/index.ts`, `src/index.ts`, `README.md`
- [ ] `package.json` exports map includes sub-path exports (`./enums`, `./types`, `./constants`, `./utils`) and scripts include `"type-check": "tsc --noEmit"`
- [ ] `tsconfig.json` extends `@CeolX/config/tsconfig.base.json`; `tsc --noEmit` passes with no errors
- [ ] All domain enum value arrays are defined as `as const` arrays with derived string literal union types (`USER_ROLES`, `EVENT_STATUSES`, `BOOKING_STATUSES`, `BOOKING_DIRECTIONS`, `SUBSCRIPTION_STATUSES`, `EVENT_CATEGORIES`, `NOTIFICATION_PERSONAS`)
- [ ] `packages/db/package.json` adds `"@CeolX/shared": "workspace:*"` to dependencies
- [ ] `packages/db/src/schema/enums.ts` imports `USER_ROLES`, `EVENT_STATUSES`, `BOOKING_STATUSES`, `BOOKING_DIRECTIONS`, `SUBSCRIPTION_STATUSES` from `@CeolX/shared` — no hardcoded values remain for those enums
- [ ] `packages/db` `tsc --noEmit` passes after the enum import update
- [ ] Constants reflect PRD values (map limits, Ireland coordinates, GDPR timings)
- [ ] `apps/server/package.json` adds `"@CeolX/shared": "workspace:*"` to dependencies
- [ ] `import { UserRole } from "@CeolX/shared"` resolves correctly in `apps/server` (the Hono API host)
- [ ] `import { EventStatus } from "@CeolX/shared"` resolves correctly in `apps/admin`
- [ ] `import { MAP_MAX_PINS_PER_FETCH } from "@CeolX/shared"` resolves correctly in `apps/native`
- [ ] Turborepo includes `packages/shared` in the workspace dependency graph
- [ ] `packages/shared` has zero runtime dependencies and zero internal workspace dependencies
- [ ] README.md documents purpose, public API surface, and the db↔shared enum relationship

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
    "@CeolX/shared": "workspace:*"
  }
}
```

`packages/db` also adds this dependency so it can import the enum arrays:

```json
{
  "dependencies": {
    "@CeolX/shared": "workspace:*"
  }
}
```

Turborepo automatically builds `packages/shared` before building any dependent package or app.

### Enum Values: `as const` Arrays + Derived Types (not TypeScript `enum`)

Use `as const` tuple arrays for all domain concepts that map to database column values. Derive the TypeScript type with `(typeof ARRAY)[number]`. Do **not** use TypeScript `enum` — Drizzle returns plain strings and TS enum values require an explicit `.toString()` or cast when passed to Drizzle queries.

```typescript
// Correct
export const USER_ROLES = ['spectator', 'artist'] as const;
export type UserRole = (typeof USER_ROLES)[number]; // "spectator" | "artist"

// Avoid — requires enum.Value → string conversion when writing Drizzle queries
export enum UserRole {
  Spectator = 'spectator',
  Artist = 'artist',
}
```

For one-off, non-persisted unions (e.g., a component prop), prefer inline `type X = 'a' | 'b'`.

### Constants vs Environment Variables

Constants in this package are **business rule values from the PRD** (e.g., max pins, Ireland centre). They do not change per environment. Runtime configuration (API URLs, API keys) belongs in `.env` files, not here.

---

## Common Gotchas

- **Migrate `src/types/user.ts` before creating new files** — the existing file exports `User` and `UserRole` which `apps/native` and `apps/admin` already import via `@CeolX/shared`. Move `User` into `src/types.ts` and `UserRole` (as `USER_ROLES as const` array) into `src/enums.ts`, update `src/index.ts`, then delete `src/types/user.ts`. Do not break the existing imports.
- **`"type": "module"` in package.json** — required for ESM imports with Turborepo; without it, `tsc` may resolve incorrectly in consuming apps
- **Exports map** — the `"exports"` field in `package.json` must match the file structure; TypeScript 5.x respects this for path resolution
- **Enum value casing** — `EVENT_CATEGORIES` uses `"Traditional"` (title case) but all other arrays use lowercase; match the database column values exactly or Drizzle comparisons will fail silently
- **`packages/shared` has zero runtime dependencies** — if you find yourself adding `drizzle-orm` or `hono`, the logic belongs in `packages/db` or `apps/server` instead
- **`mediaTypeEnum` and `notificationTypeEnum` stay in `packages/db`** — these are internal DB concerns; no client app references them, so they are not exposed via `packages/shared`
- **Adding a new enum value** — change the array in `packages/shared/src/enums.ts`, then run `db:generate` in `packages/db` to produce the `ALTER TYPE … ADD VALUE` migration; TypeScript types update automatically
- **`FCM_NOTIFICATION_CLICK_ACTION` constant** — the spec value `'FLUTTER_NOTIFICATION_CLICK'` is a Flutter SDK constant and does not apply to a React Native project. Verify the correct FCM click action string for `@react-native-firebase/messaging` before using this constant; it may simply be unused or unnecessary.

---
