# Task 17: Seed Data and Migration Strategy

## Description

Define the seed data strategy for initializing the database with default categories, subscription plans, permissions, roles, and sample data for development. Establish migration procedures for local development, staging, and production environments. Include rollback procedures and CI/CD integration for automated migration checks.

## Affected Apps/Packages

- `packages/db` (migration scripts and seeds)
- `apps/api` (consuming seeded data)
- All apps (depend on migrations completing)

## Requirements

### Seed Data Strategy

#### 1. Default Roles (System Roles)

Seed on initial migration:

```typescript
INSERT INTO roles (id, name, display_name, is_system) VALUES
  ('role_learner', 'learner', 'Learner', true),
  ('role_mentor', 'mentor', 'Mentor', true),
  ('role_team_member', 'team_member', 'Team Member', true),
  ('role_super_admin', 'super_admin', 'Super Administrator', true);
```

#### 2. Default Permissions (Complete Matrix)

Seed ~50-80 permissions covering all modules:

**Courses Module:**

- courses:create, courses:read, courses:update, courses:delete
- courses:publish, courses:unpublish, courses:archive
- courses:view_analytics

**Users Module:**

- users:read, users:update, users:suspend, users:ban
- users:approve_verification, users:manage_roles

**Reporting Module:**

- reporting:view, reporting:export, reporting:view_user_data

**Community Module:**

- community:manage_posts, community:manage_comments
- community:view_reports, community:resolve_reports

**Settings Module:**

- settings:manage_categories, settings:manage_tags
- settings:manage_subscriptions, settings:manage_coupons
- settings:manage_configs

**Admin Module:**

- admin:manage_admins, admin:manage_permissions
- admin:view_audit_logs, admin:export_data

#### 3. Role-Permission Assignments

Map each role to appropriate permissions:

**Learner:**

- courses:read (view courses)
- users:read (view public profiles)
- community:view (read posts/comments)

**Mentor:**

- courses:create, courses:read, courses:update, courses:publish
- users:read, users:approve_verification
- community:manage_posts (own content)
- settings:manage_categories (read-only)

**Team Member:**

- courses:read, courses:update (shared courses)
- users:read
- community:manage_posts (own content)

**Super Admin:**

- ALL permissions (wildcard access)

#### 4. Default Categories

Seed cosmetics-related categories with hierarchy:

```typescript
const categories = [
  {
    id: "cat_makeup",
    name: "Makeup",
    slug: "makeup",
    parentId: null,
    sortOrder: 1,
    isFeatured: true,
  },
  {
    id: "cat_makeup_eye",
    name: "Eye Makeup",
    slug: "eye-makeup",
    parentId: "cat_makeup",
    sortOrder: 1,
  },
  {
    id: "cat_makeup_face",
    name: "Face Makeup",
    slug: "face-makeup",
    parentId: "cat_makeup",
    sortOrder: 2,
  },
  {
    id: "cat_skincare",
    name: "Skincare",
    slug: "skincare",
    parentId: null,
    sortOrder: 2,
    isFeatured: true,
  },
  {
    id: "cat_haircare",
    name: "Hair Care",
    slug: "haircare",
    parentId: null,
    sortOrder: 3,
  },
  {
    id: "cat_nails",
    name: "Nail Art",
    slug: "nail-art",
    parentId: null,
    sortOrder: 4,
  },
  {
    id: "cat_business",
    name: "Beauty Business",
    slug: "beauty-business",
    parentId: null,
    sortOrder: 5,
  },
];
```

#### 5. Default Tags

Seed common tags for filtering:

```typescript
const tags = [
  { name: "cruelty-free", slug: "cruelty-free" },
  { name: "vegan", slug: "vegan" },
  { name: "organic", slug: "organic" },
  { name: "natural", slug: "natural" },
  { name: "trending", slug: "trending" },
  { name: "bestseller", slug: "bestseller" },
  { name: "beginner-friendly", slug: "beginner-friendly" },
  { name: "step-by-step", slug: "step-by-step" },
  { name: "quick-tutorial", slug: "quick-tutorial" },
  { name: "professional", slug: "professional" },
];
```

#### 6. Default Subscription Plans

Seed subscription tiers:

```typescript
const subscriptionPlans = [
  {
    id: 'plan_free',
    name: 'Free',
    description: 'Free courses only',
    price: new Decimal(0),
    currency: 'USD',
    interval: 'monthly',
    stripePriceId: 'price_free',
    stripeProductId: 'prod_free',
    freeTrial Days: 0,
    isActive: true,
    sortOrder: 1,
    features: {
      unlimitedAccess: false,
      maxActiveCourses: 5,
      prioritySupport: false,
      certificates: false
    }
  },
  {
    id: 'plan_pro_monthly',
    name: 'Pro Monthly',
    description: 'Unlimited access, monthly',
    price: new Decimal(29.99),
    currency: 'USD',
    interval: 'monthly',
    stripePriceId: 'price_monthly',
    stripeProductId: 'prod_pro',
    freeTrial Days: 7,
    isActive: true,
    sortOrder: 2,
    features: {
      unlimitedAccess: true,
      maxActiveCourses: -1,
      prioritySupport: true,
      certificates: true,
      apiAccess: false
    }
  },
  {
    id: 'plan_pro_annual',
    name: 'Pro Annual',
    description: 'Unlimited access, save 20%',
    price: new Decimal(299.99),
    currency: 'USD',
    interval: 'annual',
    stripePriceId: 'price_annual',
    stripeProductId: 'prod_pro',
    freeTrial Days: 14,
    isActive: true,
    sortOrder: 3,
    features: {
      unlimitedAccess: true,
      maxActiveCourses: -1,
      prioritySupport: true,
      certificates: true,
      apiAccess: false
    }
  }
];
```

