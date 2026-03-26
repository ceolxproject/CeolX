# CeolX — Development Milestones & Task Plan

**Developer**: Priya Yadav (Solo Full-Stack, RaftLabs)
**Timeline**: 12–14 weeks | **Methodology**: Agile — 2-week sprints
**PRD**: `prd/CeolX_PRD_v1.6.docx` | **Stack**: React Native + Expo, Hono, Drizzle, Neon, BetterAuth

> This document is the review copy. Once approved, each task below becomes an Asana item in the Backlogs section.

---

## Milestone Summary

| #    | Milestone                       | Approx. Weeks | No. of Tasks        |
| ---- | ------------------------------- | ------------- | ------------------- |
| M1   | Project Setup & Infrastructure  | 1–2           | 9 (excl. T2 schema) |
| M1.5 | Database Schema Design          | 2             | 7                   |
| M2   | Authentication & Persona System | 2–3           | 4                   |
| M3   | Map & Discovery                 | 3–5           | 4                   |
| M4   | Event System                    | 5–7           | 4                   |
| M5   | Booking Flow (Artist ↔ Venue)   | 7–8           | 3                   |
| M6   | Profiles & Social               | 8–9           | 4                   |
| M7   | Push Notifications & Emails     | 9–10          | 3                   |
| M8   | Venue Subscription & Payments   | 10–11         | 4                   |
| M9   | Super Admin Dashboard           | 9–10          | 2                   |
| M10  | Media (S3, CloudFront, Mux)     | 6–7           | 1                   |
| M11  | Analytics & GDPR                | 11–12         | 3                   |
| M12  | QA & Launch Prep                | 12–14         | 3                   |
|      | **Total**                       |               | **51 tasks**        |

> M9 and M10 run in parallel with other milestones (admin dashboard and media can be built alongside app features).
> M1.5 must complete before M2 — all feature milestones depend on the database schema being finalised.

---

## M1 — Project Setup & Infrastructure

**Weeks 1–2 · 5 tasks**

---

### M1-T1 · Turborepo Monorepo + GitHub Branch Strategy

**What**: Set up the entire project scaffolding and source control strategy before any code is written.

| Sub-task          | Details                                                              |
| ----------------- | -------------------------------------------------------------------- |
| Turborepo init    | Create `apps/mobile`, `apps/admin`, `apps/api`, `packages/shared`    |
| TypeScript config | Project references across all workspaces                             |
| Shared package    | Types, enums (role, event status, booking status), utility functions |
| GitHub repo       | Three branches: `dev`, `staging`, `main`                             |
| Branch protection | Require PR + review on `main` and `staging`                          |
| Neon DB branches  | Match Git branches — dev DB / staging DB / prod DB                   |

---

### M1-T2 · Database Infrastructure Setup (Docker Local + Neon Staging/Prod)

**What**: Set up PostgreSQL across all three environments. Schema design is handled separately in M1.5.

| Sub-task          | Details                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| Docker Compose    | PostgreSQL 16 (alpine) for local dev — `docker compose up -d`                  |
| Neon project      | Create project, `staging` branch, `main` branch (production)                   |
| Drizzle config    | `drizzle.config.ts` + DB client factory that switches driver by `DATABASE_URL` |
| `.env.local`      | Local Docker connection string (gitignored); `.env.example` committed          |
| Connection verify | `npm run db:check` — runs `SELECT 1`, prints PostgreSQL version                |

> See full task spec: `M1-Infrastructure/M1-T2-Database-Infrastructure-Setup.md`

---

### M1-T3 · tRPC API Scaffold (Hono Transport)

**What**: Scaffold all feature procedures as tRPC stubs in `packages/api`; `apps/server` is a thin Hono host.

| Sub-task         | Details                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| tRPC routers     | `events`, `artists`, `venues`, `bookings`, `admin` — stub procedures, no business logic yet      |
| Procedure types  | `publicProcedure`, `protectedProcedure`, `adminProcedure` — enforced via tRPC context middleware |
| BetterAuth mount | `/api/auth/*` — BetterAuth HTTP handler; no custom auth routes needed                            |
| Webhook stub     | `POST /api/webhooks/stripe` — Hono route; raw body required (wired M8-T1)                        |
| Env management   | Dev / staging / prod environment variables                                                       |
| Middleware       | CORS (for mobile + admin), request logging, error handler (Hono-level only)                      |
| Health check     | `GET /health` endpoint                                                                           |

---

### M1-T4 · React Native + Expo App Scaffold

**What**: Bootstrap the mobile app with navigation structure, permissions, and placeholder screens.

| Sub-task            | Details                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Expo init           | TypeScript template in `apps/mobile`                                                               |
| Navigation          | React Navigation — bottom tabs (Map \| Discover \| Bookings \| Profile) + stack navigators per tab |
| EAS Build           | Configure Expo Application Services for iOS + Android builds                                       |
| Env config          | Environment variables via `expo-constants`                                                         |
| Permissions         | Location, camera, photo library, push notifications in `app.config.ts`                             |
| Placeholder screens | Stub screens for all primary routes                                                                |
| Smoke test          | App runs on iOS Simulator + Android Emulator                                                       |

---

### M1-T5 · React Admin Dashboard Scaffold (TanStack Router + Vite)

