# M1-T3 · Hono API Scaffold

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                |
| **Status**     | 🔲 To Do                                           |
| **Depends on** | M1-T1 (Turborepo + shared enums), M1-T2 (DB infra) |
| **PRD Ref**    | Section 10.1 (Backend API — Hono)                  |

---

## Description

Scaffold the backend API foundation with complete route structure, middleware stack, error handling, and local dev server. No business logic is implemented yet — only route stubs that return placeholder responses. This task establishes the architectural patterns and request/response formats that every M2–M11 feature will build on.

Hono runs as a plain Node.js HTTP server via `@hono/node-server`. This keeps the setup simple and platform-agnostic — deployable to Railway, Render, Fly.io, or any Node.js host without a build step or vendor-specific adapter.

---

## Affected Apps / Packages

| App / Package     | Role                                                       |
| ----------------- | ---------------------------------------------------------- |
| `apps/api`        | Hono application with routes, middleware, error handlers   |
| `packages/shared` | Types used in request/response schemas, enums, error codes |

---

## API Endpoints

All endpoints return placeholder JSON at this stage. Business logic is wired in subsequent milestones.

### Health Check

**GET /health**

```json
{ "status": "ok", "timestamp": "2026-03-23T14:30:00Z", "version": "1.0.0" }
```

### Auth Routes (`/api/v1/auth`)

| Method | Path       | Wired in |
| ------ | ---------- | -------- |
| POST   | `/sign-up` | M2-T1    |
| POST   | `/sign-in` | M2-T1    |
| POST   | `/logout`  | M2-T1    |

### Event Routes (`/api/v1/events`)

| Method | Path   | Notes              | Wired in |
| ------ | ------ | ------------------ | -------- |
| GET    | `/map` | Bounding-box query | M3-T1    |
| POST   | `/`    | Create event       | M4-T1    |
| GET    | `/:id` | Event detail       | M4-T1    |
| PATCH  | `/:id` | Update event       | M4-T1    |

### Artist Routes (`/api/v1/artists`)

| Method | Path      | Wired in |
| ------ | --------- | -------- |
| GET    | `/search` | M3-T3    |
| GET    | `/:id`    | M6-T1    |

### Booking Routes (`/api/v1/bookings`)

| Method | Path   | Wired in |
| ------ | ------ | -------- |
| POST   | `/`    | M5-T1    |
| PATCH  | `/:id` | M5-T3    |

### Admin Routes (`/api/v1/admin`)

| Method | Path                  | Wired in |
| ------ | --------------------- | -------- |
| GET    | `/events/pending`     | M9-T2    |
| PATCH  | `/events/:id/approve` | M9-T2    |
| PATCH  | `/events/:id/reject`  | M9-T2    |

### Webhook Routes (`/api/v1/webhooks`)

| Method | Path      | Wired in |
| ------ | --------- | -------- |
| POST   | `/stripe` | M8-T2    |

---

## Requirements

### Route Structure

- All routes in `src/routes/` — one file per concern: `auth.ts`, `events.ts`, `artists.ts`, `bookings.ts`, `admin.ts`, `webhooks.ts`
- `src/index.ts` imports and registers all route groups
- Route handlers delegate to `src/services/` — handlers should be thin (5–10 lines max)
- All routes prefixed `/api/v1/`

### CORS

- Origins: `https://app.ceolx.ie`, `https://admin.ceolx.ie`, `http://localhost:3000`, `http://localhost:8081` (Expo)
- Credentials allowed
- OPTIONS preflight handled automatically by Hono's CORS middleware

### Auth Middleware

- Extracts `userId` and `currentRole` from `Authorization: Bearer <token>` header
- Sets them on Hono context — stubbed for now, fully wired in M2-T1
- Unprotected routes (sign-up, sign-in, health check) bypass auth
- Returns `401` if token present but invalid

### Error Response Format

Consistent across all routes:

```json
{
  "error": "ValidationError",
  "code": "INVALID_EMAIL",
  "message": "Email format invalid",
  "statusCode": 400
}
```

### Request Validation

- Zod schemas via `@hono/zod-validator`
- All schemas in `src/schemas/`
- Invalid requests return `400` with field-level error details

### Environment Variables