#### 7. Super Admin Account

Seed a super admin account for platform setup (local/staging only):

```typescript
const superAdmin = {
  id: "user_super_admin",
  email: "admin@mentor.local",
  emailVerifiedAt: NOW,
  name: "Super Admin",
  passwordHash: hashPassword("admin@123456"),
  role: "super_admin",
  status: "active",
};
// NOTE: Use environment variable in production, never hardcode
```

#### 8. Sample Development Data

For development environment only:

**Sample Mentor:**

```typescript
const sampleMentor = {
  id: "user_sample_mentor",
  name: "Sarah Johnson",
  email: "sarah@example.com",
  role: "mentor",
  status: "active",
};
```

**Sample Learners:**

```typescript
const sampleLearners = [
  { name: "Alex Smith", email: "alex@example.com" },
  { name: "Jordan Lee", email: "jordan@example.com" },
  { name: "Taylor Brown", email: "taylor@example.com" },
];
```

**Sample Course:**

```typescript
const sampleCourse = {
  id: "course_sample",
  instructorId: sampleMentor.id,
  title: "Beginner Makeup Techniques",
  slug: "beginner-makeup-techniques",
  description: "Learn fundamental makeup application techniques...",
  categoryId: "cat_makeup",
  courseType: "lesson",
  skillLevel: "beginner",
  status: "published",
  isFree: true,
};
```

### Migration File Organization

```
packages/db/migrations/
├── 001_init_schema.sql          # Initial table creation
├── 002_enum_types.sql           # PostgreSQL enums
├── 003_users_auth.sql           # Users and auth tables
├── 004_courses_content.sql      # Courses structure
├── 005_community_tables.sql     # Community features
├── 006_payments_subscriptions.sql # Billing tables
├── 007_seed_default_data.sql    # System roles, permissions
├── 008_seed_categories.sql      # Default categories/tags
├── 009_seed_plans.sql           # Default subscription plans
└── 010_seed_admin.sql           # Super admin account
```

### Migration Execution Strategy

#### Local Development

```bash
# Fresh database
pnpm db:push  # Creates all tables
pnpm db:seed  # Runs seed files

# View schema in Drizzle Studio
pnpm db:studio
```

#### Staging Environment

```bash
# With migration history
pnpm db:migrate  # Run unapplied migrations in order
pnpm db:push --force  # If needed for development

# Verify migration
psql $NEON_DATABASE_URL -c "SELECT * FROM migrations;"
```

#### Production Environment

```bash
# Backup first
pg_dump $NEON_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations with confirmation
pnpm db:migrate --dry-run  # Preview changes
pnpm db:migrate            # Apply migrations

# Monitor for errors
tail -f logs/migration.log
```

### Migration Rollback Procedures

**Rollback Strategy:**

- Keep migration files immutable (never modify applied migrations)
- Create new "undo" migration for changes, not reverting original
- Example: Instead of editing `003_users.sql`, create `011_users_fix.sql`

**Rollback Command:**

```typescript
// Create down migration
const downMigration = `
-- Revert changes from 003_users.sql
ALTER TABLE users DROP COLUMN new_field;
DROP TABLE IF EXISTS temporary_table;
`;

// Run rollback
pnpm db:migrate:down --steps=1  // Revert last 1 migration
```

**Example Rollback Migration:**

```sql
-- File: 011_users_rollback_new_field.sql
-- Reverts changes from 003_users.sql
-- Timestamp: 2024-02-20T10:30:00Z

BEGIN;

-- Rollback: Drop new_field from users table
ALTER TABLE users DROP COLUMN IF EXISTS new_field;

-- Rollback: Restore original constraint
ALTER TABLE users ADD CONSTRAINT email_not_null CHECK (email IS NOT NULL);

-- Verify rollback
SELECT COUNT(*) FROM users; -- Should return non-zero

COMMIT;
```

### CI/CD Integration

#### GitHub Actions for Migration Checks

```yaml
name: Database Migrations

on: [pull_request]

jobs:
  migration-check:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: pnpm db:push

      - name: Verify schema
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        run: pnpm db:introspect

      - name: Check for errors
        run: |
          if [ $? -ne 0 ]; then
            echo "Migration failed"
            exit 1
          fi
```

### Deployment Checklist

