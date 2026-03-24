# Team Invite Flow

## Description

Implement the team member invitation system. Enable instructors to invite team members via email. Send invitation emails with unique acceptance links via Postmark. Handle accept/decline flow where invited members can complete the full onboarding wizard (same as primary mentor). Submit applications for Super Admin verification before granting access. Track invitation status and expiration.

## Affected Apps/Packages

- Backend: `hono-api` service
- Frontend: `mentor-web` (Next.js)
- Database: PostgreSQL team_invitations, team_members tables
- Email Service: Postmark API
- Authentication: JWT for invitation links

## API Endpoints

### POST /teams/invite

**Send team member invitation**

**Request:**

```http
POST /teams/invite
Authorization: Bearer {instructor_jwt}
Content-Type: application/json

{
  "email": "teammate@example.com",
  "role": "team_member",
  "message": "Join me as a course creator!" (optional)
}
```

**Request Parameters:**

- `email` (required): Email address of invitee
- `role` (required): Always "team_member" (can extend for future roles)
- `message` (optional): Personal message in invitation email

**Response (201 Created):**

```json
{
  "success": true,
  "invitationId": "inv-uuid-123",
  "email": "teammate@example.com",
  "status": "pending",
  "invitationLink": "https://mentor.example.com/join-team?token=inv_abc123_xyz789",
  "expiresAt": "2024-02-28T10:30:00Z",
  "sentAt": "2024-02-18T10:30:00Z"
}
```

**Error Responses:**

- 400: Invalid email format
- 400: Email is already a team member
- 400: Email is an existing instructor
- 409: Active invitation already sent to this email
- 401: Unauthorized (missing JWT)

---

### GET /teams/invitations

**List sent invitations (for instructor)**

**Request:**

```http
GET /teams/invitations?status=pending&limit=25&offset=0
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `status` (optional): "pending", "accepted", "declined", "expired"
- `limit` (optional, default: 25)
- `offset` (optional, default: 0)

**Response (200 OK):**

```json
{
  "invitations": [
    {
      "invitationId": "inv-uuid-123",
      "email": "teammate@example.com",
      "status": "pending",
      "sentAt": "2024-02-18T10:30:00Z",
      "expiresAt": "2024-02-28T10:30:00Z",
      "acceptedAt": null,
      "inviteeEmail": "teammate@example.com"
    },
    {
      "invitationId": "inv-uuid-124",
      "email": "john@example.com",
      "status": "accepted",
      "sentAt": "2024-02-10T09:00:00Z",
      "expiresAt": "2024-02-20T09:00:00Z",
      "acceptedAt": "2024-02-12T14:30:00Z",
      "inviteeEmail": "john@example.com"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25,
    "total": 2,
    "hasMore": false
  }
}
```

---

### DELETE /teams/invitations/:invitationId

**Revoke an invitation (before acceptance)**

**Request:**

```http
DELETE /teams/invitations/inv-uuid-123
Authorization: Bearer {instructor_jwt}
```

**Response (200 OK):**

```json
{
  "success": true,
  "invitationId": "inv-uuid-123",
  "revokedAt": "2024-02-18T10:35:00Z"
}
```

**Error Responses:**

- 404: Invitation not found
- 409: Invitation already accepted
- 403: Not authorized to revoke this invitation

---

### POST /join-team/accept

**Accept invitation and start onboarding (public endpoint)**

**Request:**

```http
POST /join-team/accept
Content-Type: application/json

{
  "invitationToken": "inv_abc123_xyz789"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "invitationId": "inv-uuid-123",
  "teamId": "team-uuid-456",
  "inviterEmail": "mentor@example.com",
  "inviterName": "Jane Doe",
  "onboardingUrl": "https://mentor.example.com/onboarding?token=inv_abc123_xyz789&step=personal_details",
  "expiresAt": "2024-02-28T10:30:00Z"
}
```

**Error Responses:**

- 400: Invalid or expired token
- 404: Invitation not found
- 409: Invitation already accepted

---

### POST /join-team/decline

**Decline invitation**

**Request:**

```http
POST /join-team/decline
Content-Type: application/json

{
  "invitationToken": "inv_abc123_xyz789",
  "reason": "Not interested at this time" (optional)
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "invitationId": "inv-uuid-123",
  "declinedAt": "2024-02-18T10:40:00Z"
}
```

---

## Data Model

### team_invitations Table

```sql
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  invitee_email VARCHAR(255) NOT NULL,

  -- Invitation details
  invitation_token VARCHAR(128) UNIQUE NOT NULL,  -- Used in public URL
  role VARCHAR(32) DEFAULT 'team_member',

  -- Status tracking
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  -- pending, accepted, declined, expired, revoked

  -- Personal message
  message TEXT NULL,

  -- Invitee after acceptance
  invitee_id UUID UNIQUE REFERENCES team_members(id),

  -- Timestamps
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP NULL,
  declined_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 days'),

  -- Metadata
  ip_address INET,
  user_agent VARCHAR(512),

  -- Constraints
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')
  ),
  CONSTRAINT not_self_invite CHECK (inviter_id != invitee_id)
);

CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_inviter_id ON team_invitations(inviter_id);
CREATE INDEX idx_team_invitations_invitee_email ON team_invitations(invitee_email);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON team_invitations(expires_at);
CREATE UNIQUE INDEX idx_team_invitations_token ON team_invitations(invitation_token);
CREATE UNIQUE INDEX idx_team_invitations_pending_email
  ON team_invitations(team_id, invitee_email)
  WHERE status = 'pending';
```

### team_members Table (if doesn't exist)

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,

  -- Role
  role VARCHAR(32) NOT NULL DEFAULT 'team_member',
  -- instructor (primary), team_member, admin

  -- Status
  status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
  -- pending_verification, active, suspended, removed

  -- Onboarding progress
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed_at TIMESTAMP NULL,

  -- Verification
  verified_by_admin BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT unique_team_member UNIQUE (team_id, user_id),
  CONSTRAINT valid_status CHECK (
    status IN ('pending_verification', 'active', 'suspended', 'removed')
  )
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_status ON team_members(status);
CREATE INDEX idx_team_members_verified_by_admin ON team_members(verified_by_admin);
```

---

## Implementation Details

### Send Invitation Email

```typescript
import { PostmarkClient } from "postmark";

const postmarkClient = new PostmarkClient(process.env.POSTMARK_API_TOKEN);

async function sendTeamInvitation(
  inviterId: string,
  inviteeEmail: string,
  teamId: string,
  message?: string,
) {
  // 1. Validate invitee email
  if (!isValidEmail(inviteeEmail)) {
    throw new Error("Invalid email address");
  }

  // 2. Check for existing active invitation
  const existingInvitation = await db.team_invitations.findOne({
    team_id: teamId,
    invitee_email: inviteeEmail,
    status: "pending",
  });

  if (existingInvitation) {
    throw new Error("Active invitation already sent to this email");
  }

  // 3. Check if already a team member
  const existingMember = await db.team_members.findOne({
    team_id: teamId,
    user: { email: inviteeEmail },
  });

  if (existingMember) {
    throw new Error("This person is already a team member");
  }

  // 4. Check if email is instructor
  const existingInstructor = await db.instructors.findOne({
    user: { email: inviteeEmail },
  });

  if (existingInstructor) {
    throw new Error("This email is already registered as an instructor");
  }

  // 5. Get inviter info
  const inviter = await db.instructors.findById(inviterId);
  const inviterUser = await db.users.findById(inviter.user_id);

  // 6. Get team info
  const team = await db.teams.findById(teamId);

  // 7. Generate invitation token
  const invitationToken = generateSecureToken(); // 32-byte random hex

  // 8. Create invitation record
  const invitation = await db.team_invitations.create({
    team_id: teamId,
    inviter_id: inviterId,
    invitee_email: inviteeEmail,
    invitation_token: invitationToken,
    message,
    role: "team_member",
    expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    ip_address: req.ip,
    user_agent: req.headers["user-agent"],
  });

  // 9. Build invitation link
  const invitationLink = `${process.env.APP_URL}/join-team?token=${invitationToken}`;

  // 10. Send email via Postmark
  try {
    await postmarkClient.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL,
      To: inviteeEmail,
      TemplateAlias: "team-invitation",
      TemplateModel: {
        inviter_name: inviterUser.name,
        inviter_email: inviterUser.email,
        team_name: team.name,
        invitation_link: invitationLink,
        personal_message: message,
        expires_in_days: 10,
      },
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email");
  }

  // 11. Emit event
  await eventBus.emit("team.invitation.sent", {
    invitationId: invitation.id,
    teamId,
    inviterId,
    inviteeEmail,
  });

  return {
    invitationId: invitation.id,
    email: inviteeEmail,
    status: "pending",
    invitationLink,
    expiresAt: invitation.expires_at,
    sentAt: invitation.sent_at,
  };
}
```

