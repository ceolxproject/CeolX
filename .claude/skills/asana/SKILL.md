---
name: asana
description: >
  Use when interacting with Asana for project management, task tracking, or work coordination.
  MUST be invoked when: user mentions "asana", references an Asana task URL or numeric GID
  (e.g. 1213639384202046), says "leave a comment", "update the task", "check the task",
  "mark as done", or any intent to read/write Asana data. Covers creating/updating/deleting
  tasks, comments, subtasks, dependencies, searching, and managing projects.
  workspace id 1194107417268910 and project id 1210959953917909
---

# Asana Skill

## Context

- **Workspace ID**: `1194107417268910`
- **Default Project**: CeolX — ID `1210959953917909`
- All task and user operations happen within this workspace unless the user specifies otherwise.

---

## Core Principles

**"Create the task" means create it.** Call `create_tasks` and reply with the task URL. Never stop
at `create_task_preview` and wait for a button click — a preview is an extra click that delivers
nothing that was asked for. Same for closing: set `completed: true` directly. Only use a preview
when the user explicitly asks to review or confirm before creation.

**Assign to Divy (`divy.p@raftlabs.com`) by default.** Not Priya, not anyone else, unless the user
names a specific person for that task.

Always **look up user GIDs** before assigning someone other than Divy. Never guess a GID. Use
`get_workspace_users` to find the right person, then match by name. If there are multiple people
with similar names, show the options and ask the user to confirm.

**Sections in Asana are called sections, not groups.** When a user says "group", they mean a
section within a project.

---

## Available Tools & When to Use Them

| Tool                               | Use When                                                                |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `get_workspace_users`              | Looking up a user to assign a task or add as collaborator               |
| `get_projects`                     | Listing all projects in the workspace                                   |
| `get_project`                      | Getting details (sections, members) of a specific project               |
| `get_tasks`                        | Listing tasks in a project or section                                   |
| `get_task`                         | Fetching full details of a specific task by GID                         |
| `search_objects`                   | Searching for tasks, projects, or users by keyword                      |
| `search_tasks_preview`             | Previewing task search results before acting                            |
| `create_tasks`                     | **Creating tasks — the default.** Creates immediately, returns the URL  |
| `add_comment`                      | Adding a comment (PR link, context) after creating or updating a task   |
| `create_task_preview`              | Only when the user explicitly asks to review before creating            |
| `create_project_preview`           | Generating a preview of a new project for user confirmation             |
| `update_tasks`                     | Updating task fields: name, description, due date, assignee, completion |
| `get_status_overview`              | Getting a high-level status view of a project                           |
| `get_portfolios` / `get_portfolio` | Viewing portfolio-level data                                            |
| `get_items_for_portfolio`          | Listing projects in a portfolio                                         |

---

## Common Workflows

### Creating a Task

1. Identify the right project (default: CeolX `1210959953917909`) and section.
2. Call `create_tasks` — it creates immediately, no confirmation step.
3. Post any follow-up comment (PR link, context) in the same turn.
4. Reply with the `permalink_url`.

**Fields to always include:**

- `name` — clear and specific
- `notes` / `html_notes` — short and clean; cause, fix, current state. No essays.
- `default_assignee` — `divy.p@raftlabs.com` unless the user names someone else
- `section_id` — match the work's actual state (a task created as already-done goes to Completed)
- `start_on` + `due_on` — always provide both together if either is given
- `completed: true` — when creating a record of work that is already finished

`html_notes` must be well-formed XML in a single root `<body>` tag, using only the allowed
elements (`strong`, `em`, `ul`/`ol`/`li`, `a`, `code`, `h1`/`h2`, `pre`, `blockquote`). Passing
escaped entities instead of real tags fails with "Rich text should be wrapped in `<body>` tag".

### Updating a Task

1. If the user gives a task name (not a GID), use `search_objects` to find it first.
2. Call `update_tasks` with the specific fields to change.
3. Confirm the update with a brief summary of what changed.

### Marking a Task Complete

Call `update_tasks` with `{ "completed": true }`. Do it directly when the user asked for it — no
confirmation round-trip. Only check back when closing a task the user did not name.

### Finding a User

Call `get_workspace_users` and filter by name. If the user says "Aravind", return all matches
(e.g. "Aravind Jaimon" GID `1199376712173373`, "aravindarul18@gmail.com" GID `1210994090714823`)
and ask which one they mean.

### Checking Project Structure

Call `get_project` with `opt_fields: "sections,sections.name"` to get the list of sections.
Present them clearly so the user knows where their task will land.

### Searching Tasks

Use `search_objects` with a keyword. Present results with task name, GID, and assignee so the
user can identify the right one quickly.

---

## Known Users (cache — verify with get_workspace_users if uncertain)

| Name                        | GID / identifier      |
| --------------------------- | --------------------- |
| **Divy Parekh** _(default)_ | `divy.p@raftlabs.com` |
| Priya Yadav                 | `1209289934108706`    |
| Aravind Jaimon              | `1199376712173373`    |
| Pratiksha Patil             | `1203952267007789`    |

---

## Known Project Sections — CeolX (1210959953917909)

| Section     | GID                |
| ----------- | ------------------ |
| Ideas       | `1210959953917910` |
| Backlogs    | `1210960051442678` |
| In Progress | `1213652919039664` |
| Staged      | `1213652919039665` |
| Completed   | `1213652919039666` |

When a user asks to add a task to a "group" or "section", match it against this list first.
If the section doesn't exist, note that creating new sections must be done manually in the Asana UI.

---

## Response Style

After any Asana action, give a concise confirmation:

- What was done (created / updated / found)
- The task URL — always, for anything created or changed
- Key details (task name, assignee, due date, section)

Keep it brief — the user can see the Asana UI themselves.
