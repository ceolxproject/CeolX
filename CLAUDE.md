# CeolX — Project Context for Claude

This file is the single source of context for all Claude sessions working on the CeolX project.
Read this fully before doing anything. All decisions here are **finalised** unless explicitly overridden in the conversation.

## Code Navigation — Use the Knowledge Graph

A `code-review-graph` MCP knowledge graph is available for this codebase. **Always use it before reaching for Grep/Glob/Read.** It is significantly faster and avoids burning context on full-repo scans.

```
# Find a function, class, or type by name or keyword
semantic_search_nodes_tool("createEventSchema")

# Understand relationships (callers, imports, children, tests)
query_graph_tool(pattern="importers_of", node="packages/shared/src/validators/events.ts")

# Understand blast radius before changing a file
get_impact_radius_tool("packages/shared/src/types.ts")

# Get focused review context for a file
get_review_context_tool("apps/admin/src/components/DataTable.tsx")
```

Only fall back to Grep/Glob/Read when the graph doesn't cover what you need (e.g. brand-new files not yet indexed).

---

## What is CeolX?

CeolX is a **location-aware Irish music discovery platform** built for **Chongie Entertainment Services, Ireland**.

- **Mobile app**: iOS & Android (React Native + Expo)
- **Admin dashboard**: Web (React + Vite + TanStack Router)
- **Scope**: Irish music only. English only. Global access but Irish music context throughout.
- **Launch scale**: Under 1,000 users — controlled launch timed around the Irish festival season
- **Developer**: Priya Yadav (solo full-stack developer at RaftLabs, India)
- **PRD location**: `prd/CeolX_PRD_v1.6.docx` — this is the single source of truth. Always update this file, never create a new version file.
- **Flow diagrams**: `prd/CeolX_Flow_Diagrams.html`

---

## User Personas

There are **4 personas**. One account supports **one active persona at a time** (Option A role switching — see below).

| Persona                  | Description                                                                   | Paid?                                     |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------- |
| **Spectator** (End User) | Music fans discovering events. No public profile. Anonymous consumer.         | Free                                      |
| **Musician / Artist**    | Promotes performances, gets booked by venues. Public profile.                 | Paid subscription (lower tier than Venue) |
| **Venue / Business**     | Pubs, cultural hubs, event promoters. Lists gigs, recruits artists, runs ads. | Paid subscription                         |
| **Super Admin**          | Single internal CeolX admin. Web dashboard only. One account only.            | N/A                                       |

---

## Persona Selection (Finalised — updated 08/04/2026)

Persona is selected at sign-up and is **fixed for that account**.

> **Artist ↔ Venue switching is NOT supported** — MoM 3rd Apr 2026, Section 2.1. Separate accounts are required if a user needs both roles. There is no "Switch Account Type" setting.

- **Data model**: `users.current_role` (enum: `spectator | artist | venue`). Set at sign-up. Not mutable after registration.
- Separate `artist_profiles` and `venue_profiles` tables.
- No `is_active` toggling on role switch — roles are permanent per account.

### Notification routing

All personas share one FCM token per device. Each notification payload includes:

- `persona`: role the notification relates to (`artist`, `venue`, `spectator`)
- `route`: deep link route (e.g. `/events/123`)

On tap: navigate directly to the route. No persona auto-switching (switching is not supported).

---

## Authentication

Powered by **BetterAuth**.

- Email/Password (with email verification)
- Google Sign-In (iOS + Android)
- Apple Sign-In (iOS only — required for App Store compliance)
- Forgot Password via Postmark email
- Session termination on logout

---

## Event Moderation (Post-publication — Updated 08/04/2026)

**Events go live immediately** upon creation. The Super Admin reviews content after the fact and can remove inappropriate events. Profile creation and profile edits are NOT moderated.

> **MoM 3rd Apr 2026 (Section 4)**: Sean agreed content goes live immediately. Super Admin manually reviews after publication. Inappropriate content can be flagged and removed.

### Event status lifecycle

```
draft → active → archived
             ↘ removed (admin takedown) → (creator edits + resubmits) → active
```

- On creation: `status = active`. Immediately visible on map and feed.
- **Admin removes** → `status = removed`, `removal_reason` populated. Creator gets push notification with reason. Creator can edit and resubmit → back to `active`.
- After event date passes → soft archived (`status = archived`). Stays in DB, removed from map/feed, visible on creator's profile under Past Events.
- Hard delete is never used.
- `pending_review` is used to **hold an artist-created event off the map/feed until the named venue accepts** (artist→venue consent flow — see `events/crud.ts`; on venue acceptance the booking flow flips it to `active`). `rejected` remains in the schema enum for potential future use but is not used in V1.

