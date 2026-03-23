# M1-T5 · Next.js Admin Dashboard Scaffold

| Field | Value |
|-------|-------|
| **Milestone** | M1 — Project Setup & Infrastructure |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T1 |
| **PRD Ref** | Section 10.1 (Admin Dashboard), Section 8 (Super Admin Features), Section 9.8 (Venue Subscription) |

---

## Description
Bootstrap the admin web app which serves two purposes: the Super Admin dashboard and the public Venue subscription page (`ceolx.ie/subscribe`). No business logic yet — just route structure, layout, and placeholder pages.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/admin` | The entire Next.js admin application |
| `packages/shared` | Shared enums + types imported for typing |

---

## API Endpoints
None — this is a frontend scaffold task. API calls wired up in M8 (Venue Subscription) and M9 (Super Admin).

---

## Requirements
- R1: Next.js App Router initialised in `apps/admin` with TypeScript
- R2: ShadCN/UI installed and configured as the component library
- R3: Route structure stubbed: `/login`, `/dashboard`, `/users`, `/events/pending`, `/subscribe`
- R4: Root layout with sidebar navigation (Dashboard | Users | Pending Events) for admin routes
- R5: `/subscribe` uses a separate public layout — no sidebar, no admin login required
- R6: Header with admin user info + logout button (wired up in M9)
- R7: Dev server starts with `pnpm dev` in `apps/admin` without errors

---

## Acceptance Criteria
- [ ] `pnpm dev` in `apps/admin` starts without errors
- [ ] All five routes (`/login`, `/dashboard`, `/users`, `/events/pending`, `/subscribe`) accessible and show placeholder content
- [ ] ShadCN/UI components render correctly on at least one page
- [ ] Admin routes use sidebar layout; `/subscribe` uses public layout (no sidebar)
- [ ] `packages/shared` types importable in `apps/admin`

---

## Technical Notes
- The `/subscribe` route must be publicly accessible — it is what Venues land on from their Postmark activation email. No admin auth guard on this route.
- Admin routes (`/dashboard`, `/users`, `/events/pending`) will require login — auth middleware added in M9, not here.
- Sidebar "Pending Events" item will show a badge count wired up in M9.
- Use App Router (`app/` directory) — not the legacy `pages/` router.
