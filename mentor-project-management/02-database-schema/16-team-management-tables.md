# Task 16: Team Management Tables

## Description

Create tables for managing mentor teams and team member collaboration. Enables mentors to invite team members, manage their approval, and track team activity. Team members can have delegated permissions and assist with course management and learner support.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (team management endpoints)
- `apps/web-mentor` (team creation and member management)
- `apps/web-admin` (team monitoring and support)

## Requirements

### Teams Table

Create table `teams`:

| Column         | Type           | Constraints                | Description                               |
| -------------- | -------------- | -------------------------- | ----------------------------------------- |
| `id`           | `UUID`         | PK, Default: `uuid_v7()`   | Unique team identifier                    |
| `name`         | `VARCHAR(255)` | NOT NULL                   | Team name (e.g., "Sarah's Makeup Studio") |
| `slug`         | `VARCHAR(255)` | UNIQUE, NOT NULL           | URL-friendly slug                         |
| `description`  | `TEXT`         | NULL                       | Team description                          |
| `mentor_id`    | `UUID`         | FK → users(id), NOT NULL   | Primary mentor/owner                      |
| `logo_url`     | `TEXT`         | NULL                       | Team logo (R2 URL)                        |
| `is_active`    | `BOOLEAN`      | NOT NULL, DEFAULT: TRUE    | Team active status                        |
| `member_count` | `INTEGER`      | DEFAULT: 1                 | Denormalized member count                 |
| `created_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Team creation                             |
| `updated_at`   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Last update                               |

### Indexes for Teams Table

- Primary Key: `id`
- Index: `(mentor_id)` - find mentor's team
- Unique Index: `(slug)` - URL routing
- Index: `(is_active)` - find active teams

### Team Members Table

Create table `team_members`:

| Column                  | Type          | Constraints                           | Description                                      |
| ----------------------- | ------------- | ------------------------------------- | ------------------------------------------------ |
| `id`                    | `UUID`        | PK, Default: `uuid_v7()`              | Unique membership identifier                     |
| `team_id`               | `UUID`        | FK → teams(id), NOT NULL              | Team reference                                   |
| `user_id`               | `UUID`        | FK → users(id), NOT NULL              | Team member user                                 |
| `role`                  | `VARCHAR(50)` | NOT NULL, DEFAULT: 'member'           | Enum: owner, co_mentor, assistant                |
| `status`                | `VARCHAR(50)` | NOT NULL, DEFAULT: 'pending_approval' | Enum: invited, pending_approval, active, removed |
| `permissions`           | `TEXT[]`      | DEFAULT: ARRAY[]::TEXT[]              | Array of permission strings                      |
| `invited_at`            | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`            | When invited                                     |
| `invited_by`            | `UUID`        | FK → users(id), NOT NULL              | Who sent invitation                              |
| `approval_requested_at` | `TIMESTAMP`   | NULL                                  | When user accepted invite                        |
| `approved_at`           | `TIMESTAMP`   | NULL                                  | When mentor approved                             |
| `approved_by`           | `UUID`        | FK → users(id), NULL                  | Who approved (mentor)                            |
| `removed_at`            | `TIMESTAMP`   | NULL                                  | When removed from team                           |
| `removed_by`            | `UUID`        | FK → users(id), NULL                  | Who removed member                               |
| `created_at`            | `TIMESTAMP`   | NOT NULL, DEFAULT: `now()`            | Record creation                                  |

### Team Member Status Lifecycle

- **invited** - Invitation sent to email, awaiting acceptance
- **pending_approval** - User accepted, waiting for mentor approval
- **active** - Approved, full team member
- **removed** - Left team or was removed

### Team Member Roles

- **owner** - Primary mentor (cannot be removed)
- **co_mentor** - Can manage courses and team
- **assistant** - Can assist with grading and support

### Permissions for Team Members

Common permission strings:

- `courses:manage` - Manage team courses
- `courses:publish` - Publish courses
- `assignments:grade` - Grade assignments
- `community:moderate` - Moderate community posts
- `enrollments:view` - View enrollment analytics
- `team:manage_members` - Add/remove team members
- `team:view_analytics` - View team analytics

### Unique Constraint for Team Members

- Composite unique index: `(team_id, user_id)` - one membership per user per team

### Indexes for Team Members Table

- Primary Key: `id`
- Index: `(team_id)` - find team members
- Index: `(user_id)` - find user's teams
- Index: `(status)` - find active members
- Composite Index: `(team_id, status)` - active team members
- Index: `(invited_at)` - recent invitations
- Partial Index: `(team_id)` WHERE `status = 'active'` - active members only

### Team Activity Logs Table

Create table `team_activity_logs`:

