---
name: dev
description: >-
  Task-driven development workflow with session persistence and milestone
  support. Reads task specs, auto-enters plan mode for research/planning,
  persists workflow state across mode switches, builds with TDD, commits
  incrementally, verifies (including Playwright UI testing for web tasks),
  and creates PR. Supports single tasks, milestone directories, Ralph Loop
  iteration, and human handoff for non-automatable actions. Invoke:
  /dev @path/to/task.md [instructions],
  /dev @path/to/milestone/ [instructions]
---

# Task-Driven Development Workflow

## Overview

This skill orchestrates a complete development cycle for task specification files from `docs/project-management/`. It drives 7+ phases from task review through PR creation, automatically invoking relevant domain skills and enforcing project conventions. For UI tasks, it includes Playwright-based browser verification (Phase 6b). It is Ralph Loop-aware and supports human handoff for non-automatable actions.

**Supports:**

- Single task files
- Milestone directories (auto-continues through all tasks — each gets full Phase 1-7b workflow)
- Optional custom instructions appended to any invocation
- Session persistence across plan mode switches and re-invocations

**Output:** A PR on GitHub with all acceptance criteria met, tests passing, UI verified (for web tasks), and commits following project conventions.

---

## Input Parsing

Parse the `/dev` invocation to determine mode and extract arguments.

### Invocation Patterns

| Pattern                   | Example                                                                    | Mode      |
| ------------------------- | -------------------------------------------------------------------------- | --------- |
| Single task               | `/dev @docs/project-management/05-courses/course-api.md`                   | single    |
| Single task + instruct.   | `/dev @docs/project-management/05-courses/course-api.md Skip auth for now` | single    |
| Milestone directory       | `/dev @docs/project-management/05-courses/`                                | milestone |
| Milestone dir + instruct. | `/dev @docs/project-management/05-courses/ Focus on API first`             | milestone |

### Parsing Rules

1. **Extract path** — first argument is the `@`-prefixed path:
   - Ends with `.md` → **single-task mode** — set `mode = "single"`, `taskFile = path`
   - Ends with `/` or is a directory → **milestone mode** — set `mode = "milestone"`, `milestoneDir = path`
2. **Extract custom instructions** — everything after the path = `customInstructions` string (may be empty)
3. **Milestone task queue** — in milestone mode:
   - List all `.md` files in the directory
   - Exclude `SUMMARY.md`, `README.md`, and any non-task files
   - Sort by filename (numeric prefix ensures correct order: `01-*.md`, `02-*.md`, etc.)
   - Cross-reference with `docs/project-management/PROGRESS.md` — skip tasks already marked `[x]`
   - Present the remaining task queue to the user for confirmation:

     ```
     ## Milestone: 05 — Course Management
     ## Tasks: 3 remaining of 8 total

     | # | Task File                    | Status      |
     |---|------------------------------|-------------|
     | 4 | course-enrollment-api.md     | Next        |
     | 5 | course-progress-tracking.md  | Pending     |
     | 6 | course-completion-api.md     | Pending     |

     Tasks 1-3 already completed. Proceed with task 4?
     ```

   - Wait for user confirmation before starting
   - Once confirmed, the workflow runs continuously through all remaining tasks — each task gets the full Phase 1-7b treatment (research, plan, branch, TDD, commits, verify, PR). The user does not need to re-invoke `/dev` between tasks.

### Validation

- If the path doesn't exist, inform the user and abort
- If a milestone directory has no remaining tasks, inform the user and abort
- If no path is provided, ask the user for one

---

## Auto Plan Mode

The `/dev` skill automatically enters plan mode for Phases 1-2 (research-only phases where no code is written).

### Protocol

1. **On `/dev` invocation**, check if currently in plan mode:
   - **Not in plan mode** → call `EnterPlanMode` tool immediately, before any other action
   - **Already in plan mode** → proceed directly to Phase 1
2. **Plan mode stays active** through Phase 1 (Task Review) and Phase 2 (Research & Planning)
   - These phases are read-only: file reading, codebase exploration, research, and planning only
3. **After Phase 2 plan approval** → call `ExitPlanMode` to transition to implementation (Phases 3-7)
4. **Fallback** — if `EnterPlanMode` tool is unavailable or errors, instruct the user: "Please type `/plan` to enter plan mode, then re-invoke `/dev`"

<HARD-GATE>
NEVER write implementation code while in plan mode. Phases 1-2 are research and planning only. Exit plan mode before Phase 3.
</HARD-GATE>

---

## Session State

Workflow state persists across plan mode switches, re-invocations, and conversation context loss via a session file.

### Session File

**Path:** `docs/plans/.dev-session.json`
**Gitignored:** Yes (see `.gitignore` entry — never commit this file)

### Schema

```json
{
  "version": 2,
  "startedAt": "2026-02-23T10:00:00Z",
  "updatedAt": "2026-02-23T12:30:00Z",
  "mode": "single",
  "customInstructions": ["Skip auth for now", "Use zod for all validation"],
  "milestone": {
    "directory": "docs/project-management/05-courses/",
    "totalTasks": 8,
    "completedTasks": ["01-course-schema.md", "02-course-crud.md"],
    "currentTaskIndex": 2
  },
  "currentTask": {
    "file": "docs/project-management/05-courses/03-course-enrollment.md",
    "title": "Course Enrollment API",
    "slug": "course-enrollment",
    "milestoneNumber": "05"
  },
  "branch": "feature/05-course-enrollment",
  "asana": {
    "taskGid": "1213333716632887",
    "taskUrl": "https://app.asana.com/0/1213125604020506/1213333716632887",
    "commentPosted": false,
    "markedComplete": false
  },
  "planFile": "docs/plans/2026-02-23-course-enrollment-plan.md",
  "phases": {
    "phase1": "completed",
    "phase2": "completed",
    "phase3": "completed",
    "phase4": "in_progress",
    "phase5": "in_progress",
    "phase6": "pending",
    "phase6b": "pending",
    "phase7": "pending",
    "phase7b": "pending"
  },
  "ralphLoop": {
    "detected": false,
    "iterationOnStart": 0,
    "completionPromise": ""
  },
  "acceptanceCriteria": [
    {
      "id": 1,
      "text": "POST /enroll creates enrollment record",
      "status": "done",
      "evidence": "packages/api/src/routers/enrollment.ts:42",
      "uiEvidence": ""
    },
    {
      "id": 2,
      "text": "Duplicate enrollment returns 409",
      "status": "not_started",
      "evidence": "",
      "uiEvidence": ""
    }
  ]
}
```

