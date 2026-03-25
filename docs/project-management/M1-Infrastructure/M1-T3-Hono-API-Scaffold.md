# M1-T3 · tRPC API Scaffold (Hono Transport)

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                |
| **Status**     | ✅ Done                                            |
| **Depends on** | M1-T1 (Turborepo + shared enums), M1-T2 (DB infra) |
| **PRD Ref**    | Section 10.1 (Backend API — Hono)                  |

---

## Description

Scaffold the backend API in a **tRPC-first** architecture. All feature procedures live in `packages/api/src/routers/` as tRPC procedures. `apps/server` is a thin Hono host that serves three things:

1. **tRPC** at `/trpc/*` — all feature queries and mutations
2. **BetterAuth** at `/api/auth/*` — sign-up, sign-in, sign-out, OAuth callbacks (BetterAuth's own HTTP handler; no custom routes needed)
3. **Stripe webhook** at `/api/webhooks/stripe` — raw body required; cannot go through tRPC (wired in M8-T2)

No business logic is implemented yet — only stub procedures that return placeholder responses. This task establishes the architectural patterns that every M2–M11 feature will build on.

---

## Affected Apps / Packages

| App / Package  | Role                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| `packages/api` | tRPC routers + context. All feature logic lives here. `AppRouter` type exported |
| `apps/server`  | Hono host: mounts tRPC, BetterAuth handler, Stripe webhook, health check        |

---

## tRPC Procedure Map

All procedures are stub-only at this stage. Business logic is wired in subsequent milestones.

### `events.*`

| Procedure       | Type     | Input                                     | Wired in |
| --------------- | -------- | ----------------------------------------- | -------- |
| `events.getMap` | query    | `{ swLat, swLng, neLat, neLng, limit? }`  | M3-T1    |
| `events.create` | mutation | `CreateEventInput`                        | M4-T1    |
| `events.byId`   | query    | `{ id }`                                  | M4-T2    |
| `events.update` | mutation | `{ id, data: Partial<CreateEventInput> }` | M4-T1    |

### `artists.*`

| Procedure        | Type  | Input    | Wired in |
| ---------------- | ----- | -------- | -------- |
| `artists.search` | query | `{ q }`  | M3-T3    |
| `artists.byId`   | query | `{ id }` | M6-T1    |

### `bookings.*`

| Procedure         | Type     | Input                             | Wired in |
| ----------------- | -------- | --------------------------------- | -------- | ------------ | ----- |
| `bookings.create` | mutation | `{ eventId, artistId, message? }` | M5-T1    |
| `bookings.update` | mutation | `{ id, status: accepted           | rejected | cancelled }` | M5-T3 |

### `admin.*` (adminProcedure — session required; role check added in M9-T1)

| Procedure             | Type     | Input            | Wired in |
| --------------------- | -------- | ---------------- | -------- |
| `admin.pendingEvents` | query    | —                | M9-T2    |
| `admin.approveEvent`  | mutation | `{ id }`         | M9-T2    |
| `admin.rejectEvent`   | mutation | `{ id, reason }` | M9-T2    |

### Non-tRPC Routes (Hono only)

| Method | Path                   | Notes                      | Wired in |
| ------ | ---------------------- | -------------------------- | -------- |
| GET    | `/health`              | Returns `{ status: "ok" }` | Done     |
| ALL    | `/api/auth/*`          | BetterAuth HTTP handler    | M2-T1    |
| POST   | `/api/webhooks/stripe` | Stripe webhook (raw body)  | M8-T2    |

---

## Requirements

### tRPC Setup (`packages/api`)

- `initTRPC` initialised with `Context` (see `context.ts`)
- Three procedure types exported:
  - `publicProcedure` — no auth check
  - `protectedProcedure` — throws `UNAUTHORIZED` if no session
  - `adminProcedure` — throws `UNAUTHORIZED` if no session; role check added in M9-T1
- All input validated with Zod `.input(z.object(...))`
- Domain routers: `eventsRouter`, `artistsRouter`, `bookingsRouter`, `adminRouter`
- `appRouter` combines all domain routers; `AppRouter` type exported for client inference

### Context (`packages/api/src/context.ts`)

- Extracts BetterAuth session from incoming request headers via `auth.api.getSession`
- Passes `session` to all procedures via `ctx.session`
- `session` is `null` for unauthenticated requests

### tRPC Server (`apps/server`)

- `@hono/trpc-server` mounts `appRouter` at `/trpc/*`
- `createContext` factory passed to `trpcServer` — creates context per request
- No REST routes. No custom auth middleware. No `src/schemas/` directory.

### CORS

- Origins: `https://app.ceolx.ie`, `https://admin.ceolx.ie`, `http://localhost:3000`, `http://localhost:8081` (Expo)
- Configured via `env.CORS_ALLOWED_ORIGINS` (pipe-delimited)
- Credentials allowed

### Error Handling

- Hono `onError` handler returns consistent JSON for non-tRPC errors (webhook, health)
- tRPC errors surface as standard tRPC error responses (handled by tRPC runtime)

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
packages/api/src/
  index.ts            <- initTRPC, publicProcedure, protectedProcedure, adminProcedure
  context.ts          <- createContext (BetterAuth session extraction)
  routers/
    index.ts          <- appRouter combining all domain routers; AppRouter type
    events.ts         <- events.getMap, events.create, events.byId, events.update
    artists.ts        <- artists.search, artists.byId
    bookings.ts       <- bookings.create, bookings.update
    admin.ts          <- admin.pendingEvents, admin.approveEvent, admin.rejectEvent

apps/server/src/
  index.ts            <- Hono host: tRPC mount, BetterAuth handler, webhooks, health
  middleware/
    errorHandler.ts   <- Hono onError handler (non-tRPC errors)
  routes/
    webhooks.ts       <- POST /api/webhooks/stripe stub (M8-T2)
```

> `src/schemas/`, `src/routes/auth.ts`, `src/routes/events.ts`, `src/routes/artists.ts`,
> `src/routes/bookings.ts`, `src/routes/admin.ts`, and `src/middleware/auth.ts` were
> removed in the tRPC migration — validation is now inline in procedure `.input()` schemas.

---

## Code Reference

### `apps/server/src/index.ts`

```typescript
import { createContext } from "@CeolX/api/context";
import { appRouter } from "@CeolX/api/routers/index";
import { auth } from "@CeolX/auth";
import { env } from "@CeolX/env/server";
import { trpcServer } from "@hono/trpc-server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { errorHandler } from "./middleware/errorHandler";
import webhooksRoutes from "./routes/webhooks";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({ origin: env.CORS_ALLOWED_ORIGINS.split("|"), credentials: true }),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  }),
);

