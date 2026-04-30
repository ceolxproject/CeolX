# M9-T2 — Event Moderation Queue (Admin)

**Task file:** `docs/project-management/M9-Super-Admin/M9-T2-Event-Moderation-Queue-Admin.md`
**Asana task:** [1213823931758515](https://app.asana.com/1/1194107417268910/project/1209289934155843/task/1213823931758515)
**Branch:** `feature/m9-t2-event-moderation` (current worktree branch `worktree-admin-event-moderation` will be renamed — doesn't match `validate-branch-name` pattern)

---

## Context

The original M9-T2 task spec describes pre-publication moderation (`pending_review` → approve/reject). Per the MoM 3rd Apr 2026 (Section 4) decision and `CLAUDE.md`, CeolX migrated to **post-publication moderation**: events go live immediately and the Super Admin reviews live content, removing inappropriate events with a mandatory reason. Creators can edit and resubmit (REMOVED → ACTIVE).

The supporting infrastructure for the new model is already in place:

- `removeEventSchema` validator (`packages/shared/src/validators/events.ts:54`) — 10–500 char `removalReason`
- Notification triggers A-15/V-14 (event removed) and A-16/V-15 (event resubmitted) in `packages/shared/src/notifications/triggers.ts`
- Resubmit logic in `packages/api/src/routers/events/crud.ts:528-562` — when a creator updates a `REMOVED` event, status flips to `ACTIVE`, `removalReason` cleared, A-16/V-15 fires
- DB column `events.removalReason` (`packages/db/src/schema/events.ts`)
- `adminProcedure` middleware (`packages/api/src/index.ts:65`)

What's missing — **and what this task delivers**:

1. The admin router (`packages/api/src/routers/admin.ts`) still has the OLD pre-publication stubs (`pendingEvents`/`approveEvent`/`rejectEvent`) returning placeholders.
2. The admin UI route (`apps/admin/src/routes/_admin/events/pending.tsx`) is an empty placeholder with comment "data wired in M9".
3. The M9-T2 task doc still describes the old flow.

**Outcome:** Super Admin can browse all live events in the dashboard and remove any that violate policy, with a mandatory reason that is sent to the creator via push + in-app notification (A-15/V-14). The creator can then resubmit (already wired). The M9-T2 task doc is rewritten to match.

---

## Decisions (User-Confirmed in Phase 1)

| Decision         | Choice                                                  |
| ---------------- | ------------------------------------------------------- |
| Moderation model | Post-publication (matches PRD/CLAUDE.md)                |
| Route + nav      | `/events/moderation` + sidebar label "Event Moderation" |
| Task doc         | Update in this PR                                       |
| Asana            | Will comment + close on completion                      |

---

## Implementation Approach

### A. Shared validators (`packages/shared/src/validators/events.ts`)

Extend the existing file with two new admin-side schemas:

- **`adminEventListQuerySchema`** — query input for the list page
  - `status: z.enum(['active', 'removed', 'archived']).default('active')`
  - `persona: z.enum(['artist', 'venue']).optional()`
  - `q: z.string().max(100).optional()` — search by title (case-insensitive `ILIKE`)
  - `limit: z.number().int().min(1).max(50).default(20)`
  - `offset: z.number().int().min(0).default(0)`
- **`adminRemoveEventSchema`** — composes the existing `removeEventSchema`
  - `id: z.string().uuid()`
  - `removalReason: z.string().min(10).max(500)` (re-uses the rule from `removeEventSchema`)

Export both `*Input` types. Re-export from `packages/shared/src/validators/index.ts`.

### B. API router (`packages/api/src/routers/admin.ts`)

**Replace the file** (the 3 old stubs become dead code under the new model). New procedures, all `adminProcedure`:

- **`admin.listEvents` (query)** — input = `adminEventListQuerySchema`
  - Joins `events` → `users` (creator) and includes the creator's role (`artist`/`venue`) by reading `users.currentRole`
  - Filters by `status`, optional `persona` (creator role), optional `q` (title ILIKE)
  - Order by `createdAt DESC` (newest first per CLAUDE.md "sorted newest first")
  - Returns `{ events, total }`
  - Each `event` row: `{ id, title, coverImage, status, removalReason, createdAt, dateStart, lat, lng, venueAddress, creator: { id, name, persona } }`
- **`admin.removeEvent` (mutation)** — input = `adminRemoveEventSchema`
  - Reads the event; throws `NOT_FOUND` if missing or already `removed`/`archived`
  - Updates: `status = REMOVED`, `removalReason = input.removalReason`
  - Pushes A-15 (artist) or V-14 (venue) onto `pendingDispatches`, then dispatches via `ctx.dispatchNotification` (mirrors the post-commit pattern in `events/crud.ts:466`, `:760`)
  - Calls `removeEventFromTypesense(id).catch(() => {})` (same defensive pattern used in `crud.ts:756`)
  - Returns the updated event

> **Why one router file (not a sub-folder):** the existing `admin.ts` is already a single file. Splitting into `admin/events.ts` + `admin/index.ts` is a future refactor when the admin router grows. Out of scope.

### C. Admin app — route, page, sidebar (`apps/admin`)

**Files affected:**

| File                                                 | Change                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/admin/src/routes/_admin/events/pending.tsx`    | **Delete**                                                                                                 |
| `apps/admin/src/routes/_admin/events/moderation.tsx` | **Create** — main page                                                                                     |
| `apps/admin/src/routeTree.gen.ts`                    | Auto-regenerated by TanStack Router CLI                                                                    |
| `apps/admin/src/components/Sidebar.tsx`              | Update line 8: rename "Pending Events" → "Event Moderation"; path `/events/pending` → `/events/moderation` |
| `apps/admin/src/components/RemoveReasonDialog.tsx`   | **Create** — clone of `RejectReasonDialog` with copy + min-length validation (10 chars) tuned for removal  |

**Page composition (`moderation.tsx`):**

- Top: `PageHeader` with title "Event Moderation" + status filter dropdown (active / removed / archived) + persona filter (all / artists / venues) + search input
- Middle: shadcn `<Table>` (mirrors `users.tsx` directly — same project pattern, simpler than `DataTable<T>` for now)
  - Columns: Cover (32×32 thumb), Title, Creator + persona badge, Date, Location (truncated address), Status badge, Actions
  - Row click → opens an `<EventDetailDialog>` (modal, reuses shadcn `Dialog`) — shows full event details (cover, description, dateStart, location, creator, ticket link if present)
- Action button per row: **Remove** (red, destructive) → opens `<RemoveReasonDialog>`. On confirm: `mutate({ id, removalReason })` → on success, toast (Sonner) + invalidate `admin.listEvents` query
- For rows already `status = removed`: show "Removed" status pill, hide the Remove button (no-op)

**Why drop the mini-map:** the task spec lists it as "consider adding" / nice-to-have. CLAUDE.md doesn't list it. Skipping keeps scope tight; admin sees lat/lng + address as text, sufficient for V1 review. Can add later behind a feature flag.

**Why no badge count:** the original task spec assumed a queue (pending count). Under post-publication there's no queue — admin reviews ad-hoc. A "live events" count is not actionable. Drop the badge to avoid implying a backlog.

### D. Documentation (`docs/project-management/M9-Super-Admin/M9-T2-Event-Moderation-Queue-Admin.md`)

Rewrite to match the post-publication model:

- Description rewritten: "Super Admin reviews live events and removes inappropriate ones with a mandatory reason."
- tRPC procedure section updated: `admin.listEvents`, `admin.removeEvent`
- Requirements/Acceptance Criteria rewritten around the new flow (status filter, removal reason min-10, A-15/V-14 firing, list refresh after removal, etc.)
- Reference the MoM 3rd Apr 2026 (Section 4) decision so future readers don't hit the same drift

---

## Critical Files

| File                                                                           | Role                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `packages/shared/src/validators/events.ts:54`                                  | Existing `removeEventSchema` to reuse + extend                                             |
| `packages/shared/src/validators/index.ts`                                      | Re-export new schemas                                                                      |
| `packages/shared/src/notifications/triggers.ts:268,285`                        | A-15/V-14 trigger definitions to wire in                                                   |
| `packages/api/src/routers/admin.ts`                                            | Whole file rewrite                                                                         |
| `packages/api/src/routers/events/crud.ts:236,466,506,547,760`                  | Reference for dispatch + Typesense pattern                                                 |
| `packages/api/src/services/event-sync.ts`                                      | `removeEventFromTypesense` to call on removal                                              |
| `packages/api/src/index.ts:65`                                                 | `adminProcedure` already exported                                                          |
| `apps/admin/src/routes/_admin/events/pending.tsx`                              | Delete                                                                                     |
| `apps/admin/src/routes/_admin/events/moderation.tsx`                           | Create                                                                                     |
| `apps/admin/src/components/Sidebar.tsx:8`                                      | Update nav item                                                                            |
| `apps/admin/src/components/RejectReasonDialog.tsx`                             | Reference pattern for new RemoveReasonDialog                                               |
| `apps/admin/src/components/RemoveReasonDialog.tsx`                             | New (10-char min validation, "Remove" copy)                                                |
| `apps/admin/src/utils/trpc.ts`                                                 | Existing tRPC client + react-query — same `.queryOptions()` / `.mutationOptions()` pattern |
| `docs/project-management/M9-Super-Admin/M9-T2-Event-Moderation-Queue-Admin.md` | Rewrite                                                                                    |

---

## Build Sequence (TDD)

1. **Validators (shared)** — write tests for `adminEventListQuerySchema` + `adminRemoveEventSchema`, then implement, then re-export
2. **API: `admin.listEvents`** — tests (filters, pagination, sorting, RBAC reject for non-admin) → implement
3. **API: `admin.removeEvent`** — tests (success, NOT_FOUND, BAD_REQUEST short reason, A-15/V-14 dispatched, Typesense removed, idempotent for already-removed) → implement
4. **Admin: `RemoveReasonDialog` component** — test (renders, validates min-10 reason, calls onConfirm) → implement
5. **Admin: `moderation.tsx` page** — test (renders list, opens dialog, calls mutation, invalidates) → implement
6. **Sidebar update** — small test that nav contains "Event Moderation" → implement
7. **Doc rewrite** (no test)
8. **Manual UI verification (Phase 6b)** — Playwright walkthrough

---

## Verification Plan

**Static:** `pnpm lint`, `pnpm check-types`, `pnpm test:coverage` (must stay ≥ existing threshold — confirm during Phase 6), `pnpm build`.

**Backend acceptance:**

- Non-admin call to `admin.removeEvent` → `FORBIDDEN`
- `admin.removeEvent` with reason of 9 chars → Zod `BAD_REQUEST`
- `admin.removeEvent` on a non-existent id → `NOT_FOUND`
- `admin.removeEvent` on an `active` event → status flips to `REMOVED`, `removalReason` set, A-15 (artist creator) or V-14 (venue creator) row appears in the `notifications` join, Typesense doc removed
- `admin.listEvents({ status: 'active' })` returns the just-removed event when caller filters by `removed`, not when filtering by `active`
- After admin removal, when the creator calls `events.update` to edit & save, status flips back to `ACTIVE` and A-16/V-15 fires (already shipped — re-verify it still works end-to-end)

**UI acceptance (Playwright — Phase 6b):**

- Sidebar shows "Event Moderation" linking to `/events/moderation`
- Active events list renders with cover, title, creator + persona, date, address, Remove button
- Status filter switches the list contents
- Remove button opens dialog; submit disabled until ≥ 10 chars typed
- Submitting removal: row vanishes from `active` list, toast appears
- Switching status filter to "Removed" shows the removed event with its `removalReason` displayed

---

## Risks & Mitigations

| Risk                                                                  | Mitigation                                                                                                                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typesense disabled in dev — `removeEventFromTypesense` may throw      | Wrap with `.catch(() => {})` exactly like `crud.ts:756` does today                                                                                                                           |
| Notification dispatch failure shouldn't block removal                 | Use the same pattern: build `pendingDispatches[]`, dispatch _after_ DB commit, ignore individual dispatch errors per the existing pattern                                                    |
| Removing an event a creator is currently editing → stale UI on mobile | Out of scope — covered by the existing resubmit flow (creator's update will hit a fresh row); add to "future hardening" list, not this PR                                                    |
| Branch rename mid-worktree                                            | The current worktree branch `worktree-admin-event-moderation` doesn't match `validate-branch-name`. Rename via `git branch -m` to `feature/m9-t2-event-moderation` before any push (Phase 3) |
| Coverage threshold drift                                              | Verify with `pnpm test:coverage` before PR; if any new file dips coverage, add tests for the gap                                                                                             |

---

## Out of Scope (Explicit Non-Goals)

- Removed-event review queue prioritization / sorting beyond newest-first
- Bulk remove / multi-select
- Moderation history audit log table (could be a separate task; existing `removalReason` on the event is sufficient evidence)
- Embedded mini-map on the detail view (PRD says "consider")
- Event detail as a separate route (modal is enough; full route is more churn for the same outcome)
- Touching the deprecated `pending_review`/`rejected` enum values in the schema — they remain in the enum for compat, just unused
- Sidebar badge count (post-publication has no queue)

---

## Research Log

| Question                                           | Source                                                                               | Finding                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- |
| Does `removeEventSchema` exist for admin removal?  | `packages/shared/src/validators/events.ts:54`                                        | Yes — 10–500 char `removalReason`. Reuse rule for new `adminRemoveEventSchema`.                                                                                                                                                                                                                                                 |
| Are A-15/V-14/A-16/V-15 triggers wired?            | `packages/shared/src/notifications/triggers.ts:43-46,268,285,301,317`                | All four exist with title/body builders requiring `eventId`, `eventTitle`, `reason` (removal triggers only).                                                                                                                                                                                                                    |
| How are notifications dispatched in events router? | `packages/api/src/routers/events/crud.ts:236,466,506,547,760`                        | Pattern: build `pendingDispatches[]` inside the procedure, then `await Promise.all(pendingDispatches.map((d) => ctx.dispatchNotification(d)))` AFTER the DB transaction. Mirror this.                                                                                                                                           |
| Is resubmit logic already wired?                   | `packages/api/src/routers/events/crud.ts:528-562` (commit `4927c6b`)                 | Yes — `events.update` detects `REMOVED → ACTIVE`, clears `removalReason`, fires A-16/V-15. No work needed for resubmit.                                                                                                                                                                                                         |
| Does Typesense handle event removal?               | `packages/api/src/routers/events/crud.ts:756,793` via `services/event-sync.ts`       | `removeEventFromTypesense(id).catch(() => {})` — call on admin remove.                                                                                                                                                                                                                                                          |
| What's the admin app's tRPC pattern?               | `apps/admin/src/utils/trpc.ts` + `dashboard.tsx:56`, `users.tsx`                     | `useQuery(trpc.x.queryOptions())` for queries; for mutations, use `useMutation(trpc.x.mutationOptions(...))` (standard `@trpc/tanstack-react-query` proxy). New code in this PR is the first place `useMutation` will appear in admin — verify the proxy supports `mutationOptions` (it does per `createTRPCOptionsProxy` API). |
| Existing dialog/table patterns?                    | `apps/admin/src/components/RejectReasonDialog.tsx`, `ConfirmDialog.tsx`, `users.tsx` | Solid patterns to clone — RejectReasonDialog is structurally identical to what we need for RemoveReasonDialog (just copy + 10-char minimum).                                                                                                                                                                                    |
| Branch-name validator pattern                      | `package.json` `validate-branch-name.pattern`                                        | `^(feature                                                                                                                                                                                                                                                                                                                      | fix | ...)\/[a-z0-9._-]+$`. Current worktree branch is non-compliant; rename in Phase 3. |
| Commitlint config                                  | `commitlint.config.js` (memory-confirmed)                                            | Subject must be fully lowercase incl. acronyms (e.g. `m9-t2` not `M9-T2`). PR base is `development`, not `main`.                                                                                                                                                                                                                |

---

## Notes for Phase 3+

- **Branch rename**: `git branch -m feature/m9-t2-event-moderation` from this worktree, then `git push -u origin feature/m9-t2-event-moderation` at PR time
- **Plan persistence**: this plan was written to `~/.claude/plans/temporal-scribbling-dijkstra.md` (harness override of the dev-skill default). On Phase 3 entry, copy/symlink to `docs/plans/2026-04-30-m9-t2-event-moderation-plan.md` so the dev skill's session resume path works
- **Session file**: create `docs/plans/.dev-session.json` after plan approval — include the Asana GID `1213823931758515`, branch name, and 7 acceptance criteria mapped from the rewritten task doc