**Notes on v2 schema changes:**

- `phase6b` added — tracks UI verification phase status (`"pending"`, `"in_progress"`, `"completed"`, `"skipped"`)
- `ralphLoop` object added — tracks Ralph Loop detection state (only populated when `.claude/ralph-loop.local.md` exists)
- `uiEvidence` field added to each acceptance criterion — stores screenshot path or UI verification notes (empty for non-UI criteria)
- `asana` object added — tracks Asana task link and update status. `null` when user skips providing a link.
  - `taskGid` — extracted numeric GID for MCP calls
  - `taskUrl` — original URL for display
  - `commentPosted` / `markedComplete` — idempotency flags (prevent duplicates on Ralph Loop iterations or session resumes)

### Asana URL Parsing

Extract the task GID (last numeric path segment before query params) from the user-provided URL. Supported formats:

- `https://app.asana.com/1/<workspace>/project/<project>/task/<taskGid>?...` → extract `<taskGid>`
- `https://app.asana.com/0/<project>/<taskGid>` → extract `<taskGid>`
- Plain numeric GID (e.g., `1213333716632887`) → use as-is

### Lifecycle

1. **On `/dev` invocation** → check for existing session file at `docs/plans/.dev-session.json`:
   - **Exists** → **Resume flow:**
     - Read and parse the session file
     - Present current state to the user:

       ```
       ## Resuming Dev Session
       Task: Course Enrollment API (05-courses/03-course-enrollment.md)
       Branch: feature/05-course-enrollment
       Phase: 4 — TDD Implementation (in progress)
       Criteria: 3 of 7 done
       Custom instructions: "Skip auth for now"

       Continue from current phase, or start fresh?
       ```

     - If user confirms → continue from the stored phase
     - If user wants fresh start → delete session file, proceed as new session

   - **Exists but re-invoked with a different path** → ask user:
     - "Active session for [current task]. Abandon it and start [new task], or continue current?"
   - **Not exists** → **New session:** parse input, proceed to Phase 1

2. **Custom instructions append** — when the user provides new instructions mid-session (re-invocation with extra text, or instructions given after plan mode switch):
   - APPEND to the `customInstructions` array — never replace
   - All accumulated instructions remain visible and active throughout the workflow

3. **Session updates** — update the session file at:
   - Phase transitions (when a phase status changes)
   - After each acceptance criterion status change
   - When custom instructions are added

4. **Session creation** — create the session file after Phase 2 approval (this is the checkpoint that ensures workflow survives mode switches). Before Phase 2, use in-memory state only.

5. **Session deletion** — delete the session file after Phase 7b completes successfully (task fully done).

6. **Milestone transitions** — in milestone mode, after Phase 7b for a task:
   - Add current task to `milestone.completedTasks`
   - Increment `milestone.currentTaskIndex`
   - Reset all phase statuses to `"pending"`
   - Re-enter plan mode for the next task, then **immediately begin Phase 1 for that task** — do NOT stop or wait for a new `/dev` invocation. The milestone workflow is a continuous pipeline.
   - Continue until all milestone tasks are complete, then delete session

<HARD-GATE>
NEVER proceed past Phase 2 without saving session state. The session file is the checkpoint that preserves workflow across mode switches.
</HARD-GATE>

<HARD-GATE>
NEVER commit `.dev-session.json` to git. This file is gitignored and must remain local-only.
</HARD-GATE>

---

## Ralph Loop Awareness

The Ralph Loop plugin (`ralph-loop`) creates a self-referential iteration loop where `/dev` is re-invoked with the same prompt until all acceptance criteria are met. When active, `/dev` must adapt its behavior for idempotency, auto-proceed, and completion signaling.

### Detection

On every `/dev` invocation, check for the Ralph Loop state file:

```bash
# Check if Ralph Loop is active
cat .claude/ralph-loop.local.md 2>/dev/null
```

If the file exists, parse the YAML frontmatter to extract:

- `iteration` — current iteration number
- `max_iterations` — iteration limit (0 = unlimited)
- `completion_promise` — the exact text to emit in `<promise>` tags when done

Update the session file with Ralph Loop state:

```json
{
  "ralphLoop": {
    "detected": true,
    "iterationOnStart": 5,
    "completionPromise": "ALL_CRITERIA_MET"
  }
}
```

### Iteration Logging

At the start of each iteration (when Ralph Loop is detected), log the current state:

```
## 🔄 Ralph Loop — Iteration 5
Phase: 4 — TDD Implementation (in progress)
Criteria: 3 of 7 done (2 remaining, 2 needs_human)
Branch: feature/05-course-enrollment (exists)
PR: not yet created
```

### Idempotency Guards

When Ralph Loop is active, every state-changing action must be guarded against duplication:

| Action             | Guard                         | Command                                                                                  |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Branch creation    | Check if branch exists        | `git branch --show-current` — if already on correct branch, skip                         |
| PR creation        | Check if PR exists for branch | `gh pr list --head <branch> --json number,url` — if PR exists, skip and use existing URL |
| PROGRESS.md update | Check if already marked       | Read file, check if `[x]` already present for this task                                  |
| Commits            | Check for changes             | `git status --short` — if no changes, skip commit                                        |
| Plan mode entry    | Check current phase           | If phases 1-2 already `"completed"` in session, skip plan mode entirely                  |
| Session file       | Check if exists               | If session exists with current task, resume instead of recreate                          |
| Asana comment      | Check session flag            | If `asana.commentPosted` is `true`, skip                                                 |
| Asana completion   | Check session flag            | If `asana.markedComplete` is `true`, skip                                                |

### Auto-Proceed Behavior

When Ralph Loop is active, **skip all interactive confirmations** to avoid blocking the loop:

- **Plan approval** — auto-approve if plan already exists and was approved in a prior iteration
- **Branch name confirmation** — use the session's stored branch name without asking
- **Commit message confirmation** — generate and commit without asking
- **PR body confirmation** — use the standard template without asking

**Exception:** Human handoff actions (Phase 6b) are NEVER auto-approved. See Human Handoff Protocol.

### Completion Promise

