# Team Dashboard

## Description

Build the team management UI in the Mentor web app for primary instructors. Display list of team members with name, email, status, and joined date. Show activity log per member with recent actions. Enable removing team members with confirmation. Display pending invitations with resend/revoke options. Provide team analytics and member contribution metrics.

## Affected Apps/Packages

- Frontend: `mentor-web` (Next.js)
- Backend: `hono-api` service
- Database: PostgreSQL team_members, team_invitations, activity_logs tables
- Component Library: shadcn/ui Button, Dialog, Table components

## API Endpoints

### GET /teams/members

**List team members**

**Request:**

```http
GET /teams/members?limit=25&offset=0&status=active
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `limit` (optional, default: 25): Items per page
- `offset` (optional, default: 0): For pagination
- `status` (optional): "active", "pending_verification", "suspended", "removed"
- `sortBy` (optional, default: "joined_date_desc"): "joined_date_asc", "joined_date_desc", "name_asc", "name_desc"

**Response (200 OK):**

```json
{
  "members": [
    {
      "teamMemberId": "team-member-uuid-1",
      "userId": "user-uuid-1",
      "instructorId": "instructor-uuid-1",
      "name": "John Smith",
      "email": "john@example.com",
      "role": "team_member",
      "status": "active",
      "joinedAt": "2024-02-10T08:00:00Z",
      "profileImage": "https://...",
      "specialization": ["makeup_artist", "color_theory"],
      "recentActivity": {
        "lastActiveAt": "2024-02-18T10:30:00Z",
        "actionCount": 12,
        "actionType": "course_published"
      }
    },
    {
      "teamMemberId": "team-member-uuid-2",
      "userId": "user-uuid-2",
      "instructorId": "instructor-uuid-2",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "team_member",
      "status": "pending_verification",
      "joinedAt": "2024-02-15T14:22:00Z",
      "profileImage": null,
      "specialization": ["esthetician"],
      "recentActivity": {
        "lastActiveAt": "2024-02-15T14:25:00Z",
        "actionCount": 0,
        "actionType": "onboarding_completed"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25,
    "total": 2,
    "hasMore": false
  },
  "summary": {
    "totalMembers": 2,
    "activeMembers": 1,
    "pendingMembers": 1,
    "removedMembers": 0
  }
}
```

---

### GET /teams/members/:memberId/activity

**Get activity log for a specific team member**

**Request:**

```http
GET /teams/members/team-member-uuid-1/activity?limit=50&offset=0&days=30
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `limit` (optional, default: 50): Items per page
- `offset` (optional, default: 0): For pagination
- `days` (optional, default: 30): Last N days of activity
- `action` (optional): Filter by action type (e.g., "course_created", "course_published")

**Response (200 OK):**

```json
{
  "memberId": "team-member-uuid-1",
  "memberName": "John Smith",
  "activities": [
    {
      "activityId": "act-uuid-1",
      "actor": "john@example.com",
      "action": "course_published",
      "actionLabel": "Published course",
      "target": "course",
      "targetId": "course-uuid-123",
      "targetName": "Advanced Makeup Techniques",
      "timestamp": "2024-02-18T10:30:00Z",
      "details": {
        "courseTitle": "Advanced Makeup Techniques",
        "studentCount": 45
      }
    },
    {
      "activityId": "act-uuid-2",
      "actor": "john@example.com",
      "action": "course_created",
      "actionLabel": "Created course",
      "target": "course",
      "targetId": "course-uuid-124",
      "targetName": "Lip Art Masterclass",
      "timestamp": "2024-02-17T14:15:00Z",
      "details": {
        "courseTitle": "Lip Art Masterclass"
      }
    },
    {
      "activityId": "act-uuid-3",
      "actor": "john@example.com",
      "action": "comment_moderated",
      "actionLabel": "Moderated comment",
      "target": "comment",
      "targetId": "comment-uuid-456",
      "targetName": "Comment on Advanced Makeup Techniques",
      "timestamp": "2024-02-16T09:45:00Z",
      "details": {
        "action": "approved",
        "commentSnippet": "Great course!..."
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 23,
    "hasMore": false
  },
  "stats": {
    "totalActions": 23,
    "activeAtLastAction": "2024-02-18T10:30:00Z",
    "courseCreatedCount": 5,
    "coursePublishedCount": 3,
    "contentModeratedCount": 8
  }
}
```

---

### PUT /teams/members/:memberId

**Edit a team member's details**

**Request:**

```http
PUT /teams/members/team-member-uuid-1
Authorization: Bearer {instructor_jwt}
Content-Type: application/json

{
  "name": "John Smith Jr.",
  "roleDescription": "Senior Makeup Instructor",
  "specialization": ["makeup_artist", "color_theory", "skincare"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "teamMemberId": "team-member-uuid-1",
  "name": "John Smith Jr.",
  "roleDescription": "Senior Makeup Instructor",
  "specialization": ["makeup_artist", "color_theory", "skincare"],
  "updatedAt": "2024-02-18T10:35:00Z"
}
```

**Error Responses:**

- 404: Team member not found
- 403: Not authorized to edit (must be primary instructor)
- 400: Invalid input (validation error)

**Notes:**

- Only the primary instructor can edit team member details
- Changes are logged in the activity_logs table with before/after snapshot
- Cannot change team member's email (handled via separate flow)

---

### DELETE /teams/members/:memberId

**Remove a team member**

**Request:**

```http
DELETE /teams/members/team-member-uuid-1
Authorization: Bearer {instructor_jwt}
Content-Type: application/json

{
  "reason": "No longer needed" (optional)
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "teamMemberId": "team-member-uuid-1",
  "memberName": "John Smith",
  "removedAt": "2024-02-18T10:35:00Z",
  "message": "Team member removed successfully. They can no longer access the team."
}
```

**Error Responses:**

- 404: Team member not found
- 403: Not authorized to remove (must be primary instructor)
- 409: Cannot remove primary instructor

---

### GET /teams/invitations

**List pending invitations sent to this team**

**Request:**

```http
GET /teams/invitations?status=pending
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `status` (optional): "pending", "accepted", "declined", "expired", "revoked"

**Response (200 OK):**

```json
{
  "invitations": [
    {
      "invitationId": "inv-uuid-1",
      "email": "teammate@example.com",
      "status": "pending",
      "sentAt": "2024-02-18T10:30:00Z",
      "expiresAt": "2024-02-28T10:30:00Z",
      "sentByName": "You",
      "daysUntilExpiry": 10
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25,
    "total": 1,
    "hasMore": false
  },
  "summary": {
    "pendingCount": 1,
    "acceptedCount": 3,
    "declinedCount": 0,
    "expiredCount": 0
  }
}
```

---

### POST /teams/invitations/:invitationId/resend

**Resend a pending invitation**

**Request:**

```http
POST /teams/invitations/inv-uuid-1/resend
Authorization: Bearer {instructor_jwt}
```

**Response (200 OK):**

```json
{
  "success": true,
  "invitationId": "inv-uuid-1",
  "email": "teammate@example.com",
  "resentAt": "2024-02-18T10:35:00Z",
  "newExpiresAt": "2024-02-28T10:35:00Z"
}
```

---

## UI Layout

### Team Dashboard Main View

```
┌─────────────────────────────────────────────────────────┐
│ Team Management                                         │
├─────────────────────────────────────────────────────────┤
│
│  Summary Cards
│  ┌──────────────┬──────────────┬──────────────┐
│  │ Total Members │ Active      │ Pending      │
│  │      2       │      1      │      1       │
│  └──────────────┴──────────────┴──────────────┘
│
│  [Invite Team Member Button]
│
│  ┌─────────────────────────────────────────────┐
│  │ Active Members (1)                          │
│  ├──────────────┬────────┬────────┬────────────┤
│  │ Name         │ Status │ Joined │ Actions    │
│  ├──────────────┼────────┼────────┼────────────┤
│  │ John Smith   │ Active │ Feb 10 │ [Edit]     │
│  │ john@ex.com  │        │ 2024   │ [View Log] │
│  │              │        │        │ [Remove]   │
│  └──────────────┴────────┴────────┴────────────┘
│
│  ┌─────────────────────────────────────────────┐
│  │ Pending Verification (1)                    │
│  ├──────────────┬────────┬────────┬────────────┤
│  │ Name         │ Status │ Joined │ Actions    │
│  ├──────────────┼────────┼────────┼────────────┤
│  │ Jane Doe     │Pending │ Feb 15 │ [View Log] │
│  │ jane@ex.com  │        │ 2024   │ [Remove]   │
│  └──────────────┴────────┴────────┴────────────┘
│
│  ┌─────────────────────────────────────────────┐
│  │ Pending Invitations (1)                     │
│  ├──────────────┬────────┬────────┬────────────┤
│  │ Email        │ Status │ Sent   │ Actions    │
│  ├──────────────┼────────┼────────┼────────────┤
│  │ pending@ex.  │Pending │ Feb 18 │ [Resend]   │
│  │ com          │        │        │ [Revoke]   │
│  └──────────────┴────────┴────────┴────────────┘
│
└─────────────────────────────────────────────────────────┘
```

---

### Team Member Activity Modal/Drawer

```
┌──────────────────────────────────┐
│ John Smith - Activity Log         │
│ Last 30 days                      │ [X]
├──────────────────────────────────┤
│
│ Feb 18, 10:30 AM
│ 🔵 Published course
│   Advanced Makeup Techniques
│   45 students
│
│ Feb 17, 2:15 PM
│ 🔵 Created course
│   Lip Art Masterclass
│
│ Feb 16, 9:45 AM
│ 🟡 Moderated comment
│   Comment approved
│   "Great course!..."
│
│ [Load More]
│
└──────────────────────────────────┘
```

---

## Data Model

### activity_logs Table (extended)

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor (who performed action)
  actor_type VARCHAR(32),  -- 'instructor', 'admin', 'system'
  actor_id UUID REFERENCES instructors(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),

  -- Action
  action VARCHAR(64) NOT NULL,
  -- course_created, course_updated, course_published, course_deleted,
  -- pricing_updated, community_enabled, community_disabled,
  -- comment_created, comment_approved, comment_rejected,
  -- team_invite_sent, team_invite_accepted, team_member_added, team_member_removed,
  -- payout_requested, payout_completed, profile_updated

  action_label VARCHAR(255),
  description TEXT,

  -- Target (what the action was on)
  target_type VARCHAR(32),  -- 'course', 'comment', 'team', 'payout', 'profile'
  target_id UUID,
  target_name VARCHAR(255),

  -- Before/After snapshots
  before_snapshot JSONB,
  after_snapshot JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent VARCHAR(512),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Filtering
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES instructors(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_logs_instructor_id ON activity_logs(instructor_id);
CREATE INDEX idx_activity_logs_team_id ON activity_logs(team_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_actor_id ON activity_logs(actor_id);
```

---

## Frontend Components

### Team Dashboard Page

```typescript
// pages/team/dashboard.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import TeamSummary from "@/components/team/TeamSummary";
import TeamMembersList from "@/components/team/TeamMembersList";
import PendingInvitations from "@/components/team/PendingInvitations";
import InviteModal from "@/components/team/InviteModal";

export default function TeamDashboard() {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch("/api/teams/members", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }),
        fetch("/api/teams/invitations", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        }),
      ]);

      const membersData = await membersRes.json();
      const invitationsData = await invitationsRes.json();

      setMembers(membersData.members);
      setInvitations(invitationsData.invitations);
      setSummary({
        ...membersData.summary,
        ...invitationsData.summary,
      });
    } catch (error) {
      console.error("Failed to fetch team data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm("Remove this team member? They will lose access.")) {
      return;
    }

    try {
      const res = await fetch(`/api/teams/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
      });

      if (res.ok) {
        setMembers(members.filter((m) => m.teamMemberId !== memberId));
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  const handleInvitationSent = async () => {
    setShowInviteModal(false);
    await fetchTeamData();
  };

  if (loading) {
    return <div>Loading team data...</div>;
  }

  return (
    <div className="team-dashboard">
      <div className="header">
        <h1>Team Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowInviteModal(true)}
        >
          Invite Team Member
        </button>
      </div>

      {summary && <TeamSummary summary={summary} />}

      <TeamMembersList
        members={members}
        onRemove={handleRemoveMember}
        onViewActivity={(memberId) =>
          router.push(`/team/members/${memberId}/activity`)
        }
      />

      <PendingInvitations
        invitations={invitations}
        onRefresh={fetchTeamData}
      />

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSent={handleInvitationSent}
        />
      )}
    </div>
  );
}
```

### Team Members List Component

```typescript
// components/team/TeamMembersList.tsx
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import ActivityModal from "./ActivityModal";

