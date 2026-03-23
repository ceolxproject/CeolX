# M9-T1 · Super Admin Auth + Dashboard (KPI Overview + User Management)

| Field | Value |
|-------|-------|
| **Milestone** | M9 — Super Admin |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T5 (admin scaffold), M1-T3 (API), M1-T2 (DB schema) |
| **PRD Ref** | Section 8 (Super Admin Features) |

---

## Description
The Super Admin web dashboard — a single internal user account with full visibility of the platform. Covers login, KPI overview cards, and user management table. There is only ONE Super Admin account in V1.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Admin auth (email/password only), admin user endpoints, KPI aggregation |
| `apps/admin` | Login page, Dashboard (KPI cards), Users page (table + search + CSV export) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/admin/auth/login` | Admin email/password login |
| POST | `/admin/auth/logout` | Admin logout |
| GET | `/admin/users` | List all users (paginated) |
| GET | `/admin/stats` | KPI overview data |

---

## Requirements
- R1: Admin login uses email/password only — no Google/Apple Sign-In for admin
- R2: Admin session separate from end-user session — different session scope
- R3: Single Super Admin account only — no multi-admin in V1; account created via seed script, not a sign-up flow
- R4: All admin routes (`/admin/*`) guarded by admin auth middleware — non-admin access returns 401
- R5: Dashboard KPI cards: Total Users, Active Events, Pending Moderation Count, Active Venue Subscriptions
- R6: Users page: table with columns — name, email, persona (`current_role`), joined date, account status
- R7: User search by email address
- R8: CSV export of users table
- R9: "Pending Events" sidebar badge count wired to count of `status = pending_review` events

---

## Acceptance Criteria
- [ ] Admin can log in with email/password; non-admin credentials rejected
- [ ] Admin routes return 401 without valid admin session
- [ ] Dashboard KPI cards display correct totals
- [ ] Users table renders with all columns; pagination works
- [ ] Email search filters the users table correctly
- [ ] CSV export downloads a file with all user data
- [ ] "Pending Events" sidebar badge shows correct count
- [ ] Admin logout clears session and redirects to login

---

## Technical Notes
- Super Admin account seeded via a one-time script (e.g. `pnpm seed:admin`) — never exposed as a sign-up route
- Admin session uses a separate cookie/token scope to prevent end-user tokens from granting admin access
- KPI data queried fresh on each dashboard load — no caching required at V1 scale
- CSV export uses a server-side streaming approach or a simple `json-to-csv` conversion — no complex reporting library needed
- NOT in V1: user suspension/banning, category management, platform-wide analytics, subscription management UI