The Ralph Loop ends when the assistant outputs `<promise>COMPLETION_TEXT</promise>` where `COMPLETION_TEXT` exactly matches the `completion_promise` from the state file.

**When to emit the promise:**

1. ALL acceptance criteria have status `"done"` (or `"needs_human"` for items requiring human action)
2. Full verification suite has passed (lint, types, tests, build)
3. UI verification has passed or been skipped (Phase 6b)
4. PR has been created (or already exists)
5. PROGRESS.md has been updated

**Emit procedure:**

```
All acceptance criteria met. PR created: <PR_URL>

<promise>COMPLETION_TEXT</promise>
```

<HARD-GATE>
NEVER emit a Ralph Loop completion promise (`<promise>` tag) unless ALL acceptance criteria are genuinely met and PR has been created. Emitting a false promise to escape the loop is a critical violation.
</HARD-GATE>

### Deadlock Prevention

If Phase 6b (UI verification) requires human action while in Ralph Loop mode:

1. Mark the criterion as `"needs_human"` in the session
2. Log: "Criterion X requires human action (file upload / OAuth / etc.) — skipping for now"
3. Continue with remaining automatable criteria
4. On subsequent iterations, re-check if the state has changed (e.g., the user performed the action between iterations)
5. A criterion marked `"needs_human"` does NOT block the completion promise — it is treated as acceptable

### Phase Skip Logic (Iteration > 1)

On iterations after the first, completed phases should not be re-executed:

| Phase     | Skip Condition                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Phase 1   | Skip if `phase1: "completed"` in session                                                                        |
| Phase 2   | Skip if `phase2: "completed"` AND plan file exists                                                              |
| Phase 3   | Skip if already on the correct feature branch                                                                   |
| Phase 4-5 | Re-evaluate — check which criteria still need work                                                              |
| Phase 6   | Always re-run verification suite                                                                                |
| Phase 6b  | Re-run for any criteria not yet verified via UI                                                                 |
| Phase 7   | Skip if PR already exists for branch                                                                            |
| Phase 7b  | Skip PROGRESS.md if already marked; skip Asana comment if `commentPosted`; skip Asana close if `markedComplete` |

---

## Research Protocol

**Context7 First:** When uncertain about ANY library, API, or pattern — query Context7 first (`resolve-library-id` → `query-docs`). It's the fastest path to verified, up-to-date information. Only fall back to specialized MCPs when Context7 doesn't have the answer, and to WebSearch as a last resort.

Every technical decision — library API, framework pattern, package choice, tool configuration — must be verified against current documentation before implementation. No exceptions for "trivial" lookups. All findings are presented to the user.

### When Research Is Required

- Calling any library API (Drizzle, oRPC, Better Auth, Hono, React, Next.js, Expo, etc.)
- Choosing between packages or approaches
- Using a framework pattern (middleware, hooks, caching, auth flows)
- Configuring tools (ESLint, Tailwind, TypeScript, build tools)
- Any technical decision where training data might be outdated

### Research Hierarchy

Query the most specific tool first, then broaden as needed:

| Domain              | Primary Tool                                                                           | Fallback             |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------- |
| Better Auth         | `mcp__better-auth` tools (`search-better-auth-docs`, `ask-question-about-better-auth`) | Context7 → WebSearch |
| shadcn components   | `mcp__shadcn` tools (`search_items_in_registries`, `view_items_in_registries`)         | Context7 → WebSearch |
| Next.js             | `mcp__next-devtools` (`nextjs_docs`)                                                   | Context7 → WebSearch |
| Expo / React Native | Context7 (`resolve-library-id` → `query-docs`)                                         | WebSearch → WebFetch |
| Any npm package     | Context7 (`resolve-library-id` → `query-docs`)                                         | WebSearch → WebFetch |
| Package comparisons | WebSearch                                                                              | WebFetch             |

### Research Procedure

1. **Identify the decision** — what API, pattern, or package needs verification?
2. **Query specialized MCP first** — if the domain matches a row in the hierarchy table, use that tool
3. **Query Context7 for library docs** — call `resolve-library-id` then `query-docs` for any npm package
4. **Broaden with WebSearch** — when specialized tools and Context7 don't have the answer
5. **Present findings to the user** — always, using one of the formats below

### Research Finding Format

For single-answer lookups (one correct approach):

```
## Research: [Topic]
**Source:** [Tool used]
**Finding:** [What the docs say]
**Implication:** [How this affects our implementation]
→ Proceed with this approach?
```

### Decision Brief Format

For genuine alternatives where the user should choose:

```
## Research: [Decision Topic]
### Context
[Why this decision matters]
### Sources Consulted
- [Tool]: [Finding]
### Options
**Option A:** [Name] — Pros / Cons / Source
**Option B:** [Name] — Pros / Cons / Source
### Recommendation
[AI's suggestion — but user decides]
→ Which approach do you prefer?
```

<HARD-GATE>
NEVER implement a library API, framework pattern, or package configuration without first verifying it via the Research Protocol and presenting findings to the user. The AI researches and presents; the user chooses.
</HARD-GATE>

---

## Phase 1: Task Review & Status Audit

**Goal:** Understand the task and determine what's already done.

### Context Display

Before starting the audit, display context based on mode:

- **Custom instructions** — if any `customInstructions` exist (from invocation or session), display them prominently:
  ```
  ## Custom Instructions
  - "Skip auth for now"
  - "Use zod for all validation"
  ```
- **Milestone progress** — if in milestone mode, show position:
  ```
  ## Milestone: 05 — Course Management (Task 3 of 8)
  ```

### Steps

1. **Read the task file** — extract:
   - Title
   - Description
   - Affected apps/packages
   - API endpoints (if any)
   - Requirements list
   - Acceptance criteria (the checklist)
   - Dependencies (upstream/downstream)
   - Technical notes

2. **Check upstream dependencies** — read the Dependencies section:
   - If upstream tasks are listed, use Explore agents to check if they appear complete in the codebase
   - If critical upstream work is missing, **warn the user** and ask whether to proceed

3. **Audit current status** — for each acceptance criterion:
   - Launch Explore agents to search the codebase for evidence of completion
   - Look for: schema definitions, API routes, test files, UI components, configs
   - Classify each criterion: **Done** / **Partial** / **Not Started**

