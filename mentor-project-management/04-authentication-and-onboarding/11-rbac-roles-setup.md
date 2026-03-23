# RBAC Roles Setup

## Description

Implement Role-Based Access Control (RBAC) using BetterAuth's RBAC plugin. Define all 4 roles (Learner, Mentor, Team Member, Super Admin) with comprehensive permission sets. Create middleware for route protection, API endpoint guards, and permission checking utilities. Map entire PRD permissions matrix (Section 9).

## Affected Apps/Packages

- `packages/auth`
- Backend: Hono API
- Frontend: All web apps and mobile

## API Endpoints

### GET /auth/user/permissions

Get current user's permissions.

**Response** (200 OK):

```json
{
  "role": "mentor",
  "permissions": [
    "courses:create",
    "courses:edit_own",
    "courses:publish",
    "courses:view_analytics",
    "students:message",
    "profile:edit",
    "profile:view",
    "dashboard:view"
  ],
  "scope": "platform"
}
```

### GET /auth/roles

Admin endpoint to list all roles and permissions.

**Response** (200 OK):

```json
{
  "roles": [
    {
      "id": "learner",
      "name": "Learner",
      "description": "Student/learner user",
      "permissions": [...],
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "mentor",
      "name": "Mentor",
      "description": "Course instructor",
      "permissions": [...],
      "createdAt": "2024-01-01T00:00:00Z"
    }
    // ... other roles
  ]
}
```

### POST /auth/user/{userId}/role

Admin endpoint to assign role to user.

**Request Body**:

```json
{
  "role": "mentor",
  "reason": "Approved instructor application"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "role": "mentor"
  }
}
```

## Requirements

### Role Definitions

**1. Learner**

- Default role for new signups
- Can browse, search, enroll in courses
- Can watch course videos and access content
- Can submit assignments
- Can participate in discussions
- Can access personal dashboard
- Cannot create courses
- Cannot view other student data
- Expiry: None (persistent role)

**2. Mentor**

- Instructor/course creator
- Can create and publish courses
- Can manage their own courses
- Can view student progress and analytics
- Can message students
- Can create live sessions
- Can view performance metrics
- Cannot delete published courses
- Cannot see other instructors' students
- Requires approval to become mentor

**3. Team Member**

- Administrative team member
- Can help manage courses (not create)
- Can message students
- Can view assigned course analytics
- Can manage course content (edit, add lessons)
- Cannot create new courses from scratch
- Cannot access admin panel
- Cannot manage users
- Limited to assigned courses

**4. Super Admin**

- Platform administrator
- Full platform access
- Can manage all users and roles
- Can manage system settings
- Can access financial/billing data
- Can manage domain, email, security settings
- Can view all analytics and reports
- Can delete courses/content
- Can manage integrations
- Audit log access

### Permission Structure

Format: `resource:action` or `scope:action`

**Course Management**:

- `courses:create` - Create new course
- `courses:edit_own` - Edit own courses (mentors)
- `courses:edit_all` - Edit any course (super admin)
- `courses:delete_own` - Delete own courses (mentors)
- `courses:delete_all` - Delete any course (super-admin)
- `courses:publish` - Publish course
- `courses:unpublish` - Unpublish course
- `courses:view_own` - View own courses
- `courses:view_all` - View all courses
- `courses:view_analytics_own` - View own course analytics
- `courses:view_analytics_all` - View all analytics (admin)
- `courses:manage_content` - Edit lessons, modules, etc.
- `courses:manage_students` - View enrolled students

**Student/User Management**:

- `users:create` - Create user accounts
- `users:edit_own` - Edit own profile
- `users:edit_all` - Edit any user profile
- `users:delete` - Delete user accounts
- `users:suspend` - Suspend/restrict user access
- `users:verify` - Verify user identity
- `users:view_profile` - View user profiles
- `users:manage_roles` - Assign roles to users
- `users:bulk_import` - Import users from file

**Mentors/Instructors**:

- `mentors:apply` - Submit mentor application
- `mentors:approve` - Approve mentor applications (admin)
- `mentors:reject` - Reject applications
- `mentors:list` - View mentor directory (learners)
- `mentors:manage` - Manage mentor accounts