**Admin content review dashboard**: Shows all active events, sorted newest first. Admin can remove any event with a mandatory reason.

---

## Subscriptions (Web-based Stripe — Finalised, updated 08/04/2026)

**Both Artist and Venue require paid subscriptions.** Artist pricing is lower than Venue. Neither is free in V1 (MoM 3rd Apr 2026, Section 2.2).

**Not in-app**. Apple Rule 3.1.1 prohibits third-party payment processors for in-app digital purchases. Solution: subscription via web for both roles.

### Venue Flow

1. User selects Venue/Business persona at sign-up
2. `venue_profiles.subscription_status = inactive`. Profile not visible.
3. **Postmark** sends activation email with Stripe subscription link (`ceolx.com/subscribe`)
4. In-app shows: _"Your profile is not yet visible to artists. Check your email to activate."_ + **Resend Email** button
5. **No external URL is shown inside the app** — this avoids App Store rejection
6. Venue opens email → clicks link → `ceolx.com/subscribe` (hosted in React admin app)
7. Logs in with CeolX credentials → completes Stripe checkout
8. Stripe webhook → Hono backend → `subscription_status = active`
9. App activates Venue persona (next refresh or WebSocket push)

### Artist Flow

Same web-based pattern as Venue. Different Stripe price ID (lower tier). `artist_profiles.subscription_status` follows the same lifecycle: `inactive → active → past_due → cancelled`. Artist profile not visible until subscription is active.

### Revenue

- Stripe fee: ~2.9% + 30¢ per transaction
- CeolX net: ~97% (vs ~85% with Apple IAP)
- No RevenueCat. No Apple IAP. No Google Play Billing.

---

## Map — Key Decisions (Finalised)

### Data loading

- **Viewport bounding box query** — only fetch events visible in the current map area
- Sends SW + NE lat/lng corners to backend on each map render
- API calls **debounced ~400ms** after user stops panning
- Max **50 pins per fetch**
- **GIST spatial index** on `(lat, lng)` in Neon for fast queries
- **Pin clustering** enabled — multiple nearby pins merge into a count badge when zoomed out

### Location permission fallback chain

1. **GPS** (granted) → center map on device location
2. **IP geolocation** (denied) → server resolves approximate city/county from IP. Shows banner: _"Using approximate location — search to refine."_
3. **Ireland default** (IP fails) → center on lat: 53.1424, lng: -7.6921. Search bar shown prominently.

User is never blocked. Search bar (county / artist / category) is always available as manual override.

### Empty state (no events in view)

Radius is **system-defined — never shown to the user**.

Silent auto-expand:

1. Try current viewport / ~5 km from map centre
2. If 0 results → silently retry at 25 km
3. If 0 results → silently retry at 100 km
4. If still 0 → show non-blocking floating card: _"No events near here. Try searching for Dublin, Galway, or Cork."_ + **Browse all upcoming events** (switches to Feed view)

---

## Tech Stack (Finalised)

| Layer               | Technology                                 | Notes                                                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Mobile App          | React Native + Expo (TypeScript)           | Single codebase for iOS + Android                                         |
| Maps                | React Native Maps                          | Apple Maps on iOS, Google Maps on Android                                 |
| Backend API         | Hono (Node.js / TypeScript)                | Lightweight, minimal boilerplate, Lambda-compatible                       |
| ORM                 | Drizzle                                    | SQL-like, TypeScript-first, explicit                                      |
| Database            | PostgreSQL via Neon                        | Serverless, DB branching (dev/staging/prod)                               |
| Auth                | BetterAuth                                 | Email/Password + Google OAuth + Apple Sign-In                             |
| Push Notifications  | Firebase FCM                               | One token per device, persona-aware payloads                              |
| Transactional Email | Postmark                                   | Verification, password reset, Venue activation, payment confirmation      |
| Media Storage       | AWS S3 + CloudFront                        | Images, audio. CloudFront CDN for Irish users.                            |
| Video Processing    | Mux                                        | Upload, transcode, HLS streaming, CDN, analytics                          |
| Payments            | Stripe (web only)                          | Venue subscriptions via ceolx.com/subscribe. No RevenueCat. No Apple IAP. |
| Admin Dashboard     | React + Vite + TanStack Router + ShadCN/UI | Also hosts ceolx.com/subscribe page                                       |
| Monorepo            | Turborepo                                  | apps/mobile, apps/admin, apps/api, packages/shared                        |
| Repository          | GitHub                                     | Branch per environment, matching Neon DB branches                         |

### Validation architecture

`packages/shared/src/validators/` is the **single source of truth** for all user-facing schemas. Both client (form validation) and server (tRPC `.input()`) must use the same schema — never define a duplicate inline.