### Accept Invitation & Start Onboarding

```typescript
async function acceptInvitation(invitationToken: string) {
  // 1. Find invitation by token
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  // 2. Check if not expired
  if (new Date() > invitation.expires_at) {
    await db.team_invitations.update(invitation.id, {
      status: "expired",
    });
    throw new Error("Invitation has expired");
  }

  // 3. Check if not already accepted
  if (invitation.status === "accepted") {
    throw new Error("Invitation already accepted");
  }

  if (invitation.status !== "pending") {
    throw new Error(
      `Cannot accept invitation with status: ${invitation.status}`,
    );
  }

  // 4. Mark as accepted
  await db.team_invitations.update(invitation.id, {
    status: "accepted",
    accepted_at: new Date(),
  });

  // 5. Get inviter info
  const inviter = await db.instructors.findById(invitation.inviter_id);
  const inviterUser = await db.users.findById(inviter.user_id);

  // 6. Get team info
  const team = await db.teams.findById(invitation.team_id);

  // 7. Emit event
  await eventBus.emit("team.invitation.accepted", {
    invitationId: invitation.id,
    inviteeEmail: invitation.invitee_email,
    teamId: invitation.team_id,
  });

  return {
    invitationId: invitation.id,
    teamId: team.id,
    inviterEmail: inviterUser.email,
    inviterName: inviterUser.name,
    invitationToken, // Send back for onboarding URL
    expiresAt: invitation.expires_at,
  };
}
```

### Complete Team Member Onboarding

