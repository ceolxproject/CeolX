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

Always **preview before creating**. Use `create_task_preview` or `create_project_preview` before
actually creating anything — this lets the user confirm details first. Only skip the preview step
if the user explicitly says "just do it" or "don't ask".

Always **look up user GIDs** before assigning. Never guess a GID. Use `get_workspace_users` to
find the right person, then match by name. If there are multiple people with similar names, show
the options and ask the user to confirm.

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
| `create_task_preview`              | Generating a preview of a new task for user confirmation                |
| `create_project_preview`           | Generating a preview of a new project for user confirmation             |
| `update_task`                      | Updating task fields: name, description, due date, assignee, completion |
| `get_status_overview`              | Getting a high-level status view of a project                           |
| `get_portfolios` / `get_portfolio` | Viewing portfolio-level data                                            |
| `get_items_for_portfolio`          | Listing projects in a portfolio                                         |

---

## Common Workflows

### Creating a Task

1. If a user name is given, call `get_workspace_users` to resolve the GID.
2. Identify the right project (default: CeolX `1210959953917909`).
3. Call `create_task_preview` with all available fields populated.
4. Wait for user to click "Create task" in the UI — do not call any creation tool again.

**Good `create_task_preview` fields to always include:**

- `taskName` — clear and specific
- `description` — context, checklist of subtasks if relevant, links to documents
- `assignee` — GID from `get_workspace_users`, or `"me"` if self-assigning
- `startDate` + `dueDate` — always provide both together if either is given
- `priority` — always include (`"low"`, `"medium"`, or `"high"`)

### Updating a Task

1. If the user gives a task name (not a GID), use `search_objects` to find it first.
2. Call `update_task` with the specific fields to change.
3. Confirm the update with a brief summary of what changed.

### Marking a Task Complete

Call `update_task` with `{ "completed": true }`. Always confirm with the user before doing this.

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

| Name            | GID                |
| --------------- | ------------------ |
| Priya Yadav     | `1209289934108706` |
| Aravind Jaimon  | `1199376712173373` |
| Pratiksha Patil | `1203952267007789` |

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
- Key details (task name, assignee, due date, section)
- Any pending actions the user should take (e.g. "click Create task to confirm")

Keep it brief — the user can see the Asana UI themselves.
