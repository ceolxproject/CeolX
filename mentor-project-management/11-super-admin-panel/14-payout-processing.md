# Payout Processing

## Description

Comprehensive payout management system for instructor earnings. Displays pending payout amounts per instructor, enables manual payout triggering via Stripe Connect, implements 70/30 revenue split for course purchases with All Access pool calculation, provides payout history, supports failed payout re-triggering, and maintains complete audit trail.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)
- Payments: Stripe Connect API integration

## API Endpoints

- `GET /api/admin/payouts` — List pending payouts per instructor
- `GET /api/admin/payouts/history` — Payout history with filters
- `POST /api/admin/payouts/process/:instructor_id` — Manually trigger payout
- `POST /api/admin/payouts/:payout_id/retry` — Retry failed payout
- `GET /api/admin/payouts/:payout_id/breakdown` — Get payout calculation breakdown
- `GET /api/admin/payouts/summary` — Total pending, average payout, etc.
- `GET /api/admin/instructors/:id/earnings` — Instructor earnings breakdown

## Requirements

- Payouts dashboard with:
  - Summary cards: total pending payouts, total paid (all-time), average payout, next payout date
  - Pending payouts list: instructor name, email, pending amount, last payout date, status (ready, processing, on-hold)
- Pending payouts list showing:
  - Instructor name/profile link
  - Email
  - Pending amount (formatted currency)
  - Pending courses: count of courses contributed to
  - Last payout: date and amount
  - Status: ready (can trigger), processing, on-hold (verification needed), error
  - Manual payout button
- Filter: by status, pending amount range, last payout date, instructor name
- Sortable: by name, pending amount, last payout
- Pagination: 25 per page
- Payout breakdown modal showing:
  - Calculation: total earnings from all courses
  - Revenue sources: course sales (70% of purchase price), All Access pool share
  - Course-by-course breakdown: course name, students, revenue, instructor share
  - All Access pool: estimated share based on watch time %
  - Platform fees: 30% deduction
  - Final payout amount
  - Previous 3 months breakdown
- Manual payout trigger:
  - Confirm: shows instructor, amount, Stripe account status
  - Allows admin to manually trigger payout to Stripe Connect
  - Requires instructor to have connected Stripe account
- Payout history showing:
  - Date, instructor, amount, status (completed, failed, pending)
  - Filters: date range, instructor, status, amount range
  - Clickable row shows payout details and breakdown
  - Retry button for failed payouts
  - Export history to CSV
- Payout earnings calculation:
  - 70/30 split: instructor gets 70% of course purchase price
  - All Access pool: separate calculation for courses watched by All Access subscribers
    - Pool = All-Access subscription revenue
    - Share per instructor = pool \* (instructor_watch_time / total_platform_watch_time)
  - Calculate monthly (or on-demand)
- Failed payout handling:
  - Display error reason from Stripe
  - Retry button to attempt payout again
  - Manual investigation notes field (admin can add notes)
- Audit trail: all payouts logged with admin_id, breakdown, Stripe response

## Acceptance Criteria

- [ ] Payouts dashboard displays with summary cards and pending list
- [ ] Pending payouts list shows instructor, pending amount, last payout, status
- [ ] Click row or manual payout button to trigger payout
- [ ] Payout trigger modal confirms instructor, amount, Stripe status
- [ ] Manual payout creates Stripe Connect transfer to instructor's connected account
- [ ] Payout history displays all past payouts with date, amount, status
- [ ] Filter history by date range, instructor, status
- [ ] Sortable columns in pending list: name, amount, last payout, status
- [ ] Payout breakdown modal shows: earnings sources, course breakdown, All Access pool share, final amount
- [ ] Earnings calculation: 70% course sales + All Access pool share
- [ ] All Access pool: total All-Access revenue split by watch time percentage
- [ ] Failed payout shows error reason and retry button
- [ ] Retry failed payout attempts Stripe transfer again
- [ ] Payout history export to CSV with all details
- [ ] Pagination works (25 per page)
- [ ] Audit trail logs all payout actions with amount and breakdown
- [ ] Instructor cannot manually trigger payout (only admin can)
- [ ] Mobile: list and modals are readable, buttons are touch-friendly

## Dependencies

- Database tables: instructor_payouts, payout_items, payout_history, payments, course_enrollments, video_watch_events, subscriptions
- Stripe Connect API for transfers
- Earnings calculation service
- Audit log system

## Technical Notes

- **Pending Payouts**: Query instructors with earnings > 0 and status != 'paid_out' in current month
  - Query: SELECT users.\*, SUM(instructor_payouts.amount) as pending FROM users JOIN instructor_payouts WHERE instructor_payouts.status IN ('pending', 'failed') GROUP BY users.id
- **Payout Status**: Enum: pending, processing, completed, failed, on_hold
- **70/30 Split**: On every course purchase:
  - payment.amount (total paid)
  - instructor_share = payment.amount \* 0.7
  - platform_share = payment.amount \* 0.3
  - Create instructor_payouts record with amount=instructor_share, source='course_sale'
- **All Access Pool**:
  - Pool size = SUM(payments.amount) WHERE subscription_tier.name='All Access'
  - Per-instructor share:
    - instructor_watch_pct = SUM(instructor's video watch time) / SUM(all platform video watch time)
    - instructor_all_access_share = pool \* instructor_watch_pct
  - Calculate monthly or quarterly
  - Create instructor_payouts record with amount=calculated_share, source='all_access_pool'
- **Pending Calculation**: SUM(instructor_payouts.amount) WHERE instructor_id=user.id AND status='pending'
- **Payout History**: Log completed payouts in payout_history table with: id, instructor_id, amount, stripe_transfer_id, status, created_at, completed_at
- **Manual Payout**:
  - Verify instructor has stripe_account_id set (connected account)
  - Call Stripe POST /v1/transfers with amount, destination=instructor_stripe_account_id, metadata={course_ids, breakdown}
  - Store stripe_transfer_id, set status='processing'
  - On Stripe webhook (transfer.completed), update status='completed' and payout_history
- **Failed Payout**: If Stripe webhook returns transfer.failed, set status='failed', store error message, send admin notification
- **Retry Failed**: Create new Stripe transfer, keep reference to original failed transfer
- **Breakdown Query**:
  1. Course sales: SELECT course_id, SUM(payment.amount\*0.7) FROM payments JOIN courses WHERE instructor_id=user.id GROUP BY course_id
  2. All Access share: (all_access_pool \* watch_time_pct)
  3. Total = sum of 1 + 2
- **Watch Time Pct**: SELECT SUM(watch_time) FROM video_watch_events JOIN videos WHERE videos.course_id IN (instructor's courses) / SUM(all watch_time on platform)
- **Audit Trail**: Log instructor_id, amount, sources (course breakdown + all_access), status, admin_id, timestamp
- **Schedule**: Consider automatic monthly payouts (every 1st of month) with admin approval workflow
- **Minimum Payout**: Optional: set minimum payout threshold (e.g., $50) before allowing manual payout