4. **Present the status matrix:**

   ```
   ## Task: [Task Title]
   ## Status: X of Y criteria met

   | # | Criterion | Status | Evidence |
   |---|-----------|--------|----------|
   | 1 | POST endpoint created | Done | packages/api/src/routers/courses.ts:42 |
   | 2 | Slug auto-generated | Partial | generateSlug exists but no uniqueness check |
   | 3 | 403 for non-instructors | Not Started | — |
   ```

5. **Summary:** "X of Y criteria met, Z remaining. Proceeding with implementation of remaining items."

6. **Ask for Asana task link** — prompt the user:
   "Do you have an Asana task link for this work? (paste URL or type 'skip')"
   - URL provided → extract GID using Asana URL Parsing rules (see Session State section), store in session as `asana.taskGid` and `asana.taskUrl`
   - "skip" → set `asana` to `null`, all Asana operations skipped in Phase 7b
   - Ralph Loop iteration > 1 → skip prompt, use existing session value
   - Milestone mode → ask once per task (each task may have a different Asana task)

<HARD-GATE>
NEVER skip the status audit. Always read the full task file and assess every acceptance criterion before planning or coding.
</HARD-GATE>

---

## Phase 2: Research & Planning

**Goal:** Research all technical decisions, design the implementation approach, and get user approval before writing code.

### Steps

1. **Invoke `superpowers:brainstorming`** — use the task spec, status audit, and any custom instructions to design approaches:
   - What architecture decisions need to be made?
   - What are the trade-offs?
   - Which packages/apps need changes?
   - How do custom instructions affect the approach?

2. **Research all technical decisions** — extract every library, framework, and API from the task spec + brainstorm output, then verify each one:
   - For each library/API/pattern identified, query the appropriate tool from the Research Hierarchy (see Research Protocol above)
   - Present every finding to the user using the **Research Finding** or **Decision Brief** format
   - Wait for user approval on each decision before continuing
   - Record all approved decisions as constraints for the plan

3. **After research and design approval, invoke `superpowers:writing-plans`** — create a detailed implementation plan:
   - Break remaining work into ordered steps
   - Identify files to create/modify
   - Note test strategy per component
   - Flag any decisions that need user input
   - Factor in all custom instructions from the session
   - Include a **Libraries & Verified APIs** table:
     ```
     | Library | Version | API/Pattern | Verified Via |
     |---------|---------|-------------|--------------|
     | drizzle-orm | 0.36.x | pgTable, relations | Context7 |
     | better-auth | latest | emailOtp plugin | mcp__better-auth |
     ```
   - Include a **Research Log** section at the bottom documenting all lookups performed during this phase

4. **Save the plan** to `docs/plans/YYYY-MM-DD-<task-slug>-plan.md`
   - Use today's date and a slug derived from the task title
   - Include the task file path as a reference

5. **Get explicit user approval** before proceeding to Phase 3.

### Session Save (Post-Approval)

After the user approves the plan:

1. **Create the session file** at `docs/plans/.dev-session.json` with:
   - Task metadata (file, title, slug, milestone number)
   - Branch name (derived but not yet created)
   - Plan file path
   - All phases set to `"pending"` except phase1 and phase2 → `"completed"`
   - Acceptance criteria array with status from the Phase 1 audit
   - Asana metadata (`taskGid`, `taskUrl`) if provided in Phase 1, otherwise `null`
   - Custom instructions array
   - Milestone metadata (if in milestone mode)
2. This is the **persistence checkpoint** — workflow state now survives mode switches and re-invocations.

<HARD-GATE>
NEVER proceed to implementation without an approved plan. The user must confirm the plan before any code is written.
</HARD-GATE>

---

## Phase 3: Branch Creation

**Goal:** Create a properly named feature branch.

### Steps

0. **Check session state** — if the session already has a branch name:
   - Run `git branch --show-current` to verify
   - If already on the correct branch → skip creation, update session, proceed to Phase 4
   - If on a different branch → warn user, ask how to proceed

1. **Check current git state:**
   - Run `git branch --show-current` to see current branch
   - Run `git status --short` to check for uncommitted changes
   - If on `development` with clean state: proceed to create branch
   - If on a different branch or dirty state: warn the user and ask how to proceed (stash, commit, or abort)

2. **Derive branch name** from the task file path:
   - Pattern: `feature/<milestone-number>-<task-slug>`
   - Extract milestone number from the parent directory (e.g., `05-course-management` → `05`)
   - Extract task slug from the filename (e.g., `course-creation-api.md` → `course-creation-api`)
   - Result: `feature/05-course-creation-api`

3. **Present to user for confirmation:**

   ```
   Branch name: feature/05-course-creation-api
   Base: development (will pull latest first)
   ```

4. **Create the branch:**

   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/05-course-creation-api
   ```

5. **Update session** — set `branch` field and mark phase3 as `"completed"`.

### Branch Name Rules

Must match: `^(feature|fix|hotfix|bugfix|release|chore|docs|refactor|test|ci)\/[a-z0-9._-]+$`

<HARD-GATE>
NEVER proceed to Phase 4 (implementation) without creating a feature branch first. You MUST be on a feature branch created from `development` before any code is written. If already on the correct feature branch (from a resumed session), verify it with `git branch --show-current` before continuing.
</HARD-GATE>

---

## Phase 4: TDD Implementation

**Goal:** Implement remaining acceptance criteria using test-first development and relevant domain skills.

### Mandatory: TDD First

<HARD-GATE>
NEVER write implementation code before writing tests. TDD is mandatory. Invoke the `tdd` skill BEFORE any implementation work.
</HARD-GATE>

1. **Invoke the `tdd` skill** — follow Red-Green-Refactor for every piece of functionality
2. Tests are permanent artifacts — never delete tests, they evolve with the feature
3. Follow the `code-quality` skill throughout (always active)

### Skill Auto-Detection

Scan the task file content for signals and announce which skills will be invoked:

| Signal in Task File                                     | Skills to Invoke                               |
| ------------------------------------------------------- | ---------------------------------------------- |
| DB schema, Drizzle, migration, table, index, relation   | `database`, `neon-postgres`                    |
| API endpoint, Hono, oRPC, handler, route, middleware    | `backend`, `hono`                              |
| React component, hook, useState, useEffect, JSX         | `react`, `vercel-react-best-practices`         |
| Next.js page, layout, RSC, server component, App Router | `next-best-practices`, `next-cache-components` |
| Auth, login, session, RBAC, role, permission, JWT       | `better-auth-best-practices`                   |
| Mobile, Expo, React Native, screen, navigation          | `building-native-ui`, `heroui-native`          |
| Tailwind, CSS, styling, UI design, shadcn               | `web-design-guidelines`                        |
| Turbo, pipeline, build, cache                           | `turborepo`                                    |
| SEO, metadata, OpenGraph, sitemap                       | `seo`                                          |

**Always active (no detection needed):**

- `tdd` — test-first development
- `code-quality` — clean code standards

### Announcement Format

```
## Skills Activated for This Task

