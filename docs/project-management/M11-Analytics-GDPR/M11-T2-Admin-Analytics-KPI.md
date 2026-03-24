# M11-T2 · Admin Analytics & KPI Dashboard

| Field          | Value                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **Milestone**  | M11 — Analytics & GDPR                                                                         |
| **Status**     | 🔲 To Do                                                                                       |
| **Depends on** | M9-T1 (admin dashboard core), M2-T4 (personas), M4 (events), M5 (bookings), M8 (subscriptions) |
| **PRD Ref**    | Section 8 (Super Admin Features — KPI Overview), Section 4.5 (Analytics)                       |

---

## Description

Extend the Super Admin dashboard with comprehensive analytics and KPI cards. The Super Admin team needs real-time visibility into platform health during the controlled launch phase (under 1,000 users): how many users signed up this week, how many events are pending moderation, what is the monthly recurring revenue from Venue subscriptions, and overall engagement metrics. This task provides aggregated, cached KPI data from the PostgreSQL database without requiring a separate analytics service or data warehouse. KPI trends (up/down arrows) compare current and previous 30-day periods to show momentum. The dashboard is the single source of truth for platform metrics during launch.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | `GET /admin/stats` aggregation endpoint; caching layer (Redis or DB timestamp); background job to pre-compute KPIs if scaling                   |
| `apps/admin`      | KPI dashboard layout with six cards (users, events, subscriptions, engagement, pending moderation); trend indicators; period selector (7d, 30d) |
| `packages/shared` | TypeScript interfaces for KPI response schema                                                                                                   |

---

## API Endpoints

### GET /api/v1/admin/stats

Retrieve aggregated KPI data for the dashboard. Returns user, event, subscription, engagement, and moderation metrics.

**Query Parameters:**

- `period`: optional, `7d` (default) or `30d` — determines which time window to use for "new" counts

