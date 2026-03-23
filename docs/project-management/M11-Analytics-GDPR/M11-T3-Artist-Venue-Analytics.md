# M11-T3 · Artist & Venue In-App Analytics

| Field | Value |
|-------|-------|
| **Milestone** | M11 — Analytics & GDPR |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T4 (personas), M4-T1 (events), M5 (bookings), M6-T1 (Artist profile), M6-T2 (Venue profile), M6-T3 (follows), M6-T4 (posts) |
| **PRD Ref** | Section 6.1 (Artist Features), Section 7.1 (Venue Features — Analytics) |

---

## Description

Artists and Venues need visibility into their content performance to make informed decisions about future events and promotions. This task provides a creator-only analytics tab within their profile showing engagement metrics (post likes, event views, event saves), booking activity status, follower growth, and audience insights. All metrics are aggregated server-side and cached for 30 minutes to balance freshness and performance. Analytics data is **strictly private** — each creator can only view their own analytics; the endpoints use the authenticated user's session identity, not a profile ID parameter. Spectators have no access to this feature. This is essential during the controlled launch to help creators understand what resonates with the audience.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | `GET /artists/me/analytics`, `GET /venues/me/analytics` endpoints; aggregation queries; caching layer (Redis or DB timestamp) |
| `apps/mobile` | Analytics tab on Artist profile (ProfileArtist screen) and Venue profile (ProfileVenue screen); visible to owner only; stat cards, breakdown tables |
| `packages/shared` | TypeScript interfaces for analytics response schema |

---

## API Endpoints

### GET /api/v1/artists/me/analytics

Retrieve analytics for the authenticated Artist. Returns post engagement, event reach, bookings, and follower data.