**Student/Learning**:

- `courses:enroll` - Enroll in course
- `courses:unenroll` - Unenroll from course
- `assignments:submit` - Submit assignments
- `assignments:view_feedback` - View feedback
- `discussions:participate` - Post in discussions
- `discussions:moderate` - Moderate discussions
- `live-sessions:attend` - Join live sessions
- `live-sessions:host` - Host live sessions (mentors)

**Messaging**:

- `messages:send_learner` - Send messages to learners
- `messages:send_all` - Send messages to anyone
- `messages:view_own` - View own messages
- `messages:view_all` - View all messages (admin)
- `messages:delete` - Delete messages

**Reporting & Analytics**:

- `analytics:view_own` - View own analytics
- `analytics:view_team` - View team analytics
- `analytics:view_platform` - View platform analytics
- `reports:generate` - Generate reports
- `reports:export` - Export reports

**Admin Panel**:

- `admin:access` - Access admin dashboard
- `admin:view_users` - View user list
- `admin:view_courses` - View course list
- `admin:view_analytics` - View analytics
- `admin:view_settings` - View system settings
- `admin:edit_settings` - Edit system settings
- `admin:view_logs` - View audit logs

**Platform Settings**:

- `settings:view` - View settings
- `settings:edit_company` - Edit company info
- `settings:edit_security` - Edit security settings
- `settings:edit_email` - Configure email provider
- `settings:edit_payment` - Configure payment settings
- `settings:edit_content` - Edit content moderation
- `settings:manage_domains` - Manage domains
- `settings:manage_integrations` - Manage 3rd party integrations

### Permissions By Role

**Learner**:

```
courses:enroll
courses:unenroll
courses:view_own (enrolled courses)
assignments:submit
assignments:view_feedback
discussions:participate
discussions:moderate (own discussions)
live-sessions:attend
messages:send_learner (to instructor)
messages:view_own
profile:view
profile:edit
dashboard:view
```

**Mentor**:

```
[Learner permissions] +
courses:create
courses:edit_own
courses:delete_own
courses:publish
courses:unpublish
courses:view_own (all owned)
courses:manage_content
courses:manage_students
assignments:create
assignments:grade
discussions:moderate (in own courses)
mentors:list
messages:send_learner (to enrolled students)
analytics:view_own
live-sessions:host
notifications:configure
dashboard:view (mentor dashboard)
```

**Team Member**:

```
[Learner permissions] +
courses:edit_all (assigned courses only)
courses:manage_content (assigned courses)
courses:manage_students (assigned courses)
assignments:grade (assigned courses)
discussions:moderate (assigned courses)
analytics:view_team
messages:send_learner
dashboard:view (team dashboard)
notifications:configure
```

**Super Admin**:

```
[All permissions above] +
users:delete
courses:delete_all
courses:unpublish (any course)
settings:view
settings:edit_company
settings:edit_security
settings:edit_email
settings:edit_payment
settings:edit_content
settings:manage_domains
settings:manage_integrations
admin:view_logs
admin:edit_settings
roles:create (new roles)
roles:edit
roles:delete
```

### BetterAuth RBAC Configuration

```typescript
// packages/auth/src/config.ts
export const authConfig = {
  providers: [...],
  rbac: {
    roles: {
      learner: {
        displayName: 'Learner',
        permissions: [
          'courses:enroll',
          'courses:unenroll',
          // ... all learner permissions
        ],
      },
      mentor: {
        displayName: 'Mentor',
        permissions: [
          // ... all mentor permissions
        ],
      },
      team_member: {
        displayName: 'Team Member',
        permissions: [
          // ... all team member permissions
        ],
      },
      super_admin: {
        displayName: 'Super Admin',
        permissions: [
          // ... all super admin permissions
        ],
      },
    },
  },
};
```

### Middleware for Role Protection

- Create middleware factory function
- Accept role(s) to require
- Check user exists and has role
- Return 403 Forbidden if unauthorized
- Support multiple roles (OR logic)
- Support permission-based access (more granular)

### API Endpoint Guards

