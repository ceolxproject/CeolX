# Developer Handoff Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the irreplaceable, high-impact tribal knowledge from Priya's 73 local Claude memory files into a committed `docs/handoff/` folder so the next RaftLabs developer inherits it with the repo.

**Architecture:** A new `docs/handoff/` folder with a start-here index and four focused files (gotchas, project state, ops runbooks, architecture). Content is sourced from the full memory files (not the lossy index), filtered to high-impact traps, and every asserted file path / flag is verified against the current codebase before it lands. Unverifiable claims are marked, not asserted.

**Tech Stack:** Markdown only. Sources: memory files at `~/.claude/projects/-Users-priyayadav-Documents-Raftlabs-CeolX/memory/`, the repo itself, `CLAUDE.md`, `docs/project-management/`. Verification via the code-review-graph MCP tools (fall back to Grep/Read).

## Global Constraints

- **Audience:** mid/senior RaftLabs dev, fluent in RN/Expo/Hono/Drizzle. Document only CeolX-specific or non-obvious things. No generic framework tutorials.
- **High-impact traps only** — NOT all 73. Include an entry only if it blocks a build/deploy/release, causes silent data loss / wrong-data, is a platform trap that costs a fluent dev a day, or encodes a non-obvious architectural rule. Omit everything else.
- **Verify before asserting.** Any file path, flag, or config key must be checked against the current repo. Unverifiable claims get `⚠️ unverified as of 2026-07-14`.
- **No context bloat in CLAUDE.md** — handoff content lives in `docs/handoff/`, never folded into `CLAUDE.md`. Cross-link to `CLAUDE.md` instead of duplicating decisions.
- **Commits:** `docs:` type, subject fully lowercase (commitlint rule). Work happens on the existing `docs/developer-handoff` branch. Do not push or open a PR unless asked.
- **Gotcha entry format:** `**Symptom → Cause → Fix**`, ending with the owning file path and any Asana ref.

---

### Task 1: Triage the memory files into the high-impact set

**Files:**
- Create: `docs/handoff/.triage.md` (scratch working file — deleted in Task 6)

**Interfaces:**
- Produces: `.triage.md` — a categorized list of the selected high-impact memory entries. Each line: `[category] slug — one-line symptom — source memory filename`. Tasks 2–5 consume this to know which entries belong in their file. Categories: `gotcha-auth`, `gotcha-map`, `gotcha-media`, `gotcha-notif`, `gotcha-events`, `gotcha-email`, `gotcha-build`, `gotcha-deploy`, `gotcha-db`, `state`, `runbook`, `arch`.

- [ ] **Step 1: List every memory file**

Run: `ls -1 /Users/priyayadav/.claude/projects/-Users-priyayadav-Documents-Raftlabs-CeolX/memory/`
Expected: ~73 `.md` files plus `MEMORY.md`.

- [ ] **Step 2: Read the memory files in full**