**Rule:** When wiring a tRPC procedure that has a corresponding schema in `@CeolX/shared/validators`, import it:

```ts
// packages/api/src/routers/events.ts
import { createEventSchema } from '@CeolX/shared/validators';
createEvent: protectedProcedure.input(createEventSchema).mutation(...)
```

**Existing inline schemas in routers** (artists, venues, events, admin, bookings) are temporary duplicates from pre-M1.6. Replace them with the shared schema when you touch that router for a feature.

**Exception — job payload schemas** in `apps/server/src/jobs/types.ts` validate internal QStash webhook payloads, not user input. These stay server-only and are never shared.

### Replaced / removed

- ~~NestJS~~ → Hono (simpler for solo dev)
- ~~Prisma~~ → Drizzle (more explicit)
- ~~AWS Cognito~~ → BetterAuth
- ~~AWS MediaConvert + Lambda~~ → Mux
- ~~RevenueCat + Apple IAP + Google Play Billing~~ → Stripe web-only
- ~~Stripe (in-app)~~ → Stripe web-only (Apple Rule 3.1.1)

---

## AI Tools Setup

All AI tools (Claude, Cursor, VS Code/Copilot, Codex, Gemini) have project-level MCP configs checked into the repo.
**Windsurf** MCP config is user-scoped (`~/.codeium/windsurf/mcp_config.json`) and cannot be project-committed. Add manually:

```json
{
  "mcpServers": {
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "shadcn": { "command": "npx", "args": ["-y", "shadcn@latest", "mcp"] },
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    },
    "neon": { "serverUrl": "https://mcp.neon.tech/mcp" },
    "better-auth": { "serverUrl": "https://mcp.inkeep.com/better-auth/mcp" },
    "expo-mcp": { "serverUrl": "https://mcp.expo.dev/mcp" },
    "vercel": { "serverUrl": "https://mcp.vercel.com" }
  }
}
```

## Event Data Model (Key Fields)

```
events
  title, description, cover_image
  date_start, date_end (optional)
  lat, lng                          -- spatial index (GIST)
  venue_id (FK) | venue_address     -- registered venue or free-text fallback
  category
  collaborators                     -- confirmed platform Artist profiles (event_collaborators join table)
  unregistered_collaborators        -- JSONB [{ name, email }] — outside-platform invite recipients
  ticket_link                       -- external URL
  is_gig_opportunity                -- DEPRECATED — nullable, no longer written; ignore in new code
  collection_id (optional)
  created_by                        -- Artist or Venue profile ID
  status                            -- enum: draft | pending_review | rejected | active | archived
  rejection_reason                  -- nullable; populated by admin on rejection
```

### Event form field distinctions (Updated 31/05/2026 — Asana 1215188774775403)

> **Change:** The **Collaborator** field (direct, auto-confirmed performer) was **removed** from the event form. A venue can no longer add a confirmed performer without consent. Every venue→artist link now flows through **Invite Artist** → pending booking → the artist accepts via the M5 booking flow. "Artist is always invited — no direct collaborator." Collaborators/artists are **optional** when creating an event.

Only **one** artist-linking field exists on the event creation/edit form now:

| Field             | Purpose            | Who can be added                                    | Confirmation                                             |
| ----------------- | ------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| **Invite Artist** | Pending invitation | Platform artists OR outside-platform (name + email) | Platform: M5 booking flow; Outside: email invite (M7-T3) |

A performer only becomes a **confirmed collaborator** (`eventCollaborators` row with an `ACCEPTED` booking) once they accept the invite. Legacy events created before this change keep their auto-confirmed collaborator rows untouched, and the event-detail page still displays confirmed performers. The `ADDED_AS_COLLABORATOR_TO_ARTIST` notification trigger is now unused (kept in `shared` for the notification matrix; flag for Pratiksha).

### Mandatory fields by persona

- **Venue creating event** — no mandatory collaborator. Inviting artists is optional.
- **Artist creating event** — must specify a Venue (registered venue profile OR free-text address)

---

## Booking Flow (Artist ↔ Venue)

Two directions:

- **Venue-initiated**: Venue sends invitation to a specific Artist via event form Invite Artist field
- **Artist-initiated**: Artist requests to perform at **any** event (universal — not gated by `is_gig_opportunity`)

State machine: `Pending → Accepted | Rejected` → `Cancelled` (either party, any time post-acceptance)

---

## Super Admin (Web Dashboard)