interface TeamMember {
  teamMemberId: string;
  name: string;
  email: string;
  status: string;
  joinedAt: string;
  specialization: string[];
  recentActivity: {
    lastActiveAt: string;
    actionCount: number;
    actionType: string;
  };
}

interface Props {
  members: TeamMember[];
  onRemove: (memberId: string) => void;
  onViewActivity: (memberId: string) => void;
}

export default function TeamMembersList({
  members,
  onRemove,
  onViewActivity,
}: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Group members by status
  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending_verification");

  return (
    <div className="team-members-list">
      {activeMembers.length > 0 && (
        <div className="member-group">
          <h3>Active Members ({activeMembers.length})</h3>
          <MemberTable
            members={activeMembers}
            onRemove={onRemove}
            onViewActivity={onViewActivity}
            onViewActivityClick={(id) => setSelectedMemberId(id)}
          />
        </div>
      )}

      {pendingMembers.length > 0 && (
        <div className="member-group">
          <h3>Pending Verification ({pendingMembers.length})</h3>
          <MemberTable
            members={pendingMembers}
            onRemove={onRemove}
            onViewActivity={onViewActivity}
            isPending
            onViewActivityClick={(id) => setSelectedMemberId(id)}
          />
        </div>
      )}

      {selectedMemberId && (
        <ActivityModal
          memberId={selectedMemberId}
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </div>
  );
}

function MemberTable({
  members,
  onRemove,
  onViewActivity,
  isPending,
  onViewActivityClick,
}: any) {
  return (
    <table className="member-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Specialization</th>
          <th>Joined</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.teamMemberId}>
            <td className="name">{member.name}</td>
            <td className="email">{member.email}</td>
            <td className="specialization">
              {member.specialization.join(", ")}
            </td>
            <td className="joined">
              {formatDistanceToNow(new Date(member.joinedAt), {
                addSuffix: true,
              })}
            </td>
            <td className="status">
              <span className={`badge badge-${member.status}`}>
                {member.status === "pending_verification"
                  ? "Pending"
                  : "Active"}
              </span>
            </td>
            <td className="actions">
              <button
                className="btn-link"
                onClick={() => onViewActivityClick(member.teamMemberId)}
              >
                View Activity
              </button>
              <button
                className="btn-link btn-danger"
                onClick={() => onRemove(member.teamMemberId)}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Activity Modal Component

```typescript
// components/team/ActivityModal.tsx
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function ActivityModal({ memberId, onClose }: any) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchActivity();
  }, [memberId]);

  const fetchActivity = async () => {
    try {
      const res = await fetch(`/api/teams/members/${memberId}/activity`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
      });

      const data = await res.json();
      setActivities(data.activities);
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Activity Log</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <p>Loading activity...</p>
        ) : (
          <div className="modal-body">
            {stats && (
              <div className="activity-stats">
                <p>
                  <strong>Total Actions:</strong> {stats.totalActions}
                </p>
                <p>
                  <strong>Courses Created:</strong> {stats.courseCreatedCount}
                </p>
                <p>
                  <strong>Content Moderated:</strong>{" "}
                  {stats.contentModeratedCount}
                </p>
              </div>
            )}

            <div className="activity-list">
              {activities.map((activity) => (
                <div key={activity.activityId} className="activity-item">
                  <div className="activity-timestamp">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                    })}
                  </div>
                  <div className="activity-action">
                    <strong>{activity.actionLabel}</strong>
                  </div>
                  {activity.targetName && (
                    <div className="activity-target">
                      {activity.targetName}
                    </div>
                  )}
                  {activity.details && (
                    <div className="activity-details">
                      {Object.entries(activity.details).map(([key, value]) => (
                        <p key={key}>
                          {key}: {String(value)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Requirements

### Team Member Data

1. Display name, email, role, status, joined date
2. Show specializations
3. Show recent activity summary

### Activity Logs

1. Track all instructor actions in activity_logs table
2. Store actor, action, target, timestamp, before/after snapshots
3. Filterable by action type and date range
4. Exportable for audit purposes

### UI Features

1. Summary cards: total members, active, pending, removed
2. Member list with status grouping
3. Sortable and paginated member table
4. Activity log modal with stats
5. Remove member with confirmation
6. Pending invitations section with resend/revoke

### Notifications

1. Notify removed member (via email)
2. Log removal in activity_logs
3. Prevent access immediately after removal

---

## Acceptance Criteria

- [ ] PUT /teams/members/:memberId updates team member details (name, role description, specialization)
- [ ] Edit team member changes are logged in activity_logs with before/after snapshot
- [ ] Only primary instructor can edit team member details (403 for others)
- [ ] GET /teams/members returns team members with pagination
- [ ] Members grouped by status (active, pending, removed)
- [ ] Member list displays: name, email, status, joined date, specialization
- [ ] GET /teams/members/:memberId/activity returns activity log
- [ ] Activity log includes: action, target, timestamp, details
- [ ] Activity log is filterable by date range and action type
- [ ] Activity stats show: total actions, actions by type
- [ ] DELETE /teams/members/:memberId removes member
- [ ] Confirmation dialog shown before removing member
- [ ] Removed member can no longer access team
- [ ] Removal reason captured (optional)
- [ ] GET /teams/invitations lists pending and completed invitations
- [ ] Invitations show: email, status, sent date, expiry date
- [ ] POST /teams/invitations/:invitationId/resend resends pending invitation
- [ ] Resend updates expiry date to 10 days from now
- [ ] Pending invitations grouped separately from active members
- [ ] Summary cards show accurate member counts
- [ ] Team dashboard is responsive on mobile/tablet/desktop
- [ ] Activity modal displays recent member actions
- [ ] Activity modal shows action stats
- [ ] Cannot remove primary instructor (error)
- [ ] Only primary instructor can manage team
- [ ] Page requires proper authentication (403 if not authorized)
- [ ] Activity log is sortable by date, action type
- [ ] Member list is sortable by name, joined date, status

## Dependencies

- **Milestone**: Authentication (04-authentication-and-onboarding)
- **Milestone**: Team Member Onboarding (08-team-member-onboarding)
- **Milestone**: Activity Logs (10-activity-logs-mentor)
- **Component Library**: shadcn/ui components
- **Date Library**: date-fns for formatting

## Technical Notes

### Activity Log Filtering

```typescript
// Query activity logs for member
const activities = await db.activity_logs
  .find({
    actor_id: instructorId,
    team_id: teamId,
    created_at: {
      $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    },
  })
  .sort({ created_at: -1 });
```

### Member Removal Workflow

1. Delete or mark team_member as removed
2. Revoke access permissions
3. Send notification email
4. Log activity: "team_member_removed"
5. Archive member data for compliance

### Activity Log Actions

- Course: created, updated, published, deleted, archived
- Pricing: price_changed, status_changed
- Community: enabled, disabled
- Comments: created, approved, rejected, flagged
- Team: invite_sent, member_added, member_removed
- Payout: requested, approved, failed
- Profile: updated, verified

### Future Enhancements

1. Export member activity to CSV/PDF
2. Team member performance analytics
3. Contribution metrics (courses created, students taught)
4. Team revenue split analytics
5. Scheduled activity reports (daily/weekly digest)
6. Team member messaging/chat
7. Role-based permissions (admin, moderator, creator)