Read each `*.md` (skip `MEMORY.md`, that's just the index). Do not rely on the index one-liners — read the body of each file for the real detail.

- [ ] **Step 3: Apply the selection test and write the triage list**

For each memory, keep it ONLY if at least one is true: blocks a build/deploy/release; causes silent data loss or wrong-data; is a platform trap costing a fluent dev a day; encodes a non-obvious architectural rule. Drop personal prefs (`user_calls_me_butter`), pure process reminders already in commitlint/CLAUDE.md (`feedback_branch_name_pattern`, `feedback_check_commitlint_before_commit`, `feedback_pr_base_is_development` — these instead get one line in the README rules table, not a gotcha entry), and superseded notes (merge, don't list twice).

Write `docs/handoff/.triage.md` grouping surviving slugs by category. Mark which map to Task 2 (gotcha-*), Task 3 (state), Task 4 (runbook), Task 5 (arch). Some memories feed more than one file (e.g. `discovery_map_read_from_typesense` → both a gotcha and an arch data-flow); note both.

- [ ] **Step 4: Commit**

```bash
git add docs/handoff/.triage.md
git commit -m "docs: triage handoff memory files into high-impact set"
```

---

### Task 2: Write 01-gotchas.md

**Files:**
- Create: `docs/handoff/01-gotchas.md`
- Read: `docs/handoff/.triage.md` (from Task 1), the `gotcha-*` memory files it names

**Interfaces:**
- Consumes: the `gotcha-*` lines from `.triage.md`.
- Produces: `docs/handoff/01-gotchas.md` with H2 sections per non-empty category (Auth & onboarding, Map & discovery, Media/posts/feed, Notifications & deep-linking, Events & bookings, Email, Builds & EAS, Deploy & infra, DB & data-modeling). README (Task 6) links to these H2 anchors.

- [ ] **Step 1: Draft entries from the selected memories**

For each selected gotcha, write one entry in the format:
```markdown
### <short title>
**Symptom:** what the dev observes going wrong.
**Cause:** the underlying reason.
**Fix:** the resolution / the rule to follow.
`path/to/owning/file.ts` · Asana <id if any>
```
Order entries within each section by likelihood of biting (build/deploy blockers and data-loss first).

- [ ] **Step 2: Verify every asserted path and flag against the current repo**

For each entry that names a file path, symbol, or config flag, confirm it still exists:
Run (example): `semantic_search_nodes_tool("mergePaginatedEvents")` or `query_graph_tool(pattern="file_summary", node="<path>")`; fall back to Read/Grep.
Any path/flag that no longer resolves: either correct it to the current name or append `⚠️ unverified as of 2026-07-14`. Never assert a stale path.

- [ ] **Step 3: Verify no placeholders remain**

Run: `grep -nE "TODO|TBD|FIXME|fill in|XXX" docs/handoff/01-gotchas.md`
Expected: no output (empty).

- [ ] **Step 4: Commit**

```bash
git add docs/handoff/01-gotchas.md
git commit -m "docs: add high-impact gotchas catalogue to handoff"
```

---

### Task 3: Write 02-project-state.md

**Files:**
- Create: `docs/handoff/02-project-state.md`
- Read: `docs/handoff/.triage.md`, `docs/project-management/PROGRESS.md`, `docs/project-management/CeolX_Milestones.md`, `CLAUDE.md` (Open Items table), the `state`-tagged memories

**Interfaces:**
- Consumes: `state` lines from `.triage.md`; milestone/progress docs.
- Produces: `docs/handoff/02-project-state.md` with sections: `Milestone status`, `Unfinished / half-built`, `Open items awaiting client input`, `Flagged for the next dev`.

- [ ] **Step 1: Summarize milestone completion**

Read `docs/project-management/PROGRESS.md` and `CeolX_Milestones.md`. Write a compact table: milestone → status (done / in-progress / not started) → one-line note. Do not restate task-level detail already in those files; link to them.

- [ ] **Step 2: List unfinished / flagged work**

Pull the "flagged for next dev / Pratiksha" items from CLAUDE.md and the memories: e.g. unused `ADDED_AS_COLLABORATOR_TO_ARTIST` notification trigger (kept in shared, flag for Pratiksha); email-matrix scope gap (38 specced, 6 built — `project_email_matrix_scope_gap`); `is_gig_opportunity` deprecated. One line each: what, where, why it's open.

- [ ] **Step 3: Copy the 6 open items awaiting client input**

From CLAUDE.md's "Open Items" table — reproduce the 6 rows (item + owner) so the next dev knows what's blocked on the client, not on them.

- [ ] **Step 4: Verify and commit**

Run: `grep -nE "TODO|TBD|FIXME|fill in|XXX" docs/handoff/02-project-state.md`
Expected: no output.
```bash
git add docs/handoff/02-project-state.md
git commit -m "docs: add project state and open items to handoff"
```

---

### Task 4: Write 03-ops-runbooks.md

**Files:**
- Create: `docs/handoff/03-ops-runbooks.md`
- Read: `docs/handoff/.triage.md`, the `runbook`-tagged memories, `docs/plans/staging-deployment-guide.md`, `docs/ops/`, `eas.json`, `.github/workflows/`, `docker-compose.yml`, `.envxrc`

**Interfaces:**
- Consumes: `runbook` lines from `.triage.md`; existing ops docs.
- Produces: `docs/handoff/03-ops-runbooks.md` with one H2 per procedure: EAS build/submit, Neon migrate, Vercel deploy, Typesense, envx `.gpg`, OTA to staging.

- [ ] **Step 1: Draft each runbook with traps inline**

For each procedure write: the copy-pasteable command sequence, then a **Traps** callout listing the memory-sourced gotchas for that op. Cover at minimum:
- **EAS build/submit:** node floor per profile (`project_eas_node_version_pnpm_floor`), `--frozen-lockfile` (`feedback_pnpm_install_after_lockfile_change`), app-bundle not apk for Play (`project_staging_android_apk_buildtype`), EAS ignores local `.env` (`project_eas_env_loading`).
- **Neon:** fresh DB = `push --force` on DIRECT endpoint + stamp migrations, not `migrate` (`project_neon_fresh_db_push_not_migrate`); staging migrate CI action (`project_db_migrate_ci_neon_staging`).
- **Vercel:** push to BOTH remotes or no trigger (`project_vercel_watches_client_remote`); Hono `export default app` not `handle()` (`feedback_hono_vercel_export_pattern`).
- **Typesense:** cloud in prod, docker dev-only (`project_typesense_cloud_in_prod`).
- **envx `.gpg`:** re-encrypt plaintext, never merge ciphertext (`project_envx_gpg_merge_conflict`).
- **OTA to staging:** `APP_VARIANT=staging` + `EXPO_PUBLIC_SHARE_BASE_URL` both mandatory for fingerprint match (`project_eas_update_ota_staging`).

- [ ] **Step 2: Verify commands and env-var names against the repo**

Cross-check each command/flag against `eas.json`, `package.json` scripts, `.github/workflows/`, and `.envxrc`. Correct any drift or mark `⚠️ unverified as of 2026-07-14`.

- [ ] **Step 3: Verify and commit**

Run: `grep -nE "TODO|TBD|FIXME|fill in|XXX" docs/handoff/03-ops-runbooks.md`
Expected: no output.
```bash
git add docs/handoff/03-ops-runbooks.md
git commit -m "docs: add ops runbooks to handoff"
```

---

### Task 5: Write 04-architecture.md

**Files:**
- Create: `docs/handoff/04-architecture.md`
- Read: `docs/handoff/.triage.md`, the `arch`-tagged memories, `apps/`, `packages/shared/`, `CLAUDE.md`

**Interfaces:**
- Consumes: `arch` lines from `.triage.md`.
- Produces: `docs/handoff/04-architecture.md` with sections: `Monorepo layout`, `Source-of-truth rules`, `Event lifecycle`, `Booking state machine`, `Key data flows`.

- [ ] **Step 1: Confirm the real on-disk app names**

Run: `ls apps/ packages/` — CLAUDE.md says `apps/mobile`/`apps/api` but memories reference `apps/native`/`apps/server`. Use whatever is actually on disk, and note the discrepancy so the README can flag it.

- [ ] **Step 2: Write the where-things-live tour**

Cover: the `apps/*` + `packages/shared` responsibilities; shared validators & notification copy as source of truth (`feedback_notification_copy_in_shared`, CLAUDE.md validation architecture); event status lifecycle (`draft → active → archived`, `removed`, `pending_review` — from `project_archived_status_means_deleted` + CLAUDE.md); booking state machine (Pending → Accepted/Rejected → Cancelled); discovery/map reads from Typesense by geopoint not Neon, coordless events at (0,0) vanish (`project_discovery_map_read_from_typesense`, `project_discovery_search_is_global`); two profile-image columns `user.image` vs `profileImageUrl` (`project_profile_image_two_columns`); notification schema split (`project_notification_schema_split`).

- [ ] **Step 3: Verify and commit**

Run: `grep -nE "TODO|TBD|FIXME|fill in|XXX" docs/handoff/04-architecture.md`
Expected: no output.
```bash
git add docs/handoff/04-architecture.md
git commit -m "docs: add architecture and data-flow map to handoff"
```

---

### Task 6: Write README.md index + final cross-link pass + cleanup

**Files:**
- Create: `docs/handoff/README.md`
- Delete: `docs/handoff/.triage.md`
- Read: the four files from Tasks 2–5

**Interfaces:**
- Consumes: the finalized `01`–`04` files (their H2 anchors) so routing links resolve.
- Produces: `docs/handoff/README.md` — the entry point.

- [ ] **Step 1: Write the start-here index**

Include: one-paragraph "what is CeolX" (link to `PRODUCT.md`/`CLAUDE.md`); monorepo-at-a-glance using the real app names from Task 5 Step 1; an "If you're doing X, read Y" routing table linking into `01`–`04`; a non-negotiable rules table (PR base `development`; commitlint fully-lowercase subject; never `StyleSheet.create`; shared validators = source of truth; use code-review-graph before Grep); key people (Priya outgoing; Aravind = technical guidance only per `feedback_aravind_not_boss`; Pratiksha = PM per `project_pratiksha_is_pm`) and links (PRD path, Asana IDs from CLAUDE.md).

- [ ] **Step 2: Verify all cross-links resolve**

For every relative link `docs/handoff/<file>#<anchor>` in the README, confirm the target file exists and the heading produces that anchor.
Run: `ls docs/handoff/` (expect `README.md 01-gotchas.md 02-project-state.md 03-ops-runbooks.md 04-architecture.md`).
Run: `grep -nE "TODO|TBD|FIXME|fill in|XXX" docs/handoff/*.md`
Expected: no output.

- [ ] **Step 3: Remove the scratch triage file**

Run: `git rm docs/handoff/.triage.md`

- [ ] **Step 4: Commit**

```bash
git add docs/handoff/README.md
git commit -m "docs: add handoff index and remove triage scratch file"
```

---

## Self-Review

- **Spec coverage:** README (Task 6), 01-gotchas high-impact-only (Tasks 1–2), 02-project-state (Task 3), 03-ops-runbooks (Task 4), 04-architecture (Task 5), extraction method incl. verification (Task 1 read + per-file verify steps), selection test (Task 1 Step 3 + Global Constraints), CLAUDE.md-no-bloat (Global Constraints) — all mapped.
- **Placeholder scan:** the plan's own grep steps enforce no `TODO/TBD` in the *output*; the plan text itself contains none.
- **Type/name consistency:** category tags in Task 1's Interfaces (`gotcha-*`, `state`, `runbook`, `arch`) match the Consumes clauses in Tasks 2–5; output filenames consistent across Tasks 2–6 and the README routing table.
