# M9-T1 · Super Admin Auth + Dashboard (KPI Overview + User Management)

| Field          | Value                                                  |
| -------------- | ------------------------------------------------------ |
| **Milestone**  | M9 — Super Admin                                       |
| **Status**     | 🔲 To Do                                               |
| **Depends on** | M1-T5 (admin scaffold), M1-T3 (API), M1-T2 (DB schema) |
| **PRD Ref**    | Section 8 (Super Admin Features)                       |

---

## Description

The Super Admin web dashboard is the internal control centre for CeolX platform operations. It is a **single-account dashboard** (no multi-admin in V1) that provides visibility into all platform activity: user metrics, event moderation queue, subscription revenue, and engagement data. The Super Admin is the only internal user with access to all pending events awaiting moderation and can approve or reject them with reasons. Login is email/password only (no OAuth) to keep the admin account isolated from regular user authentication flows. The dashboard contains KPI overview cards for the team to monitor platform health during the controlled launch phase (under 1,000 users). This task covers the admin login system, the dashboard home screen with KPI cards, and the user management table with search and CSV export capabilities.

---

## Affected Apps / Packages

- **`apps/api`**: Admin authentication endpoints (email/password login, logout), KPI aggregation queries, user listing endpoint, session management
- **`apps/admin`**: Next.js admin dashboard UI — login page, KPI dashboard home, users management table with search and export
- **`packages/shared`**: TypeScript types for admin session, KPI response schemas

---

## API Endpoints

### POST /admin/auth/login

Request:

```json
{
  "email": "admin@ceolx.ie",
  "password": "secure_password_hash"
}
```

Response (200 OK):

```json
{
  "success": true,
  "session": {
    "id": "session_abc123",
    "adminId": "admin_xyz789",
    "email": "admin@ceolx.ie",
    "expiresAt": "2026-03-24T12:00:00Z"
  }
}
```

Error (401 Unauthorized):

```json
{
  "error": "Invalid email or password"
}
```

### POST /admin/auth/logout

Request: (authenticated)
Response (200 OK):

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /admin/stats

Request: (authenticated)
Response (200 OK):

```json
{
  "users": {
    "total": 247,
    "byPersona": {
      "spectator": 180,
      "artist": 45,
      "venue": 22
    },
    "newLast7Days": 12,
    "newLast30Days": 34
  },
  "events": {
    "total": 89,
    "byStatus": {
      "active": 45,
      "pending_review": 8,
      "rejected": 2,
      "archived": 34
    },
    "newLast7Days": 5,
    "newLast30Days": 18
  },
  "subscriptions": {
    "activeVenues": 22,
    "mrr": 3960,
    "newLast30Days": 4,
    "pastDueCount": 1
  },
  "engagement": {
    "totalFollows": 312,
    "totalBookings": 41,
    "totalPosts": 67
  },
  "pendingModeration": 8
}
```

### GET /admin/users?page=1&limit=20&search=email@ceolx.ie

Request: (authenticated, optional query params)
Response (200 OK):

```json
{
  "users": [
    {
      "id": "user_123",
      "name": "Siobhán Ní Dhubhda",
      "email": "siobhan@example.com",
      "currentRole": "artist",
      "createdAt": "2026-02-15T10:30:00Z",
      "lastLoginAt": "2026-03-23T09:15:00Z",
      "flaggedInactive": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 247,
    "totalPages": 13
  }
}
```

### GET /admin/users/export

Request: (authenticated)
Response (200 OK — CSV file):

```
name,email,current_role,created_at,last_login_at,flagged_inactive
Siobhán Ní Dhubhda,siobhan@example.com,artist,2026-02-15 10:30:00,2026-03-23 09:15:00,false
```

---

## Requirements

### Admin Authentication System

- Admin login uses email/password only — no Google Sign-In, no Apple Sign-In, no OAuth; this keeps the admin session scope isolated from end-user authentication
- Super Admin account is created **once** via a seeded database script (`pnpm seed:admin`) — never exposed as a sign-up route in the UI
- Admin session is managed separately from end-user sessions using a distinct session scope (e.g. `admin_session_*` cookie prefix) to prevent end-user tokens from granting admin access
- All `/admin/*` routes are guarded by admin auth middleware that checks for valid admin session; non-admin requests return 401 Unauthorized
- Logout endpoint clears the admin session cookie and revokes the session in the database

### Dashboard KPI Cards

