# CeolX — Developer Handoff

You're inheriting CeolX from Priya Yadav (outgoing solo full-stack dev, RaftLabs). This folder is the **fast path to productive** — the things that aren't obvious from reading the code or the PRD, distilled from ~6 months of building and debugging. It assumes you're fluent in the stack (React Native/Expo, Hono, Drizzle, tRPC); it does **not** re-teach any of that. It only covers what's CeolX-specific or genuinely non-obvious.

Read this page, then jump to whichever file matches what you're about to do.

## What CeolX is (30 seconds)

A **location-aware Irish-music discovery platform** for Chongie Entertainment Services (Ireland). A React Native app (iOS + Android) for fans/artists/venues to discover and list gigs on a map + feed, plus a React admin dashboard for a single Super Admin. Four personas (Spectator / Artist / Venue / Super Admin); Artist and Venue are paid (Stripe, web-only — Apple Rule 3.1.1). Controlled launch under ~1,000 users around the Irish festival season. Full product context is in [`../../CLAUDE.md`](../../CLAUDE.md) and [`../../PRODUCT.md`](../../PRODUCT.md); the source-of-truth PRD is `prd/CeolX_PRD_v1.6.docx`.

## Monorepo at a glance

Turborepo + pnpm. **Real on-disk names** (CLAUDE.md's "Monorepo Structure" table says `apps/mobile`/`apps/api` — that's stale; use these):

```
apps/
  native/   React Native + Expo app (iOS + Android)
  admin/    React + Vite + TanStack Router SPA — Super Admin + public ceolx.com (subscribe, /post share pages)
  server/   Hono HTTP host — mounts the API, app-links, post-share OG, QStash job handlers; deployed to Vercel
packages/
  api/      tRPC routers + procedures (the actual API logic; apps/server just hosts it)
  db/       Drizzle schema + migrations (@CeolX/db)
  shared/   Zod validators, enums, notification copy builders, types — SOURCE OF TRUTH, used by client + server
  auth/     BetterAuth config          email/  Postmark templates + senders
  env/      typed env schemas          ui/     shared admin UI primitives
  cache/    caching helpers            config/ shared eslint/tsconfig
```

## If you're doing X, read Y

| You're about to… | Read |
| --- | --- |
| Debug something weird / "why does this break" | [`01-gotchas.md`](./01-gotchas.md) — 54 traps, grouped by area, symptom → cause → fix |
| Understand what's built, what's half-done, what's blocked | [`02-project-state.md`](./02-project-state.md) — milestones, unfinished work, client-blocked items |
| Deploy, build, migrate, publish an OTA | [`03-ops-runbooks.md`](./03-ops-runbooks.md) — EAS / Neon / Vercel / Typesense / envx, copy-pasteable |
| Find where code lives / understand a data flow | [`04-architecture.md`](./04-architecture.md) — layout, source-of-truth rules, event & booking flows |

Fast index into the gotchas by area: [Auth & onboarding](./01-gotchas.md#auth--onboarding) · [Map & discovery](./01-gotchas.md#map--discovery) · [Media/posts/feed](./01-gotchas.md#mediapostsfeed) · [Notifications & deep-linking](./01-gotchas.md#notifications--deep-linking) · [Events & bookings](./01-gotchas.md#events--bookings) · [Email](./01-gotchas.md#email) · [Builds & EAS](./01-gotchas.md#builds--eas) · [Deploy & infra](./01-gotchas.md#deploy--infra) · [DB & data-modeling](./01-gotchas.md#db--data-modeling)

## Non-negotiable rules (the ones that bite fastest)

| Rule | Why |
| --- | --- |
| **PRs base onto `development`**, not `main` (`gh pr create --base development`). | `main` is the default; targeting it is wrong for this repo. |
| **Commit subjects are fully lowercase**, including acronyms (`fcm`, `pr`, `sha`). | commitlint (`commitlint.config.js`) rejects otherwise. Branch prefixes: feature/fix/hotfix/bugfix/release/chore/docs/refactor/test/ci. |
| **Never `StyleSheet.create`** in `apps/native`. | Styling is Tailwind v4 + uniwind — `className` + `cn()` only. |
| **Shared validators are the single source of truth.** | A Zod schema in `packages/shared/src/validators/` backs BOTH the client form and the tRPC `.input()`. Never duplicate inline. |
| **Notification copy comes from `@CeolX/shared` builders**, never inline strings in a router. | Keeps push/inbox/email in lockstep with the PM-audited matrix. |
| **Push to BOTH git remotes** (`raftlabs` + `client`) for `staging`/`main`. | Vercel only watches `client`; deploys silently no-op otherwise. See runbooks. |
| **The real build gate is `turbo build`**, not `server#check-types` (known-red). | See gotchas → Builds & EAS. |
| **Use the `code-review-graph` MCP tools before Grep/Glob.** | Faster, cheaper on context. See CLAUDE.md "Code Navigation". |

## Verification convention in these docs

Every file path, flag, and command in this folder was checked against the repo as of **2026-07-14**. Anything that couldn't be confirmed is marked `⚠️ unverified as of 2026-07-14` rather than asserted — treat those as "confirm before relying on." Known open reconciliations: the shared-post domain moved from `ceolx.ie` (in old notes) to `ceolx.com` (on disk) — confirm no `.ie` DNS/registration still needs cleanup; and `apps/server` has no `jobs:setup-crons` script yet despite a doc-comment referencing one.

## People & links

| Who | Role |
| --- | --- |
| **Priya Yadav** | Outgoing solo full-stack dev (RaftLabs) — original author of all of this. |
| **Pratiksha Patil** | Assistant Manager = **the PM**. Route scope, sign-offs, business/product decisions, notification-matrix audits here. |
| **Aravind Jaimon** | Manager / PRD reviewer — **technical guidance only**; not the owner of business/scope calls. |

- **PRD (source of truth):** `prd/CeolX_PRD_v1.6.docx` — always update this file, never fork a new version. Flow diagrams: `prd/CeolX_Flow_Diagrams.html`.
- **Project context for AI sessions:** [`../../CLAUDE.md`](../../CLAUDE.md) (note: its monorepo table names are stale — see above).
- **Milestones / progress:** [`../project-management/PROGRESS.md`](../project-management/PROGRESS.md) (live tracker).
- **Asana:** workspace `1194107417268910`, project `1210959953917909`. Sections — In Progress `1213652919039664`, Staged `1213652919039665`, Completed `1213652919039666`.
