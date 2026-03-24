# M1-T3 · Hono API Scaffold + AWS Lambda Configuration

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                     |
| **Status**     | 🔲 To Do                                                                |
| **Depends on** | M1-T1 (Turborepo + shared enums), M1-T2 (Drizzle schema)                |
| **PRD Ref**    | Section 10.1 (Backend API — Hono), Section 10.2 (AWS Lambda deployment) |

---

## Description

Scaffold the backend API foundation with complete route structure, middleware stack, error handling, and AWS Lambda deployment configuration. No business logic is implemented yet — only route stubs that return 200 OK placeholders. This task establishes the architectural patterns and request/response formats that every M2–M11 feature will build on.

Hono was chosen for its minimal boilerplate, TypeScript-first design, and native AWS Lambda support. The API implements a consistent error response format, CORS headers for mobile and admin app origins, authentication middleware (activated fully in M2), and database connection pooling. Lambda configuration includes AWS SDK setup, environment variable management, and cold-start optimization.

---

## Affected Apps / Packages

| App / Package     | Role                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `apps/api`        | Hono application with routes, middleware, error handlers, Lambda adapter |
| `packages/shared` | Types used in request/response schemas, enums, error codes               |

---

## API Endpoints (if applicable)

All endpoints return `200 OK` with placeholder JSON at this stage.

### Health Check

**GET /health**

Health check for load balancers and monitoring.

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-03-23T14:30:00Z",
  "version": "1.0.0"
}
```

### Authentication Routes

**POST /api/v1/auth/sign-up**

Register new user with email and password (wired in M2-T1).

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Sign-up endpoint placeholder"
}
```

**POST /api/v1/auth/sign-in**

Authenticate user and return session token (wired in M2-T1).

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Sign-in endpoint placeholder"
}
```

**POST /api/v1/auth/logout**

Terminate user session.

**Response (200):**

```json
{
  "success": true,
  "message": "Logout endpoint placeholder"
}
```

### Event Routes

**GET /api/v1/events/map**

Fetch events in bounding box for map display (wired in M3-T1).

**Query Params:**

```
?sw_lat=53.0&sw_lng=-8.5&ne_lat=54.0&ne_lng=-7.5&limit=50
```

**Response (200):**

```json
{
  "events": [],
  "message": "Map endpoint placeholder"
}
```

**POST /api/v1/events**

Create a new event (wired in M4-T1).

**Request Body:**

```json
{
  "title": "Traditional Irish Music Session",
  "description": "Join us for an evening of traditional Irish music",
  "dateStart": "2026-04-15T19:00:00Z",
  "dateEnd": "2026-04-15T22:00:00Z",
  "lat": 53.3498,
  "lng": -6.2603,
  "venueAddress": "The Local Pub, Dublin",
  "category": "Traditional",
  "ticketLink": "https://example.com/tickets"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "success": true,
  "message": "Event creation endpoint placeholder"
}
```

**GET /api/v1/events/:id**

Fetch single event detail.

**Response (200):**

```json
{
  "event": {},
  "message": "Event detail endpoint placeholder"
}
```

**PATCH /api/v1/events/:id**

Update an existing event.

**Response (200):**

```json
{
  "event": {},
  "message": "Event update endpoint placeholder"
}
```

### Search Routes

**GET /api/v1/artists/search**

Search for artists by name, genre, location.

**Query Params:**

```
?q=Aoife&genre=Traditional&limit=20
```

**Response (200):**

```json
{
  "artists": [],
  "message": "Artist search endpoint placeholder"
}
```

**GET /api/v1/artists/:id**

Fetch artist's public profile.

**Response (200):**

```json
{
  "artist": {},
  "message": "Artist profile endpoint placeholder"
}
```

### Booking Routes

**POST /api/v1/bookings**

Create booking invitation or application.

**Request Body:**

```json
{
  "artistId": "uuid",
  "venueId": "uuid",
  "eventId": "uuid",
  "direction": "venue_to_artist"
}
```

**Response (201):**

```json
{
  "bookingId": "uuid",
  "success": true,
  "message": "Booking creation endpoint placeholder"
}
```

**PATCH /api/v1/bookings/:id**

Update booking status (accept, reject, cancel).

**Response (200):**

```json
{
  "booking": {},
  "message": "Booking update endpoint placeholder"
}
```

### Admin Routes

**GET /api/v1/admin/events/pending**

Fetch events pending moderation.

**Query Params:**

```
?limit=50&offset=0
```

**Response (200):**

```json
{
  "events": [],
  "total": 0,
  "message": "Pending events endpoint placeholder"
}
```

**PATCH /api/v1/admin/events/:id/approve**

Approve an event for publication.

**Response (200):**

```json
{
  "success": true,
  "message": "Event approved"
}
```

**PATCH /api/v1/admin/events/:id/reject**

Reject an event with reason.

**Request Body:**

```json
{
  "rejectionReason": "Event violates community guidelines"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Event rejected"
}
```

### Webhook Routes

**POST /api/v1/webhooks/stripe**

Handle Stripe subscription events (wired in M8-T2).

**Response (200):**

```json
{
  "received": true,
  "message": "Webhook received"
}
```

---

## Requirements

### Route Structure & Organization

- All routes organized in `/src/routes/` with separate files: `auth.ts`, `events.ts`, `search.ts`, `bookings.ts`, `admin.ts`, `webhooks.ts`
- Main application file `src/index.ts` imports and registers all route groups
- Route handlers extract business logic into `/src/services/` — handlers should be thin (5–10 lines)
- Error handling middleware catches unhandled errors and returns consistent JSON format
- All routes prefixed with `/api/v1/`

### CORS Configuration

- CORS headers configured to allow mobile app origins (`https://app.ceolx.ie` and Expo dev server in development)
- Admin dashboard origin allowed (`https://admin.ceolx.ie` in production, localhost in development)
- Credentials allowed (`Access-Control-Allow-Credentials: true`)
- Preflight requests handled correctly (OPTIONS method)