- Dashboard displays **six KPI cards** on load: Total Users, Users by Persona (breakdown), Events by Status, Active Subscriptions, Engagement (follows + bookings), and Pending Moderation Count
- Each KPI card shows a simple **trend indicator** (↑ or ↓) comparing the current 30-day total against the previous 30-day period
- KPI data is queried fresh on each page load from the Neon database (no caching required at V1 scale under 1,000 users)
- All date/time fields on cards use ISO 8601 format with user-friendly labels (e.g. "New in last 7 days: 12")
- **Pending Moderation badge** in the sidebar dynamically updates to show count of `status = pending_review` events; clicking the badge navigates to M9-T2 (Pending Events page)

### User Management Table

- Users page displays a searchable, paginated table of all registered users
- Table columns: Name, Email, Current Persona (spectator/artist/venue), Registration Date, Last Login Date, Flagged Inactive status
- Search filters by email address (full or partial match, case-insensitive)
- Pagination defaults to 20 users per page; configurable via limit parameter
- Sorting: table sorted by registration date (newest first) by default; admins can click column headers to sort by name, email, or last login
- **CSV Export** button generates and downloads a CSV file of all users matching the current search/filter; includes all columns plus any additional fields needed for analytics

### Session & Security

- Admin login page is accessible at `/admin/login` before authentication
- On successful login, user is redirected to `/admin/dashboard`
- Session expiry time is **24 hours**; token must be refreshed before expiry (optional for V1; can be simple non-expiring sessions if needed)
- Failed login attempts log a warning to the backend (no rate-limiting required for V1, but consider for production)
- Logout from any admin page clears session and redirects to `/admin/login`

---

## Acceptance Criteria

- [ ] Admin login page renders with email, password, and submit button
- [ ] Valid admin credentials (seeded in DB) allow login; invalid credentials rejected with error message
- [ ] Admin session cookie set; non-admin users cannot access `/admin/*` routes (401 returned)
- [ ] Dashboard loads within 2 seconds; all six KPI cards display correct data
- [ ] User KPI card shows breakdown by persona (spectator/artist/venue) and new user counts for last 7 and 30 days
- [ ] Event KPI card shows counts by status (active/pending/rejected/archived) and new event counts for last 7 and 30 days
- [ ] Subscription KPI shows active venue count, total MRR (monthly recurring revenue), new subscriptions count, and past-due count
- [ ] Pending Moderation badge shows count of `status = pending_review` events; updates after approve/reject actions in M9-T2
- [ ] Users table loads with all columns; pagination works (next/previous page buttons functional)
- [ ] Email search filters users; search results update in real-time as admin types
- [ ] CSV export downloads a file with all columns and data in valid CSV format
- [ ] Admin logout clears session and redirects to login page

---

## Dependencies

- **Upstream**: M1-T2 (DB schema with users, events, artist_profiles, venue_profiles tables); M1-T3 (Hono API scaffold); M1-T5 (Next.js admin scaffold)
- **Downstream**: M9-T2 (Pending Events Moderation Queue); M11-T2 (extended KPI analytics)
- **External services**: Neon PostgreSQL (database queries), session storage (in-DB or Redis if scaling)

---

## Technical Notes

### Super Admin Account Seeding

Create a one-time seed script at `/apps/api/src/seed-admin.ts`:

```typescript
import { db } from "./db";
import { users } from "./schema";
import { hash } from "@node-rs/argon2";

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@ceolx.ie";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";

  const hashedPassword = await hash(adminPassword);

  try {
    await db.insert(users).values({
      id: "admin_" + crypto.randomUUID(),
      email: adminEmail,
      password: hashedPassword,
      name: "CeolX Admin",
      currentRole: "spectator",
      isAdmin: true,
      createdAt: new Date(),
      lastLoginAt: null,
      consentAt: new Date(),
      flaggedInactive: false,
    });
    console.log(`✓ Admin account seeded: ${adminEmail}`);
  } catch (error) {
    console.error("Admin seed failed:", error);
  }
}

seedAdmin();
```

Run with: `pnpm seed:admin` (add to `package.json` scripts). Store credentials in `.env.local` or pass via environment variables; **never commit credentials to Git**.

### Admin Auth Middleware

Hono middleware for `/admin/*` routes:

