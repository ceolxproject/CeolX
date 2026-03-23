# M1-T3 · Hono API Scaffold + AWS Lambda Config

| Field | Value |
|-------|-------|
| **Milestone** | M1 — Project Setup & Infrastructure |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T1, M1-T2 |
| **PRD Ref** | Section 10.1 (Backend API — Hono), Section 10.2 |

---

## Description
Scaffold the backend API with all route groups, middleware, and AWS Lambda deployment config. No business logic yet — just the skeleton every feature in M2+ will fill in.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Entire Hono application lives here |
| `packages/shared` | Types used in request/response shapes |

---

## API Endpoints
Stub all routes — no logic, just `200 OK` placeholders:

| Method | Path | Future Purpose |
|--------|------|----------------|
| GET | `/health` | Health check |
| POST | `/auth/sign-up` | Registration |
| POST | `/auth/sign-in` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/events/map` | Bounding box map query |
| GET | `/events/feed` | Algorithmic feed |
| POST | `/events` | Create event |
| GET | `/events/:id` | Event detail |
| PATCH | `/events/:id` | Edit event |
| GET | `/artists/search` | Artist search |
| GET | `/artists/:id` | Artist profile |
| GET | `/venues/:id` | Venue profile |
| POST | `/bookings` | Create booking |
| PATCH | `/bookings/:id` | Update booking status |
| POST | `/posts` | Create post |
| GET | `/admin/users` | List users |
| GET | `/admin/events/pending` | Pending moderation queue |
| POST | `/webhooks/stripe` | Stripe payment webhook |

---

## Requirements
- R1: All route groups stubbed and returning `200 OK`
- R2: CORS configured — allow mobile app origin + admin dashboard origin
- R3: Auth middleware in place (even if not enforcing yet — activated fully in M2)
- R4: Consistent error response format: `{ error: string, code: string, message: string }`
- R5: AWS Lambda adapter configured and tested with a local invocation
- R6: Environment variables managed per environment (dev / staging / prod)

---

## Acceptance Criteria
- [ ] `GET /health` returns `{ status: "ok" }` with 200
- [ ] All route stubs reachable and returning 200 (verified via Postman or curl)
- [ ] CORS headers present on responses — mobile origin allowed
- [ ] Error handler returns consistent JSON structure on unhandled errors
- [ ] Lambda adapter builds without errors (`tsc` + bundle step)
- [ ] Local dev server starts with `pnpm dev` in `apps/api`

---

## Technical Notes
- Keep all route handlers thin — extract business logic into `/services/` files from the start to keep handlers testable
- The error format `{ error, code, message }` must be agreed upfront — the mobile app parses error codes to show user-facing messages
- Use Hono's built-in validator (`@hono/zod-validator`) for all request body/query validation — don't write manual checks
