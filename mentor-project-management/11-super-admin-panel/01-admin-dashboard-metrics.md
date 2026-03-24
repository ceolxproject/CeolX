# Admin Dashboard Metrics

## Description

Core platform overview dashboard displaying real-time KPI metrics and analytics charts. Presents critical business metrics including user growth, revenue trends, top-performing courses, and top videos by engagement. Features metrics cards (total users, active users, revenue, MRR), interactive charts, and ranked listings.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/metrics/overview` — Returns KPI summary (total users, active users, total revenue, MRR, earned, paid)
- `GET /api/admin/metrics/revenue-trend` — Returns revenue trend data (daily/weekly/monthly aggregated, last 90 days)
- `GET /api/admin/metrics/user-growth` — Returns user growth trend (new users per period)
- `GET /api/admin/metrics/top-courses` — Returns top 10 courses by revenue or enrollment
- `GET /api/admin/metrics/top-videos` — Returns top 10 videos by views and total watch time
- `GET /api/admin/metrics/learner-instructor-breakdown` — Returns counts of learners vs instructors

## Requirements

- Display KPI cards with formatted currency and counts
- Revenue metrics: total revenue (all-time), MRR (recurring), total paid (subscriptions), earned (instructor payouts)
- Charts: line chart for revenue trend (90 days), area chart for user growth
- Top courses table with course name, instructor, revenue/enrollment count
- Top videos table with video title, course, views, total watch time, view percentage
- Learner/instructor breakdown card showing counts
- Responsive design (desktop primary)
- Real-time or near-real-time data (cache with 15-min TTL minimum)
- Admin notification inbox integration (show unread count badge if available)
- Date range picker for metrics (default: last 90 days, allow custom ranges)

## Acceptance Criteria

- [ ] KPI cards render with correct data and formatting
- [ ] Revenue trend chart displays 90-day line chart with interactive tooltip
- [ ] User growth chart displays area chart with trend line
- [ ] Top courses ranked by revenue, shows instructor names, searchable
- [ ] Top videos ranked by watch time, includes view percentages
- [ ] Learner/instructor breakdown card displays accurate counts
- [ ] Date range picker allows preset (last 7/30/90 days, YTD) and custom date ranges
- [ ] Metrics update without full page refresh (polling or real-time subscription)
- [ ] Charts are responsive and readable on 1920px+ desktop displays
- [ ] Loading states visible while fetching metrics
- [ ] Error states gracefully handled with retry option
- [ ] Performance: initial load < 2 seconds with caching

## Dependencies

- Database tables: users, subscriptions, payments, courses, videos, video_watch_events, instructor_payouts
- Stripe API for revenue data (optional, or use db directly)
- Real-time metrics service or scheduled aggregation job

## Technical Notes

- **Caching Strategy**: Use Redis to cache hourly/daily aggregates to avoid expensive queries on repeated dashboard views
- **Performance**: Create database indexes on (created_at, status) for user growth queries; on (revenue, created_at) for revenue metrics
- **Watch Time Calculation**: Aggregate video_watch_events by video_id, sum(watched_duration)
- **Revenue**: Sum all payment records where status='completed'; exclude refunds
- **MRR**: Sum all active subscription amounts for recurring plans
- **Earned**: Sum of all instructor_payouts where status='completed'
- **Learner/Instructor Count**: COUNT DISTINCT users where role IN ('learner', 'instructor')
- **Chart Libraries**: Recommend Recharts or Chart.js for visualization
- **Real-time Updates**: Consider WebSocket subscription for live metrics or server-sent events (SSE)
