# M6-T3 · Follow System

| Field          | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Milestone**  | M6 — Profiles & Social                                                                                             |
| **Status**     | 🔲 To Do                                                                                                           |
| **Depends on** | M6-T1 (artist_profiles), M6-T2 (venue_profiles), M7-T1 (FCM push notifications)                                    |
| **PRD Ref**    | Section 5.1 (End User Features), Section 6.3 (Artist Social), Section 7.3 (Venue Social), Section 9.3 (Data Model) |

---

## Description

The follow system enables users to subscribe to specific artists and venues. Following influences the Discover feed algorithm (followed accounts rank higher) and enables users to receive push notifications about new posts and bookings from accounts they follow. This is a lightweight social graph — not a mutual follow system; follows are unidirectional. Any authenticated user can follow any artist or venue. Follower counts are denormalized on the profile tables for fast queries.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | POST /api/v1/follows (create follow), DELETE /api/v1/follows/:profileId (unfollow), GET /api/v1/users/me/following (list follows), GET /api/v1/artists/:id and GET /api/v1/venues/:id return follower_count |
| `apps/mobile`     | Follow button on Artist/Venue profile screens, Following list in Profile tab, follower count display                                                                                                        |
| `packages/shared` | Follow types, profile reference types                                                                                                                                                                       |
| Firebase FCM      | Push notification when user is followed (optional V2 feature)                                                                                                                                               |

---

## API Endpoints

### POST /api/v1/follows

Create a follow relationship. User follows an artist or venue.

**Authentication:** Required (any persona)

**Request Body:**

```json
{
  "profile_id": "artist-profile-uuid",
  "profile_type": "artist"
}
```

Valid profile_type: `"artist"` | `"venue"`

**Response (201 Created):**

```json
{
  "id": "follow-uuid",
  "follower_user_id": "user-uuid",
  "following_profile_id": "artist-profile-uuid",
  "following_profile_type": "artist",
  "created_at": "2026-03-23T14:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Invalid profile_id or profile_type; attempting to follow self
- `401 Unauthorized` — Not authenticated
- `404 Not Found` — Profile does not exist or is inactive
- `409 Conflict` — Already following this profile (duplicate)
- `500 Internal Server Error` — Database error

---

### DELETE /api/v1/follows/:profileId

Remove a follow relationship. User unfollows an artist or venue.

**Authentication:** Required (any persona)

**Path Params:**

```
:profileId — UUID of artist_profile or venue_profile being unfollowed
```

**Response (204 No Content):**

```
(no body)
```

**Error Responses:**

- `401 Unauthorized` — Not authenticated
- `404 Not Found` — Follow relationship does not exist
- `500 Internal Server Error` — Database error

---

### GET /api/v1/users/me/following

List all artists and venues the authenticated user follows.

**Authentication:** Required

**Query Params:**

```
?profile_type=artist  (optional: filter to only artists or venues)
?limit=50             (optional: default 50, max 100)
?offset=0             (optional: pagination)
```

**Response (200 OK):**

```json
{
  "following": [
    {
      "id": "follow-uuid-1",
      "profile_id": "artist-uuid-1",
      "profile_type": "artist",
      "profile": {
        "id": "artist-uuid-1",
        "display_name": "Síle Na Gealach",
        "profile_image_url": "https://...",
        "genres": ["traditional", "folk"],
        "is_active": true
      },
      "created_at": "2026-03-20T10:00:00Z"
    },
    {
      "id": "follow-uuid-2",
      "profile_id": "venue-uuid-1",
      "profile_type": "venue",
      "profile": {
        "id": "venue-uuid-1",
        "name": "The Brazen Head",
        "profile_image_url": "https://...",
        "subscription_status": "active",
        "is_active": true
      },
      "created_at": "2026-03-22T14:30:00Z"
    }
  ],
  "total": 2
}
```

---

## Requirements

### Follow Creation

- R1: Any authenticated user (spectator, artist, venue) can follow any active artist or venue
- R2: A user cannot follow themselves (attempting to follow own profile returns error)
- R3: Each user can follow a profile at most once (duplicate follows prevented by unique constraint)
- R4: Attempting to follow an inactive profile (is_active = false) returns 404 error
- R5: Follow is unidirectional — no mutual follow requirement

### Unfollowing

- R6: User can unfollow any profile they previously followed
- R7: Unfollowing removes the follow relationship from the database
- R8: Unfollow can be called by the user who created the follow relationship

### Follower Count

- R9: artist_profiles.follower_count and venue_profiles.follower_count are denormalized integers
- R10: On follow creation: increment follower_count on the target profile
- R11: On unfollow: decrement follower_count on the target profile
- R12: Follower count displayed prominently on all profile pages (artist and venue)
- R13: Follower count updates in real-time (or on refresh) when follow/unfollow occurs

### Follow List

- R14: GET /api/v1/users/me/following returns all profiles (artists and venues) the authenticated user follows
- R15: Results include profile data (id, display_name/name, profile_image_url, genre/subscription_status)
- R16: Results are paginated (default 50 per page, max 100)
- R17: Results can be filtered by profile_type (artist or venue only)
- R18: Results are sorted by follow creation date (newest first)

### UI Integration

- R19: Follow button visible on all artist and venue profile screens (except own profile)
- R20: Follow button text toggles between "Follow" and "Following" based on follow status
- R21: Tapping Follow button calls POST /api/v1/follows and updates button state immediately (optimistic UI)
- R22: Tapping Following button calls DELETE /api/v1/follows and updates button state immediately
- R23: User's Following tab in Profile section shows full list with scroll/pagination
- R24: Following list shows profile image, name, and a quick-unfollow button

### Feed Integration (Deferred to M3-T4)

- R25: Discover feed algorithm weights followed accounts at +20% ranking boost
- R26: Users see posts from followed accounts higher in their feed
- R27: Follows feed is the primary source of feed content (followed posts, then trending, then random)

---

## Acceptance Criteria

### Follow Button

- [ ] Follow button visible on all artist and venue profile screens
- [ ] Follow button disabled when viewing own profile (Artist viewing Artist profile, Venue viewing Venue profile)
- [ ] Tapping Follow calls POST /api/v1/follows; button toggles to "Following" immediately
- [ ] Tapping Following calls DELETE /api/v1/follows; button toggles back to "Follow" immediately
- [ ] Follower count increments when follow created, decrements on unfollow

### Follow Validation

- [ ] Attempting to follow self returns error
- [ ] Attempting to follow same profile twice returns 409 Conflict
- [ ] Following inactive profile returns 404 error
- [ ] Unfollow request for non-existent follow returns 404

### Following List

- [ ] GET /api/v1/users/me/following returns all followed profiles with full data
- [ ] Results paginated (default 50, max 100)
- [ ] Results can be filtered by profile_type (artist or venue)
- [ ] Following tab in Profile section renders list with scroll/pagination
- [ ] Each item shows profile image, name, and unfollow button
- [ ] Tapping unfollow from Following list immediately removes item and updates count

### Database

- [ ] Follower count incremented on follow, decremented on unfollow
- [ ] Unique constraint on (follower_user_id, following_profile_id, following_profile_type) prevents duplicates
- [ ] Composite index on follower_user_id for fast filtering

---

## Dependencies

- **Upstream**: M6-T1 (artist_profiles must exist), M6-T2 (venue_profiles must exist), M7-T1 (FCM for future notifications)
- **Downstream**: M3-T4 (Feed algorithm uses follower graph for ranking), M6-T4 (Posts feed queries followed accounts)
- **External services**: Firebase FCM (optional: notify when followed in V2)

---

## Technical Notes

### Database Schema (follows table)

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES users(id),
  following_profile_id UUID NOT NULL,
  following_profile_type TEXT NOT NULL CHECK (following_profile_type IN ('artist', 'venue')),
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_follow UNIQUE(follower_user_id, following_profile_id, following_profile_type)
);

CREATE INDEX idx_follows_follower ON follows(follower_user_id);
CREATE INDEX idx_follows_following ON follows(following_profile_id, following_profile_type);
```