**Response (200 OK):**

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
    "newLast30Days": 34,
    "newLast7DaysTrend": "up",
    "newLast30DaysTrend": "down"
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
    "newLast30Days": 18,
    "newLast7DaysTrend": "up"
  },
  "subscriptions": {
    "activeVenues": 22,
    "monthlyRecurringRevenue": 3960,
    "newLast30Days": 4,
    "pastDueCount": 1,
    "mrrTrend": "up"
  },
  "engagement": {
    "totalFollows": 312,
    "totalBookings": 41,
    "bookingsByStatus": {
      "pending": 8,
      "accepted": 28,
      "rejected": 3,
      "cancelled": 2
    },
    "totalPosts": 67,
    "avgLikesPerPost": 4.2
  },
  "moderation": {
    "pendingReview": 8,
    "rejectedLast7Days": 1
  },
  "cachedAt": "2026-03-23T14:30:00Z",
  "cacheExpiresAt": "2026-03-23T14:35:00Z"
}
```

**Error Responses:**

- `401 Unauthorized`: Admin not authenticated
- `500 Internal Server Error`: Database query failed

---

## Requirements

### User KPIs

- R1: **Total users**: count all rows in `users` table where `isAdmin = false`
- R2: **Users by persona**: GROUP BY `currentRole` (spectator, artist, venue) and COUNT
- R3: **New users in last 7 days**: count users with `createdAt >= NOW() - INTERVAL '7 days'`
- R4: **New users in last 30 days**: count users with `createdAt >= NOW() - INTERVAL '30 days'`
- R5: **Trend indicators**: compare new users (last 7 days) vs previous 7 days; same for 30-day period. Show "up" if current > previous, "down" if current < previous

### Event KPIs

- R6: **Total events**: count all rows in `events` table where `status != 'draft'`
- R7: **Events by status**: GROUP BY `status` (active, pending_review, rejected, archived) and COUNT
- R8: **New events in last 7 days**: count events with `createdAt >= NOW() - INTERVAL '7 days'` and `status != 'draft'`
- R9: **New events in last 30 days**: count events with `createdAt >= NOW() - INTERVAL '30 days'`
- R10: **Pending moderation count**: count events where `status = 'pending_review'` (this also drives the sidebar badge in M9-T1)

### Subscription KPIs

- R11: **Active venue subscriptions**: count `venue_subscriptions` where `subscriptionStatus = 'active'`
- R12: **Monthly Recurring Revenue (MRR)**: SUM of (`subscriptionPrice` \* number of active subscriptions) / 12 if annual, or direct monthly sum if monthly
  - Stripe data: fetch from Stripe API or cache locally; for V1, assume £180/month per Venue (20 euros/month)
  - Simple formula: `activeVenues * 180` (in local currency)
- R13: **New subscriptions in last 30 days**: count `venue_subscriptions` with `createdAt >= NOW() - INTERVAL '30 days'` and `subscriptionStatus = 'active'`
- R14: **Past-due subscriptions**: count `venue_subscriptions` where `subscriptionStatus = 'past_due'`

### Engagement KPIs

- R15: **Total follows**: count all rows in `follows` table
- R16: **Total bookings**: count all rows in `bookings` table
- R17: **Bookings by status**: GROUP BY `status` (pending, accepted, rejected, cancelled) and COUNT
- R18: **Total posts**: count all rows in `posts` table where `status = 'active'` (not deleted)
- R19: **Avg likes per post**: SUM(`post_likes` count) / COUNT(`posts`)

### Dashboard Display

- R20: Six KPI cards displayed on the dashboard home screen:
  1. Users (total + breakdown by persona + new counts)
  2. Events (total + breakdown by status + new counts)
  3. Subscriptions (active count + MRR + new count + past-due)
  4. Engagement (follows + bookings breakdown + posts)
  5. Pending Moderation (count badge for navigation)
  6. (Optional) Platform Health (avg event creation time, avg approval time)
- R21: Each card shows a simple trend indicator (↑/↓) for the primary metric vs previous period
- R22: All KPIs refreshed on page load; no real-time polling required (data refreshes every 5 minutes max)

### Caching Strategy

- R23: KPI queries are expensive (multiple aggregations); cache results in-memory or in Redis with 5-minute TTL
  - Simple approach: store `cachedAt` timestamp on the response; if request comes within 5 minutes, return cached result
  - Advanced approach: use Redis with `cache:admin:stats` key, 300-second expiry
- R24: Cache invalidation: on new user signup, event creation, booking state change, or subscription event, invalidate the KPI cache immediately
- R25: During database migrations or schema changes, clear the cache to avoid stale data

---

## Acceptance Criteria

- [ ] `GET /admin/stats` endpoint returns valid JSON matching the schema above
- [ ] User count breakdown by persona is accurate (verified against Neon query)
- [ ] Event counts by status are accurate; pending_review count matches sidebar badge
- [ ] New user counts for 7d and 30d are accurate and update daily
- [ ] Subscription KPIs (active, MRR, new, past-due) are accurate
- [ ] Engagement metrics (follows, bookings, posts) are correct
- [ ] Trend indicators show up/down arrows correctly (compared to previous period)
- [ ] Dashboard loads within 2 seconds on page load (cached response)
- [ ] Cache invalidation works: creating a new event immediately updates pending_review count
- [ ] Admin can view KPI dashboard without errors on production

---

## Dependencies

- **Upstream**: M9-T1 (admin dashboard scaffold and auth); M1-T2 (DB schema with users, events, subscriptions, bookings, follows, posts tables); M2-T4 (personas system)
- **Downstream**: M12-T1 (testing — verify KPI accuracy); M12-T3 (launch monitoring — baseline KPI values)
- **External services**: Neon PostgreSQL (for aggregation queries); optional Redis (for caching)

---

## Technical Notes

### KPI Aggregation Queries (Drizzle ORM)

Example: fetch user stats with trend calculation

```typescript
import { db } from './db';
import { users } from './schema';
import { count, eq } from 'drizzle-orm';

async function getUserStats() {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Total users by persona
  const totalByPersona = await db
    .select({
      role: users.currentRole,
      count: count().as('count'),
    })
    .from(users)
    .where(eq(users.isAdmin, false))
    .groupBy(users.currentRole);

  // New users last 7 days
  const newLast7 = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.isAdmin, false),
        gte(users.createdAt, last7Days)
      )
    );

  // New users last 14 days (for trend calculation)
  const newLast14 = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.isAdmin, false),
        gte(users.createdAt, last14Days),
        lt(users.createdAt, last7Days)
      )
    );

  const trend7d = (newLast7[0]?.count || 0) > (newLast14[0]?.count || 0) ? 'up' : 'down';

  return {
    total: totalByPersona.reduce((sum, row) => sum + row.count, 0),
    byPersona: Object.fromEntries(
      totalByPersona.map(r => [r.role, r.count])
    ),
    newLast7Days: newLast7[0]?.count || 0,
    newLast30Days: /* similar query */,
    newLast7DaysTrend: trend7d,
  };
}
```

### Caching with Redis

```typescript
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const STATS_CACHE_KEY = "admin:stats";
const STATS_CACHE_TTL = 300; // 5 minutes