app.route("/api/webhooks", webhooksRoutes);

app.onError(errorHandler);
app.notFound((c) =>
  c.json(
    {
      error: "NotFound",
      code: "ROUTE_NOT_FOUND",
      message: "Endpoint not found",
      statusCode: 404,
    },
    404,
  ),
);

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 3001 }, () => {
  console.log(`API running on http://localhost:3001`);
});
```

### `packages/api/src/index.ts`

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// TODO M9-T1: add BetterAuth admin plugin and check ctx.session.user.role === 'admin'
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session)
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

### `packages/api/src/routers/index.ts`

```typescript
import { router } from "../index";
import { adminRouter } from "./admin";
import { artistsRouter } from "./artists";
import { bookingsRouter } from "./bookings";
import { eventsRouter } from "./events";

export const appRouter = router({
  events: eventsRouter,
  artists: artistsRouter,
  bookings: bookingsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

### `package.json` scripts (apps/server)

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/"
  }
}
```

---

## Acceptance Criteria

- [x] `GET /health` returns `{ status: "ok" }` with HTTP 200
- [x] tRPC stub procedures reachable at `/trpc/events.getMap`, `/trpc/admin.pendingEvents`, etc.
- [x] `publicProcedure`, `protectedProcedure`, `adminProcedure` all exported from `packages/api/src/index.ts`
- [x] `protectedProcedure` returns UNAUTHORIZED when called without session
- [x] CORS headers present; mobile and admin origins allowed
- [x] Error handler returns consistent JSON for Hono-level errors
- [x] `npm run dev` starts on `http://localhost:3001`
- [x] `npm run check-types` passes with zero errors

---

## Common Gotchas

- **tRPC procedure naming**: procedures are camelCase, namespaced by router — e.g. `events.getMap`, not `getEventsMap`. Clients call `trpc.events.getMap.query(...)`.
- **Auth via context, not middleware**: There is no Hono auth middleware. Session is extracted once in `createContext` and passed to every procedure via `ctx.session`. Use `protectedProcedure` to enforce authentication.
- **BetterAuth is not a tRPC procedure**: Sign-up, sign-in, and sign-out go through BetterAuth's own HTTP handler at `/api/auth/*`. Mobile uses the BetterAuth client SDK — not raw fetch or tRPC.
- **Webhooks must stay Hono**: Stripe webhook verification requires the raw request body. tRPC parses JSON bodies automatically, which would break HMAC signature checks. Stripe webhook stays as a Hono route.
- **Timezone**: Store and return all timestamps as UTC ISO 8601. Convert to user timezone on the client.
- **`tsx watch` vs `nodemon`**: `tsx watch` handles TypeScript natively with no separate build step — preferred for this stack.