- **Single account only**. No multi-admin in V1.
- Login: email/password only
- Features: KPI overview cards, view all users (table), search by email, export CSV
- **Content moderation**: Pending Events Queue → Approve (→ active) or Reject (with reason → creator notified)
- Profile creation/edits are NOT moderated — events only
- NOT in V1: user suspension/banning, category management, platform-wide analytics, subscription management

---

## Monorepo Structure (Turborepo)

```
apps/
  mobile/     -- React Native + Expo
  admin/      -- React + Vite + TanStack Router + ShadCN/UI (also hosts ceolx.com/subscribe)
  api/        -- Hono backend (deployed as AWS Lambda)
packages/
  shared/     -- TypeScript types, utilities, shared constants
```

---

## Git Workflow

- **Base branch is always `development`** — branch off it, open every PR against it (never `main`).
- **Merge strategy: rebase and merge only** — no merge commits.
- **Updating a feature branch with new `development` commits: `git rebase development`.** Never `git pull`/merge `development` into a feature branch — that creates merge commits and non-linear history.
- One PR per bug/feature. Commits scoped per file/feature, not one giant commit.
- PR description links the Asana task.

---

## GDPR (Mandatory — Irish client)

- Consent at sign-up for data collection, location, marketing
- Right to erasure: account deletion anonymises personal data, retains non-personal content structures
- Right to data portability: users can export their data
- Location: on-demand only (not background tracking)
- Privacy Policy + ToS accepted at sign-up
- Inactive accounts flagged after 24 months

---

## Key Business Rules

- Irish music genre only — no expansion planned for V1
- English only in V1
- Location permission is mandatory for the app to function (fallback chain exists — see Map section)
- **Artist ↔ Venue switching is not supported** — separate accounts required (MoM 3rd Apr 2026)
- `is_gig_opportunity` is deprecated — no longer written; any event can receive artist performance requests (M5)
- **Collaborators/artists are optional on event creation** — the direct "Collaborator" field was removed (Asana 1215188774775403, 31/05/2026). Venues link artists only via **Invite Artist** (pending → artist accepts). No auto-confirmed direct collaborator.
- **Artist must specify a venue** (registered profile or free-text address) when creating an event
- **Both Artist and Venue require paid subscriptions** — Artist pricing lower than Venue (MoM 3rd Apr 2026)
- Artist profile is not visible until subscription is active
- Venue profile is not visible until subscription is active
- All events soft-deleted — no hard deletes ever
- Recurring events not supported in V1
- Live streaming not in V1
- In-app ticket purchasing not in V1 (external links only)
- AI features not in V1

---

## Open Items (Need Client/Stakeholder Input)

| #   | Item                                                            | Owner                       |
| --- | --------------------------------------------------------------- | --------------------------- |
| 1   | Default event categories — pre-seeded values?                   | Client to provide           |
| 2   | Venue subscription — feature gating between Lite and Pro tiers  | Client post-launch          |
| 3   | Promotional ads — frequency cap and targeting rules             | Pratiksha to confirm        |
| 4   | UI design approval — Feed vs Map home screen layout             | Pratiksha / client sign-off |
| 5   | Notification trigger list — full client sign-off                | Priya to share draft        |
| 6   | Venue pre-seeding — will client provide registered venues list? | Client to confirm           |

---

## Key People

| Name            | Role                                 |
| --------------- | ------------------------------------ |
| Priya Yadav     | Solo full-stack developer (RaftLabs) |
| Aravind Jaimon  | Manager / PRD reviewer               |
| Pratiksha Patil | Assistant Manager                    |

### Asana

- Workspace ID: `1194107417268910`
- Project ID: `1210959953917909`
- Priya GID: `1209289934108706`
- Aravind GID: `1199376712173373`
- Pratiksha GID: `1203952267007789`

### Sections

- Ideas: `1210959953917910`
- Backlogs: `1210960051442678`
- In Progress: `1213652919039664`
- Staged: `1213652919039665`
- Completed: `1213652919039666`

---

## Files in This Folder

```
CeolX/
  CLAUDE.md                                  -- this file (project context)
  CeolX - Features (Copy for Devs).docx      -- original Jan 2026 features doc (reference only)
  CeolX - Proposal Document March 2026.docx  -- original Mar 2026 proposal (reference only)
  prd/
    CeolX_PRD_v1.6.docx                      -- SINGLE SOURCE OF TRUTH (always update this)
    CeolX_Flow_Diagrams.html                 -- interactive flow diagrams (7 tabs)
    CeolX_PRD_v1.0 → v1.5.docx              -- archived versions (do not edit)
```

The PRD generation script lives at `/sessions/trusting-sweet-albattani/generate_prd.js`.
Run with `node generate_prd.js` from that directory. Output goes directly to `prd/CeolX_PRD_v1.6.docx`.
