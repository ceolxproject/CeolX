# Milestone 11: Super Admin Panel

## Overview

Complete admin control center for the Mentor platform (Mentor cosmetics learning SaaS). The Super Admin Panel is a Next.js web application built with Hono API backend, providing comprehensive management capabilities across dashboard metrics, user administration, content oversight, subscriptions, payments, compliance, and activity logging.

## Project Context

- **Product**: Mentor by Mentor - Professional cosmetics learning platform
- **Frontend**: Next.js (`apps/web-admin`)
- **Backend**: Hono API (`apps/hono-api`)
- **Shared Packages**: Types and utilities (`packages/shared`)

## Task Files

### 1. Dashboard & Analytics

- **[01-admin-dashboard-metrics.md](./01-admin-dashboard-metrics.md)** — Platform overview with KPIs (users, revenue, MRR), revenue/user growth charts, top courses/videos, learner/instructor breakdown

### 2. User Administration

- **[02-admin-notification-inbox.md](./02-admin-notification-inbox.md)** — Grouped notification center for mentor applications, course publications, reports, payout requests, system alerts
- **[03-instructor-approval-management.md](./03-instructor-approval-management.md)** — Instructor application workflow with profile/portfolio/document review, approve/reject with feedback, batch operations
- **[04-user-management-crud.md](./04-user-management-crud.md)** — Complete user CRUD: searchable list, detailed profiles, subscription/payment history, edit, deactivate/reactivate, export
- **[05-login-as-mentor.md](./05-login-as-mentor.md)** — Admin impersonation feature requiring justification, full mentor dashboard access, time-limited sessions, audit trail

### 3. Admin Access Control

- Super Admin Panel is the only admin access level (no sub-admins)

### 4. Content Management

- **[07-course-oversight.md](./07-course-oversight.md)** — Course admin: view all statuses, flag problematic content, unpublish/archive/delete, bulk actions, detailed analytics
- **[08-category-tag-management.md](./08-category-tag-management.md)** — CRUD for hierarchical categories and tags: create/edit/delete, drag-drop reordering, merge categories, impact preview
- **[09-promo-banner-management.md](./09-promo-banner-management.md)** — Promotional banners with image/CTA, segment-based publishing (all users/subscribed/inactive/custom), one active per segment, scheduling
- **[17-web-course-visibility-controls.md](./17-web-course-visibility-controls.md)** — Control course visibility: web vs mobile-only, bulk actions, discovery API integration

### 5. Subscriptions & Revenue

- **[10-subscription-tier-config.md](./10-subscription-tier-config.md)** — Subscription plan management: create/edit monthly/annual plans, pricing, team/enterprise plans, Stripe sync
- **[11-all-access-course-eligibility.md](./11-all-access-course-eligibility.md)** — All Access plan course inclusion/exclusion, impact preview, grandfathering rules (started courses retain access)
- **[12-team-plan-visibility.md](./12-team-plan-visibility.md)** — Team subscription overview: seat allocation/utilization, per-team member lists, usage metrics
- **[13-coupon-management.md](./13-coupon-management.md)** — Coupon CRUD: % or fixed discounts, expiry/usage limits, segment targeting, usage analytics, Stripe sync

### 6. Payments & Payouts

- **[14-payout-processing.md](./14-payout-processing.md)** — Instructor payout management: pending per instructor, manual Stripe Connect transfer, 70/30 split, All Access pool calculation, failed payout retry, audit trail

### 7. Platform Configuration

- **[15-onboarding-settings-config.md](./15-onboarding-settings-config.md)** — Configure learner onboarding: welcome screen content, skill level options, interest categories, role options, apply to new users only

### 8. Compliance & Audit

- **[16-activity-logs-admin.md](./16-activity-logs-admin.md)** — Comprehensive audit logs: searchable/filterable (logins, course access, payments, content changes, admin actions), export CSV, configurable retention

## Key Features Summary

### Dashboard

- Real-time KPI metrics (total users, active users, revenue, MRR, earned)
- Revenue trend line chart (90-day view)
- User growth area chart
- Top courses and videos rankings
- Learner/instructor breakdown

### User Management

- Searchable/filterable user list (all roles)
- Detailed user profiles with courses, subscriptions, payments, activity
- Edit user information
- Account deactivation/reactivation
- Bulk operations support
- CSV export capability

### Instructor Onboarding

- Pending application review list
- Profile, portfolio, identity document viewing
- Approve/reject with feedback emails
- Batch operations
- Full audit trail

### Admin Access Control

- Super Admin only access
- Full platform control across all modules
- Dashboard, Users, Content, Subscriptions, Payouts, Logs, Settings modules

### Content Management

- Course status views (published, draft, unpublished, archived)
- Flag problematic courses with reasons
- Unpublish/archive/delete with impact analysis
- Category/tag hierarchical management
- Drag-drop reordering
- Category merging with course reassignment

### Promotional Management

- Promo banner creation (image, CTA, URL)
- Segment-based targeting (all, subscribed, inactive, custom)
- One active banner per segment enforcement
- Schedule start/end dates
- Link to coupons
- Performance analytics

### Subscriptions & Pricing

- Create/manage subscription tiers (monthly/annual)
- Team/enterprise plan setup
- All Access course eligibility configuration
- Grandfathering for existing learners
- Stripe product/price sync

### Revenue Management

- Team plan seat allocation and utilization
- Coupon creation (% or fixed discounts)
- Expiry/usage limit configuration
- Segment-based coupon distribution
- Usage analytics and redemption tracking
- Instructor payout processing (70/30 split + All Access pool)
- Stripe Connect integration