```typescript
async function completeTeamMemberOnboarding(
  invitationToken: string,
  onboardingData: {
    email: string;
    firstName: string;
    lastName: string;
    specialization: string[];
    introVideoUrl: string;
    photoIdUrl: string;
    portfolioUrl: string;
    socialLinks: Record<string, string>;
  },
) {
  // 1. Find invitation
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  if (!invitation || invitation.status !== "accepted") {
    throw new Error("Invalid or expired invitation");
  }

  // 2. Check email matches
  if (onboardingData.email !== invitation.invitee_email) {
    throw new Error("Email does not match invitation");
  }

  // 3. Start database transaction
  const transaction = await db.beginTransaction();

  try {
    // 4. Create user account
    const user = await db.users.create(
      {
        email: onboardingData.email,
        first_name: onboardingData.firstName,
        last_name: onboardingData.lastName,
        role: "instructor", // Team members are instructors
        status: "active",
      },
      transaction,
    );

    // 5. Create instructor record
    const instructor = await db.instructors.create(
      {
        user_id: user.id,
        specialization: onboardingData.specialization,
        intro_video_url: onboardingData.introVideoUrl,
        photo_id_url: onboardingData.photoIdUrl,
        portfolio_url: onboardingData.portfolioUrl,
        social_links: onboardingData.socialLinks,
        verification_status: "pending", // Awaiting Super Admin approval
      },
      transaction,
    );

    // 6. Get team
    const team = await db.teams.findById(invitation.team_id);

    // 7. Create team member record
    const teamMember = await db.team_members.create(
      {
        team_id: team.id,
        user_id: user.id,
        instructor_id: instructor.id,
        role: "team_member",
        status: "pending_verification", // Awaiting Super Admin approval
        onboarding_completed: true,
        onboarding_completed_at: new Date(),
      },
      transaction,
    );

    // 8. Update invitation with invitee_id
    await db.team_invitations.update(
      invitation.id,
      { invitee_id: teamMember.id },
      transaction,
    );

    // 9. Commit transaction
    await transaction.commit();

    // 10. Send application for Super Admin verification
    await notificationService.sendToSuperAdmins({
      type: "team_member_verification_required",
      data: {
        instructorId: instructor.id,
        instructorName: `${onboardingData.firstName} ${onboardingData.lastName}`,
        instructorEmail: onboardingData.email,
        teamId: team.id,
        teamName: team.name,
        invitedBy: await getInviterName(invitation.inviter_id),
      },
    });

    // 11. Notify inviter
    await notificationService.send({
      instructorId: invitation.inviter_id,
      type: "team_member_joined",
      data: {
        memberName: `${onboardingData.firstName} ${onboardingData.lastName}`,
        memberEmail: onboardingData.email,
        status: "pending_verification",
      },
    });

    // 12. Emit event
    await eventBus.emit("team.member.onboarding.completed", {
      invitationId: invitation.id,
      instructorId: instructor.id,
      teamId: team.id,
      email: onboardingData.email,
    });

    return {
      success: true,
      invitationId: invitation.id,
      instructorId: instructor.id,
      teamMemberId: teamMember.id,
      status: "pending_verification",
      message:
        "Onboarding complete! Your application is pending Super Admin verification.",
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### Decline Invitation

```typescript
async function declineInvitation(invitationToken: string, reason?: string) {
  // 1. Find invitation
  const invitation = await db.team_invitations.findOne({
    invitation_token: invitationToken,
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  if (invitation.status !== "pending" && invitation.status !== "accepted") {
    throw new Error(
      `Cannot decline invitation with status: ${invitation.status}`,
    );
  }

  // 2. Mark as declined
  await db.team_invitations.update(invitation.id, {
    status: "declined",
    declined_at: new Date(),
    metadata: {
      decline_reason: reason,
    },
  });

  // 3. Notify inviter
  await notificationService.send({
    instructorId: invitation.inviter_id,
    type: "team_invitation_declined",
    data: {
      inviteeEmail: invitation.invitee_email,
      reason,
    },
  });

  // 4. Emit event
  await eventBus.emit("team.invitation.declined", {
    invitationId: invitation.id,
    reason,
  });

  return {
    invitationId: invitation.id,
    declinedAt: new Date(),
  };
}
```

### Revoke Invitation

```typescript
async function revokeInvitation(
  invitationId: string,
  instructorId: string, // Must be the inviter
) {
  // 1. Find invitation
  const invitation = await db.team_invitations.findById(invitationId);

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  // 2. Verify permission (inviter or team lead)
  if (invitation.inviter_id !== instructorId) {
    const team = await db.teams.findById(invitation.team_id);
    if (team.primary_instructor_id !== instructorId) {
      throw new Error("Not authorized to revoke this invitation");
    }
  }

  // 3. Check if not already accepted
  if (invitation.status !== "pending") {
    throw new Error(
      `Cannot revoke invitation with status: ${invitation.status}`,
    );
  }

  // 4. Mark as revoked
  await db.team_invitations.update(invitationId, {
    status: "revoked",
    revoked_at: new Date(),
  });

  // 5. Emit event
  await eventBus.emit("team.invitation.revoked", {
    invitationId,
  });

  return {
    invitationId,
    revokedAt: new Date(),
  };
}
```

---

## Frontend Integration

### Team Invite Form

```typescript
// components/TeamInviteForm.tsx
import { useState } from "react";

export default function TeamInviteForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/teams/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
        body: JSON.stringify({ email, message, role: "team_member" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      setSuccess(true);
      setEmail("");
      setMessage("");

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teammate@example.com"
        required
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional message..."
        rows={4}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send Invitation"}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">Invitation sent!</p>}
    </form>
  );
}
```

### Join Team Link Handler

```typescript
// pages/join-team.tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function JoinTeam() {
  const router = useRouter();
  const { token } = router.query;
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    const acceptInvitation = async () => {
      try {
        const res = await fetch("/api/join-team/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationToken: token }),
        });

        if (!res.ok) {
          throw new Error("Invalid or expired invitation");
        }

        const data = await res.json();
        setInvitationData(data);

        // Redirect to onboarding
        setTimeout(() => {
          router.push(
            `/onboarding?token=${token}&step=personal_details`
          );
        }, 2000);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    acceptInvitation();
  }, [token, router]);

  if (loading) return <div>Processing invitation...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="join-team">
      <h1>Welcome!</h1>
      {invitationData && (
        <p>
          You've been invited to join {invitationData.inviterName}'s team.
          Redirecting to onboarding...
        </p>
      )}
    </div>
  );
}
```

---

## Email Template (Postmark)

**Template Alias:** `team-invitation`

```html
<h1>You're invited to join a team!</h1>

