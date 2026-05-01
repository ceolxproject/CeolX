---
name: write-eod-report
description: Compose and post Priya's daily End-of-Day (EOD) report to today's auto-generated Asana task. Use whenever Priya says "write EOD", "EOD report", "post EOD", "end of day report", "log my day", "daily standup on asana", or it is clearly the end of a working session and today's progress needs to be logged on Asana. The skill gathers today's git commits across all branches, uncommitted/staged work, PRs opened or merged today via gh, and Asana tasks completed today, drafts the comment in the required 7-question format, shows it for review, and posts only after Priya confirms.
---

# Write EOD Report

Compose and post Priya's daily End-of-Day report to today's auto-generated Asana task. The EOD task is created automatically every working day and assigned to Priya.

**Hard rule: never post without Priya's explicit confirmation.** Always show the draft first.

## The format (verbatim — do not paraphrase the questions)

These seven questions appear in this exact order and wording. They are bolded section headers — render via `html_text` with `<strong>`.

```
How was your day?
What did you work on today?
What do you plan to work on tomorrow?
Are we still on track with all the tasks in the current sprint?
Are there any blockers? Is there anything I can do to help you work more efficiently?
Anything new/interesting thing you learnt/discovered today?
Are there any planned leaves? If yes, please add them on Razorpay and inform the team you are working with.
```

## Workflow

### Step 1 — Find today's EOD task on Asana

The EOD task is auto-assigned to Priya every working day. Try these in order:

1. **`get_my_tasks`** with `completed_since="now"` (returns only incomplete tasks for the authenticated user). Look for one whose `due_on` matches today's date in `Asia/Kolkata`, or whose `name` contains "EOD" / "End of Day" / today's date in `DD/MM/YYYY` form.
2. **Fall back to `get_tasks`** scoped to the CeolX project (`1210959953917909`) with `modified_since` set to today 00:00 IST. Filter the results to assignee = Priya (`1209289934108706`) and to a name that looks like an EOD entry.
3. **If still not found**, ask Priya for the task URL or GID. Do not guess. Do not post to a non-EOD task.

Reference IDs from `CLAUDE.md` (do not hardcode anywhere else):

- Workspace: `1194107417268910`
- CeolX project: `1210959953917909`
- Priya: `1209289934108706`

### Step 2 — Gather today's work

Today is the local date in `Asia/Kolkata` (Priya's timezone). Compute the ISO date once and reuse it. Run the four sources in parallel — they don't depend on each other.

**(a) Git commits today across all branches**

```bash
git log --all --since="<today>T00:00:00+05:30" --until="<tomorrow>T00:00:00+05:30" \
  --author="Priya" \
  --pretty=format:"%h %ai %s%d"
```

Group commits by conventional-commit `scope` or by the milestone tag in the message (e.g. all commits referencing M9-T2 group together). Within a group, list short SHA + subject.

**(b) Uncommitted / staged work**

```bash
git status --short
git diff --stat
git diff --staged --stat
```

If the working tree is clean, omit this entirely from the report. If there are changes, summarise as one bullet per scope (e.g. "WIP on `feature/m6-followers-screen`: 3 files in `apps/native/`"). Never paste full diffs.

**(c) PRs opened or merged today**

```bash
gh pr list --author "@me" --state all --limit 30 \
  --search "created:>=<today> OR merged:>=<today>" \
  --json number,title,state,url,createdAt,mergedAt,baseRefName
```

Report each as `#<num> <title> — <Opened|Merged|Draft> → <baseRefName>`.

**(d) Asana tasks completed today**

```
get_tasks(
  project="1210959953917909",
  completed_since="<today>T00:00:00+05:30",
  limit=100,
  opt_fields="name,completed,completed_at,assignee.name,assignee.gid"
)
```

Filter results to `assignee.gid == 1209289934108706` and `completed_at >= today 00:00 IST`. List each as `<task name>` (drop the `[M…-T…]` prefix only if it makes the line too long).

If a source is empty, skip its bullets — don't write "no commits" filler.

### Step 3 — Compose the draft

Map the gathered data into the seven questions:

- **How was your day?** — One line. Read the substance: shipped a milestone → "Productive — shipped M9-T2 and M11-T2". No commits but cleared review comments → "Lighter day, focused on review and planning". Be honest, not performative.
- **What did you work on today?** — Bulleted, grouped by milestone/scope. Each bullet ends with the short SHA(s) or PR number(s) so the report is auditable. Include uncommitted WIP if relevant. Include merged PRs explicitly ("Merged PR #56 — M11-T2 admin analytics").
- **What do you plan to work on tomorrow?** — Pull from: (i) anything Priya mentioned in this session about next steps, (ii) the most active in-flight branch (uncommitted or recently pushed but not merged), (iii) the next open Asana task assigned to Priya in `In Progress` or the current milestone section. If none of these are clear, ask Priya before drafting this line — don't guess.
- **Are we still on track with all the tasks in the current sprint?** — Check the milestones referenced in today's commits/tasks. If their Asana tasks are marked complete and due dates aren't slipping, "Yes — on track". If a milestone is overdue and not started, flag it specifically.
- **Are there any blockers?** — Default to "None". Only list real blockers if Priya mentioned one in this session, or if a stash/WIP comment indicates an unresolved issue (e.g. the FCM revert stash).
- **Anything new/interesting thing you learnt/discovered today?** — Default to "Nothing notable today." Only fill if there's a genuine takeaway from the session (a non-obvious bug fix, a library quirk, a design realisation). Don't pad.
- **Are there any planned leaves?** — Default to "None planned." Only mention a leave if Priya explicitly stated one in this session.

Keep the whole comment tight. No filler, no apologies, no meta-commentary about the report itself.

### Step 4 — Show the draft

Print the full draft exactly as it will be posted (rendered as Markdown in your message — the user will see what they're approving). End with:

> Post this to **<task name>** (<task URL>)? Reply "post it" to confirm, or paste edits.

Wait. Do not post yet.

### Step 5 — Post on confirmation

Confirmation phrases: "post it", "post", "yes post", "send it", "ship it", "go ahead", "looks good post it". Anything else is treated as edits — apply the edits, re-show the draft, wait again.

Post via `add_comment` using `html_text` (so the seven question headers render bold):

```
add_comment(
  task_id="<gid>",
  html_text="<body><strong>How was your day?</strong>\n…\n<strong>What did you work on today?</strong>\n<ul><li>…</li></ul>\n…</body>"
)
```

`html_text` allowed elements (per Asana API): `<body>`, `<strong>`, `<em>`, `<u>`, `<s>`, `<code>`, `<ol>`, `<ul>`, `<li>`, `<a>`, `<blockquote>`, `<pre>`. **No `<br/>`, `<p>`, `<h*>`, or `<hr/>`.** Use `\n` between blocks; Asana renders newlines as line breaks.

After posting, confirm to Priya with the task URL.

## What not to do

- Don't paraphrase the seven questions. They are templated and the reviewer scans for them by exact text.
- Don't post without confirmation, even if Priya says "do everything end-to-end" — show the draft first. The skill exists because the format and substance need a human eye.
- Don't fabricate blockers, learnings, or tomorrow plans to fill space. Empty defaults ("None", "Nothing notable") are correct answers.
- Don't include full git diffs or commit bodies. Short SHA + subject only.
- Don't post to a non-EOD task. If the EOD task can't be found, ask — don't improvise a comment on the closest-looking task.
