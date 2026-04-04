# @CeolX/shared

Shared TypeScript types, domain enums, utility functions, and business-rule constants for the CeolX monorepo.

This package is the **single source of truth for all domain enum values**. `packages/db` imports the `as const` arrays from here to construct Drizzle `pgEnum` definitions — ensuring the TypeScript types and database schema never drift apart.

---

## Public API

### Enums (`@CeolX/shared/enums` or `@CeolX/shared`)

All domain enums are defined as `as const` arrays with derived string literal union types.

| Export                                              | Type                                                                  | Description                         |
| --------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `USER_ROLES` / `UserRole`                           | `'spectator' \| 'artist' \| 'venue' \| 'admin'`                       | User persona                        |
| `EVENT_STATUSES` / `EventStatus`                    | `'draft' \| 'pending_review' \| 'rejected' \| 'active' \| 'archived'` | Event lifecycle                     |
| `BOOKING_STATUSES` / `BookingStatus`                | `'pending' \| 'accepted' \| 'rejected' \| 'cancelled'`                | Booking state machine               |
| `BOOKING_DIRECTIONS` / `BookingDirection`           | `'venue_to_artist' \| 'artist_to_venue'`                              | Who initiated the booking           |
| `SUBSCRIPTION_STATUSES` / `VenueSubscriptionStatus` | `'inactive' \| 'active' \| 'past_due' \| 'cancelled'`                 | Venue Stripe subscription           |
| `EVENT_CATEGORIES` / `EventCategory`                | `'Traditional' \| 'Contemporary' \| ...`                              | Irish music categories (Title Case) |
| `NOTIFICATION_PERSONAS` / `NotificationPersona`     | `'artist' \| 'venue' \| 'spectator'`                                  | Notification targeting              |

### Types (`@CeolX/shared/types` or `@CeolX/shared`)

| Export                                                            | Description                              |
| ----------------------------------------------------------------- | ---------------------------------------- |
| `User`                                                            | Authenticated user shape                 |
| `BoundingBox`, `LatLng`                                           | Geo primitives for map queries           |
| `PaginationParams`, `PaginatedResult<T>`                          | Pagination input/output                  |
| `ApiSuccess<T>`, `ApiError`, `ApiResponse<T>`                     | API response envelope                    |
| `EventSummary`, `ArtistSummary`, `VenueSummary`, `BookingSummary` | Lightweight domain shapes for client use |
| `NotificationPayload`                                             | FCM push notification payload            |

### Constants (`@CeolX/shared/constants` or `@CeolX/shared`)

| Export                                      | Value                 | Description                                 |
| ------------------------------------------- | --------------------- | ------------------------------------------- |
| `MAP_MAX_PINS_PER_FETCH`                    | `50`                  | Max map pins per viewport query             |
| `MAP_DEBOUNCE_MS`                           | `400`                 | Map pan debounce delay                      |
| `MAP_EXPAND_RADIUS_KM`                      | `[5, 25, 100]`        | Silent radius expansion steps for empty map |
| `IRELAND_CENTER_LAT` / `IRELAND_CENTER_LNG` | `53.1424` / `-7.6921` | Ireland geographic centre fallback          |
| `MAX_REJECTION_REASON_LENGTH`               | `500`                 | Max chars for event rejection reason        |
| `INACTIVE_ACCOUNT_FLAG_MONTHS`              | `24`                  | GDPR inactivity flag threshold              |
| `ACCOUNT_ANONYMIZE_DELAY_DAYS`              | `30`                  | GDPR anonymisation delay after flag         |
| `DEFAULT_PAGE_LIMIT`                        | `20`                  | Default API pagination limit                |
| `MAX_PAGE_LIMIT`                            | `100`                 | Maximum API pagination limit                |

### Utils (`@CeolX/shared/utils` or `@CeolX/shared`)

| Function                               | Description                                 |
| -------------------------------------- | ------------------------------------------- |
| `slugify(str)`                         | Convert string to URL-safe slug             |
| `capitalize(str)`                      | Capitalise first character                  |
| `truncate(str, maxLength)`             | Truncate with `...` suffix                  |
| `toISOString(date)`                    | Date → ISO 8601 string                      |
| `isEventUpcoming(dateStart)`           | True if event is in the future              |
| `isEventPast(dateStart)`               | True if event has passed                    |
| `formatEventDate(dateStart, dateEnd?)` | Format for display (Europe/Dublin timezone) |
| `isWithinBoundingBox(point, box)`      | Geo containment check                       |
| `distanceKm(a, b)`                     | Haversine distance in kilometres            |

---

## Usage

```typescript
// Via root import
import { UserRole, USER_ROLES, MAP_MAX_PINS_PER_FETCH } from '@CeolX/shared';

// Via sub-path import
import { USER_ROLES } from '@CeolX/shared/enums';
import { ApiResponse } from '@CeolX/shared/types';
import { MAP_MAX_PINS_PER_FETCH } from '@CeolX/shared/constants';
import { slugify } from '@CeolX/shared/utils';
```

---

## db↔shared Enum Relationship

`packages/db` imports the `as const` arrays directly into Drizzle's `pgEnum()`:

```typescript
// packages/db/src/schema/enums.ts
import { USER_ROLES, EVENT_STATUSES } from '@CeolX/shared';
import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const eventStatusEnum = pgEnum('event_status', EVENT_STATUSES);
```

**To add a new enum value:** edit the array in `packages/shared/src/enums.ts`, then run `db:generate` in `packages/db` to produce the `ALTER TYPE … ADD VALUE` migration. TypeScript types update automatically.

---

## Design Constraints

- **Zero runtime dependencies** — do not add `drizzle-orm`, `hono`, or any other runtime package here
- **No internal workspace dependencies** — this package is consumed by all apps; circular imports must be impossible
- `mediaTypeEnum` and `notificationTypeEnum` live in `packages/db` only — they are internal DB concerns, no client app references them