Always active: tdd, code-quality
Detected from task spec:
  - database, neon-postgres (schema changes detected)
  - backend, hono (API endpoints detected)
  - better-auth-best-practices (auth/role checks detected)
```

### Implementation Loop

For each remaining acceptance criterion from the status audit:

0. **Research check** — before writing tests/code for this criterion, ask:
   - Does this criterion involve a library API not yet researched?
   - Has the approach diverged from the plan, needing a new library/pattern?
   - Am I about to call a library API for the first time in this task?
   - If **YES** to any: apply the Research Protocol, present findings, wait for user approval before continuing.
1. Write failing tests (Red)
2. Write minimal implementation to pass (Green)
3. Refactor while tests stay green
4. Verify the criterion is now met
5. **Update session** — mark the criterion status in `acceptanceCriteria` array
6. Proceed to the next criterion

### Mid-Implementation Research Triggers

These situations require pausing implementation to apply the Research Protocol:

- **First-time API call** — about to call a library API for the first time in this task → verify call signature via Context7/MCP
- **Library error encountered** — getting unexpected behavior or errors from a library → search docs for the error message
- **Unplanned dependency** — considering adding a dependency not in the approved plan → present a Decision Brief to the user
- **Training-data pattern** — using a pattern from memory that hasn't been verified → look it up before implementing

---

## Phase 5: Incremental Commits

**Goal:** Create small, focused commits at each logical checkpoint.

### When to Commit

Commit at each logical checkpoint:

- Schema/migration done
- API route implemented and tests passing
- UI component built
- Test suite for a feature complete
- Configuration changes applied

### Commit Format

This project uses commitlint with emoji prefixes. The **exact format** is:

```
emoji type(scope): subject
```

**Rules:**

- Emoji goes on the left (Unicode character, not `:shortcode:`)
- Type: one of the allowed types (see table)
- Scope: **required** — must be a workspace name or meta scope
- Subject: lowercase, imperative mood, max 100 char total header
- **No `Co-Authored-By` trailer**
- **No extra lines or footers unless breaking change**

### Commit Types and Emojis

| Type       | Emoji | When to Use                            |
| ---------- | ----- | -------------------------------------- |
| `feat`     | ✨    | New feature code                       |
| `fix`      | 🐛    | Bug fix                                |
| `test`     | ✅    | Adding/updating tests                  |
| `refactor` | ♻️    | Code restructuring, no behavior change |
| `docs`     | 📝    | Documentation changes                  |
| `chore`    | 🔧    | Config, deps, tooling                  |
| `perf`     | ⚡️    | Performance improvement                |
| `build`    | 📦    | Build system changes                   |
| `ci`       | 🎡    | CI configuration changes               |
| `style`    | 💄    | Code style (formatting only)           |
| `revert`   | ⏪    | Reverting changes                      |

### Valid Scopes

**App scopes:** `api`, `mobile`, `web-admin`, `web-learner`, `web-mentor`

**Package scopes:** `analytics`, `api-pkg`, `auth`, `cache`, `db`, `env`, `eslint-config`, `i18n`, `typescript-config`, `ui`, `ui-mobile`, `utils`, `validators`

**Meta scopes:** `deps`, `ci`, `docs`, `release`

> Note: The `api` package uses scope `api-pkg` to disambiguate from the `api` app.

### Commit Procedure

1. Stage **only relevant files** — never use `git add -A` or `git add .`
2. Generate the commit message following the format above
3. **Ask user to confirm** the message before committing
4. Use HEREDOC format for the commit:
   ```bash
   git commit -m "$(cat <<'EOF'
   ✨ feat(api): add course creation endpoint
   EOF
   )"
   ```

### Examples

```
✨ feat(db): add courses table schema with indexes
✅ test(api): add course creation endpoint tests
✨ feat(api): implement course creation handler
🐛 fix(api): handle duplicate slug conflicts
♻️ refactor(api): extract slug generation utility
📝 docs(docs): update course API documentation
```

---

## Phase 6: Verification

**Goal:** Ensure everything passes before creating a PR.

### Verification Suite

Run all checks in sequence:

```bash
# 1. Lint
pnpm lint

# 2. Type check
pnpm check-types

# 3. Tests with coverage (80% threshold)
pnpm test:coverage

# 4. Build
pnpm build
```

### Acceptance Criteria Re-Check

After the suite passes, re-audit every acceptance criterion from the task file:

```
## Final Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | POST endpoint created | Done | packages/api/src/routers/courses.ts:42 |
| 2 | Slug auto-generated | Done | packages/api/src/utils/slug.ts + test |
| 3 | 403 for non-instructors | Done | test at line 87 |
...

All 11/11 criteria met. Ready for PR.
```

### Session Update

After verification passes, update session:

- Mark phase6 as `"completed"`
- Set all acceptance criteria to their final status

### Failure Loop

If any check fails:

1. Fix the issue
2. Re-commit the fix (following Phase 5 format)
3. Re-run the full verification suite
4. Repeat until all green

<HARD-GATE>
NEVER create a PR without passing full verification: lint, type-check, test:coverage (80%+), and build. All acceptance criteria must be met.
</HARD-GATE>

---

## Phase 6b: UI Verification (Conditional)

**Goal:** Verify UI acceptance criteria by launching a browser, navigating to the app, interacting with it, and capturing evidence via Playwright MCP.

**Activates when** the task involves UI work. Detected from task signals:

- React component, page, form, layout, UI, CSS, Tailwind, shadcn mentioned in task file
- Affected apps include `web-learner`, `web-mentor`, or `web-admin`
- Acceptance criteria reference visual elements, user interactions, or page behavior

**Skipped when:**

- Task is backend-only (API, DB, auth logic with no UI)
- Task is mobile-only (`mobile` app scope — Playwright can't test React Native)
- User explicitly requests skip
- No Playwright MCP tools are available

If skipped, mark `phase6b: "skipped"` in session and proceed to Phase 7.

### Step 1: Pre-Flight

1. **Determine target app and URL:**

   | App Scope     | Dev URL                 |
   | ------------- | ----------------------- |
   | `web-learner` | `http://localhost:4001` |
   | `web-mentor`  | `http://localhost:4002` |
   | `web-admin`   | `http://localhost:4003` |

