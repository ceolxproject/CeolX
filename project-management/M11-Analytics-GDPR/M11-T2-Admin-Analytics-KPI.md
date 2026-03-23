# M11-T2 · Admin Analytics & KPI Tracking

| Field | Value |
|-------|-------|
| **Milestone** | M11 — Analytics & GDPR |
| **Status** | 🔲 To Do |
| **Depends on** | M9-T1 (admin dashboard), M4 (events), M8 (subscriptions) |
| **PRD Ref** | Section 8 (Super Admin Features — KPI Overview) |

---

## Description
Extend the Super Admin dashboard KPI cards with more granular reporting. Provides the internal team with platform health visibility for the controlled launch — user growth, event activity, subscription revenue, and engagement.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | KPI aggregation queries, stats endpoint |
| `apps/admin` | Extended KPI cards on Dashboard, simple trend indicators |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/stats` | Extended KPI data for admin dashboard |

---

## Requirements
- R1: **User KPIs**: total registered users, breakdown by persona (Spectator / Artist / Venue), new users in the last 7 days and 30 days
- R2: **Event KPIs**: total events by status (active, pending, rejected, archived), events created in last 7 and 30 days
- R3: **Subscription KPIs**: total active Venue subscriptions, total past_due subscriptions, new subscriptions in last 30 days
- R4: **Engagement KPIs**: total follows, total bookings (by status), total posts
- R5: All KPIs shown as cards on the admin dashboard with a simple trend arrow (up/down vs previous 30 days)
- R6: KPI data refreshed on page load — no real-time updates needed in V1

---

## Acceptance Criteria
- [ ] KPI cards display correct counts for users, events, subscriptions, and engagement
- [ ] Persona breakdown (Spectator / Artist / Venue) shown on user KPI card
- [ ] "New in last 7 days" and "New in last 30 days" figures shown for users and events
- [ ] Trend arrows show directional change vs previous period
- [ ] KPIs load within 2 seconds on the dashboard

---

## Technical Notes
- All KPI queries run against the Neon DB — no separate analytics database needed at V1 scale (under 1,000 users)
- Keep queries simple — no complex window functions or CTEs required. Indexed queries on `created_at` with date range filters are sufficient
- NOT in V1: per-user activity logs, funnel analysis, A/B testing, event page view tracking, revenue forecasting
- If performance becomes an issue post-launch, KPI queries can be moved to a scheduled job that pre-computes and caches results
