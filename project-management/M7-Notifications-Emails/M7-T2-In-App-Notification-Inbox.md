# M7-T2 · In-App Notification Inbox

| Field | Value |
|-------|-------|
| **Milestone** | M7 — Notifications & Emails |
| **Status** | 🔲 To Do |
| **Depends on** | M7-T1 (push notifications must be working and stored in DB) |
| **PRD Ref** | Section 9.6 (Notifications) |

---

## Description
A persistent in-app notification inbox showing all past notifications for the user, with read/unread state. Allows users to catch up on missed notifications without relying solely on push delivery.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Notification list endpoint, mark-as-read endpoint |
| `apps/mobile` | Notification inbox screen (accessible from Profile tab or bell icon), unread badge count |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/notifications` | List all notifications for authenticated user, newest first |
| PATCH | `/notifications/:id/read` | Mark single notification as read |
| PATCH | `/notifications/read-all` | Mark all notifications as read |

---

## Requirements
- R1: Notification inbox accessible from a bell icon or Profile tab
- R2: List shows all notifications for the user, newest first — no pagination required in V1
- R3: Each notification shows: title, body, timestamp, read/unread indicator
- R4: Tapping a notification marks it as read and navigates using the `route` in the notification payload (same persona-routing logic as push tap in M7-T1)
- R5: Unread notification count shown as a badge on the bell icon / tab
- R6: "Mark all as read" option available
- R7: Notifications older than 90 days may be excluded (soft filter — no hard deletion)

---

## Acceptance Criteria
- [ ] Notification inbox screen accessible from the app
- [ ] All past notifications listed, newest first
- [ ] Unread notifications visually distinct from read ones
- [ ] Tapping a notification marks it read and navigates to the correct screen/persona
- [ ] Badge count on the entry point reflects unread count
- [ ] "Mark all as read" clears all unread indicators and badge count

---

## Technical Notes
- The `notifications` table stores all sent notifications with `read` boolean — `GET /notifications` queries this table filtered by `user_id`
- The same persona-aware routing logic from M7-T1 applies here: if notification's `persona` doesn't match current role → auto-switch → navigate → toast
- Badge count on tab icon is derived from `COUNT(*) WHERE read = false AND user_id = :id`
