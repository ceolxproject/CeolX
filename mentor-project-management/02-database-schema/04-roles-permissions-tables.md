# Task 4: RBAC - Roles and Permissions Tables

## Description

Implement a comprehensive Role-Based Access Control (RBAC) system with roles table, permissions table, role-permissions junction table, and user-roles mapping. This enables flexible permission management where super admin manages all permissions, and the system enforces granular access control across all features.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `packages/auth` (RBAC integration)
- `apps/api` (authorization middleware)
- `apps/web-admin` (role and permission management)
- All apps (permission checks)

## Requirements

### Roles Table

Create table `roles` to define available user roles:

| Column         | Type           | Constraints                | Description                                                   |
| -------------- | -------------- | -------------------------- | ------------------------------------------------------------- |
| `id`           | `UUID`         | PK, Default: `uuid_v7()`   | Unique role identifier                                        |
| `name`         | `VARCHAR(100)` | UNIQUE, NOT NULL           | Role name (e.g., 'learner', 'mentor', 'super_admin')          |
| `display_name` | `VARCHAR(100)` | NOT NULL                   | Human-readable name (e.g., 'Learning Platform User')          |
| `description`  | `TEXT`         | NULL                       | Role description for documentation                            |
| `is_system`    | `BOOLEAN`      | DEFAULT: FALSE             | System roles (learner, mentor, team_member cannot be deleted) |
| `created_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Role creation timestamp                                       |
| `updated_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update timestamp                                         |

### Default Roles

System roles to seed during migration:

1. **learner** - Basic platform user with read access
2. **mentor** - Can create and manage courses
3. **team_member** - Mentor's team members with delegated permissions
4. **super_admin** - Full platform access and configurations

Note: The project has NO sub-admin role. Only Super Admin is available for administrative functions.

### Permissions Table

Create table `permissions` with specific, granular permissions:

| Column          | Type           | Constraints                | Description                                             |
| --------------- | -------------- | -------------------------- | ------------------------------------------------------- |
| `id`            | `UUID`         | PK, Default: `uuid_v7()`   | Unique permission identifier                            |
| `name`          | `VARCHAR(100)` | UNIQUE, NOT NULL           | Permission code (e.g., 'courses:create', 'users:ban')   |
| `display_name`  | `VARCHAR(100)` | NOT NULL                   | Human-readable permission name                          |
| `description`   | `TEXT`         | NULL                       | What this permission grants                             |
| `module`        | `VARCHAR(50)`  | NOT NULL                   | Module name (courses, users, reporting, settings, etc.) |
| `action`        | `VARCHAR(50)`  | NOT NULL                   | Action type (create, read, update, delete, manage)      |
| `resource_type` | `VARCHAR(50)`  | NOT NULL                   | Resource affected (course, user, post, etc.)            |
| `created_at`    | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Permission creation timestamp                           |

### Permissions Matrix

Define all permissions across modules:

#### Courses Module

- `courses:create` - Create new course
- `courses:read` - View courses
- `courses:update` - Update course content
- `courses:delete` - Delete course
- `courses:publish` - Publish/unpublish course
- `courses:archive` - Archive course
- `courses:view_analytics` - View course analytics

#### Users Module

- `users:read` - View user profiles and information
- `users:update` - Modify user profile
- `users:suspend` - Suspend user account
- `users:ban` - Ban user from platform
- `users:approve_verification` - Approve ID verification for instructors
- `users:manage_roles` - Assign roles to users

#### Reporting Module

- `reporting:view` - View analytics and reports
- `reporting:export` - Export report data
- `reporting:view_user_data` - View user-specific data

#### Community Module

- `community:manage_posts` - Delete/edit user posts
- `community:manage_comments` - Delete/edit user comments
- `community:view_reports` - View community reports
- `community:resolve_reports` - Resolve reported content

#### Settings Module

- `settings:manage_categories` - Create/edit/delete course categories
- `settings:manage_tags` - Create/edit/delete tags
- `settings:manage_subscriptions` - Configure subscription plans
- `settings:manage_coupons` - Create/manage discount codes
- `settings:manage_configs` - Manage platform configurations