| Column           | Type           | Constraints                | Description                                                                           |
| ---------------- | -------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `id`             | `UUID`         | PK, Default: `uuid_v7()`   | Unique log entry identifier                                                           |
| `team_id`        | `UUID`         | FK → teams(id), NOT NULL   | Team involved                                                                         |
| `actor_id`       | `UUID`         | FK → users(id), NOT NULL   | User performing action                                                                |
| `action_type`    | `VARCHAR(100)` | NOT NULL                   | Enum: member_invited, member_approved, member_removed, course_created, course_updated |
| `target_user_id` | `UUID`         | FK → users(id), NULL       | User affected by action                                                               |
| `target_id`      | `UUID`         | NULL                       | Resource ID (course_id, etc.)                                                         |
| `details`        | `JSONB`        | NULL                       | Action details                                                                        |
| `timestamp`      | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | Action timestamp                                                                      |

### Indexes for Team Activity Logs

- Primary Key: `id`
- Index: `(team_id)` - find team activity
- Index: `(actor_id)` - find user's team actions
- Index: `(action_type)` - filter by action
- Index: `(timestamp)` - chronological queries
- Composite Index: `(team_id, timestamp)` - team activity timeline

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE team_member_role AS ENUM ('owner', 'co_mentor', 'assistant');
CREATE TYPE team_member_status AS ENUM ('invited', 'pending_approval', 'active', 'removed');
CREATE TYPE team_activity_action AS ENUM (
  'member_invited',
  'member_approved',
  'member_removed',
  'course_created',
  'course_updated',
  'course_published',
  'assignment_graded'
);
```

### Drizzle Schema Definition

In `packages/db/src/schema/team.ts`:

- Define `teams` table
- Define `teamMembers` table
- Define `teamActivityLogs` table
- Use `relations()` for:
  - teams → users (via mentor_id)
  - teams ↔ teamMembers (one-to-many)
  - teamMembers → users (via user_id)
  - teamActivityLogs → teams (N:1)
  - teamActivityLogs → users (N:1)

## Database Tables

### teams

- **Purpose**: Team organization for mentors
- **Row estimate**: ~10K-100K teams (grows with mentor count)
- **Key relationships**: N:1 with users (mentor), 1:N with teamMembers

### team_members

- **Purpose**: Track team membership and permissions
- **Row estimate**: ~50K-500K members (avg 3-5 per team)
- **Key relationships**: N:1 with teams, N:1 with users

### team_activity_logs

- **Purpose**: Activity audit trail for teams
- **Row estimate**: ~100K-1M logs (varies by activity)
- **Key relationships**: N:1 with teams, N:1 with users

## Acceptance Criteria

- [ ] `teams` table created with mentor ownership
- [ ] `team_members` table created with role and status
- [ ] Team member status lifecycle enforced (invited → pending → active)
- [ ] Unique constraint on (team_id, user_id) prevents duplicate membership
- [ ] Team member roles defined (owner, co_mentor, assistant)
- [ ] Permissions array supports granular access control
- [ ] Invitation workflow tracked (invited_at, approval_requested_at, approved_at)
- [ ] Team activity logs created for important actions
- [ ] Denormalized member_count updatable on team
- [ ] All timestamps in UTC timezone
- [ ] Indexes created for efficient team queries
- [ ] Test data with multiple teams and members
- [ ] Test member invitation and approval workflow
- [ ] Test permission-based access control
- [ ] Test team activity logging
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Task 04: RBAC - Roles and Permissions Tables

## Technical Notes

### Team Invitation Flow

```typescript
// Mentor invites team member
const inviteTeamMember = async (teamId, email, role) => {
  // Check if user exists
  let user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    // Create pending user (or send invite to external email)
    user = await createPendingUser(email);
  }

  // Create invitation
  const invitation = await db.insert(teamMembers).values({
    teamId,
    userId: user.id,
    role,
    status: "invited",
    invitedAt: NOW,
    invitedBy: req.user.id,
  });

  // Send invitation email
  const inviteLink = `${APP_URL}/team/invitation?id=${invitation.id}`;

  await sendEmail(email, {
    subject: `You've been invited to a team on Mentor`,
    body: `Accept invitation: ${inviteLink}`,
  });

  // Log activity
  await logTeamActivity(teamId, req.user.id, "member_invited", user.id);
};
```

### Accept Invitation Flow

```typescript
const acceptTeamInvitation = async (invitationId) => {
  const invitation = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, invitationId))
    .limit(1);

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  // Update invitation status
  await db
    .update(teamMembers)
    .set({
      status: "pending_approval",
      approvalRequestedAt: NOW,
    })
    .where(eq(teamMembers.id, invitationId));

  // Notify mentor of pending approval
  const team = await getTeam(invitation.teamId);
  const mentor = await getUser(team.mentorId);

  await sendEmail(mentor.email, {
    subject: "Team member approval pending",
    body: `${invitation.user.name} accepted your team invitation. Approve them to get started.`,
  });

  // Log activity
  await logTeamActivity(
    invitation.teamId,
    invitation.userId,
    "member_acceptance",
  );
};
```

### Approve Team Member

```typescript
const approveTeamMember = async (teamId, memberId) => {
  const member = await db
    .update(teamMembers)
    .set({
      status: "active",
      approvedAt: NOW,
      approvedBy: req.user.id,
    })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
    .returning();

  // Notify member of approval
  await sendEmail(member.user.email, {
    subject: "You're now part of the team!",
    body: "Your team membership has been approved. Start collaborating now!",
  });

  // Log activity
  await logTeamActivity(teamId, req.user.id, "member_approved", memberId);

  // Update team member count
  await updateTeamMemberCount(teamId);
};
```

### Remove Team Member

```typescript
const removeTeamMember = async (teamId, memberId) => {
  const membership = await db
    .update(teamMembers)
    .set({
      status: "removed",
      removedAt: NOW,
      removedBy: req.user.id,
    })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
    .returning();

  // Log activity
  await logTeamActivity(
    teamId,
    req.user.id,
    "member_removed",
    membership[0].userId,
  );

  // Revoke access to shared resources
  await revokeTeamMemberAccess(membership[0].userId, teamId);

  // Update team member count
  await updateTeamMemberCount(teamId);
};
```

### Check Team Member Permissions

```typescript
const checkTeamPermission = async (userId, teamId, permission) => {
  const member = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.status, "active"),
      ),
    )
    .limit(1);

  if (!member) {
    return false;
  }

  // Owner has all permissions
  if (member.role === "owner") {
    return true;
  }

  // Check specific permission
  return member.permissions.includes(permission);
};
```

### Query Patterns

```typescript
// Get team's active members
const getTeamMembers = (teamId) => {
  return db
    .select()
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    )
    .orderBy(asc(teamMembers.role));
};