```markdown
## Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Migrations reviewed by team member
- [ ] Rollback migration prepared and tested
- [ ] Database backup scheduled before deploy
- [ ] CI/CD checks passing
- [ ] No breaking schema changes (backward compatible)
- [ ] Data transformation scripts prepared (if needed)
- [ ] Monitoring alerts configured for migration errors
- [ ] Team notified of maintenance window
- [ ] Off-peak deployment time selected

## Post-Deployment Verification

- [ ] Connect to production database
- [ ] Verify all tables exist: `\dt`
- [ ] Check row counts on key tables
- [ ] Verify indexes created: `\di`
- [ ] Test application with new schema
- [ ] Monitor query performance
- [ ] Check application logs for errors
- [ ] Confirm data integrity
```

### Seed Data Best Practices

#### 1. Idempotent Seeds

```sql
-- Good: Won't fail if data already exists
INSERT INTO categories (id, name, slug)
VALUES ('cat_makeup', 'Makeup', 'makeup')
ON CONFLICT (slug) DO NOTHING;

-- Avoid: Will fail on duplicate
INSERT INTO categories (id, name, slug)
VALUES ('cat_makeup', 'Makeup', 'makeup');
```

#### 2. Reference Integrity

```sql
-- Insert parent first
INSERT INTO categories (id, name, slug, parentId)
VALUES ('cat_makeup', 'Makeup', 'makeup', NULL);

-- Then insert children
INSERT INTO categories (id, name, slug, parentId)
VALUES ('cat_eye', 'Eye Makeup', 'eye-makeup', 'cat_makeup');
```

#### 3. Use UUIDs Consistently

```sql
-- Generate consistent UUIDs for test data
-- Use deterministic UUIDs from namespace + name
SELECT md5('category:makeup')::uuid AS category_id;
-- Result: Always same UUID for same name
```

### Testing Migrations

#### Local Testing

```bash
# Fresh database
rm -rf migrations/
pnpm db:push

# Test rollback
pnpm db:migrate:down --steps=1

# Test re-apply
pnpm db:push

# Verify schema
pnpm db:introspect
```

#### Docker Testing

```dockerfile
FROM postgres:16

COPY ./migrations /docker-entrypoint-initdb.d/

# Migrations run automatically on container start
```

### Monitoring Migration Health

```typescript
// Log migration execution
const logMigration = async (migrationFile, status, duration) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      migration: migrationFile,
      status,
      durationMs: duration,
      severity: status === "failed" ? "error" : "info",
    }),
  );
};

// Alert on failures
if (status === "failed") {
  await sendAlert({
    channel: "database",
    message: `Migration ${migrationFile} failed after ${duration}ms`,
    severity: "critical",
  });
}
```

### Documentation

Create `/docs/DATABASE_MIGRATIONS.md`:

```markdown
# Database Migrations Guide

## Quick Start

pnpm db:push # Apply pending migrations
pnpm db:migrate # Run migration history
pnpm db:rollback # Revert last migration

## Migration Files

- Located in `packages/db/migrations/`
- Named with timestamp: `YYYYMMDDHHMMSS_description.sql`
- Never modify applied migrations
- Keep migrations small and focused

## New Migration

1. Make schema changes in `packages/db/src/schema/`
2. Generate migration: `pnpm db:generate`
3. Review migration file
4. Test locally: `pnpm db:push`
5. Commit and push

## Deployment

- Production migrations must have rollback prepared
- Backward compatible changes preferred
- Test on staging first
- Monitor query performance after deploy
```

## Acceptance Criteria

- [ ] All system roles seeded (learner, mentor, team_member, super_admin)
- [ ] All permissions seeded (~50+ permission records)
- [ ] Role-permission associations complete and tested
- [ ] Default categories seeded with proper hierarchy
- [ ] Default tags seeded
- [ ] Subscription plans seeded with Stripe IDs
- [ ] Super admin account seeded for development
- [ ] Sample development data (mentor, learners, course)
- [ ] Migration files organized and numbered
- [ ] Seed data idempotent (can run multiple times safely)
- [ ] Rollback migrations prepared for all deployments
- [ ] CI/CD integration for migration checks on PRs
- [ ] Deployment checklist documented
- [ ] Local migration testing works end-to-end
- [ ] Production migration procedure documented
- [ ] Database monitoring and alerting configured
- [ ] Team trained on migration procedures

## Dependencies

- All schema tasks (01-16) must be completed
- Database set up and accessible
- Drizzle Kit configured
- Stripe account with test API keys

## Technical Notes

### Seed Data Retention

- Keep seed data minimal (only required system data)
- Remove sample development data before deploying to staging/prod
- Separate development seeds from production seeds

### Zero-Downtime Deployments

- Add new columns as NULL before populating
- Create indexes concurrently: `CREATE INDEX CONCURRENTLY`
- Use feature flags for schema changes
- Backwards compatible schema changes only

### Data Integrity Checks

```sql
-- Verify referential integrity after migration
SELECT COUNT(*) FROM users WHERE id IS NULL;
SELECT COUNT(*) FROM courses WHERE instructor_id IS NULL;
SELECT COUNT(*) FROM enrollments WHERE user_id IS NULL;

-- Verify constraints
SELECT constraint_name FROM information_schema.constraint_column_usage
WHERE table_name = 'users';
```

### Performance After Migration

```sql
-- Update statistics for query planner
ANALYZE;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```