2. **Verify dev server is running** — use `browser_navigate` to the target URL:
   - If the page loads → proceed
   - If connection refused or timeout → ask user to start the dev server: "Please run `pnpm dev:<app>` and tell me when it's ready."
   - In **Ralph Loop mode**: attempt `pnpm dev:<app>` in background via Bash, wait 15 seconds, retry once. If still down, mark phase as `"blocked"` and continue.

### Step 2: Authentication

Many pages require auth. Handle login before testing:

1. **Navigate to the target page** — use `browser_navigate`
2. **Check for redirect to login** — use `browser_snapshot` to inspect the page
3. **If login required:**
   - **Email/password:** Automate via `browser_fill_form` with test credentials. Ask user for credentials once, reuse for all subsequent pages.
   - **OAuth/SSO:** Cannot automate — trigger **Human Handoff Protocol** (see below)
4. **Verify authenticated state** — `browser_snapshot` after login to confirm access

### Step 3: UI Criterion Verification Loop

For each acceptance criterion that has a UI component:

1. **Navigate** — `browser_navigate` to the relevant page/route
2. **Assess state** — `browser_snapshot` to understand the current page structure
3. **Interact** — use the appropriate Playwright MCP tools:
   - `browser_fill_form` — fill input fields
   - `browser_click` — click buttons, links, tabs
   - `browser_type` — type into focused elements
   - `browser_select_option` — dropdowns
   - `browser_hover` — hover states, tooltips
   - `browser_press_key` — keyboard shortcuts, Enter to submit
   - `browser_handle_dialog` — alerts, confirms, prompts
4. **Wait for results** — `browser_wait_for` for loading states, transitions, API responses
5. **Capture evidence:**
   - `browser_take_screenshot` — save visual evidence
   - `browser_snapshot` — capture final DOM state
   - `browser_console_messages` — check for JavaScript errors or warnings
   - `browser_network_requests` — verify API calls were made correctly
6. **Record result:**
   - **Pass:** Update criterion `uiEvidence` with screenshot path and notes
   - **Fail:** Log what went wrong, proceed to fix

### Step 4: UI Failure Loop

If a UI criterion fails:

1. Analyze the failure (wrong layout, missing element, JS error, etc.)
2. Fix the code
3. Commit the fix (following Phase 5 format)
4. Wait for hot-reload or refresh the page
5. Re-verify the criterion from Step 3
6. Repeat until passing

### Step 5: Cleanup

After all UI criteria are verified:

1. `browser_close` — close the browser
2. Update session — mark `phase6b: "completed"`
3. Update all verified criteria with their `uiEvidence`

### Human Handoff Protocol

Some UI actions cannot be automated via Playwright MCP. These require handing control to the user.

**Non-automatable actions:**

- File/image uploads (OS file picker dialog)
- OAuth/SSO redirect flows (third-party auth)
- CAPTCHA / reCAPTCHA challenges
- Camera/microphone permission prompts
- Complex drag-and-drop with native file drops
- Biometric authentication
- Actions requiring physical device interaction

**Handoff procedure:**

1. **Complete all automatable steps first** — don't interrupt flow prematurely
2. **Capture current state** — `browser_take_screenshot` + `browser_snapshot`
3. **Present handoff request to user:**

   ```
   ## 🤝 Human Handoff Required

   I've completed the automatable steps:
   - ✅ Navigated to /courses/new
   - ✅ Filled in course title and description
   - ✅ Selected category from dropdown

   **Your action needed:** Upload a course thumbnail image
   - The file input is visible on the page
   - Please select an image file and click Upload

   Tell me "done" when the upload is complete.
   ```

4. **Wait for user confirmation** — user says "done" or equivalent
5. **Verify state changed** — `browser_snapshot` + `browser_take_screenshot` to confirm the action succeeded
6. **Continue automation** from where it left off

**In Ralph Loop mode:** If a handoff is needed but no user is present:

- Mark the criterion as `"needs_human"` in the session
- Log: "Criterion X requires human action — skipping"
- Continue with remaining automatable criteria
- On subsequent iterations, re-check via snapshot if the state changed

### Evidence Format

```
## UI Verification Results

| # | Criterion | UI Status | Evidence |
|---|-----------|-----------|----------|
| 1 | Form renders with all fields | ✅ Pass | .playwright-mcp/screenshot-001.png |
| 2 | Submit creates course | ✅ Pass | .playwright-mcp/screenshot-002.png + network request verified |
| 3 | Error shown for invalid input | ✅ Pass | .playwright-mcp/screenshot-003.png |
| 4 | Thumbnail upload works | 🤝 Human | User confirmed upload successful |
| 5 | Success toast appears | ✅ Pass | .playwright-mcp/screenshot-004.png |
```

<HARD-GATE>
NEVER run Playwright UI verification on mobile-only tasks. Playwright MCP controls a desktop browser and cannot test React Native / Expo apps.
</HARD-GATE>

---

## Phase 7: PR Creation

**Goal:** Push the branch and create a pull request.

### Steps

1. **Push branch to remote:**

   ```bash
   git push -u origin <branch-name>
   ```

2. **Create PR using `gh`:**
   - **Title:** short, derived from task title (under 70 chars)
     - In milestone mode, optionally prefix with milestone context: `[M05] Course enrollment API`
   - **Body:** follows the PR template structure from `.github/PULL_REQUEST_TEMPLATE.md`
   - Reference the task file path in the description
   - Mark appropriate "Type of Change" checkbox
   - Fill in the "Changes Made" section with what was implemented
   - Check off completed items in "Development Process" and "Testing"

