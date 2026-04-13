# M2-T5 · RBAC Roles + Auth Middleware

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Milestone**  | M2 — Authentication & Persona System                               |
| **Status**     | 🔲 To Do                                                           |
| **Depends on** | M2-T1 (auth session), M2-T4 (persona system, `users.current_role`) |
| **PRD Ref**    | Section 4.1 (Authentication), Section 4.3 (Persona Switching)      |

---

## Description

Define the role enum and implement Hono middleware that enforces persona-based access control on all protected API routes. BetterAuth handles session authentication but does NOT enforce `current_role` access on routes — that is custom middleware. Every route that is persona-specific (artist-only, venue-only, admin-only) must be guarded here. This task establishes the security foundation that all M3+ features depend on.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| `packages/shared` | `UserRole` enum (`spectator \| artist \| venue \| admin`)                             |
| `apps/api`        | `authMiddleware` (session validation), `requireRole` middleware (persona enforcement) |

---

## API Endpoints

No new endpoints. This task adds middleware used by all existing and future routes.

---

## Requirements

### UserRole Enum

- Defined in `packages/shared/src/enums/roles.ts`
- Values: `spectator`, `artist`, `venue`, `admin`
- Exported and used by both `apps/api` and `apps/mobile`
- Used as the type for `users.current_role` in the DB schema

### Auth Middleware (`authMiddleware`)

- Validates the BetterAuth session token on every protected request
- Extracts `userId` and `currentRole` from the session and sets them on Hono context: `c.set('userId', ...)` and `c.set('currentRole', ...)`
- Returns `401 Unauthorized` if no valid session token
- Returns `403 Forbidden` if session is expired
- Applied to all routes under `/api/v1/*` (except public auth routes)

### Role Middleware (`requireRole`)

- Higher-order middleware: `requireRole('artist')` or `requireRole('venue', 'admin')`
- Reads `currentRole` from Hono context (set by `authMiddleware`)
- Returns `403 Forbidden` with `{ error: 'ROLE_REQUIRED', requiredRole: [...], currentRole }` if role does not match
- Chainable: applied after `authMiddleware` on specific routes
- Admin bypass: `admin` role passes all `requireRole` checks regardless of specified roles

### Route Protection Matrix

| Route pattern                      | Required role(s)       |
| ---------------------------------- | ---------------------- |
| `GET /api/v1/users/me`             | Any authenticated user |
| `POST /api/v1/users/onboarding`    | Any authenticated user |
| `PATCH /api/v1/users/role`         | Any authenticated user |
| `POST /api/v1/events`              | `artist`, `venue`      |
| `GET /api/v1/events/moderation`    | `admin`                |
| `PATCH /api/v1/events/:id/approve` | `admin`                |
| `PATCH /api/v1/events/:id/reject`  | `admin`                |
| `GET /api/v1/artist-profiles/*`    | Any authenticated user |
| `PATCH /api/v1/artist-profiles/*`  | `artist`               |
| `GET /api/v1/venue-profiles/*`     | Any authenticated user |
| `PATCH /api/v1/venue-profiles/*`   | `venue`                |

---

## Acceptance Criteria

- [ ] `UserRole` enum exported from `packages/shared` and imported in both `apps/api` and `apps/mobile`
- [ ] `authMiddleware` validates BetterAuth session on every `/api/v1/*` request
- [ ] Unauthenticated request to protected route returns `401`
- [ ] `requireRole('artist')` returns `403` when user's `current_role` is `spectator` or `venue`
- [ ] `requireRole('venue')` returns `403` when user's `current_role` is `spectator` or `artist`
- [ ] `admin` role passes all `requireRole` checks
- [ ] `authMiddleware` sets `userId` and `currentRole` on Hono context for downstream handlers
- [ ] All `/api/v1/*` routes (except `/api/auth/*`) are protected by `authMiddleware`
- [ ] Route protection matrix above is enforced

---

## Dependencies

### Upstream

- M2-T1 (BetterAuth session — middleware reads the session)
- M2-T4 (Persona system — `users.current_role` is the source of truth for role enforcement)

### Downstream

- All M3+ feature routes — every endpoint gated by persona uses `requireRole`

### External services

- BetterAuth session API (for token validation in `authMiddleware`)

---

## Technical Notes

### UserRole Enum

```typescript
// packages/shared/src/enums/roles.ts

export const UserRole = {
  SPECTATOR: 'spectator',
  ARTIST: 'artist',
  VENUE: 'venue',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
```

### Auth Middleware

```typescript
// apps/api/src/middleware/auth.ts

import { Context, Next } from 'hono';
import { auth } from '../lib/auth';
import type { UserRole } from '@ceolx/shared';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    currentRole: UserRole;
  }
}

export const authMiddleware = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required' }, 401);
  }

  c.set('userId', session.user.id);
  c.set('currentRole', session.user.currentRole as UserRole);

  return next();
};
```

### requireRole Middleware

```typescript
// apps/api/src/middleware/requireRole.ts

import { Context, Next } from 'hono';
import type { UserRole } from '@ceolx/shared';

export const requireRole = (...roles: UserRole[]) => {
  return async (c: Context, next: Next) => {
    const currentRole = c.get('currentRole');

    // Admin bypasses all role checks
    if (currentRole === 'admin') {
      return next();
    }

    if (!roles.includes(currentRole)) {
      return c.json(
        {
          error: 'ROLE_REQUIRED',
          message: `This action requires one of the following roles: ${roles.join(', ')}`,
          requiredRole: roles,
          currentRole,
        },
        403
      );
    }

    return next();
  };
};
```

### Applying to Routes

```typescript
// apps/api/src/routes/events.ts

import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

// Any authenticated user
app.get('/api/v1/users/me', authMiddleware, getUserMe);

// Artist or venue only
app.post('/api/v1/events', authMiddleware, requireRole('artist', 'venue'), createEvent);

// Admin only
app.get('/api/v1/events/moderation', authMiddleware, requireRole('admin'), getModerationQueue);
```

---

## Common Gotchas

- **BetterAuth does not enforce `current_role`**: BetterAuth only validates the session token. Role enforcement on routes is entirely custom — this middleware is mandatory, not optional.
- **Role stored in session vs DB**: `authMiddleware` reads `currentRole` from the BetterAuth session. Ensure BetterAuth is configured to include `currentRole` in the session payload; otherwise middleware must do a DB lookup on every request.
- **Admin route separation**: Admin routes (`/api/v1/events/moderation`, etc.) should additionally check `current_role === 'admin'` from the DB, not just the session, to prevent stale session attacks.
- **`requireRole` must follow `authMiddleware`**: Never use `requireRole` without `authMiddleware` before it — `c.get('currentRole')` will be undefined.
- **Spectator access to public data**: Not all endpoints need `requireRole`. Map browsing, public event listings, and artist/venue profiles are read-accessible to all authenticated users including spectators.

---