// Get pending approvals for mentor
const getPendingApprovals = (mentorId) => {
  return db
    .select()
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teams.mentorId, mentorId),
        eq(teamMembers.status, "pending_approval"),
      ),
    )
    .orderBy(asc(teamMembers.approvalRequestedAt));
};

// Get user's teams
const getUserTeams = (userId) => {
  return db
    .select()
    .from(teams)
    .innerJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .where(
      and(eq(teamMembers.userId, userId), eq(teamMembers.status, "active")),
    );
};

// Get team activity
const getTeamActivity = (teamId) => {
  return db
    .select()
    .from(teamActivityLogs)
    .where(eq(teamActivityLogs.teamId, teamId))
    .orderBy(desc(teamActivityLogs.timestamp))
    .limit(50);
};
```

### Permission Management

```typescript
// Set permissions for team member
const setTeamMemberPermissions = async (teamId, memberId, permissions) => {
  const member = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, memberId))
    .limit(1);

  if (member.role === "owner") {
    throw new Error("Cannot modify owner permissions");
  }

  await db
    .update(teamMembers)
    .set({ permissions })
    .where(eq(teamMembers.id, memberId));

  // Log activity
  await logTeamActivity(teamId, req.user.id, "permissions_updated", {
    targetMemberId: memberId,
    permissions,
  });
};

// Default permissions by role
const defaultPermissions = {
  owner: [
    "courses:manage",
    "courses:publish",
    "assignments:grade",
    "community:moderate",
    "team:manage_members",
  ],
  co_mentor: [
    "courses:manage",
    "courses:publish",
    "assignments:grade",
    "community:moderate",
  ],
  assistant: ["assignments:grade", "community:moderate"],
};
```

### Team Activity Logging

```typescript
const logTeamActivity = async (
  teamId,
  actorId,
  actionType,
  targetUserId = null,
  details = null,
) => {
  await db.insert(teamActivityLogs).values({
    teamId,
    actorId,
    actionType,
    targetUserId,
    details,
    timestamp: NOW,
  });
};
```

### Testing Considerations

- Test team creation and slug generation
- Test member invitation and acceptance
- Test approval workflow
- Test permission checking
- Test member removal
- Test activity logging
- Test team member count denormalization
- Test role-based default permissions
- Test cascade effects (deleting team deletes memberships)
- Test access control (members can only see their teams)

### Performance Optimization

- Partial index on active members: `WHERE status = 'active'`
- Denormalize member count for fast team stats
- Cache team member permissions (5-minute TTL)
- Index on (team_id, status) for active member queries
- Batch operations for bulk member management

### UI/UX Considerations

- Show pending approvals prominently for mentors
- Allow easy permission customization per role
- Display team activity feed on team dashboard
- Show member status and join date in member list
- Allow mentors to bulk invite members