### Hono Handler Example

```typescript
import { Hono } from "hono";
import { db } from "../db";
import { follows, artistProfiles, venueProfiles } from "../db/schema";
import { eq, and } from "drizzle-orm";

const followRouter = new Hono();

// POST /follows
followRouter.post("/", async (c) => {
  const user = c.get("user");
  const { profile_id, profile_type } = await c.req.json();

  if (!["artist", "venue"].includes(profile_type)) {
    return c.json({ error: "Invalid profile_type" }, 400);
  }

  // Check if profile exists and is active
  const profileTable =
    profile_type === "artist" ? artistProfiles : venueProfiles;
  const profile = await db
    .select()
    .from(profileTable)
    .where(
      and(eq(profileTable.id, profile_id), eq(profileTable.is_active, true)),
    )
    .then((rows) => rows[0]);

  if (!profile) {
    return c.json({ error: "Profile not found or inactive" }, 404);
  }

  // Prevent self-follow
  if (profile_type === "artist") {
    const artistProfile = await db.query.artistProfiles.findFirst({
      where: eq(artistProfiles.user_id, user.id),
    });
    if (artistProfile?.id === profile_id) {
      return c.json({ error: "Cannot follow yourself" }, 400);
    }
  } else if (profile_type === "venue") {
    const venueProfile = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.user_id, user.id),
    });
    if (venueProfile?.id === profile_id) {
      return c.json({ error: "Cannot follow yourself" }, 400);
    }
  }

  // Check for duplicate follow
  const existingFollow = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.follower_user_id, user.id),
        eq(follows.following_profile_id, profile_id),
        eq(follows.following_profile_type, profile_type),
      ),
    )
    .then((rows) => rows[0]);

  if (existingFollow) {
    return c.json({ error: "Already following this profile" }, 409);
  }

  // Create follow
  const newFollow = await db
    .insert(follows)
    .values({
      follower_user_id: user.id,
      following_profile_id: profile_id,
      following_profile_type: profile_type,
    })
    .returning()
    .then((rows) => rows[0]);

  // Increment follower_count
  await db
    .update(profileTable)
    .set({ follower_count: db.raw(`follower_count + 1`) })
    .where(eq(profileTable.id, profile_id));

  return c.json(newFollow, 201);
});

// DELETE /follows/:profileId
followRouter.delete("/:profileId", async (c) => {
  const user = c.get("user");
  const profileId = c.req.param("profileId");

  // Find the follow relationship
  const follow = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.follower_user_id, user.id),
        eq(follows.following_profile_id, profileId),
      ),
    )
    .then((rows) => rows[0]);

  if (!follow) {
    return c.json({ error: "Follow not found" }, 404);
  }

  // Delete follow
  await db.delete(follows).where(eq(follows.id, follow.id));

  // Decrement follower_count
  const profileTable =
    follow.following_profile_type === "artist" ? artistProfiles : venueProfiles;
  await db
    .update(profileTable)
    .set({ follower_count: db.raw(`MAX(0, follower_count - 1)`) })
    .where(eq(profileTable.id, profileId));

  return c.json({}, 204);
});

// GET /users/me/following
followRouter.get("/me/following", async (c) => {
  const user = c.get("user");
  const profileType = c.req.query("profile_type");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  let query = db
    .select()
    .from(follows)
    .where(eq(follows.follower_user_id, user.id));

  if (profileType && ["artist", "venue"].includes(profileType)) {
    query = query.where(eq(follows.following_profile_type, profileType));
  }

  const results = await query
    .limit(limit)
    .offset(offset)
    .orderBy(desc(follows.created_at));

  // Fetch profile data for each follow
  const following = await Promise.all(
    results.map(async (f) => {
      const profileTable =
        f.following_profile_type === "artist" ? artistProfiles : venueProfiles;
      const profile = await db
        .select()
        .from(profileTable)
        .where(eq(profileTable.id, f.following_profile_id))
        .then((rows) => rows[0]);

      return {
        ...f,
        profile,
      };
    }),
  );

  return c.json({
    following,
    total: following.length,
  });
});

export default followRouter;
```