- Apply middleware to routes
- Routes return 403 if user lacks role
- Include reason in error message
- Log unauthorized attempts
- Distinguish between 401 (unauthenticated) and 403 (forbidden)

### Frontend Route Protection

- Check user role before rendering
- Redirect to unauthorized page
- Show appropriate error messages
- Hide navigation items user cannot access
- Disable buttons for restricted actions

### Permission Utility Functions

- `hasRole(user, role)` - Check if user has role
- `hasAnyRole(user, roles)` - Check if user has any role
- `hasPermission(user, permission)` - Check specific permission
- `hasAllPermissions(user, permissions)` - Check all in list
- `can(user, resource, action)` - Semantic check

### Audit Logging

- Log role assignments with admin ID
- Log permission usage (analytics)
- Log access denials for security review
- Include user ID, action, resource, timestamp
- Retention: 1 year minimum

### Database Schema

```typescript
export const roles = pgTable("role", {
  id: text("id").primaryKey(), // 'learner', 'mentor', etc.
  name: text("name").notNull(),
  description: text("description"),
  level: integer("level"), // 0=learner, 1=mentor, 2=team, 3=super-admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const permissions = pgTable("permission", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  resource: text("resource").notNull(), // 'courses', 'users', etc.
  action: text("action").notNull(), // 'create', 'edit', 'delete', etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  })
);

export const userRoles = pgTable(
  "user_role",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    assignedBy: text("assigned_by").references(() => users.id),
    reason: text("reason"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  })
);

export const roleAudit = pgTable("role_audit", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  adminId: text("admin_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(), // 'assign', 'remove', 'change'
  roleId: text("role_id").notNull(),
  reason: text("reason"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});
```

### Hono Middleware Examples

```typescript
// Require single role
export function requireRole(roleId: string) {
  return async (c: Context, next: Next) => {
    const user = c.get("auth.user");

    if (!user || user.role !== roleId) {
      return c.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        403
      );
    }

    await next();
  };
}

// Require any of multiple roles
export function requireAnyRole(roleIds: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("auth.user");

    if (!user || !roleIds.includes(user.role)) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    await next();
  };
}

// Require specific permission
export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const user = c.get("auth.user");

    if (!user) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }

    const userPermissions = await getUserPermissions(user.id);

    if (!userPermissions.includes(permission)) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    await next();
  };
}

// Require role level (hierarchical check)
export function requireRoleLevel(minLevel: number) {
  const roleLevels: Record<string, number> = {
    learner: 0,
    mentor: 1,
    team_member: 2,
    super_admin: 3,
  };

  return async (c: Context, next: Next) => {
    const user = c.get("auth.user");
    const userLevel = roleLevels[user?.role || "learner"] || 0;

    if (userLevel < minLevel) {
      return c.json({ error: "FORBIDDEN" }, 403);
    }

    await next();
  };
}
```

### Usage in Routes

```typescript
// Protect route with role
app.get("/admin/users", requireRole("super_admin"), async (c: Context) => {
  // Handle request
});

// Protect with multiple roles
app.post(
  "/courses/:id/publish",
  requireAnyRole(["mentor", "super_admin"]),
  async (c: Context) => {
    // Handle request
  }
);

// Protect with permission
app.delete(
  "/courses/:id",
  requirePermission("courses:delete_all"),
  async (c: Context) => {
    // Handle request
  }
);

// Protect with role level
app.get(
  "/admin/analytics",
  requireRoleLevel(3), // super_admin and above
  async (c: Context) => {
    // Handle request
  }
);
```

### Frontend Permission Checks (React)

```typescript
// hooks/usePermission.ts
import { useAuth } from '@/contexts/AuthContext';

export function usePermission() {
  const { user } = useAuth();

  const hasRole = (role: string) => user?.role === role;

  const hasAnyRole = (roles: string[]) => roles.includes(user?.role || '');

  const hasPermission = async (permission: string) => {
    if (!user) return false;
    const permissions = await fetchUserPermissions(user.id);
    return permissions.includes(permission);
  };

  return { hasRole, hasAnyRole, hasPermission };
}

// Usage in components
export function CourseHeader({ course }: { course: Course }) {
  const { hasPermission } = usePermission();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    hasPermission('courses:edit_own').then(setCanEdit);
  }, []);

  return (
    <div>
      <h1>{course.title}</h1>
      {canEdit && <button>Edit Course</button>}
    </div>
  );
}
```