| Variable               | Used in | Notes                                    |
| ---------------------- | ------- | ---------------------------------------- |
| `DATABASE_URL`         | M1-T2   | Set in `.env.local`                      |
| `BETTER_AUTH_SECRET`   | M2      | Placeholder until M2                     |
| `POSTMARK_API_TOKEN`   | M7      | Placeholder until M7                     |
| `STRIPE_SECRET_KEY`    | M8      | Placeholder until M8                     |
| `FIREBASE_PRIVATE_KEY` | M7      | Placeholder until M7                     |
| `NODE_ENV`             | Always  | `development` / `staging` / `production` |
| `PORT`                 | Always  | Default `3001`                           |

---

## File Structure

```
apps/api/src/
  index.ts          <- Hono app + node server entry point
  routes/
    auth.ts
    events.ts
    artists.ts
    bookings.ts
    admin.ts
    webhooks.ts
  middleware/
    auth.ts
    errorHandler.ts
  schemas/
    events.ts
    bookings.ts
  services/         <- empty stubs at this stage
  db/
    client.ts       <- from M1-T2
    schema/         <- from M1.5
```

---

## Code Reference

### `src/index.ts`

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import authRoutes from "./routes/auth";
import eventsRoutes from "./routes/events";
import artistsRoutes from "./routes/artists";
import bookingsRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";
import webhooksRoutes from "./routes/webhooks";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = new Hono();

app.use(logger());
app.use(
  cors({
    origin: [
      "https://app.ceolx.ie",
      "https://admin.ceolx.ie",
      "http://localhost:3000",
      "http://localhost:8081",
    ],
    credentials: true,
  }),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }),
);

app.use("/api/*", authMiddleware);

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/events", eventsRoutes);
app.route("/api/v1/artists", artistsRoutes);
app.route("/api/v1/bookings", bookingsRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/webhooks", webhooksRoutes);

app.onError(errorHandler);
app.notFound((c) =>
  c.json(
    {
      error: "NotFound",
      code: "ROUTE_NOT_FOUND",
      message: "Endpoint not found",
    },
    404,
  ),
);

const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`);
});

export default app;
```

### Auth Middleware

```typescript
// src/middleware/auth.ts
import type { Context, Next } from "hono";

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    c.set("userId", null);
    c.set("currentRole", null);
    return next();
  }

  // TODO M2-T1: verify with BetterAuth
  c.set("userId", "stub-user-id");
  c.set("currentRole", "spectator");
  return next();
};
```

### Error Handler

```typescript
// src/middleware/errorHandler.ts
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler = (err: Error, c: Context) => {
  console.error("[API Error]", { message: err.message, path: c.req.path });

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.constructor.name,
        code: `HTTP_${err.status}`,
        message: err.message,
        statusCode: err.status,
      },
      err.status,
    );
  }

  return c.json(
    {
      error: "InternalServerError",
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      statusCode: 500,
    },
    500,
  );
};
```

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@hono/zod-validator": "^0.x",
    "zod": "^3.x",
    "drizzle-orm": "^0.x",
    "better-auth": "^0.x"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "typescript": "^5.x",
    "@types/node": "^20.x"
  }
}
```

---

## Acceptance Criteria

- [ ] `GET /health` returns `{ status: "ok" }` with HTTP 200
- [ ] All route stubs reachable and returning placeholder JSON (verified with curl or Postman)
- [ ] CORS headers present; mobile and admin origins allowed
- [ ] Auth middleware in place; unprotected routes accessible without token
- [ ] Error handler returns consistent `{ error, code, message }` JSON
- [ ] `@hono/zod-validator` rejects invalid requests with 400
- [ ] `npm run dev` starts on `http://localhost:3001`
- [ ] `npm run type-check` passes with zero errors

---

## Common Gotchas

- **`authMiddleware` on `/api/*` catches auth routes too**: Sign-up and sign-in live at `/api/v1/auth/*` — the stub middleware just sets null and calls `next()`. In M2-T1, public auth routes will be explicitly bypassed with a path check.
- **Timezone**: Store and return all timestamps as UTC ISO 8601. Convert to user timezone on the client.
- **Hono context typing**: Add a type parameter for type-safe `c.get()` / `c.set()`:
  ```typescript
  type Variables = { userId: string | null; currentRole: string | null };
  const app = new Hono<{ Variables: Variables }>();
  ```
- **`tsx watch` vs `nodemon`**: `tsx watch` handles TypeScript natively with no separate build step — preferred for this stack.
