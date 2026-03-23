# Team Plan Visibility

## Description

Dashboard and management interface for team subscriptions. Displays team plan overview including seat allocation, utilization metrics, and per-team user lists. Accessible from team plan subscription tier config and user detail pages. Provides visibility into team coverage and adoption.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/team-plans` — List all team subscriptions with seat info
- `GET /api/admin/team-plans/:id` — Get team subscription details
- `GET /api/admin/team-plans/:id/members` — List team members
- `GET /api/admin/team-plans/:id/usage` — Get seat utilization metrics
- `PATCH /api/admin/team-plans/:id/seat-count` — Update seat allocation (if configurable)
- `GET /api/admin/users/:user_id/team-plan` — Get user's team plan (on user detail page)

## Requirements

- Team plans list showing:
  - Team/company name
  - Subscription tier (Team plan type)
  - Total seats allocated
  - Active seats (members using the plan)
  - Inactive seats (unused)
  - Utilization percentage
  - Subscription status (active, trial, past-due)
  - Renewal date
  - Monthly/annual cost
- Sortable columns: team name, seats, utilization, status, renewal date
- Filter by: status, utilization range (0-25%, 25-50%, etc.)
- Search by team/company name
- Detail view showing:
  - Team info: company name, team owner/admin
  - Subscription: plan type, seats, renewal date, price
  - Members list: name, email, status (active/inactive), join date, last login
  - Utilization chart: visual representation of used/unused seats
  - Usage history: seat usage over time (chart)
- Members list on detail view:
  - Columns: name, email, role (team owner, team member), status, join date, last login
  - Ability to remove member from team (?)
  - Ability to invite new member (?)
- Integration with user detail view: show team plan info if user is team member
- Pagination, responsive design
- Empty states when no teams or members

## Acceptance Criteria

- [ ] Team plans list displays with name, seats, utilization, status, renewal date
- [ ] Filter by status (active, trial, past-due, canceled)
- [ ] Filter by utilization range (0-25%, 25-50%, 50-75%, 75-100%)
- [ ] Search by team/company name (real-time with debounce)
- [ ] Columns sortable by name, seats, utilization, status
- [ ] Click row opens detail view with full team subscription info
- [ ] Detail view shows subscription details: plan, seats, renewal date, cost
- [ ] Members list displays: name, email, role, status, join date, last login
- [ ] Utilization chart shows allocated vs used seats visually
- [ ] Usage history chart shows seat utilization trend over time
- [ ] Pagination for members list (20 per page)
- [ ] User detail page includes team plan section (if user is team member)
- [ ] Team plan section shows: team name, team owner, seats, utilization, member count
- [ ] Load performance: list < 2 seconds, detail view < 1.5 seconds
- [ ] Mobile: list scrollable, detail view readable

## Dependencies

- Database tables: subscriptions (with type='team'), team_subscriptions, team_members, user_activity
- Subscription management system
- User management system

## Technical Notes

- **Team Subscription**: subscription with subscription_tier.type='team'
  - Columns: subscription_id, team_name, base_seat_count, total_seat_count (base + additional)
  - Store in team_subscriptions table with subscription_id FK
- **Team Members**: Create team_members table with columns: id, team_subscription_id, user_id, role (owner/member), joined_at, removed_at
- **Seat Count**: total_seat_count = base_seat_count + additional_seats_purchased
  - Query from subscription pricing (base seats + additional seat charges applied)
- **Active Seats**: COUNT DISTINCT user_id from team_members WHERE removed_at IS NULL AND status != 'invited'
- **Utilization**: (active_seats / total_seats) \* 100
- **Subscription Status**: Query from subscriptions.status (active, trialing, past_due, canceled)
- **Renewal Date**: subscription.current_period_end
- **Usage History**: Log team member join/remove events in team_member_activity table; aggregate by date to show utilization trend
- **Cost**: subscription.amount / 100 (assuming Stripe stores in cents)
- **Last Login**: Query user_activity table for max login_at by team member
- **User Detail Integration**: On user detail page, if user.team_subscription_id is set, display team section with team name, owner, seats, link to team detail
- **Remove Member**: Set team_members.removed_at = now; don't hard delete
- **Member Invite**: Optional future feature; create team_invitations table if implemented
- **Pagination**: 20 members per page on team detail view
- **Charts**: Use Recharts or Chart.js for utilization and history charts