async function getCachedStats() {
  // Check cache first
  const cached = await redis.get(STATS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch fresh stats
  const stats = await computeStats();

  // Cache for 5 minutes
  await redis.setex(STATS_CACHE_KEY, STATS_CACHE_TTL, JSON.stringify(stats));

  return stats;
}

// Invalidate cache on data changes
app.post("/events", async (c) => {
  // ... create event logic ...
  await redis.del(STATS_CACHE_KEY); // Invalidate immediately
  return c.json({ success: true });
});
```

### Admin Dashboard KPI Card Component (Next.js + ShadCN/UI)

```typescript
// components/KPICard.tsx
interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down';
  subtitle?: string;
  breakdown?: Record<string, number>;
}

export function KPICard({
  title,
  value,
  unit,
  trend,
  subtitle,
  breakdown,
}: KPICardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
            {trend && (
              <span className={`text-lg ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trend === 'up' ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>
      </div>

      {subtitle && <p className="mt-3 text-xs text-gray-500">{subtitle}</p>}

      {breakdown && (
        <div className="mt-4 space-y-1 border-t pt-3">
          {Object.entries(breakdown).map(([label, count]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-600">{label}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Usage on dashboard
export default function Dashboard({ stats }: { stats: typeof adminStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <KPICard
        title="Total Users"
        value={stats.users.total}
        unit="users"
        trend={stats.users.newLast7DaysTrend}
        subtitle={`${stats.users.newLast7Days} new in last 7 days`}
        breakdown={stats.users.byPersona}
      />

      <KPICard
        title="Active Events"
        value={stats.events.byStatus.active}
        unit="events"
        trend={stats.events.newLast7DaysTrend}
        subtitle={`${stats.events.pendingReview} pending moderation`}
      />

      <KPICard
        title="Monthly Recurring Revenue"
        value={`€${(stats.subscriptions.monthlyRecurringRevenue / 100).toFixed(2)}`}
        trend={stats.subscriptions.mrrTrend}
        subtitle={`${stats.subscriptions.activeVenues} active venue subscriptions`}
      />

      {/* More cards... */}
    </div>
  );
}
```

### Hono Endpoint Implementation

```typescript
app.get("/api/v1/admin/stats", adminAuthMiddleware, async (c) => {
  try {
    // Check cache
    const cached = await redis.get("admin:stats:v1");
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Compute all stats in parallel
    const [userStats, eventStats, subscriptionStats, engagementStats] =
      await Promise.all([
        getUserStats(),
        getEventStats(),
        getSubscriptionStats(),
        getEngagementStats(),
      ]);

    const response = {
      users: userStats,
      events: eventStats,
      subscriptions: subscriptionStats,
      engagement: engagementStats,
      cachedAt: new Date().toISOString(),
      cacheExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    // Cache for 5 minutes
    await redis.setex("admin:stats:v1", 300, JSON.stringify(response));

    return c.json(response);
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});
```

---

## Common Gotchas

- **Trend calculation**: Comparing current period to previous period requires careful date math. Use ISO 8601 timestamps and timezone-aware calculations.

- **MRR calculation**: Monthly Recurring Revenue assumes all subscriptions are monthly. If annual subscriptions exist, divide by 12 or track billing period separately. For V1, assume all subscriptions are monthly.

- **Persona field name**: The column is `users.currentRole`, not `role` or `persona`. Ensure query matches schema.

- **Pending moderation badge**: The pending count is displayed both on the dashboard card AND in the sidebar badge. Keep both in sync by using the same query.

- **Cache invalidation timing**: Invalidating the cache on every user signup/event creation can be expensive at scale. For V1 (under 1,000 users), this is fine. For scaling, consider a background job that recomputes KPIs every 5 minutes instead of on-demand invalidation.

- **Slow query warning**: GROUP BY with COUNT on large tables can be slow. Ensure indexed columns (`createdAt`, `status`, `currentRole`, `subscriptionStatus`) have indices. At V1 scale, this is not an issue.

- **Timezone handling**: All timestamps in the DB should be UTC. Dashboard can display in user's local timezone or use a fixed UTC label.