### Authentication Middleware

- Auth middleware in place to verify BetterAuth session token on protected routes
- Middleware extracts `userId` and `currentRole` from token and adds to Hono context
- Unprotected routes (sign-up, sign-in, health check) bypass auth
- Middleware does not enforce authorization yet — just extracts context (activation in M2)

### Error Response Format

- Consistent error JSON structure: `{ error, code, message, statusCode }`
- Example bad request: `{ error: "ValidationError", code: "INVALID_EMAIL", message: "Email format invalid", statusCode: 400 }`
- Example unauthorized: `{ error: "AuthenticationError", code: "INVALID_TOKEN", message: "Session token expired", statusCode: 401 }`
- Error handler catches unhandled exceptions and logs with context (user ID, route, timestamp)

### Validation & Serialization

- Request body/query validation using Zod schemas via `@hono/zod-validator`
- All schemas defined in `/src/schemas/` directory
- Response serialization: all date fields returned as ISO 8601 strings, enums as lowercase strings

### Environment Variables

- `DATABASE_URL` — Neon connection string (wired in M1-T2)
- `BETTER_AUTH_SECRET` — BetterAuth secret key (wired in M2)
- `AWS_S3_BUCKET` — S3 bucket name (wired in M6)
- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` — Mux credentials (wired in M6)
- `STRIPE_SECRET_KEY` — Stripe API key (wired in M8)
- `POSTMARK_API_TOKEN` — Postmark API token (wired in M7)
- `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` — Firebase credentials (wired in M7)
- `NODE_ENV` — `development`, `staging`, or `production`
- `PORT` — defaults to 3001 for local dev

### AWS Lambda Integration

- AWS Lambda adapter installed (`@hono/aws-lambda`)
- Lambda handler exported from `src/lambda.ts`
- Cold-start optimizations: minimal imports, lazy-load heavy dependencies (Firebase, Stripe, S3)
- CloudWatch logging configured for debugging
- Environment variables read from Lambda environment or AWS Systems Manager Parameter Store

### Local Development

- Dev server started with `npm run dev` in `apps/api`, runs on `http://localhost:3001`
- Hot reload enabled during development
- Postman collection created with all endpoints (stub responses) for manual testing

---

## Acceptance Criteria

- [ ] `GET /health` returns `{ status: "ok" }` with HTTP 200
- [ ] All 15+ endpoint stubs reachable and returning 200 OK (verified with curl or Postman)
- [ ] CORS headers present on responses; mobile and admin origins allowed
- [ ] Auth middleware in place; unprotected routes reachable without token
- [ ] Error handler catches unhandled errors and returns `{ error, code, message }` JSON
- [ ] Validation middleware rejects invalid requests with 400 Bad Request
- [ ] Lambda adapter builds without errors (`npm run build` in `apps/api`)
- [ ] Local dev server starts with `npm run dev`, accessible at `http://localhost:3001`
- [ ] TypeScript compilation passes with zero errors (`npm run type-check`)
- [ ] All routes follow consistent naming and error handling patterns

---

## Technical Notes

### Hono Application Structure

