---
name: validate-work
description: >
  Validates work completed against the CeolX PRD, Proposal Document, and task specifications.
  Use this skill when Priya says "validate today's work", "check my work against the PRD",
  "EOD review", "daily validation", "validate task [X]", "did I miss anything", "check if
  what I built matches the spec", or any time work done needs to be cross-checked against
  the source-of-truth documents. Also trigger when user asks "is my implementation correct"
  or "does this match what we agreed". The skill reads the task files, CLAUDE.md, and actual
  code to produce a structured gap analysis.
---

# Work Validation Skill

You are acting as a meticulous technical PM / QA reviewer. Your job is to validate what has actually been built against what the PRD, proposal doc, and task specifications require — and surface any gaps, contradictions, or issues clearly and concisely.

## Sources of Truth (Priority Order)

1. **CLAUDE.md** — `CLAUDE.md` in the project root. Contains all finalised decisions, business rules, and key constraints. Always read this first.
2. **PRD** — `docs/prd/CeolX_PRD_v1.6.docx` _(binary .docx — cannot be read directly)_. Sections are referenced by name in each task file's "PRD Ref" field. Use CLAUDE.md as the accessible proxy for PRD content.
3. **Proposal Document** — `docs/CeolX - Proposal Document March 2026.docx` _(binary .docx — cannot be read directly)_. Referenced for feature scope and client expectations.
4. **Task files** — `docs/project-management/M*/M*-T*.md`. Each task distils requirements, acceptance criteria, and PRD section references from the above docs. These are the primary validation scaffolds.
5. **Milestones overview** — `docs/project-management/CeolX_Milestones.md`. Gives the big-picture sequencing and task summaries.

> **Note on .docx files**: The PRD and Proposal are binary files Claude cannot parse. If a PRD section is referenced in a task file (e.g. "Section 4.1 — Authentication"), validate against: (a) CLAUDE.md, which captures all finalised decisions, and (b) the task file's own Requirements section, which distils the PRD. Flag when a PRD reference cannot be cross-checked.

---

## Step 1 — Determine Validation Scope

Figure out WHAT to validate before doing anything else.

**If the user specifies a task** (e.g. "validate M1-T2" or "check the auth work"):

- Map to the task file: `docs/project-management/M*/M*-T*.md`
- Validate that task only

**If the user says "today's work" or "EOD" without specifying**:

- Run: `git log --oneline --since="today" --author="$(git config user.name)"` to find today's commits
- Read commit messages to infer which tasks were touched
- Map commit activity to task files in `docs/project-management/`
- If git doesn't clarify scope, ask: "Which task(s) did you work on today?"

**If the user says "validate all done tasks"**:

- Search task files for `Status.*✅ Done` and validate each one

**When in doubt, ask** — don't guess at scope.

---

## Step 2 — Gather Context

Read these in order (use parallel reads where possible):

1. `CLAUDE.md` — always read this; it contains the business rules that override everything
2. The identified task file(s) from `docs/project-management/`
3. `docs/project-management/CeolX_Milestones.md` — if you need context on task ordering or dependencies

---

## Step 3 — Review the Actual Implementation

For each task being validated:

1. Read the **"Affected Apps / Packages"** table in the task file — these tell you exactly which directories to inspect
2. Use `git diff HEAD~N..HEAD` or `git log --name-only` to find changed files relevant to the task
3. Read the actual implementation files in those apps/packages
4. Focus on: API endpoints defined, DB schema applied, business logic implemented, UI screens created, acceptance criteria checklist items

If the task has **API Endpoints** defined, check that:

- The endpoint exists in `apps/server/` (or `apps/api/`)
- Request/response shapes match the spec
- Error cases are handled

If the task involves **DB schema**, check:

- Table exists in `packages/db/` with correct columns, types, constraints, indexes
- Migrations have been run

---

## Step 4 — Validate Against Requirements

For each task, go through these validation lenses:

### 4a. Acceptance Criteria Checklist

Read the task's `## Acceptance Criteria` section. For each checkbox item:

- `[x]` — verify the claim by looking at the code; confirm it's actually done
- `[ ]` — flag as not yet done; note if it's blocking anything downstream

### 4b. Business Rules from CLAUDE.md

Cross-check implementation against any relevant rules in CLAUDE.md:

- Persona switching logic
- Event moderation lifecycle (draft → pending_review → active/rejected → archived)
- Venue subscription flow (no in-app payments, web-only Stripe)
- Map behaviour (debounce, max 50 pins, fallback chain)
- Auth methods supported (Email/Password + Google + Apple only)
- GDPR requirements
- "No hard deletes ever" rule
- "Irish music only" scope
- Any other finalised decisions that apply to the task

### 4c. PRD Section Alignment

The task file's `PRD Ref` field tells you which PRD sections to check. Since the PRD is a binary file:

- Use CLAUDE.md to validate decisions from those sections
- Use the task file's own `## Requirements` section as the PRD distillation
- Flag any requirement in the task file that you cannot verify from either CLAUDE.md or the actual code

### 4d. Technical Notes Compliance

If the task file has a `## Technical Notes` or `## Common Gotchas` section, check whether the implementation follows those patterns (e.g. correct enum values, expected config shapes, correct package names).

---

## Step 5 — Produce the Validation Report

Output a structured report using this format:

```
# Work Validation Report
**Date**: [today's date]
**Scope**: [task IDs and names validated]
**Validated by**: CLAUDE.md + task specification

---

## [M#-T# · Task Name]

### Status
**Task Status**: ✅ Done / 🚧 In Progress / 🔲 To Do
**PRD Ref**: [section from task file]

### Acceptance Criteria
| Criterion | Status | Evidence / Notes |
|-----------|--------|-----------------|
| [criterion text] | ✅ Verified / ⚠️ Partial / ❌ Missing / 🔍 Not checkable | [file:line or explanation] |

### Business Rule Compliance
| Rule (from CLAUDE.md) | Status | Notes |
|-----------------------|--------|-------|
| [rule] | ✅ / ⚠️ / ❌ | [notes] |

### Gaps & Issues
[List any discrepancies between spec and implementation. Be specific.]

### Recommendations
[Actionable next steps to close gaps. Keep it concise.]

---

## Overall Summary
- ✅ **X** criteria verified
- ⚠️ **X** partially implemented or unverifiable
- ❌ **X** missing or incorrect
- 🔍 **X** cannot be checked (binary PRD, no code yet)

**Blockers for next task**: [list any unresolved items that would block the dependent task(s)]
```

---

## Validation Principles

- **Be specific, not vague.** Point to file paths and line numbers where possible, not just "the code looks fine."
- **Don't assume done unless you've read the code.** A `[x]` in the task file is a claim — verify it.
- **Flag CLAUDE.md contradictions loudly.** If the code contradicts a finalised decision in CLAUDE.md (e.g. using in-app payment links, hard-deleting a record), this is a ❌ blocker.
- **Scope creep is a gap too.** If the code implements something not in the task spec (e.g. building M3 features while validating M1), note it.
- **Be kind with partial work.** If a task is still "In Progress", don't report missing items as ❌ — report them as 🔲 "not yet done" and focus on correctness of what IS done.
- **Always check dependencies.** If a task says "Depends on M1-T2", verify that dependency is actually done before flagging gaps in the current task.