```typescript
import { Context, Next } from "hono";

export async function adminAuthMiddleware(c: Context, next: Next) {
  const session = c.req.cookie("admin_session_id");

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Verify session in DB
  const adminSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, session))
    .limit(1);

  if (!adminSession.length || adminSession[0].expiresAt < new Date()) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("adminId", adminSession[0].adminId);
  await next();
}
```

### KPI Aggregation Queries (Drizzle)

Example query for user stats:

```typescript
import { db } from "./db";
import { users } from "./schema";
import { eq, and, gte, count } from "drizzle-orm";

async function getUserStats() {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Total users by persona
  const byPersona = await db
    .select({
      role: users.currentRole,
      count: count(),
    })
    .from(users)
    .where(eq(users.isAdmin, false))
    .groupBy(users.currentRole);

  // New users last 7 days
  const newLast7 = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.isAdmin, false), gte(users.createdAt, last7Days)));

  // New users last 30 days
  const newLast30 = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.isAdmin, false), gte(users.createdAt, last30Days)));

  return {
    total: byPersona.reduce((sum, row) => sum + row.count, 0),
    byPersona: Object.fromEntries(byPersona.map((r) => [r.role, r.count])),
    newLast7Days: newLast7[0]?.count || 0,
    newLast30Days: newLast30[0]?.count || 0,
  };
}
```

### CSV Export Implementation

Simple TypeScript CSV generation in Hono endpoint:

```typescript
import { json2csv } from "json2csv";

app.get("/admin/users/export", adminAuthMiddleware, async (c) => {
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.isAdmin, false));

  const csv = json2csv({
    data: allUsers.map((u) => ({
      name: u.name,
      email: u.email,
      current_role: u.currentRole,
      created_at: u.createdAt.toISOString(),
      last_login_at: u.lastLoginAt?.toISOString() || "",
      flagged_inactive: u.flaggedInactive,
    })),
  });

  return c.text(csv, 200, {
    "Content-Disposition": 'attachment; filename="ceolx_users_export.csv"',
    "Content-Type": "text/csv",
  });
});
```

### Admin Dashboard UI (Next.js + ShadCN/UI)

Example KPI card component:

```typescript
// components/KPICard.tsx
interface KPICardProps {
  title: string;
  value: number;
  trend?: 'up' | 'down';
  subtitle?: string;
}

export function KPICard({ title, value, trend, subtitle }: KPICardProps) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        {trend && (
          <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-2 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}
```

---

## Environment Variables Required

```
ADMIN_EMAIL=admin@ceolx.ie                          # Seeded admin email
ADMIN_PASSWORD=ChangeMe123!                         # Seeded admin password (change in production)
DATABASE_URL=postgresql://...neon.tech              # Neon connection string (production DB)
SESSION_SECRET=your_super_secret_session_key        # Secret for signing session cookies
NEXT_PUBLIC_API_URL=https://api.ceolx.ie            # Backend API URL for admin dashboard
```

---

---

## Common Gotchas

- **Admin account password is seeded in the DB**: Store credentials securely in `.env` or 1Password, never commit to Git. After initial seeding, the Super Admin should change the password via a dedicated endpoint or update it directly in the DB for V1.

- **Session expiry**: If implementing session expiry (24 hours), ensure the frontend middleware redirects expired sessions to login gracefully. For simplicity in V1, non-expiring sessions are acceptable.

- **KPI query performance**: Aggregation queries on large datasets can be slow. At V1 scale (under 1,000 users), simple `COUNT` and `GROUP BY` queries are fine. If scaling post-launch, consider pre-computing KPIs nightly via a scheduled job.

- **CSV encoding**: Ensure CSV export encodes non-ASCII characters (e.g. Irish names like "Siobhán") correctly using UTF-8. Use a library like `json2csv` to handle this automatically.

- **CORS for admin**: The Next.js admin dashboard needs CORS headers from the Hono API for cross-origin requests. Configure Hono CORS middleware to allow requests from the admin domain (e.g. `ceolx.ie`).

- **Separate admin database**: Do NOT use the same database connection pool for admin and end-user queries. Use a read-only connection or a separate admin pool if scaling.

- **Time zone handling**: All timestamps should be stored in UTC in the DB. Dashboard displays should convert to user's local time zone (or use a consistent UTC display with timezone label).

- **Admin session isolation**: The admin session cookie (e.g., `admin_session_id`) must be completely separate from end-user session cookies (from BetterAuth). Use a distinct cookie name and scope to prevent accidental token reuse.