```typescript
// apps/api/src/index.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { handle } from "hono/aws-lambda";

import authRoutes from "./routes/auth";
import eventsRoutes from "./routes/events";
import searchRoutes from "./routes/search";
import bookingsRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";
import webhooksRoutes from "./routes/webhooks";

import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";

const app = new Hono();

// Global middleware
app.use(logger());
app.use(
  cors({
    origin: [
      "https://app.ceolx.ie",
      "https://admin.ceolx.ie",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8081", // Expo dev client
    ],
    credentials: true,
  }),
);

// Health check (public)
app.get("/health", (c) => {
  return c.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    200,
  );
});

// Auth middleware (applied to /api/* routes)
app.use("/api/*", authMiddleware);

// Route groups
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/events", eventsRoutes);
app.route("/api/v1/search", searchRoutes);
app.route("/api/v1/bookings", bookingsRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/webhooks", webhooksRoutes);

// Error handler (last middleware)
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "NotFound",
      code: "ROUTE_NOT_FOUND",
      message: "Endpoint not found",
    },
    404,
  );
});

// Export for AWS Lambda
export const handler = handle(app);

// Export for local development
export default app;
```

### Route Handler Pattern

```typescript
// apps/api/src/routes/events.ts

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as eventsService from "../services/eventsService";
import type { AuthContext } from "../types/auth";

const app = new Hono<{ Variables: AuthContext }>();

const createEventSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  lat: z.number().min(51).max(55),
  lng: z.number().min(-11).max(-5),
  venueAddress: z.string().optional(),
  category: z.enum(["Traditional", "Contemporary", "Fusion"]),
  ticketLink: z.string().url().optional(),
});

app.post("/", zValidator("json", createEventSchema), async (c) => {
  const userId = c.get("userId");
  const currentRole = c.get("currentRole");
  const payload = c.req.valid("json");

  const event = await eventsService.createEvent(userId, payload, currentRole);
  return c.json({ event }, 201);
});

app.get("/map", async (c) => {
  const swLat = c.req.query("sw_lat");
  const swLng = c.req.query("sw_lng");
  const neLat = c.req.query("ne_lat");
  const neLng = c.req.query("ne_lng");
  const limit = c.req.query("limit") || "50";

  return c.json({ events: [], message: "Map endpoint placeholder" });
});

app.get("/:id", async (c) => {
  const eventId = c.req.param("id");
  return c.json({ event: {}, message: "Event detail endpoint placeholder" });
});

export default app;
```

### Authentication Middleware

```typescript
// apps/api/src/middleware/auth.ts

import { Context, Next } from "hono";

export interface AuthContext {
  Variables: {
    userId: string | null;
    currentRole: string | null;
  };
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    c.set("userId", null);
    c.set("currentRole", null);
    return next();
  }

  try {
    // TODO in M2-T1: Verify token with BetterAuth
    // For now, stub implementation
    const payload = {
      userId: "user-id-from-token",
      currentRole: "spectator",
    };

    c.set("userId", payload.userId);
    c.set("currentRole", payload.currentRole);
  } catch (err) {
    return c.json(
      {
        error: "AuthenticationError",
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
      },
      401,
    );
  }

  return next();
};
```

### Error Handler

```typescript
// apps/api/src/middleware/errorHandler.ts

import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler = (err: Error, c: Context) => {
  console.error("[API Error]", {
    message: err.message,
    stack: err.stack,
    route: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  });

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

### Environment Variables

```bash
# .env (apps/api)
DATABASE_URL=postgresql://user:pass@localhost/ceolx_dev
DIRECT_URL=postgresql://user:pass@localhost/ceolx_dev
BETTER_AUTH_SECRET=your-secret-key-here
NODE_ENV=development
PORT=3001
AWS_REGION=eu-west-1
```

### Package Configuration

```json
{
  "name": "@ceolx/api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "build": "tsc && esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "hono": "^4.4.0",
    "@hono/aws-lambda": "^1.2.0",
    "@hono/zod-validator": "^1.1.0",
    "zod": "^3.22.0",
    "drizzle-orm": "^0.28.0",
    "pg": "^8.11.0",
    "better-auth": "^0.12.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "esbuild": "^0.19.0",
    "@types/node": "^20.11.0"
  }
}
```

---

## Common Gotchas

- **Lambda cold starts**: Avoid heavy imports at module level; lazy-load Firebase, Stripe, and S3 inside handlers
- **Timezone handling**: All timestamps stored and returned in UTC (ISO 8601); convert to user timezone on client
- **Hono context typing**: Use generics correctly: `const app = new Hono<{ Variables: AuthContext }>()`
- **CORS preflight**: Ensure OPTIONS requests handled; Hono's CORS middleware handles this automatically
- **Error handler ordering**: Must be registered last (after all routes) to catch unhandled exceptions
- **Database connections**: Keep connection pooling config in mind; Lambda may need a fresh connection per invocation
- **API Gateway payload limits**: 10 MB limit; validate large uploads before sending to S3 (relevant in M6)

---