#### Admin Module

- `admin:manage_users` - Manage all platform users
- `admin:manage_permissions` - Configure permissions for roles
- `admin:view_audit_logs` - Access audit logs
- `admin:export_data` - Export sensitive data

### Role-Permissions Junction Table

Create table `role_permissions`:

| Column           | Type          | Constraints                    | Description                                       |
| ---------------- | ------------- | ------------------------------ | ------------------------------------------------- |
| `id`             | `UUID`        | PK, Default: `uuid_v7()`       | Unique record identifier                          |
| `role_id`        | `UUID`        | FK → roles(id), NOT NULL       | Role reference                                    |
| `permission_id`  | `UUID`        | FK → permissions(id), NOT NULL | Permission reference                              |
| `resource_scope` | `VARCHAR(50)` | NULL                           | Optional scope (e.g., 'own_courses', 'all_users') |
| `created_at`     | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`     | Assignment timestamp                              |

### Unique Constraint for Role-Permissions

- Composite unique index: `(role_id, permission_id)` - prevent duplicate role-permission assignments

### Indexes for Role-Permissions Junction

- Primary Key: `id`
- Unique Index: `(role_id, permission_id)` - uniqueness
- Index: `(role_id)` - find all permissions for role
- Index: `(permission_id)` - find all roles with permission

### User-Roles Table

Create table `user_roles` for mapping users to roles:

| Column        | Type        | Constraints                | Description                  |
| ------------- | ----------- | -------------------------- | ---------------------------- |
| `id`          | `UUID`      | PK, Default: `uuid_v7()`   | Unique record identifier     |
| `user_id`     | `UUID`      | FK → users(id), NOT NULL   | User reference               |
| `role_id`     | `UUID`      | FK → roles(id), NOT NULL   | Role reference               |
| `assigned_by` | `UUID`      | FK → users(id), NULL       | Admin who assigned this role |
| `assigned_at` | `TIMESTAMP` | NOT NULL, DEFAULT: `now()` | Assignment timestamp         |
| `revoked_at`  | `TIMESTAMP` | NULL                       | When role was revoked        |

### Unique Constraint for User-Roles

- Composite unique index: `(user_id, role_id)` where `revoked_at IS NULL` - user can't have same role twice simultaneously

### Indexes for User-Roles

- Primary Key: `id`
- Index: `(user_id)` - find all roles for user
- Index: `(role_id)` - find all users with role
- Index: `(user_id, revoked_at)` - find active roles for user
- Index: `(assigned_by)` - audit trail of who assigned roles

### Enums Definition

No new ENUM types required; use VARCHAR for flexibility.

### Drizzle Schema Definition

In `packages/db/src/schema/rbac.ts`:

- Define `roles` table with system roles
- Define `permissions` table with all permissions
- Define `rolePermissions` junction table
- Define `userRoles` table with assignment tracking
- Use `relations()` for:
  - roles ↔ permissions (many-to-many via rolePermissions)
  - roles ↔ users (many-to-many via userRoles)
  - users ↔ roles (inverse relation)
  - users ↔ userRoles (one-to-many)
  - permissions ↔ roles (many-to-many)

## Database Tables

### roles

- **Purpose**: Define available user roles in system
- **Row estimate**: ~10-50 rows (static/rarely changed)
- **Key relationships**: N:N with permissions via role_permissions, N:N with users via user_roles

### permissions

- **Purpose**: Define granular permissions across platform
- **Row estimate**: ~50-100 permissions (depends on feature complexity)
- **Key relationships**: N:N with roles via role_permissions

### role_permissions

- **Purpose**: Map roles to permissions with scope control
- **Row estimate**: ~200-500 records (varies by role count and permissions)
- **Key relationships**: N:1 with roles, N:1 with permissions

### user_roles

- **Purpose**: Track user role assignments and history
- **Row estimate**: ~1.5M records (users can have multiple roles)
- **Key relationships**: N:1 with users, N:1 with roles

## Acceptance Criteria

- [ ] `roles` table created with system flag and configurability flag
- [ ] `permissions` table created with module, action, and resource_type fields
- [ ] `role_permissions` junction table created with proper foreign keys
- [ ] `user_roles` table created with assignment tracking
- [ ] All default roles (learner, mentor, team_member, super_admin) seeded
- [ ] All permissions from matrix seeded in database
- [ ] Unique constraints prevent duplicate role-permission assignments
- [ ] Unique constraints prevent duplicate active user-role assignments
- [ ] All indexes created for O(1) and O(n) lookups
- [ ] Query: Get all permissions for user (via user_roles → role_permissions) works efficiently
- [ ] Query: Get all users with specific permission works efficiently
- [ ] Cascade delete: Deleting role removes all related role_permissions and user_roles
- [ ] Test data: Super-admin, mentor, team member, learner with different permissions
- [ ] Migration file generated and runnable
- [ ] RBAC middleware can validate permission in single database query

## Dependencies

- Task 02: Users and Profiles Tables
- Task 01: Drizzle ORM Setup and Configuration
- PRD Section 9 (Permissions Matrix)

## Technical Notes

### Permission Naming Convention

- Use hierarchical naming: `module:action` (e.g., `courses:create`, `users:ban`)
- Action verbs: create, read, update, delete, manage (covers multiple actions), publish, archive
- Keep permission names lowercase with underscores
- Document each permission in description field

### RBAC Implementation Pattern

```typescript
// Check if user has permission
const hasPermission = async (userId: UUID, permissionName: string) => {
  return db
    .select()
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(permissions.name, permissionName),
        isNull(userRoles.revokedAt)
      )
    )
    .limit(1);
};
```

### Permission Configuration

- Super-admin can modify all permissions for all roles
- Track all permission changes in audit logs for compliance

### Cascade Delete Strategy

- Deleting role should delete all role_permissions AND user_roles assignments
- Set up CASCADE DELETE foreign keys in migration
- Consider archiving instead of hard delete for historical record

### Permission Scope Resolution

`resource_scope` field enables fine-grained access:

- `all` - Access to all resources
- `own` - Access only to resources created by user
- `team` - Access to team resources
- `supervised` - Mentor access to learner courses
- Use application logic to enforce scope, not just database

### Role Hierarchy

While not enforced in schema, establish hierarchy for validation:

1. Learner (no admin permissions)
2. Mentor (can manage own courses)
3. Team Member (can assist mentor)
4. Super Admin (full access, only admin role)

### Bulk Permission Assignment

When creating new role, use bulk insert to assign permissions:

```typescript
await db.insert(rolePermissions).values(
  permissionIds.map((permId) => ({
    roleId: newRole.id,
    permissionId: permId,
  }))
);
```

### Caching Permissions

- Cache user permissions in memory or Redis for performance
- Invalidate cache on role/permission changes
- Implement 5-minute TTL for permission cache
- Include permission check in authorization middleware

### Audit Logging

- Log all role assignments (user_roles creation)
- Log all role permission changes (role_permissions modifications)
- Log all permission changes with justification
- Include `assigned_by` field to track who made changes

### Testing Considerations

- Test permission inheritance from role to user
- Test permission denial (negative test)
- Test role hierarchy and override
- Test bulk permission queries
- Test cascade delete of roles
- Test permission caching invalidation
- Verify super-admin cannot be removed from super_admin role

### Migration Seed Data

Include in migration SQL:

```sql
INSERT INTO roles (name, display_name, is_system) VALUES
  ('learner', 'Learner', true),
  ('mentor', 'Mentor', true),
  ('team_member', 'Team Member', true),
  ('super_admin', 'Super Administrator', true);

INSERT INTO permissions (name, display_name, module, action, resource_type) VALUES
  ('courses:create', 'Create Course', 'courses', 'create', 'course'),
  ... (all permissions from matrix)
```

### Performance Optimization

- Add partial index on `user_roles` for active assignments: `WHERE revoked_at IS NULL`
- Consider materialized view for user permissions if many lookups
- Batch permission checks when possible
- Use prepared statements in queries for better performance