**Response (200 OK):**
```json
{
  "posts": {
    "totalLikes": 342,
    "totalPosts": 8,
    "avgLikesPerPost": 42.75,
    "topPosts": [
      {
        "postId": "post_123",
        "title": "Join me at Fleadh Cheoil 2026",
        "likes": 157,
        "createdAt": "2026-03-10T14:30:00Z"
      },
      {
        "postId": "post_124",
        "title": "New fiddle tune release",
        "likes": 98,
        "createdAt": "2026-03-05T10:00:00Z"
      },
      {
        "postId": "post_125",
        "title": "Live session this weekend",
        "likes": 87,
        "createdAt": "2026-02-28T16:45:00Z"
      }
    ]
  },
  "events": {
    "totalEvents": 5,
    "totalViews": 1243,
    "totalSaves": 89,
    "avgViewsPerEvent": 248.6
  },
  "bookings": {
    "total": 12,
    "byStatus": {
      "pending": 2,
      "accepted": 8,
      "rejected": 1,
      "cancelled": 1
    }
  },
  "followers": 156,
  "cachedAt": "2026-03-23T14:30:00Z",
  "cacheExpiresAt": "2026-03-23T15:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated or not an artist
- `403 Forbidden`: Artist profile not set up for this user

---

### GET /api/v1/venues/me/analytics

Retrieve analytics for the authenticated Venue. Includes all artist metrics plus applications received.

**Response (200 OK):**
```json
{
  "posts": {
    "totalLikes": 512,
    "totalPosts": 15,
    "avgLikesPerPost": 34.1,
    "topPosts": [
      {
        "postId": "post_201",
        "title": "St. Patrick's Day Ceili - Tickets Now on Sale",
        "likes": 234,
        "createdAt": "2026-03-01T09:00:00Z"
      }
    ]
  },
  "events": {
    "totalEvents": 12,
    "totalViews": 3456,
    "totalSaves": 234,
    "avgViewsPerEvent": 288
  },
  "bookings": {
    "total": 28,
    "byStatus": {
      "pending": 3,
      "accepted": 22,
      "rejected": 2,
      "cancelled": 1
    }
  },
  "gigOpportunities": {
    "totalPosted": 4,
    "totalApplications": 16,
    "applicationsByOpportunity": [
      {
        "eventId": "event_501",
        "eventTitle": "Live Music Every Friday",
        "applicationsCount": 8
      },
      {
        "eventId": "event_502",
        "eventTitle": "St. Paddy's Day Special",
        "applicationsCount": 5
      }
    ]
  },
  "followers": 312,
  "subscription": {
    "status": "active",
    "since": "2026-02-10T00:00:00Z",
    "nextBillingDate": "2026-04-10T00:00:00Z"
  },
  "cachedAt": "2026-03-23T14:30:00Z",
  "cacheExpiresAt": "2026-03-23T15:00:00Z"
}
```

---

## Requirements

### Event View Counting

- R1: **Add column to schema**: `events.view_count` (integer, default 0)
- R2: On each `GET /events/:id` call from a non-creator user, increment `events.view_count` by 1
  - Creator viewing their own event does NOT increment the count
  - Spectators, Artists viewing other events, Venues all increment
  - Simple approach: `UPDATE events SET view_count = view_count + 1 WHERE id = ? AND created_by != ?`
- R3: No deduplication needed in V1; same user viewing multiple times counts each time

### Artist Analytics

- R4: **Post engagement**: SUM of all likes across artist's posts (`SUM(post_likes)` where post belongs to artist)
- R5: **Top 3 posts by likes**: fetch top 3 posts with highest like counts; include postId, title, likes, createdAt
- R6: **Event reach**: SUM of `view_count` from all artist's active events; also show total event saves (count from `saved_events` where event belongs to artist)
- R7: **Follower count**: COUNT rows in `follows` where `followedId = artist_id`
- R8: **Booking activity**: COUNT bookings by status where `artistId = artist_id`; breakdown: pending, accepted, rejected, cancelled

### Venue Analytics

- R9: All metrics from R4–R8 above (posts, event reach, bookings, followers)
- R10: **Gig opportunities**: identify all events where `is_gig_opportunity = true` and `created_by = venue_id`; for each, count applications (`bookings` where the event is a gig opportunity)
- R11: **Subscription status**: fetch from `venue_subscriptions` table; show "Active" (green), "Past Due" (red), "Inactive" (gray)
- R12: **Subscription dates**: show "Member since" (subscription created date) and "Next billing date" (calculated from subscription period)

### Caching & Performance

- R13: Cache analytics responses per profile ID with 30-minute TTL (via Redis or DB timestamp)
- R14: Invalidate cache immediately on:
  - New post created by creator
  - New like on creator's post
  - New booking (any status change)
  - New follow of the creator
  - New event view (optional — can wait for cache expiry)
- R15: All queries use indexed columns (`created_by`, `status`, `createdAt`); no complex CTEs or window functions
- R16: Analytics load within 2 seconds (cached response within 100ms, fresh computation within 2 seconds)

### UI & Access Control

- R17: Analytics tab appears on creator's own Artist profile (when viewing self); hidden when another user views the profile
- R18: Analytics tab appears on creator's own Venue profile (when viewing self); hidden when other users view the profile
- R19: Spectators have NO analytics tab — only Artists and Venues see this feature
- R20: On mobile, analytics tab is a secondary tab in the profile (after "About" and "Events" tabs); swipe or tab selector to navigate
- R21: No analytics data is exposed via public profile endpoints; all data is creator-only and authenticated

---

## Acceptance Criteria

- [ ] `view_count` column exists on events table
- [ ] Event view count increments on each non-creator view of event detail screen
- [ ] `GET /artists/me/analytics` returns correct post, event, booking, and follower data
- [ ] `GET /venues/me/analytics` returns all artist metrics plus gig opportunity applications
- [ ] Analytics tab visible on Creator's own profile; hidden when viewing another profile
- [ ] Top 3 posts by likes displayed correctly
- [ ] Event saves count accurate
- [ ] Booking breakdown (pending/accepted/rejected/cancelled) correct
- [ ] Venue sees gig opportunity application counts per event
- [ ] Subscription status and dates shown for Venues
- [ ] Analytics load within 2 seconds
- [ ] Cache invalidation works: creating a new post immediately updates analytics
- [ ] No analytics visible to Spectators

---

## Dependencies

- **Upstream**: M4-T1 (events schema, view_count column); M5 (bookings); M6-T1/T2 (artist/venue profiles); M6-T3 (follows); M6-T4 (posts, likes); M8 (venue subscriptions)
- **Downstream**: M12-T1 (testing — verify accuracy of aggregations); M12-T3 (launch monitoring — baseline engagement metrics)
- **External services**: Neon PostgreSQL (aggregation queries); Redis (optional caching)

---

## Technical Notes

### Event View Count Increment (Hono Endpoint)

```typescript
app.get('/api/v1/events/:eventId', async (c) => {
  const eventId = c.req.param('eventId');
  const userId = c.get('userId'); // from auth middleware, nullable for Spectators

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Increment view count if user is NOT the creator
  if (userId && userId !== event.createdBy) {
    await db
      .update(events)
      .set({ viewCount: event.viewCount + 1 })
      .where(eq(events.id, eventId));
  }

  return c.json(event);
});
```

### Artist Analytics Endpoint (Hono)

```typescript
app.get('/api/v1/artists/me/analytics', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Verify artist profile exists
  const artistProfile = await db.query.artistProfiles.findFirst({
    where: eq(artistProfiles.userId, userId),
  });

  if (!artistProfile) {
    return c.json({ error: 'Artist profile not found' }, 403);
  }

  // Check cache
  const cached = await redis.get(`analytics:artist:${userId}`);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  // Fetch analytics in parallel
  const [postLikes, topPosts, eventReach, eventSaves, bookings, followers] = await Promise.all([
    // Total likes
    db
      .select({ total: sql`sum(${postLikes.count})` })
      .from(postLikes)
      .innerJoin(posts, eq(posts.id, postLikes.postId))
      .where(eq(posts.createdBy, userId)),

    // Top 3 posts
    db
      .select({
        postId: posts.id,
        title: posts.title,
        likes: sql`count(${postLikes.id})`,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .leftJoin(postLikes, eq(postLikes.postId, posts.id))
      .where(eq(posts.createdBy, userId))
      .groupBy(posts.id)
      .orderBy(desc(sql`count(${postLikes.id})`))
      .limit(3),

    // Event views + saves
    db
      .select({
        totalViews: sql`sum(${events.viewCount})`,
        totalEvents: count(),
      })
      .from(events)
      .where(eq(events.createdBy, userId)),

    // Event saves
    db
      .select({ count: count() })
      .from(savedEvents)
      .innerJoin(events, eq(events.id, savedEvents.eventId))
      .where(eq(events.createdBy, userId)),

    // Bookings by status
    db
      .select({
        status: bookings.status,
        count: count(),
      })
      .from(bookings)
      .where(eq(bookings.artistId, userId))
      .groupBy(bookings.status),

    // Follower count
    db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followedId, userId)),
  ]);

  const analytics = {
    posts: {
      totalLikes: postLikes[0]?.total || 0,
      totalPosts: topPosts.length,
      avgLikesPerPost:
        topPosts.length > 0
          ? topPosts.reduce((sum, p) => sum + p.likes, 0) / topPosts.length
          : 0,
      topPosts: topPosts.map(p => ({
        postId: p.postId,
        title: p.title,
        likes: p.likes,
        createdAt: p.createdAt,
      })),
    },
    events: {
      totalEvents: eventReach[0]?.totalEvents || 0,
      totalViews: eventReach[0]?.totalViews || 0,
      totalSaves: eventSaves[0]?.count || 0,
      avgViewsPerEvent:
        (eventReach[0]?.totalEvents || 0) > 0
          ? (eventReach[0]?.totalViews || 0) / eventReach[0]?.totalEvents
          : 0,
    },
    bookings: {
      total: bookings.reduce((sum, b) => sum + b.count, 0),
      byStatus: Object.fromEntries(
        bookings.map(b => [b.status, b.count])
      ),
    },
    followers: followers[0]?.count || 0,
    cachedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  // Cache for 30 minutes
  await redis.setex(
    `analytics:artist:${userId}`,
    1800,
    JSON.stringify(analytics)
  );

  return c.json(analytics);
});
```

### Mobile UI - Analytics Tab (React Native)

```typescript
// AnalyticsTab.tsx
import { useQuery } from '@tanstack/react-query';