**What**: Bootstrap the admin web app as a React SPA — hosts the Super Admin dashboard and the public Venue subscription page. No SSR needed for an internal tool.

| Sub-task        | Details                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Vite init       | React + TypeScript template in `apps/admin`                                                                         |
| TanStack Router | File-based routing via `@tanstack/router-plugin/vite`; auto-generates `routeTree.gen.ts`                            |
| ShadCN/UI       | Install and configure component library (Button, Card, Input, Table, Sidebar, Badge)                                |
| Route structure | `/login`, `/dashboard`, `/users`, `/events/pending`, `/account`, `/subscribe`                                       |
| Layout routes   | `_admin.tsx` pathless layout (sidebar + header) for authenticated routes; public layout for `/login` + `/subscribe` |
| Smoke test      | `npm run dev` starts on `http://localhost:3000`, all routes accessible, ShadCN components render                    |

---

### M1-T6 · Postmark Email Service Setup

**What**: Configure Postmark account, verify sender domain, and create the `packages/email` workspace package with the reusable `sendEmail()` utility. Prerequisite for all email flows in M2 and M8.

| Sub-task         | Details                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Postmark account | Create server for CeolX, verify `noreply@ceolx.ie` sender signature (SPF, DKIM, DMARC)                             |
| Email package    | `packages/email` (`@CeolX/email`) — transport factory, `sendEmail()`, TypeScript types                             |
| Transport        | `NODE_ENV=development` → Mailpit SMTP always; staging/prod → Postmark `ServerClient` (`MessageStream: "outbound"`) |
| Email tags       | Define: `email-verification`, `password-reset`, `venue-activation`, `payment-confirmation`                         |
| Webhook stub     | `POST /api/webhooks/postmark` stub in `apps/server` (wired in M7)                                                  |
| Env vars         | `POSTMARK_API_TOKEN`, `POSTMARK_FROM_ADDRESS`, `SMTP_HOST`, `SMTP_PORT` added to env schema + `.env` template      |

---

### M1-T7 · API Rate Limiting

**What**: Protect Hono API endpoints from brute-force and abuse using two-layer rate limiting. Layer 1 applies broad limits to route groups via Hono middleware. Layer 2 adds per-procedure granular limits keyed by email for sensitive operations (forgot-password, resend emails).