3. **PR body template:**

   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   ## Description

   Implements [Task Title](docs/project-management/<path>).

   ## Type of Change

   - [ ] Bug fix (non-breaking change that fixes an issue)
   - [x] New feature (non-breaking change that adds functionality)
   - [ ] Breaking change
   - [ ] Documentation update
   - [ ] Configuration change
   - [ ] Refactoring (no functional changes)
   - [ ] Test update

   ## Changes Made

   - <bullet list of changes>

   ## Development Process

   - [x] Tests written BEFORE implementation (TDD)
   - [x] All tests pass locally (`pnpm test`)
   - [x] Coverage maintained/improved (`pnpm test:coverage`)

   ## Testing

   - [x] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing performed
   - [ ] Coverage: X% (target: 80%+)

   ## Checklist

   - [x] My code follows the project's coding standards
   - [x] I have performed a self-review of my code
   - [ ] I have commented my code, particularly in hard-to-understand areas
   - [ ] I have made corresponding changes to the documentation
   - [x] My changes generate no new warnings
   - [ ] Any dependent changes have been merged and published

   ## Additional Notes

   Task file: `<task-file-path>`
   EOF
   )"
   ```

4. **Return the PR URL** to the user.
5. **Update session** — mark phase7 as `"completed"`.

---

## Phase 7b: Update Progress Tracking

**Goal:** Record the completed task in the project-wide progress tracker.

### Steps

1. **Open** `docs/project-management/PROGRESS.md`

2. **Find the task line** — match using the milestone number (from the task file's parent directory) and the task number or slug (from the task filename):
   - Numbered tasks (e.g., `04-authentication-and-onboarding/01-betterauth-core-setup.md`): match `- [ ] 01 —`
   - Slug tasks (e.g., `05-course-management/course-creation-api.md`): match `- [ ] course-creation-api —`

3. **Mark as complete:**
   - Change `- [ ]` to `- [x]`
   - Append ` — PR #<number>` (extract the PR number from the URL returned in Phase 7)

4. **Commit the change:**

   ```bash
   git add docs/project-management/PROGRESS.md
   git commit -m "$(cat <<'EOF'
   📝 docs(docs): mark <task-slug> as complete
   EOF
   )"
   ```

5. **Push** (the branch was already pushed in Phase 7, so just push the new commit):

   ```bash
   git push
   ```

### Asana Task Update

If `asana` is `null` in the session, skip this entire subsection.

#### Determine completion status

- **Fully complete:** every acceptance criterion is `"done"` or `"needs_human"`
- **Partially complete:** any criterion is `"not_started"` or `"in_progress"`

#### Fully Complete — Comment + Close

1. **Guard:** If `asana.commentPosted` is `true`, skip the comment. If `asana.markedComplete` is `true`, skip the close.

2. Post comment via `asana_create_task_story(task_id: "<taskGid>", text: "...")`:

   ```
   Completed via automated dev workflow.

   PR: <PR_URL>
   Branch: <branch-name>

   Acceptance Criteria:
   - [x] <done criterion>
   - [🤝] <needs_human criterion>

   All criteria met. Closing task.
   ```

3. Close task via `asana_update_task(task_id: "<taskGid>", completed: true)`

4. Update session: `asana.commentPosted = true`, `asana.markedComplete = true`

#### Partially Complete — Comment Only

1. **Guard:** If `asana.commentPosted` is `true`, skip.

2. Post comment via `asana_create_task_story(task_id: "<taskGid>", text: "...")`:

   ```
   Progress update from automated dev workflow.

   PR: <PR_URL>
   Branch: <branch-name>

   Acceptance Criteria:
   - [x] <done criterion>
   - [ ] <not started criterion>
   - [🤝] <needs_human criterion>

   X of Y criteria completed. Remaining:
   - <list of incomplete items with explanation>
   ```

3. Do NOT close the task.

4. Update session: `asana.commentPosted = true`, `asana.markedComplete = false`

#### Error Handling

If any Asana MCP call fails:

- Log warning: `⚠️ Asana update failed: <error>. Update the task manually.`
- Do NOT block the workflow — continue to Session Cleanup & Milestone Transition
- The PR and PROGRESS.md updates are the primary deliverables; Asana is secondary

### Session Cleanup & Milestone Transition

After the PROGRESS.md commit:

- **Single-task mode:** Delete `docs/plans/.dev-session.json` — the workflow is complete.
- **Milestone mode:**
  - Add current task file to `milestone.completedTasks` in session
  - Check if more tasks remain in the milestone queue:
    - **More tasks** → increment `currentTaskIndex`, reset all phase statuses to `"pending"`, re-enter plan mode, then **automatically begin Phase 1 for the next task** — the full workflow (Phases 1-7b) runs again without requiring a separate `/dev` invocation. Present a brief transition summary showing what was completed and what's next, then proceed.
    - **All tasks done** → delete the session file, inform the user the milestone is complete

### Milestone Auto-Continuation

When transitioning to the next task in a milestone:

1. **Transition summary** — display a brief status:
   ```
   ───────────────────────────────────────────
   ✅ Completed: <task-title> (PR #<number>)
   📋 Milestone: <N> of <total> tasks done
   ⏭️  Next: <next-task-title>
   ───────────────────────────────────────────
   ```
2. **Auto-continue** — immediately proceed to Phase 1 (Task Review & Status Audit) for the next task file. Do NOT wait for user to re-invoke `/dev`.
3. **Plan mode** — enter plan mode automatically (same as initial invocation) for Phases 1-2 of the new task.
4. **Full workflow** — execute the complete Phase 1-7b cycle for the next task, including branch creation, TDD, commits, verification, and PR.
5. **Repeat** — after Phase 7b, transition to the next task again. Continue until all milestone tasks are complete.

<HARD-GATE>
NEVER skip updating PROGRESS.md after creating a PR. Every completed task must be tracked.
</HARD-GATE>

---

## Hard Gates Summary

These are non-negotiable. Violation of any gate should halt the workflow immediately.