### React Native Follow Button Component

```typescript
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { api } from '../services/api';

export function FollowButton({ profileId, profileType, isOwnProfile = false }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFollowStatus();
  }, [profileId]);

  const checkFollowStatus = async () => {
    try {
      const response = await api.get('/users/me/following');
      const isFollowing = response.data.following.some(
        f => f.following_profile_id === profileId
      );
      setIsFollowing(isFollowing);
    } catch (error) {
      // Silently fail
    }
  };

  const handleFollow = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await api.delete(`/follows/${profileId}`);
        setIsFollowing(false);
      } else {
        // Follow
        await api.post('/follows', {
          profile_id: profileId,
          profile_type: profileType,
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Follow action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isOwnProfile) {
    return null; // Don't show follow button on own profile
  }

  return (
    <TouchableOpacity
      onPress={handleFollow}
      disabled={loading}
      style={[
        styles.button,
        isFollowing ? styles.followingButton : styles.followButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isFollowing ? '#000' : '#fff'} />
      ) : (
        <Text style={[
          styles.buttonText,
          isFollowing ? styles.followingText : styles.followText,
        ]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}
```

### React Native Following List Screen

```typescript
export function FollowingListScreen() {
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchFollowing();
  }, [page]);

  const fetchFollowing = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/me/following?limit=50&offset=${page * 50}`);
      setFollowing(response.data.following);
    } catch (error) {
      Alert.alert('Error', 'Failed to load following list');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (profileId) => {
    try {
      await api.delete(`/follows/${profileId}`);
      setFollowing(following.filter(f => f.following_profile_id !== profileId));
    } catch (error) {
      Alert.alert('Error', 'Failed to unfollow');
    }
  };

  const renderFollowingItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.profile.profile_image_url }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.name}>
          {item.profile.display_name || item.profile.name}
        </Text>
        <Text style={styles.detail}>
          {item.profile.genres?.[0] || 'Venue'}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleUnfollow(item.following_profile_id)}
        style={styles.unfollowButton}
      >
        <Text>Unfollow</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={following}
      renderItem={renderFollowingItem}
      keyExtractor={(item) => item.id}
      onEndReached={() => setPage(page + 1)}
      refreshing={loading}
      onRefresh={() => setPage(0)}
    />
  );
}
```

### Common Gotchas

- **Self-follow validation**: Must check that the user doesn't own the profile they're trying to follow. This requires querying artist_profiles or venue_profiles by user_id first.
- **Denormalized follower_count**: Must increment/decrement synchronously with the follow/unfollow operation. If the operation fails, roll back the count update.
- **Duplicate follow handling**: Unique constraint catches duplicates at DB level. If a duplicate is attempted, return 409 Conflict (not 400 Bad Request).
- **Inactive profile follow**: If user follows an artist, then the artist switches away (is_active = false), the follow relationship persists. When artist becomes active again, the follow is still there.
- **Follower count stale reads**: For very high-traffic profiles, follower_count could become stale. Acceptable for V1 scale (under 1,000 users).
- **Follow persistence after switch**: If a user switches personas, their follows are preserved. A Spectator's follows remain even if they switch to Artist.