### Compliance

- Admin activity logging
- Searchable/filterable audit trail
- CSV export functionality
- Configurable retention period
- User login, course access, payment, admin action tracking

## Technical Specifications

### Frontend Stack

- **Framework**: Next.js (React)
- **UI Components**: Recommended Shadcn/ui or Material-UI
- **Charts**: Recharts or Chart.js
- **Forms**: React Hook Form
- **State Management**: Context API or Zustand
- **Icons**: React Icons or Heroicons

### Backend APIs

- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL with appropriate indexing
- **Authentication**: JWT-based with role/permission middleware
- **File Storage**: S3/GCS for images and documents
- **Payment**: Stripe API (Products, Prices, Customers, Subscriptions, Transfers)
- **Search**: Full-text search or Elasticsearch for activity logs
- **Scheduling**: Bull, Agenda, or similar for payout processing, log retention

### Database Considerations

- Activity logs table: Partition by date for performance
- Composite indexes on frequently filtered columns
- Redis caching for KPI metrics (15-min TTL)
- Soft deletes for audit compliance

### Security

- Admin authentication required for all endpoints
- Super Admin RBAC enforcement at API layer
- Audit logging for all data modifications
- Signed URLs for document viewing (1-hour expiry)
- Rate limiting on sensitive operations
- HTTPS enforcement
- CORS configuration for admin domain only

## Development Guidelines

### API Endpoint Patterns

- All endpoints prefixed with `/api/admin/`
- Authentication via `Authorization: Bearer {token}` header
- Response format: `{ success: boolean, data: {}, error?: string }`
- Pagination: `limit` (default 50), `offset` (default 0), `total_count` in response
- Filtering: standardized query parameter format

### Database Naming Conventions

- Table names: snake_case, plural (users, courses, payments)
- Columns: snake_case (user_id, created_at, is_active)
- Foreign keys: {table_singular}\_id
- Timestamps: created_at, updated_at, deleted_at (soft delete)

### Audit Trail Standards

- Every mutation logged to audit_logs table
- Include: admin_id, action, entity_type, entity_id, before/after data, timestamp
- Searchable by date range, admin, action type, entity
- Retain according to configurable policy

### Error Handling

- Validation errors: 400 Bad Request with field-level error messages
- Authentication errors: 401 Unauthorized
- Permission errors: 403 Forbidden
- Not found: 404 Not Found
- Server errors: 500 Internal Server Error with request ID for tracing

### Performance Targets

- Dashboard load: < 2 seconds
- User list load: < 1.5 seconds
- Search results: < 1 second (real-time with debounce)
- CSV export: stream response, no file size limits
- Activity log queries: 1-2 seconds even with 1M+ records

## Compliance & Regulatory Notes

### Data Privacy (GDPR/CCPA)

- Data export request management (included in settings)
- Account deletion with anonymization
- 30-day grace period for data purge
- Audit trail of all admin data access
- Weekly compliance reporting

### Payment Compliance

- PCI DSS: Use Stripe for payment handling, no card data in app
- Instructor payout audit trail
- Revenue calculation transparency
- Coupon usage tracking

## Deployment Considerations

### Environment Variables

- `STRIPE_API_KEY` — Stripe secret key
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis for caching
- `ADMIN_DOMAIN` — Allowed admin domain for CORS
- `LOG_RETENTION_DAYS` — Configurable audit log retention (default 90)
- `IMPERSONATION_SESSION_TTL_MINUTES` — Login-as-mentor session duration (default 30)

### Database Migrations

- Create all required tables with proper indexes
- Set up audit_logs table with date partitioning
- Create search indexes for activity logs
- Initialize default onboarding settings

### Third-Party Integrations

- **Stripe**: Product/Price/Customer/Subscription/Transfer APIs
- **Email Service**: SendGrid/AWS SES for approval/rejection emails
- **File Storage**: AWS S3 or Google Cloud Storage
- **Search**: Elasticsearch (optional, for large activity logs)

## Testing Strategy

### Unit Tests

- API endpoint validation
- Permission/RBAC checks
- Calculation logic (70/30 split, All Access pool, utilization %)
- Audit log creation

### Integration Tests

- End-to-end workflows (apply → approve → payout)
- Stripe API interactions
- Database transactions
- Permission cascading

### E2E Tests

- Admin dashboard KPI loading
- User search and filter
- Coupon creation and redemption
- Payout processing flow
- Impersonation workflow

## Success Metrics

- All 17 task files complete with implementation details
- Admin dashboard metrics load within 2 seconds
- User search returns results in < 1 second
- Zero critical security vulnerabilities (OWASP Top 10)
- 100% audit trail coverage for admin actions
- Stripe sync success rate > 99.9%
- Instructor payout processing reliability > 99.95%

## Related Milestones

- Milestone 04: Authentication and Onboarding (user roles, permissions)
- Milestone 05: Course Management (course creation, publishing)
- Milestone 08: Payments and Subscriptions (Stripe integration)
- Milestone 10: Instructor Dashboard (instructor earnings)
- Milestone 13: Compliance and GDPR (data management)

## Next Steps

1. Create detailed implementation tasks from each markdown file
2. Set up database schema and migrations
3. Build API endpoints per the documented specifications
4. Implement frontend components (dashboard, tables, modals, forms)
5. Integrate with Stripe for subscriptions and payouts
6. Implement audit logging middleware
7. Build admin authentication and RBAC
8. Comprehensive testing and security review
9. Performance optimization and caching
10. Documentation and admin user guide

---

**Last Updated**: February 18, 2026
**Total Documentation**: 1,454 lines across 17 task files + this README