export function AnalyticsTab() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['artist-analytics'],
    queryFn: () => api.get('/artists/me/analytics'),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  if (isLoading) return <ActivityIndicator />;
  if (!analytics) return <Text>No analytics</Text>;

  return (
    <ScrollView className="p-4">
      <StatCard title="Total Likes" value={analytics.posts.totalLikes} />
      <StatCard
        title="Event Views"
        value={analytics.events.totalViews}
        subtitle={`Avg: ${analytics.events.avgViewsPerEvent.toFixed(0)} per event`}
      />
      <StatCard
        title="Event Saves"
        value={analytics.events.totalSaves}
      />
      <StatCard title="Followers" value={analytics.followers} />

      <View className="mt-6">
        <Text className="mb-3 text-lg font-bold">Top Posts</Text>
        {analytics.posts.topPosts.map(post => (
          <View key={post.postId} className="mb-3 rounded-lg bg-gray-50 p-3">
            <Text className="font-semibold">{post.title}</Text>
            <Text className="text-sm text-gray-600">
              {post.likes} likes
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-6">
        <Text className="mb-3 text-lg font-bold">Bookings</Text>
        <View className="rounded-lg bg-gray-50 p-3">
          <Text className="text-sm">
            Pending: {analytics.bookings.byStatus.pending || 0}
          </Text>
          <Text className="text-sm">
            Accepted: {analytics.bookings.byStatus.accepted || 0}
          </Text>
          <Text className="text-sm">
            Rejected: {analytics.bookings.byStatus.rejected || 0}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
```

---

## Common Gotchas

- **View count race conditions**: Multiple concurrent requests viewing the same event can race. Use atomic database operations (`viewCount = viewCount + 1`) to avoid lost increments.

- **Cache invalidation**: If cache is invalidated on every event view, performance suffers. For V1, it's acceptable to cache for 30 minutes and let analytics be slightly stale. Alternatively, increment view count without cache invalidation and let the cache expire naturally.

- **Creator vs spectator**: Ensure the creator viewing their own event does NOT increment the count. Check `userId !== event.createdBy` before incrementing.

- **Aggregation query performance**: COUNT and SUM queries on large tables can be slow. Ensure indexed columns (`created_by`, `status`, `followedId`). At V1 scale (under 1,000 users), indexes on these columns are sufficient.

- **Subscription dates for Venues**: The `next_billing_date` should be calculated based on the billing cycle. If using Stripe, fetch this from the Stripe API or cache it locally on subscription updates.

- **No access control bypass**: The `/analytics` endpoints must verify the authenticated user is the creator. Never accept a profile ID parameter; always use `c.get('userId')` from the session.