### Permission Caching

- Cache user permissions in memory (5 min TTL)
- Invalidate on role change
- Use Redis for distributed systems
- Check cache before database query

### Migration Strategy

- Create roles and permissions in seed data
- Assign default roles to existing users
- Log migration for audit
- Test permission checks before deployment

## Acceptance Criteria

- [ ] All 5 roles defined in database
- [ ] All permissions defined and mapped to roles
- [ ] BetterAuth RBAC plugin configured
- [ ] Learner role assigned by default on signup
- [ ] Mentor role requires manual approval
- [ ] Super-admin can assign any role
- [ ] Middleware enforces role-based access
- [ ] API endpoints return 403 for unauthorized access
- [ ] Frontend hides restricted features
- [ ] Permission checks are consistent
- [ ] Audit logs track role assignments
- [ ] Role level hierarchy works (comparisons)
- [ ] All endpoints protected appropriately
- [ ] Documentation describes each permission
- [ ] Backend validates role on each request
- [ ] Permissions cached efficiently
- [ ] Seed data includes all roles/permissions
- [ ] Tests cover permission scenarios
- [ ] No hardcoded role checks (use middleware)

## Dependencies

- BetterAuth with RBAC plugin
- Drizzle ORM for database operations
- redis for distributed caching (optional)

## Technical Notes

### Permission Utility Module

```typescript
// packages/auth/src/permissions.ts
export const PERMISSIONS = {
  COURSES_CREATE: "courses:create",
  COURSES_EDIT_OWN: "courses:edit_own",
  COURSES_DELETE_OWN: "courses:delete_own",
  COURSES_PUBLISH: "courses:publish",
  COURSES_VIEW_ANALYTICS_OWN: "courses:view_analytics_own",
  USERS_MANAGE_ROLES: "users:manage_roles",
  ADMIN_ACCESS: "admin:access",
  // ... all permissions as constants
};

export async function getUserPermissions(userId: string): Promise<string[]> {
  // Check cache first
  const cached = await cache.get(`permissions:${userId}`);
  if (cached) return cached;

  // Fetch from database
  const permissions = await db.query.rolePermissions
    .findMany({
      where: eq(rolePermissions.roleId, user.role),
    })
    .then((rps) => rps.map((rp) => rp.permission.name));

  // Cache for 5 minutes
  await cache.set(`permissions:${userId}`, permissions, 5 * 60);

  return permissions;
}
```

### Seed Data

```typescript
// packages/database/seeds/roles.ts
export async function seedRoles() {
  // Create roles
  const roles = [
    { id: "learner", name: "Learner", level: 0 },
    { id: "mentor", name: "Mentor", level: 1 },
    { id: "team_member", name: "Team Member", level: 2 },
    { id: "super_admin", name: "Super Admin", level: 3 },
  ];

  for (const role of roles) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  // Create permissions and assign to roles
  // (large block, omitted for brevity)
}
```

### Testing Permissions

```typescript
// tests/permissions.test.ts
describe("RBAC", () => {
  it("should allow mentor to create course", async () => {
    const mentor = await createTestUser("mentor");
    const response = await app.request("/courses", {
      method: "POST",
      headers: { Authorization: `Bearer ${mentor.token}` },
    });
    expect(response.status).toBe(201);
  });

  it("should deny learner from creating course", async () => {
    const learner = await createTestUser("learner");
    const response = await app.request("/courses", {
      method: "POST",
      headers: { Authorization: `Bearer ${learner.token}` },
    });
    expect(response.status).toBe(403);
  });
});
```

## Verification Notes (2026-02-26)

- Code evidence:
  - `packages/auth/src/permissions.ts`
  - `packages/api/src/middleware/rbac.ts`
  - `packages/api/src/routers/roles.ts`
  - `packages/db/src/schema/roles.ts`
  - `packages/db/src/seed.ts` (roles + role-permission mapping)
- Verification evidence:
  - Role-protected middleware and router wiring are exercised via API route architecture and type-safe protected procedures.
