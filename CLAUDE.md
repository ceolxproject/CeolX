# CeolX — Project Context for Claude

This file is the single source of context for all Claude sessions working on the CeolX project.
Read this fully before doing anything. All decisions here are **finalised** unless explicitly overridden in the conversation.

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

| Persona                  | Description                                                                   | Paid?             |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------- |
| **Spectator** (End User) | Music fans discovering events. No public profile. Anonymous consumer.         | Free              |
| **Musician / Artist**    | Promotes performances, gets booked by venues. Public profile.                 | Free in V1        |
| **Venue / Business**     | Pubs, cultural hubs, event promoters. Lists gigs, recruits artists, runs ads. | Paid subscription |
| **Super Admin**          | Single internal CeolX admin. Web dashboard only. One account only.            | N/A               |

---

## Persona Switching (Option A — Finalised)

- One active persona at a time. User selects initial persona at sign-up.
- Can switch from **Settings > Switch Account Type** at any time after onboarding.
- **Data model**: `users.current_role` (enum: `spectator | artist | venue`). Separate `artist_profiles` and `venue_profiles` tables. Switching flips `is_active` — **no data is deleted on switch**.
- **Switching to Venue without subscription**: activation email is sent (see Venue Subscription). Venue persona activates only after Stripe webhook confirms payment.
- **Switching away from Venue**: subscription stays active, billing continues. Profile goes dormant (`is_active: false`).
- **Switching away from Artist**: `is_active: false`. Past approved events stay live until their date passes.
- **Pending events in moderation queue**: if user switches persona while events are in `pending_review`, those events stay in the queue and follow normal moderation path.

### Notification routing across personas

All personas share one FCM token per device. Each notification payload includes:

- `persona`: role the notification relates to (`artist`, `venue`, `spectator`)
- `route`: deep link route (e.g. `/events/123`)

On tap: if user is already in the correct persona → navigate directly. If not → app auto-switches persona first, then navigates. Shows a brief toast confirming the switch.

---

## Authentication

Powered by **BetterAuth**.

- Email/Password (with email verification)
- Google Sign-In (iOS + Android)
- Apple Sign-In (iOS only — required for App Store compliance)
- Forgot Password via Postmark email
- Session termination on logout

---

## Event Moderation (Pre-publication — Finalised)

**Every event** created by an Artist or Venue goes through admin moderation **before going live**. Profile creation and profile edits are NOT moderated.

### Event status lifecycle

```
draft → pending_review → active → archived
                       ↘ rejected → (creator edits) → pending_review
```

- On creation: `status = pending_review`. Not visible to any user except the creator and Super Admin.
- **Admin approves** → `status = active`. Visible on map and feed. Creator gets push notification.
- **Admin rejects** → `status = rejected`, `rejection_reason` populated. Creator gets push notification with reason. Creator can edit and resubmit → back to `pending_review`.
- After event date passes → soft archived (`status = archived`). Stays in DB, removed from map/feed, visible on creator's profile under Past Events.
- Hard delete is never used.

**Rationale**: Because users can switch from Spectator to Artist, moderation prevents random/spam events from appearing on the map.

---

## Venue Subscription (Web-based Stripe — Finalised)

**Not in-app**. Apple Rule 3.1.1 prohibits third-party payment processors for in-app digital purchases. Solution: subscription via web.

### Flow

1. User selects Venue/Business persona (sign-up or role switch)
2. `venue_profiles.subscription_status = inactive`. Profile not visible.
3. **Postmark** sends activation email with Stripe subscription link (`ceolx.ie/subscribe`)
4. In-app shows: _"Your profile is not yet visible to artists. Check your email to activate."_ + **Resend Email** button
5. **No external URL is shown inside the app** — this avoids App Store rejection
6. Venue opens email → clicks link → `ceolx.ie/subscribe` (hosted in React admin app)
7. Logs in with CeolX credentials → completes Stripe checkout
8. Stripe webhook → Hono backend → `subscription_status = active`
9. App activates Venue persona (next refresh or WebSocket push)

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

| Layer               | Technology                                 | Notes                                                                    |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Mobile App          | React Native + Expo (TypeScript)           | Single codebase for iOS + Android                                        |
| Maps                | React Native Maps                          | Apple Maps on iOS, Google Maps on Android                                |
| Backend API         | Hono (Node.js / TypeScript)                | Lightweight, minimal boilerplate, Lambda-compatible                      |
| ORM                 | Drizzle                                    | SQL-like, TypeScript-first, explicit                                     |
| Database            | PostgreSQL via Neon                        | Serverless, DB branching (dev/staging/prod)                              |
| Auth                | BetterAuth                                 | Email/Password + Google OAuth + Apple Sign-In                            |
| Push Notifications  | Firebase FCM                               | One token per device, persona-aware payloads                             |
| Transactional Email | Postmark                                   | Verification, password reset, Venue activation, payment confirmation     |
| Media Storage       | AWS S3 + CloudFront                        | Images, audio. CloudFront CDN for Irish users.                           |
| Video Processing    | Mux                                        | Upload, transcode, HLS streaming, CDN, analytics                         |
| Payments            | Stripe (web only)                          | Venue subscriptions via ceolx.ie/subscribe. No RevenueCat. No Apple IAP. |
| Admin Dashboard     | React + Vite + TanStack Router + ShadCN/UI | Also hosts ceolx.ie/subscribe page                                       |
| Monorepo            | Turborepo                                  | apps/mobile, apps/admin, apps/api, packages/shared                       |
| Repository          | GitHub                                     | Branch per environment, matching Neon DB branches                        |

### Replaced / removed

- ~~NestJS~~ → Hono (simpler for solo dev)
- ~~Prisma~~ → Drizzle (more explicit)
- ~~AWS Cognito~~ → BetterAuth
- ~~AWS MediaConvert + Lambda~~ → Mux
- ~~RevenueCat + Apple IAP + Google Play Billing~~ → Stripe web-only
- ~~Stripe (in-app)~~ → Stripe web-only (Apple Rule 3.1.1)

---

## Event Data Model (Key Fields)

```
events
  title, description, cover_image
  date_start, date_end (optional)
  lat, lng                          -- spatial index (GIST)
  venue_id (FK) | venue_address     -- registered venue or free-text fallback
  category
  collaborators                     -- linked Artist profiles
  ticket_link                       -- external URL
  is_gig_opportunity                -- boolean; true = Venue recruitment post (Artists only)
  collection_id (optional)
  created_by                        -- Artist or Venue profile ID
  status                            -- enum: draft | pending_review | rejected | active | archived
  rejection_reason                  -- nullable; populated by admin on rejection
```

---

## Booking Flow (Artist ↔ Venue)

Two directions:

- **Venue-initiated**: Venue sends invitation to a specific Artist
- **Artist-initiated**: Artist applies to a Venue's gig opportunity (`is_gig_opportunity: true`)

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
  admin/      -- React + Vite + TanStack Router + ShadCN/UI (also hosts ceolx.ie/subscribe)
  api/        -- Hono backend (deployed as AWS Lambda)
packages/
  shared/     -- TypeScript types, utilities, shared constants
```

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
- Gig opportunity events (`is_gig_opportunity: true`) are visible to Artists only, not Spectators
- Artist accounts are free in V1
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
