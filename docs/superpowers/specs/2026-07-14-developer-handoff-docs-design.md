# Developer Handoff Documentation — Design

**Date:** 2026-07-14
**Author:** Priya Yadav (outgoing solo dev, RaftLabs)
**Audience of the deliverable:** the mid/senior RaftLabs developer who inherits CeolX
**Status:** Approved for planning

## Problem

Priya is leaving. The repo is already well-documented for *decisions* (`CLAUDE.md`,
`DESIGN.md`, `PRODUCT.md`, `docs/`). But ~6 months of hard-won *debugging knowledge*
lives in **73 local Claude memory files** under
`~/.claude/projects/-Users-priyayadav-Documents-Raftlabs-CeolX/memory/`. These are
**user-scoped, not in the repo**. When Priya's machine is wiped, that knowledge — the
"why it broke and how we fixed it" traps — vanishes. That is exactly the research the
next dev would otherwise have to repeat.

`CLAUDE.md` documents *what was decided*; the memory files document *what will bite you*.
The former can be re-derived from the PRD; the latter cannot.

## Goal

Extract the ephemeral, irreplaceable knowledge into the repo, plus wrap it with the
minimum surrounding context a new dev needs to be productive — assuming they are already
fluent in React Native / Expo / Hono / Drizzle. Document only what is **CeolX-specific or
genuinely non-obvious**; skip generic setup and generic framework usage.

## Non-goals

- No client-facing / business handoff (that is a separate audience, explicitly out of scope).
- No re-documenting decisions already well-covered in `CLAUDE.md` (link to it instead).
- No generic React Native / Hono / Drizzle tutorials.
- No changes to product code.

## Structure

A new `docs/handoff/` folder (chosen over one giant file or folding into `CLAUDE.md`).
Rationale: `CLAUDE.md` is loaded into agent context **every session** — 73 gotchas there
would inflate every prompt. Handoff knowledge must be *recall-on-relevance*, read when
needed, not always-on. A folder keeps each concern focused and jump-to-able.

```
docs/handoff/
  README.md            start-here index + 15-min orientation
  01-gotchas.md        the 73 traps, categorized (symptom -> cause -> fix -> file)
  02-project-state.md  milestones done / left, open items, flagged-for-next-dev
  03-ops-runbooks.md   EAS, Neon, Vercel, Typesense, envx, OTA — copy-pasteable
  04-architecture.md   where-things-live tour + key data flows & state machines
```

## Extraction method (quality-critical)

Content comes from the **full memory files**, not the index one-liners (which are lossy).

1. Read all 73 memory files in full.
2. Group into the categories below; merge duplicates and supersessions into one coherent
   entry (e.g. FCM PR #51 add + PR #55 revert -> single "FCM current status" entry).
3. Verify high-stakes claims (file paths, flags, config keys) against the **current**
   codebase via the code-review-graph before enshrining them. Memories reflect what was
   true when written and may be stale.
4. Any claim that cannot be verified is marked `⚠️ unverified as of 2026-07-14` rather than
   asserted. Stale-but-confident docs are worse than none.

## File contents

### README.md (start-here)
- One-paragraph "what is CeolX" (link to `PRODUCT.md` / `CLAUDE.md` for depth).
- Monorepo at a glance (`apps/native`, `apps/admin`, `apps/server`/api, `packages/shared`).
- "If you're doing X, read Y" routing table into the other four files.
- Non-negotiable rules: PR base is `development`; commitlint subject fully lowercase
  (incl. acronyms); never `StyleSheet.create` (Tailwind v4 + uniwind only); shared
  validators are the single source of truth; use the code-review-graph before Grep.
- Key people (Priya outgoing, Aravind = technical guidance only, Pratiksha = PM) and links
  (PRD, Asana workspace/project IDs, flow diagrams).

### 01-gotchas.md (core deliverable)
73 entries grouped into ~9 sections, each ordered by likelihood of biting:
- Auth & onboarding · Map & discovery · Media / posts / feed · Notifications & deep-linking
  · Events & bookings · Email · Builds & EAS · Deploy & infra · DB & data-modeling
- Entry format: **Symptom → Cause → Fix**, with the owning file path and any Asana ref.

### 02-project-state.md
- Milestone completion snapshot (sourced from `docs/project-management/`).
- Unfinished / half-built work and where to resume.
- The 6 open items from `CLAUDE.md` awaiting client input (owners noted).
- Items explicitly flagged for the next dev / Pratiksha (e.g. unused
  `ADDED_AS_COLLABORATOR_TO_ARTIST` trigger; email-matrix scope gap — 38 specced, 6 built).

### 03-ops-runbooks.md
Copy-pasteable procedures, each with its known traps inline:
- EAS build/submit (node-floor per profile; `--frozen-lockfile`; app-bundle not apk for Play).
- Neon: fresh DB = `push --force` on DIRECT endpoint + stamp migrations (not `migrate`);
  staging migrate CI action.
- Vercel: push staging/main to **both** remotes or Vercel won't trigger.
- Typesense: cloud in prod, docker only for dev; Feed/Map read Typesense not Neon.
- envx `.env.*.gpg` conflict resolution (re-encrypt plaintext, never merge ciphertext).
- OTA to staging: `APP_VARIANT=staging` + `EXPO_PUBLIC_SHARE_BASE_URL` both mandatory.

### 04-architecture.md
- `apps/*` + `packages/shared` layout and responsibilities.
- Shared validators & notification copy live in `@CeolX/shared` (source of truth).
- Event status lifecycle (`draft → active → archived`, `removed`, `pending_review`).
- Booking state machine (Pending → Accepted/Rejected → Cancelled).
- Discovery/Map data flow: reads from Typesense by geopoint, not Neon; coordless events
  at (0,0) vanish. Profile image lives in two columns (`user.image` vs `profileImageUrl`).

## Success criteria

- A RaftLabs dev, given only the repo, can find how to deploy, why a known thing breaks,
  what's left to build, and where code lives — without access to Priya's Claude memory.
- Every asserted file path / flag either verified against current code or marked unverified.
- Nothing duplicated that `CLAUDE.md` already covers well; cross-linked instead.
- Lives entirely in-repo and committed, so it survives the machine being wiped.
```