| Sub-task              | Details                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Counter store         | `@upstash/ratelimit` + `@upstash/redis` (HTTP-based, Lambda-compatible). No-op when Upstash env vars absent (local dev) |
| Layer 1 middleware    | `rateLimiter()` Hono middleware factory — sliding window, singleton Map cache per process, `X-RateLimit-*` headers      |
| Layer 2 per-procedure | `rl:forgot-password:{email}`, `rl:resend-verify:{email}`, `rl:resend-activation:{userId}` — Redis incr/expire pattern   |
| Route integration     | `/api/auth/*` → 10 req/15 min (IP); `/rpc/*` → 500 req/min (userId); webhooks outside rate-limited prefixes             |
| Rate limit tiers      | `authLogin`, `authenticatedGeneral`, `publicCatalog`, `adminGeneral`, `muxUpload` — defined in `packages/cache`         |
| IP allowlist          | `RATE_LIMIT_IP_ALLOWLIST` env var (comma-separated) — bypasses all limits for internal/test IPs                         |
| Response headers      | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on all responses; `Retry-After` on 429 only           |
| Bypass conditions     | `NODE_ENV=test`, `RATE_LIMIT_ENABLED=false`, or missing Upstash vars → no-op (no errors thrown)                         |
| Webhooks              | Stripe/Mux/Postmark webhook routes fall outside rate-limited prefixes; signature verification handles abuse             |
| Env vars              | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_IP_ALLOWLIST`                   |

---

### M1-T8 · CORS Configuration

**What**: Replace the M1-T3 CORS stub with hardened, environment-aware CORS rules. Ensures admin dashboard and Expo dev client work correctly without introducing security vulnerabilities.

| Sub-task           | Details                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `config/cors.ts`   | New `apps/server/src/config/cors.ts` — `buildAllowedOrigins()` + `isAllowedOrigin()`; isolated and testable               |
| Origin whitelist   | `CORS_ALLOWED_ORIGINS` env var (pipe-separated, staging/prod only); dev origins auto-injected when `NODE_ENV=development` |
| Hono config        | Replace stub `cors()` (index.ts:17-23) with dynamic origin function — no wildcards; reject with `WARN` log                |
| Full options       | `allowMethods`, `allowHeaders: [Content-Type, Authorization]`, `exposeHeaders: [X-RateLimit-*]`, `maxAge: 86400`          |
| Credentials        | `Access-Control-Allow-Credentials: true` required for BetterAuth session cookies                                          |
| Preflight          | OPTIONS returns `204 No Content`, `Access-Control-Max-Age: 86400`                                                         |
| `.env.example` fix | Remove hardcoded dev origins from `CORS_ALLOWED_ORIGINS`; document auto-injection via `NODE_ENV=development`              |

---

### M1-T9 · Sentry Error Tracking Setup

**What**: Wire Sentry into all three CeolX apps so every feature built in M2–M12 is automatically covered from day one.

| Sub-task           | Details                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Sentry org         | Create `ceolx` org; 3 projects: `ceolx-api`, `ceolx-admin`, `ceolx-mobile`                         |
| Hono API           | `@sentry/node` + `@sentry/serverless`; wrap Lambda handler; capture in `errorHandler`              |
| React admin (Vite) | `@sentry/react`; Sentry error boundary at root; Vite source maps uploaded via `vite-plugin-sentry` |
| React Native       | `@sentry/react-native`; EAS symbol upload (dSYM + Proguard); `Sentry.wrap(App)`                    |
| Environment config | Disabled in `development` (no noise); alerts to Priya's email for `production` new issues only     |

---

## M1.5 — Database Schema Design

**Weeks 2 · 7 tasks** | **Must complete before M2**

> Full task specs: `M1.5-Database-Schema/`

---

### M1.5-T1 · Drizzle ORM Setup + Enum Definitions

**What**: Create the `apps/server/src/db/schema/` directory structure and declare all PostgreSQL enum types before any tables are defined. Mirror enums in `packages/shared` for use across mobile and admin.

| Sub-task         | Details                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Schema directory | `apps/server/src/db/schema/` with `enums.ts`, `index.ts` barrel                                                              |
| PostgreSQL enums | 7 enums: `user_role`, `event_status`, `booking_status`, `booking_direction`, `subscription_status`, `media_type`, `platform` |
| Shared TS enums  | `packages/shared/src/types/enums.ts` — `const` object mirrors for mobile + admin                                             |

---

### M1.5-T2 · User & Profile Tables

**What**: Define `users`, `artist_profiles`, `venue_profiles`. Foundation for all other tables.

| Table             | Key Constraints                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `users`           | UUID PK, unique email, `current_role` enum default `spectator`, `consent_at` NOT NULL      |
| `artist_profiles` | `user_id` UNIQUE FK → users, `is_active` bool (flipped on persona switch)                  |
| `venue_profiles`  | `user_id` UNIQUE FK → users, `subscription_status` denormalized, `is_active` default false |

---

### M1.5-T3 · Event & Collection Tables

**What**: Define `collections`, `events`, `saved_events` with GIST spatial index and check constraints.

| Table          | Key Details                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| `collections`  | FK → venue_profiles; must be defined before `events`                             |
| `events`       | GIST index on `ll_to_earth(lat, lng)` WHERE active; CHECK lat/lng within Ireland |
| `saved_events` | UNIQUE `(user_id, event_id)` for idempotent save/unsave                          |

---

### M1.5-T4 · Social Tables

**What**: Define `posts`, `comments`, `post_likes`, `follows` with soft-delete and idempotency constraints.

| Table        | Key Details                                                  |
| ------------ | ------------------------------------------------------------ |
| `posts`      | `deleted_at` soft delete; `like_count` denormalized counter  |
| `comments`   | `deleted_at` soft delete (display "Comment deleted")         |
| `post_likes` | UNIQUE `(post_id, user_id)` — idempotent like/unlike         |
| `follows`    | UNIQUE `(follower_id, followee_id)` — self-referencing users |

---

### M1.5-T5 · Bookings & Subscriptions Tables

**What**: Define `bookings` and `venue_subscriptions`.

| Table                 | Key Details                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| `bookings`            | `direction` enum (`venue_to_artist` / `artist_to_venue`); `event_id` nullable      |
| `venue_subscriptions` | UNIQUE `(venue_id)`; Stripe IDs as varchar; `plan` as varchar (tier TBD by client) |

---

### M1.5-T6 · Notifications, Device Tokens + Final Index Audit

**What**: Define `notifications` and `device_tokens`, then verify all indexes and constraints across all schema files before generating the migration.

| Table           | Key Details                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `notifications` | JSONB `payload` with `{ persona, route, action, title, body }`; index on `(user_id, read)` |
| `device_tokens` | UNIQUE `(user_id, fcm_token)`; FCM tokens upserted on app open                             |

---

### M1.5-T7 · Run Migrations + Seed Data

**What**: Apply the generated migration to all three environments, verify all 14 tables, and insert minimal seed data for M2 testing.

| Sub-task        | Details                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| Generate SQL    | `npm run db:generate` → produces `drizzle/migrations/0001_initial_schema.sql` |
| Local Docker    | Apply + verify GIST index with `EXPLAIN ANALYSE`                              |
| Neon staging    | Apply migration via Neon staging branch                                       |
| Neon production | Apply migration before M2 code merges to `main`                               |
| Seed data       | 1 user per persona type + 3 sample events (active, pending, rejected)         |

---

## M2 — Authentication & Persona System

**Weeks 2–3 · 4 tasks**

---

### M2-T1 · Email/Password Sign-Up + Email Verification

**What**: The base auth method — foundation for all other flows.

| Sub-task           | Details                                                                            |
| ------------------ | ---------------------------------------------------------------------------------- |
| BetterAuth install | Configure in `apps/api`                                                            |
| Sign-up            | Email + password + name → create `users` row                                       |
| Email verification | Trigger Postmark email on sign-up; block unverified accounts from protected routes |
| Sign-in            | Validate credentials → return session                                              |
| Logout             | Terminate BetterAuth session                                                       |
| Route protection   | BetterAuth session middleware on all API routes                                    |
| Mobile screens     | Sign Up, Sign In, "Check your email" confirmation, Logout                          |

---

### M2-T2 · Google Sign-In + Apple Sign-In

**What**: Social login. Apple Sign-In is mandatory for App Store compliance.

| Sub-task         | Details                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| Google OAuth     | Configure in BetterAuth (iOS + Android)                                         |
| Apple Sign-In    | Configure in BetterAuth (iOS only)                                              |
| Expo integration | `expo-auth-session` for OAuth flows                                             |
| Account merging  | Handle same email from different providers                                      |
| TestFlight test  | Verify Apple Sign-In on a real device via TestFlight (cannot test in Simulator) |
| Mobile screens   | Updated Sign Up / Sign In with Google + Apple buttons                           |

---

### M2-T3 · Forgot Password Flow

**What**: Standard password reset via email link.

| Sub-task            | Details                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| API — request reset | `POST /auth/forgot-password` → generate token (15 min expiry) → Postmark email    |
| API — confirm reset | `POST /auth/reset-password` → validate token → update password → invalidate token |
| Mobile screens      | Forgot Password (email input) → "Check your email" confirmation                   |
| Deep link           | Reset link deep links back into the app to new-password screen                    |
| Token rules         | Single-use, expires in 15 minutes                                                 |

---

### M2-T4 · Persona Onboarding + Role Switching Logic

**What**: The core persona system — governs all feature gating across the entire app.

| Sub-task                          | Details                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Onboarding screen                 | "Who are you?" — Spectator / Musician Artist / Venue/Business (per approved UI design)           |
| Persona creation                  | Set `users.current_role`, create role-specific profile record                                    |
| Artist onboarding                 | Stage name, bio, genre, profile image                                                            |
| Venue onboarding                  | Venue name, address, bio, profile image → trigger activation email via Postmark                  |
| Settings — switch role            | "Switch Account Type" screen                                                                     |
| First-time switch                 | New role → trigger onboarding for that role                                                      |
| Return to existing role           | Confirmation dialog → instant switch                                                             |
| Switch to Venue (no subscription) | Show pending activation state                                                                    |
| Switch away from Venue            | Subscription stays active, `is_active: false` on venue profile                                   |
| Switch away from Artist           | Profile dormant, past approved events stay live                                                  |
| Pending events on switch          | Events in `pending_review` stay in queue regardless of role switch                               |
| FCM routing                       | Notification payload includes `persona` + `route`; app auto-switches persona on tap, shows toast |

---

## M3 — Map & Discovery

**Weeks 3–5 · 4 tasks**

---

### M3-T1 · Map Integration + Viewport Bounding Box Query

**What**: The main screen — performance is the top priority here.

| Sub-task          | Details                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| react-native-maps | Apple Maps (iOS), Google Maps (Android)                                                                           |
| API endpoint      | `GET /api/events/map?swLat&swLng&neLat&neLng&limit=50` — active upcoming events in bounding box, using GIST index |
| Pin rendering     | Render event pins from API response                                                                               |
| Debounce          | `onRegionChangeComplete` debounced ~400ms — no request on every pan frame                                         |
| Pin labels        | Category label on each pin (e.g. "Live paid gig", "Traditional session") — per UI design                          |
| Pin tap           | Opens event detail bottom sheet                                                                                   |

---

### M3-T2 · Location Permission + Fallback Chain + Empty State

**What**: Users are never blocked from the map regardless of location settings.

| Sub-task                  | Details                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Permission request        | `expo-location` on first launch                                                                                          |
| Fallback 1 — GPS          | Granted → centre map on device coordinates                                                                               |
| Fallback 2 — IP geo       | Denied → server resolves city from IP (ipapi.co) → centre map there                                                      |
| Fallback 3 — Ireland      | IP fails → centre on lat: 53.1424, lng: -7.6921                                                                          |
| Fallback banner           | "Using approximate location — search to refine"                                                                          |
| Empty state — auto-expand | Try 5 km → 25 km → 100 km silently (system-defined, never shown to user)                                                 |
| Empty state — final       | Floating card: "No events near here. Try Dublin, Galway, or Cork." + "Browse all upcoming events" (switches to Feed tab) |

---

### M3-T3 · Pin Clustering + Search Bar

**What**: Map usability — clustering when zoomed out and manual location search.

| Sub-task            | Details                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| Pin clustering      | Nearby pins merge into count badge at low zoom; tap cluster to zoom in |
| Search bar          | "Search by county / artist / category" — per approved UI design        |
| County autocomplete | Google Places API restricted to Ireland                                |
| Artist search       | Results list → tap navigates to artist profile                         |
| Category filter     | Filters visible map pins                                               |
| Filter icon         | Category filter sheet (top right of search bar — per UI design)        |
| Search new location | User types location → map re-centres → pins reload                     |

---

### M3-T4 · Feed View (Algorithmic) + Discover Tab

**What**: The Discover tab — a feed-based alternative to the map.

| Sub-task               | Details                                                       |
| ---------------------- | ------------------------------------------------------------- |
| API endpoint           | `GET /api/events/feed?lat&lng&page` — 20 items per page       |
| Algorithm              | Recency 40% + distance 40% + followed accounts 20%            |
| Gig opportunity filter | `is_gig_opportunity: true` events hidden from Spectator feed  |
| Event card             | Cover image, title, date, distance, category tag              |
| Category chips         | Filter chips at top of feed                                   |
| Posts inline           | Promotional posts from followed Artists/Venues appear in feed |
| Pull-to-refresh        | + infinite scroll pagination                                  |

---

## M4 — Event System

**Weeks 5–7 · 4 tasks**

---

### M4-T1 · Event Creation (Artist + Venue)

**What**: Multi-step event creation flow for both Artists and Venues, with Venue-specific additions.

| Sub-task                    | Details                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Step 1                      | Title, category, date/time (start + optional end)                                                       |
| Step 2                      | Cover image upload (S3), description                                                                    |
| Step 3                      | Venue — search registered venues OR free-text address fallback                                          |
| Step 4                      | Collaborators (search + tag Artists), external ticket link                                              |
| Step 5                      | Collections — add to existing or create new (name + optional logo) — Venue only                         |
| Venue-only: Gig Opportunity | Toggle `is_gig_opportunity: true` — marks event as open artist recruitment post; hidden from Spectators |
| Venue-only: Promotional Ad  | Attach a title + description ad (e.g. "15% OFF at Dominos nearby") to show near event location          |
| On submit                   | `status = pending_review` — show "Pending approval" state to creator                                    |
| Rejected event              | Creator can edit and resubmit → back to `pending_review`                                                |

---

### M4-T2 · Event Detail Screen

**What**: How any user views an event — with persona-aware actions including Save and Save to Calendar.

| Sub-task            | Details                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Event detail screen | Cover image, title, date/time, description, performing artists (tappable), venue details     |
| Ticket link         | "Book a ticket" → opens external URL in device browser                                       |
| Save / Unsave       | Bookmark button for all personas — inserts/deletes from `saved_events` table; state persists |
| Save to Calendar    | Exports event to device native calendar via `expo-calendar`; requests calendar permission    |
| Edit event          | Pre-populated form (creator only); resubmits to `pending_review` if already active           |
| Gig opportunity     | "Apply" button shown to Artist persona on `is_gig_opportunity = true` events                 |
| Rejection reason    | Shown to creator on rejected events                                                          |

---

### M4-T3 · Event Moderation Flow (Admin Approve / Reject)

**What**: Super Admin reviews and approves/rejects all submitted events before they go live.

| Sub-task            | Details                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Pending Events page | Table: event title, creator name, type (Artist/Venue), category, submitted date — sorted oldest first  |
| Event preview       | Full detail view: all fields, cover image, map pin location                                            |
| Approve             | `status = active` → push notification to creator: "Your event is live!"                                |
| Reject              | Modal with mandatory rejection reason → `status = rejected` → push notification to creator with reason |
| Resubmission        | Rejected events reappear in queue when creator edits and resubmits                                     |
| Badge               | Sidebar nav shows count of pending events                                                              |

---

### M4-T4 · My Events View + Collections

**What**: Creator-facing event management screen, and Saved Events view for all personas.

| Sub-task                 | Details                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| My Created Events        | Artists + Venues: events grouped by status — Active, Pending, Rejected, Archived |
| Saved Events             | All personas: events the user has bookmarked — backed by `saved_events` table    |
| Rejection reason         | Shown inline on rejected events                                                  |
| Collections (Venue-only) | Create / edit collection with name + logo; assign events to collection           |
| Collection detail        | Shows logo, name, and all associated events                                      |
| Delete collection        | Events are retained; only `collection_id` FK is cleared                          |

---

## M5 — Booking Flow (Artist ↔ Venue)

**Weeks 7–8 · 3 tasks**

---

### M5-T1 · Venue-Initiated Booking (Invite Artist)

**What**: Venue discovers an Artist and sends them an invitation to perform.

| Sub-task       | Details                                                         |
| -------------- | --------------------------------------------------------------- |
| Invite button  | Venue views Artist profile → "Invite to Perform" → select event |
| Booking record | Created with `status: pending`, `direction: venue_to_artist`    |
| Notification   | Artist gets push notification: "New invitation from [Venue]"    |
| Artist action  | Bookings tab → Pending Invitations → Accept / Reject            |
| On accept      | Artist linked as collaborator on event; both parties notified   |
| On reject      | `status: rejected`; Venue notified                              |

---

### M5-T2 · Artist-Initiated Booking (Apply to Gig Opportunity)

**What**: Artist finds a Venue's gig opportunity and applies.

| Sub-task       | Details                                                       |
| -------------- | ------------------------------------------------------------- |
| Apply button   | Artist taps gig opportunity event → "Apply" button            |
| Booking record | Created with `status: pending`, `direction: artist_to_venue`  |
| Notification   | Venue gets push notification: "New application from [Artist]" |
| Venue action   | Bookings tab → Pending Applications → Accept / Reject         |
| On accept      | Artist linked as collaborator; both notified                  |
| On reject      | `status: rejected`; Artist notified                           |

---

### M5-T3 · Cancel Flow + Booking State Machine

**What**: Either party can cancel at any time after acceptance. State transitions must be enforced.

| Sub-task        | Details                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| Cancel button   | Available to both Artist and Venue post-acceptance on booking detail screen            |
| Notifications   | Both parties notified on cancellation                                                  |
| Booking history | Visible on both Artist and Venue profiles under Bookings section                       |
| State machine   | Enforce: no invalid transitions (e.g. cannot accept a cancelled booking)               |
| State flow      | `Pending → Accepted / Rejected` → `Cancelled` (either party, any time post-acceptance) |

---

## M6 — Profiles & Social

**Weeks 8–9 · 4 tasks**

---

### M6-T1 · Artist Public Profile

**What**: Public-facing Artist profile visible to all users.

| Sub-task        | Details                                              |
| --------------- | ---------------------------------------------------- |
| Profile screen  | Avatar, stage name, bio, genre tags, contact details |
| Tabs            | Events (Upcoming / Past) \| Posts \| Bookings        |
| Follow/Unfollow | Follow button + follower/following count             |
| Edit Profile    | Bio, name, genre, contact, profile image             |

---

### M6-T2 · Venue Public Profile

**What**: Public-facing Venue profile — only visible when subscription is active.

| Sub-task        | Details                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| Profile screen  | Avatar, venue name, address, bio, contact details                        |
| Tabs            | Events \| Posts \| Bookings                                              |
| Follow/Unfollow | Follow button + follower/following count                                 |
| Edit Profile    | Venue name, address, bio, contact, profile image                         |
| Visibility gate | Profile hidden from all other users until `subscription_status = active` |

---

### M6-T3 · Promotional Post Creation

**What**: Artists and Venues create posts with media content. All four types in scope for V1.

| Sub-task              | Details                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Create Post screen    | Caption text input + media picker (or text-only)                                          |
| Image                 | JPG / PNG / WebP, max 10 MB → upload to S3 via pre-signed URL                             |
| Video                 | MP4 / MOV, max 500 MB, max 10 min → upload via Mux Direct Upload → store HLS playback URL |
| Audio                 | MP3 / AAC, max 50 MB, max 5 min → upload to S3; rendered via `expo-av` audio player       |
| Text-only             | Caption only — no media attachment; `media_url = null`, `media_type = 'text'`             |
| Post publish          | Goes live immediately — posts are NOT moderated                                           |
| Follower notification | Push notification sent to all followers on new post                                       |

---

### M6-T4 · Post Feed, Like, Share + Follow

**What**: End User interaction with posts in the Discover feed.

| Sub-task         | Details                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Post card        | Image / video player / audio player, caption, like count, share                                    |
| Like             | Tap heart → increment like count (optimistic update)                                               |
| Share            | Native share sheet — deep link URL to post                                                         |
| Follow from post | Follow Artist/Venue directly from post card                                                        |
| Promotional ads  | Dismissible pop-up on home screen when user is within event's location radius (Venue-created only) |

---

## M7 — Push Notifications & Emails

**Weeks 9–10 · 3 tasks**

---

### M7-T1 · Firebase FCM Setup + Persona-Aware Notification Handler

**What**: Core notification infrastructure — one FCM token per device, persona-aware routing.

| Sub-task            | Details                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FCM install         | `expo-notifications` + Firebase SDK                                                                                                             |
| Token registration  | Register FCM token on login; store against user in DB                                                                                           |
| Payload structure   | `{ title, body, data: { persona, route, action } }`                                                                                             |
| On notification tap | Read `persona` → if matches current role: navigate to `route`; if different role: auto-switch → navigate → show toast "Switched to Artist mode" |
| Token refresh       | Update DB when FCM token rotates                                                                                                                |
| Cold start          | App reads payload on cold start, sets persona, opens correct screen                                                                             |

---

### M7-T2 · All Push Notification Triggers

**What**: Server-side triggers for every FCM notification defined in the PRD.

| Trigger                      | Condition                                                      |
| ---------------------------- | -------------------------------------------------------------- |
| Event Approved               | Admin approves a `pending_review` event → notify creator       |
| Event Rejected               | Admin rejects event (with reason in body) → notify creator     |
| Invitation Received          | Venue sends Artist invitation                                  |
| Application Received         | Artist applies to Venue's gig opportunity                      |
| Booking Accepted             | Either party accepts                                           |
| Booking Rejected / Cancelled | Either party rejects or cancels post-acceptance                |
| New Follower                 | Any user follows an Artist or Venue                            |
| New Post from Followed       | Followed Artist/Venue publishes a new post or event            |
| Nearby New Event             | New active event within user's set radius                      |
| Event Reminder               | Scheduled job — fires 1 hour before a saved event's start time |

---

### M7-T3 · Postmark Transactional Emails

**What**: All system emails sent via Postmark.

| Email                | Trigger                                                       |
| -------------------- | ------------------------------------------------------------- |
| Email Verification   | Sign-up with email/password                                   |
| Password Reset       | Forgot password request                                       |
| Venue Activation     | User selects Venue persona — contains ceolx.ie/subscribe link |
| Payment Confirmation | Stripe webhook confirms payment                               |
| Data Export Link     | User requests GDPR data export (M11)                          |

Additional: "Resend Email" endpoint for Venue activation — rate-limited to max 3 per hour.

---

## M8 — Venue Subscription & Payments

**Weeks 10–11 · 4 tasks**

---

### M8-T1 · ceolx.ie/subscribe Page (React + Stripe)

**What**: The web-based subscription checkout page — entirely outside the mobile app (Apple App Store compliance).

| Sub-task           | Details                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `/subscribe` route | In React admin app (TanStack Router)                                   |
| Auth gate          | User must log in with CeolX credentials before seeing checkout         |
| Plan display       | Lite / Pro subscription options (pricing TBD by client — Open Item #2) |
| Stripe Checkout    | Hosted Stripe checkout page redirect                                   |
| Success page       | "Your venue profile is now active! Return to the CeolX app."           |
| Cancel page        | "Subscription cancelled. You can try again anytime."                   |
| Deep link back     | Expo deep link returns user to app after successful payment            |

---

### M8-T2 · Stripe Webhook Handler + Subscription Status Management

**What**: Backend listens to Stripe events to keep subscription status in sync.

| Sub-task                        | Details                                          |
| ------------------------------- | ------------------------------------------------ |
| Webhook endpoint                | `POST /api/webhooks/stripe` on Hono API          |
| `checkout.session.completed`    | Set `subscription_status = active`               |
| `invoice.payment_failed`        | Notify Venue via push + email                    |
| `customer.subscription.deleted` | Set `subscription_status = inactive`             |
| Signature verification          | Verify Stripe webhook signature on every request |
| Audit log                       | Log all webhook events to DB                     |

---

### M8-T3 · In-App Venue Pending Activation UI

**What**: What the Venue sees in the app before and after subscribing — no external URL shown.

| Sub-task              | Details                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| Inactive state banner | "Your profile is not yet visible to artists. Check your email to activate."     |
| Resend Email button   | Calls activation email endpoint (rate-limited) — no URL shown in app            |
| Activation detected   | Poll on app foreground OR WebSocket push → dismiss banner, unlock full Venue UI |
| Activation toast      | "Your venue profile is now live!"                                               |
| Venue profile gate    | Profile hidden from all other users until `subscription_status = active`        |

---

### M8-T4 · ceolx.ie/account — Venue Subscription Management Portal

**What**: Self-service web portal for Venues to manage their subscription, view invoices, update payment method, and cancel. Sent via email only — never linked from inside the app.

| Sub-task               | Details                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `/account` route       | In React admin app (TanStack Router) — requires CeolX login before access             |
| Stripe Customer Portal | `stripe.billingPortal.sessions.create(...)` → redirect to hosted portal               |
| Portal features        | Current plan, billing history, update payment method, cancel subscription             |
| Cancellation webhook   | `customer.subscription.deleted` → M8-T2 handler sets `subscription_status = inactive` |
| Email link             | "Manage my subscription" link added to Postmark payment confirmation email            |
| No in-app URL          | Portal URL is never surfaced inside the mobile app (Apple compliance)                 |
| `stripe_customer_id`   | Add column to `venue_profiles` table (M1-T2)                                          |

---

## M9 — Super Admin Dashboard

**Weeks 9–10 (parallel) · 2 tasks**

---

### M9-T1 · Admin Login + KPI Dashboard + User Management

**What**: The operational core of the admin dashboard.

| Sub-task    | Details                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| Login       | Email/password only; no SSO                                                      |
| KPI cards   | Total Spectators \| Total Artists \| Total Venues \| Active Users (last 30 days) |
| Users table | Name, Email, User Type, Current Role, Registration Date, Last Login              |
| Search      | Search by email (live filter)                                                    |
| Export      | Download all users as CSV                                                        |
| Logout      | Terminate admin session                                                          |

---

### M9-T2 · Pending Events Moderation Queue

**What**: The admin's tool to approve or reject every event before it goes live.

| Sub-task            | Details                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Pending Events page | Table: title, creator, type (Artist/Venue), category, submitted date — oldest first |
| Event preview panel | Cover image + all event fields + map pin                                            |
| Approve             | `status = active` → API → FCM push to creator: "Your event is live!"                |
| Reject              | Mandatory reason (min 10 chars) → `status = rejected` → FCM push with reason        |
| Resubmissions       | Reappear in queue after creator edits and resubmits                                 |
| Nav badge           | Sidebar shows count of pending events                                               |

---

## M10 — Media (S3, CloudFront, Mux)

**Weeks 6–7 (parallel) · 1 task**

---

### M10-T1 · AWS S3 + CloudFront Setup + Mux Video Integration

**What**: Media infrastructure for all image, audio, and video uploads.

| Sub-task          | Details                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| S3 bucket         | Private bucket in `eu-west-1` (closest to Ireland)                                    |
| CloudFront        | Distribution in front of S3; signed URLs with 1-hour expiry                           |
| Pre-signed upload | `POST /api/media/upload-url` → returns S3 pre-signed PUT URL; client uploads directly |
| Mux setup         | `POST /api/media/video-upload` → creates Mux upload URL                               |
| Mux webhook       | Fires when video processing complete → store HLS playback URL on post record          |
| Video player      | Use Mux playback URL in mobile video player (HLS adaptive bitrate)                    |

---

## M11 — Analytics & GDPR

**Weeks 11–12 · 3 tasks**

---

### M11-T1 · GDPR: Consent, Account Deletion, Data Export + Legal Screens

**What**: Mandatory for an Irish/EU client — not optional.

| Sub-task                | Details                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent screen          | Sign-up: checkboxes for data collection, location, marketing (marketing is optional)                                                                                |
| Privacy Policy screen   | Linked at sign-up and in Settings                                                                                                                                   |
| Terms of Service screen | Linked at sign-up and in Settings                                                                                                                                   |
| Account deletion        | Settings → Delete Account: anonymise personal data (name, email, avatar → "Deleted User [id]"), revoke sessions + FCM token, retain non-personal content structures |
| Data export             | Settings → Export My Data: generate JSON of user's data + events + bookings → Postmark email with download link                                                     |
| Inactive account job    | Background job flags accounts inactive after 24 months of no login                                                                                                  |

---

### M11-T2 · Admin Analytics & KPI Tracking

**What**: Extended KPI cards on the Super Admin dashboard — user growth, event activity, subscription revenue, engagement.

| Sub-task          | Details                                                             |
| ----------------- | ------------------------------------------------------------------- |
| User KPIs         | Total registered users, breakdown by persona, new in last 7/30 days |
| Event KPIs        | Total events by status, events created in last 7/30 days            |
| Subscription KPIs | Active Venue subscriptions, past_due, new in last 30 days           |
| Engagement KPIs   | Total follows, bookings (by status), total posts                    |
| Trend arrows      | Up/down vs previous 30-day period on each card                      |

---

### M11-T3 · Artist & Venue In-App Analytics

**What**: Per-creator analytics tab on Artist and Venue profiles — visible to the profile owner only.

| Sub-task         | Details                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Artist analytics | Post likes, event views (`events.view_count`), event saves, follower count, booking counts by status |
| Venue analytics  | Same as Artist + artist applications received per gig opportunity event + subscription status badge  |
| API              | `GET /artists/me/analytics` + `GET /venues/me/analytics` — cached 30 min                             |
| Mobile screen    | Analytics tab on own profile — stat cards only, no charts in V1                                      |
| Access gate      | Tab only shown to the profile owner — hidden on all other users' profiles                            |

---

## M12 — QA & Launch Prep

**Weeks 12–14 · 3 tasks**

---

### M12-T1 · End-to-End QA + Bug Fixes

**What**: Full product testing across all personas and critical flows.

| Test Area           | Details                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| All 4 persona flows | Every critical path end-to-end                                                    |
| Map                 | Bounding box query speed, pin clustering, empty state auto-expand, fallback chain |
| Notifications       | All triggers, persona routing on cold start, background + foreground              |
| Stripe              | Webhook testing via Stripe CLI (local + staging)                                  |
| Auth                | All sign-in methods, session expiry, token refresh                                |
| GDPR                | Deletion, export, consent                                                         |
| Devices             | iPhone (latest + 2 back), Android Samsung + Pixel (latest + 1 back)               |
| Bug fixes           | All critical + high severity bugs resolved before submission                      |

---

### M12-T2 · iOS App Store Submission

**What**: Prepare and submit the iOS app.

| Sub-task             | Details                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| App signing          | Provisioning profiles + distribution certificate                                  |
| EAS production build | Build `.ipa` via EAS Build                                                        |
| App Store Connect    | Screenshots, description, keywords, age rating, privacy labels                    |
| Review notes         | Explain Venue subscription web flow (B2B — not in-app purchase) to Apple reviewer |
| Submit               | Submit for App Store Review                                                       |

---

### M12-T3 · Android Google Play Submission + Infrastructure Deployment

**What**: Android submission + production infrastructure go-live.

| Sub-task               | Details                                                 |
| ---------------------- | ------------------------------------------------------- |
| Android keystore       | Configure via EAS                                       |
| EAS production build   | Build `.aab` for Google Play                            |
| Play Console           | Metadata, screenshots, content rating                   |
| Submit                 | Submit for Google Play Review                           |
| Hono API deploy        | AWS Lambda — production stage                           |
| Prod env vars          | Neon prod DB, Stripe live keys, Postmark, FCM, Mux, S3  |
| Admin dashboard deploy | Vercel (or AWS Amplify); custom domain `admin.ceolx.ie` |
| Stripe webhook         | Register production webhook URL in Stripe dashboard     |
| Smoke test             | Full end-to-end test on production environment          |
| Monitoring             | Basic uptime monitoring (UptimeRobot free tier)         |

---

## Open Items (Must Resolve Before Related Milestone)

| #   | Item                                                 | Blocks                     | Owner                |
| --- | ---------------------------------------------------- | -------------------------- | -------------------- |
| 1   | Default event categories (pre-seeded list)           | M4 — event creation        | Client               |
| 2   | Venue subscription pricing (Lite / Pro)              | M8 — subscribe page        | Client               |
| 3   | Promotional ad rules (frequency cap)                 | M6 — post feed             | Pratiksha            |
| 4   | UI design approval — Feed vs Map layout              | M3 — feed view             | Pratiksha / client   |
| 5   | Notification trigger list — client sign-off          | M7 — notification triggers | Priya to share draft |
| 6   | Venue pre-seeding data — will client provide a list? | M4 — event creation        | Client               |