<p>Hi there,</p>

<p>
  <strong>{{inviter_name}}</strong> ({{inviter_email}}) has invited you to join
  their team on Mentor.
</p>

{{#if personal_message}}
<blockquote>
  <p>"{{personal_message}}"</p>
</blockquote>
{{/if}}

<p>
  <a href="{{invitation_link}}" class="btn btn-primary"> Accept Invitation </a>
</p>

<p>
  This invitation will expire in {{expires_in_days}} days. After that, you'll
  need to ask {{inviter_name}} to send a new one.
</p>

<p>If you don't want to join, you can safely ignore this email.</p>

<p>Best regards,<br />The Mentor Team</p>
```

---

## Requirements

### Email Service

1. Configure Postmark API token in environment
2. Create email template with team invitation message
3. Test email delivery in development/staging

### Token Security

1. Generate cryptographically secure tokens (32 bytes minimum)
2. Store hashed tokens in database (use bcrypt or argon2)
3. Compare hashed token on validation

### Invitation Expiration

1. Set 10-day expiration by default
2. Cleanup job to mark expired invitations
3. Prevent expired invitations from being accepted

### Email Validation

1. Verify email format before sending
2. Check for disposable email domains (optional)
3. Prevent duplicate active invitations to same email

---

## Acceptance Criteria

- [ ] POST /teams/invite validates email format
- [ ] POST /teams/invite checks for existing active invitation
- [ ] POST /teams/invite sends email via Postmark
- [ ] Invitation email includes unique acceptance link
- [ ] Invitation expires after 10 days
- [ ] Invitation link is secure (contains cryptographic token)
- [ ] GET /teams/invitations lists sent invitations with status
- [ ] GET /teams/invitations supports filtering by status
- [ ] DELETE /teams/invitations/:invitationId revokes pending invitation
- [ ] Cannot revoke already accepted invitation
- [ ] POST /join-team/accept marks invitation as accepted
- [ ] Accept generates valid onboarding URL
- [ ] Accept prevents duplicate acceptances
- [ ] Invitation cannot be accepted after expiration
- [ ] POST /join-team/decline marks invitation as declined
- [ ] Decline notifies the inviter
- [ ] Team member onboarding completes with wizard
- [ ] Onboarding creates user, instructor, and team_member records
- [ ] Team member status is pending_verification after onboarding
- [ ] Super Admin notification sent for verification
- [ ] Inviter is notified when team member completes onboarding
- [ ] Cannot accept invitation if email already in use
- [ ] Invitation requires valid token in all operations
- [ ] Only inviter can revoke their invitations
- [ ] Email matches between invitation and onboarding

## Dependencies

- **Milestone**: Teams setup (needs teams table from 02-database-schema)
- **Milestone**: Authentication (04-authentication-and-onboarding)
- **Milestone**: Team Member Onboarding (08-team-member-onboarding)
- **External Service**: Postmark Email API
- **Frontend**: Mentor Web app

## Technical Notes

### Token Generation

```typescript
import crypto from "crypto";

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
```

### Invitation Lifecycle

1. **Pending**: Invitation sent, awaiting acceptance (expires in 10 days)
2. **Accepted**: Invitee clicked link and started onboarding
3. **Completed**: Team member onboarding finished, awaiting verification
4. **Active**: Super Admin verified, team member has full access
5. **Declined**: Invitee declined invitation
6. **Expired**: 10 days passed without acceptance
7. **Revoked**: Inviter revoked before acceptance

### Cleanup Job

```typescript
// Daily job to mark expired invitations
async function cleanupExpiredInvitations() {
  const now = new Date();

  await db.team_invitations.updateMany(
    {
      status: "pending",
      expires_at: { $lt: now },
    },
    {
      status: "expired",
    },
  );
}
```

### Security Considerations

1. Use constant-time comparison for tokens to prevent timing attacks
2. Don't reveal whether email is registered (generic error messages)
3. Rate limit invitation sending (max 10 per day per instructor)
4. Log all invitation events for audit trail
5. Sanitize personal message to prevent HTML injection

### Future Enhancements

1. Resend invitation button
2. Multiple role types (admin, moderator, etc.)
3. Bulk invitation upload (CSV)
4. Invitation analytics (sent, accepted, declined rates)
5. Scheduled invitation cleanup