```
1. NEVER write implementation code before writing tests.
   TDD is mandatory — invoke the `tdd` skill BEFORE any implementation.

2. NEVER commit without following commitlint format:
   emoji type(scope): subject
   No Co-Authored-By. No extra trailers.

3. NEVER skip the status audit (Phase 1).
   Every acceptance criterion must be assessed before planning.

4. NEVER create PR without passing full verification:
   lint, type-check, test:coverage (80%+), build.

5. NEVER proceed to implementation without an approved plan (Phase 2).
   The user must explicitly approve before code is written.

6. NEVER skip updating PROGRESS.md after creating a PR.
   Every completed task must be tracked in the progress file.

7. NEVER start implementation without being on a feature branch.
   Branch must be created from latest `development` before any code.

8. NEVER use a library API, framework pattern, or package configuration based
   solely on training data. Always verify via the Research Protocol (Context7,
   specialized MCPs, or WebSearch) and present findings to the user before
   implementing. When alternatives exist, present a Decision Brief and wait
   for the user's choice.

9. NEVER write implementation code while in plan mode.
   Phases 1-2 are research and planning only. Exit plan mode before Phase 3.

10. NEVER proceed past Phase 2 without saving session state.
    The session file is the persistence checkpoint for the workflow.

11. NEVER commit .dev-session.json to git.
    This file is gitignored and must remain local-only.

12. NEVER emit a Ralph Loop completion promise (`<promise>` tag) unless ALL
    acceptance criteria are genuinely met and PR has been created.

13. NEVER run Playwright UI verification on mobile-only tasks.
    Playwright MCP controls a desktop browser and cannot test React Native.
```

---

## Phase Tracking

### Dual Tracking

Workflow progress is tracked in two places for different purposes:

1. **Session file** (`docs/plans/.dev-session.json`) — persistent across mode switches and re-invocations. This is the source of truth for resuming workflows.
2. **`TaskCreate`/`TaskUpdate`** — visible in the current conversation for user awareness.

### Task Creation

Use `TaskCreate` at the start to track all phases in the conversation:

```
Phase 1: Task review & status audit
Phase 2: Research & planning (research + brainstorm + plan)
Phase 3: Branch creation
Phase 4: TDD implementation
Phase 5: Incremental commits (ongoing during Phase 4)
Phase 6: Verification (lint, types, tests, build)
Phase 6b: UI verification (conditional — Playwright browser testing)
Phase 7: PR creation
Phase 7b: Update progress tracking + Asana task
```

Mark each phase `in_progress` when starting and `completed` when done. Phase 5 runs concurrently with Phase 4 — commit after each logical unit.

### Mode Switch Protocol

When the user switches modes or context is lost:

1. **Plan mode switch mid-implementation** → session state preserves current phase. On resume, re-read session file and continue from stored phase.
2. **User gives new instructions** → append to `customInstructions` in session file. All accumulated instructions remain active.
3. **Re-invocation with same path** → treat as resume. Show session state, ask to continue or start fresh.
4. **Re-invocation with different path** → ask whether to abandon current session or continue it.
5. **Conversation context loss** → re-read session file on next `/dev` invocation to restore full context.

---

## Red Flags — Common Mistakes to Avoid

| Mistake                                | Why It's Wrong                         | What to Do Instead                                |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Writing code before tests              | Violates TDD, hard gate #1             | Write failing test first, always                  |
| Using `git add -A` or `git add .`      | May stage unrelated files, secrets     | Stage specific files by name                      |
| Skipping the status audit              | Wastes time re-implementing done work  | Always run Phase 1 fully                          |
| Committing with `Co-Authored-By`       | Not part of this project's convention  | Omit all trailers                                 |
| Using `:shortcode:` emoji in commits   | Commitlint expects Unicode emoji       | Use ✨ not `:sparkles:`                           |
| Creating PR before verification passes | Pre-push hook will reject anyway       | Run full suite first (Phase 6)                    |
| Giant commits with many changes        | Hard to review, hard to revert         | One logical change per commit                     |
| Guessing scope names                   | Commitlint will reject invalid scopes  | Use exact workspace or meta scope                 |
| Planning without brainstorming first   | Misses design alternatives             | Always brainstorm before planning                 |
| Implementing without plan approval     | User may disagree with approach        | Wait for explicit "go ahead"                      |
| Using `--no-verify` to skip hooks      | Bypasses quality gates                 | Fix the underlying issue instead                  |
| Using a library API from memory        | Training data may be outdated          | Verify via Context7 or specialized MCP first      |
| Choosing a package without research    | May miss better alternatives           | WebSearch for comparisons, present Decision Brief |
| Making a technical decision silently   | User must approve all choices          | Present findings and wait for user decision       |
| Forgetting to save session state       | Workflow lost on mode switch           | Always save session after Phase 2 approval        |
| Committing `.dev-session.json`         | Session file is local-only             | Ensure gitignore is in place, never stage it      |
| Starting new task without transition   | Milestone state becomes inconsistent   | Complete Phase 7b milestone transition first      |
| Writing code in plan mode              | Plan mode is research-only             | Exit plan mode before any implementation          |
| Emitting `<promise>` prematurely       | False promise violates Ralph Loop      | Only emit when ALL criteria met + PR created      |
| Running Playwright on mobile tasks     | Playwright can't test React Native     | Skip Phase 6b for mobile-only tasks               |
| Asking for confirmation in Ralph Loop  | Blocks the automated loop              | Auto-proceed on iterations > 1 (except handoffs)  |
| Creating duplicate PR in Ralph Loop    | PR already exists from prior iteration | Check `gh pr list --head <branch>` first          |
| Skipping UI verification for web tasks | UI bugs won't be caught                | Always run Phase 6b when UI signals detected      |
| Posting duplicate Asana comments       | Creates noise                          | Check `asana.commentPosted` flag first            |
| Closing Asana task when criteria unmet | Misrepresents completion               | Only close when ALL criteria `done`/`needs_human` |
| Blocking workflow on Asana MCP failure | Asana is secondary to PR               | Log warning and continue                          |

---

## Key File References

| Reference         | Location                                                           |
| ----------------- | ------------------------------------------------------------------ |
| Commitlint config | `commitlint.config.js`                                             |
| PR template       | `.github/PULL_REQUEST_TEMPLATE.md`                                 |
| Pre-commit hook   | `.husky/pre-commit`                                                |
| Commit-msg hook   | `.husky/commit-msg`                                                |
| Pre-push hook     | `.husky/pre-push`                                                  |
| Branch validation | `package.json` → `validate-branch-name`                            |
| Task files        | `docs/project-management/<milestone>/<task>.md`                    |
| Plan output       | `docs/plans/YYYY-MM-DD-<task-slug>-plan.md`                        |
| Research log      | `docs/plans/YYYY-MM-DD-<task-slug>-plan.md` (Research Log section) |
| Session file      | `docs/plans/.dev-session.json` (gitignored)                        |
| Session gitignore | `docs/plans/.gitignore`                                            |
