# M6-T1 · Artist Profile (Public + Edit)

| Field          | Value                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M6 — Profiles & Social                                                                                              |
| **Status**     | ✅ Complete                                                                                                         |
| **Depends on** | M2-T4 (artist_profiles table created), M4-T1 (events linked to artist), M10-T1 (image upload via presigned S3 URLs) |
| **PRD Ref**    | Section 6.1 (Artist Features), Section 9.3 (Data Model)                                                             |

---

## Description

The Artist's public profile surfaces their identity, biography, genres, social media links, and upcoming/past events. Visible to all users (spectators, venue operators, other artists). The artist can edit their own profile at any time — no moderation required. The profile operates as both a discovery mechanism (follow-able identity) and a booking portfolio (event listing).

---

## Affected Apps / Packages

| App / Package       | Role                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/api`      | `artists.byId` (public), `artists.updateMe` (artist role only) — tRPC procedures                    |
| `apps/mobile`       | Public Artist Profile screen, Edit Profile screen (Artist persona only), image picker and S3 upload |
| AWS S3 + CloudFront | Profile image and cover image storage                                                               |

---

## tRPC Procedures

### `artists.byId` (publicProcedure · query)

Fetch public artist profile. Returns `NOT_FOUND` if `is_active = false`.

**Input:** `{ id: string }`

**Output (key fields):**

```typescript
{
  id, userId,
  displayName, bio,
  genres: string[],
  location: string,
  profileImageUrl, coverImageUrl,
  socialLinks: Record<string, string>,
  isActive: boolean,
  followerCount: number,
  upcomingEvents: EventSummary[],
  pastEvents: EventSummary[],
  createdAt, updatedAt,
}
```

**tRPC errors:** `NOT_FOUND` — profile not found or inactive

### `artists.updateMe` (protectedProcedure · mutation)

Update the authenticated user's own artist profile. Artist role required. All fields optional — only provided fields updated. Profile image upload uses `events.getPresignedUrl` (same S3 pattern).

**Input:**

```typescript
{
  displayName?: string,
  bio?: string,
  genres?: string[],
  location?: string,
  profileImageUrl?: string,   // CloudFront CDN URL after direct S3 upload
  coverImageUrl?: string,
  socialLinks?: Record<string, string>,
}
```

**tRPC errors:** `FORBIDDEN` — not in Artist persona

**Response (200 OK):**

```json
{
  "id": "artist-profile-uuid",
  "user_id": "user-uuid",
  "display_name": "Síle Na Gealach",
  "bio": "Traditional Irish fiddle player from Co. Galway",
  "genres": ["traditional", "folk", "sean-nós"],
  "location": "Galway, Ireland",
  "profile_image_url": "https://d123.cloudfront.net/profiles/artist-uuid-profile.jpg",
  "cover_image_url": "https://d123.cloudfront.net/profiles/artist-uuid-cover.jpg",
  "social_links": {
    "spotify": "https://open.spotify.com/artist/...",
    "instagram": "https://instagram.com/silegealach",
    "soundcloud": "https://soundcloud.com/silegealach"
  },
  "is_active": true,
  "follower_count": 47,
  "updated_at": "2026-03-23T12:45:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Invalid social_links format, genres not in enum, bio exceeds char limit
- `401 Unauthorized` — Not authenticated or not in Artist persona
- `404 Not Found` — Artist profile does not exist (user is not an artist)
- `500 Internal Server Error` — Database error

---

### GET /api/v1/upload/presigned?type=profile_image

Request a presigned S3 URL for uploading artist profile image. Image is stored in a user-scoped S3 prefix.

**Query Params:**

```
type=profile_image  (required)
```

**Response (200 OK):**

```json
{
  "upload_url": "https://ceolx-uploads.s3.amazonaws.com/artists/artist-uuid/profile.jpg?X-Amz-Algorithm=...",
  "cdn_url": "https://d123.cloudfront.net/profiles/artist-uuid-profile.jpg",
  "expires_in_seconds": 900
}
```

After upload completes, call PUT /api/v1/artists/me with the returned cdn_url.

---

## Requirements

### Profile Display

- R1: Public profile displays display_name, bio, genres (as tags), location, profile_image_url, cover_image_url, social_links, and follower count
- R2: Upcoming events (status = active, date_start > now) displayed with title, date, and venue address
- R3: Past events (status = archived, date_start < now) displayed separately with title and date only
- R4: Display name is required; bio, genres, location optional; social_links stored as flexible JSON object (platform → URL pairs)
- R5: Profile images stored in AWS S3 via CloudFront CDN with caching headers (24h)
- R6: Inactive profiles (is_active = false) return 404 to all users except the profile owner (who sees profile but cannot edit)

### Profile Editing

- R7: Artist can edit all profile fields at any time without moderation
- R8: Edit Profile screen shows form with all fields prefilled from database
- R9: Profile image upload via presigned S3 URL (GET /api/v1/upload/presigned?type=profile_image)
- R10: After successful S3 upload, mobile calls PUT /api/v1/artists/me with new cdn_url to update database
- R11: Social links support any platform (Spotify, Instagram, SoundCloud, YouTube, etc.); no hard-coded list of allowed platforms
- R12: Profile edits are NOT moderated — changes go live immediately

### Visibility & Access Control

- R13: Follow button visible on all profiles (artist cannot follow themselves; button disabled if viewing own profile)
- R14: Follower count displayed prominently on profile header
- R15: Switching away from Artist persona sets is_active = false; profile returns 404 publicly but stays in database (no hard delete)
- R16: Past approved events remain visible on the map/feed until their date passes, even if artist becomes inactive

### Role-Based UI

- R17: Edit Profile button visible only when viewing own profile as Artist persona
- R18: Spectators and Venues see read-only view of Artist profile
- R19: Follow/Unfollow button state reflects real-time follow status

---

## Acceptance Criteria

### Public Profile Rendering

- [x] Artist profile page renders with all fields populated (display_name, bio, genres, location, images)
- [x] Upcoming events listed in chronological order (active events only, date_start > now)
- [x] Past events section shows archived events (status = archived)
- [x] Follower count displayed and updates after follow/unfollow
- [x] Social media links render as clickable buttons/icons (if present)
- [x] Inactive profile (is_active = false) returns 404 with error message

### Profile Editing (Artist Only)

- [x] Edit Profile button visible only when logged in as Artist viewing own profile
- [x] Clicking Edit Profile opens form with all fields prefilled from database
- [x] Artist can edit display_name, bio, genres, location, social_links
- [x] Artist can upload new profile image via presigned S3 URL _(deferred to M10-T1)_
- [x] Saving profile updates immediately in database (no moderation queue)
- [x] Profile updates reflected on public profile page after refresh

### Image Upload

- [x] GET /api/v1/upload/presigned?type=profile*image returns valid S3 presigned URL (expires in 15 min) *(deferred to M10-T1)\_
- [x] Mobile uploads image directly to S3 presigned URL (bypasses backend) _(deferred to M10-T1)_
- [x] After upload, calling PUT /api/v1/artists/me with cdn*url updates profile *(deferred to M10-T1)\_
- [x] Old profile image remains in S3 (no cleanup in V1; CDN handles cache invalidation) _(deferred to M10-T1)_
- [x] CloudFront CDN URL returns image with proper MIME type and cache headers _(deferred to M10-T1)_

### Follow Integration

- [x] Follow button visible and functional on all profiles (except own profile)
- [x] Clicking Follow creates entry in follows table; button toggles to "Following" _(deferred to M6-T3)_
- [x] Follower count increments when follow created, decrements on unfollow _(deferred to M6-T3)_
- [x] Attempting to follow self returns error (button disabled) _(deferred to M6-T3)_
- [x] Profile owner follows list accessible from /api/v1/users/me/following _(deferred to M6-T3)_

### Profile Visibility

- [x] GET /api/v1/artists/:id returns 404 for inactive profiles (unless requester owns the profile)
- [x] Inactive artist profile remains in database (is_active = false)
- [x] Switching away from Artist persona triggers is_active = false transition

---

## Dependencies

- **Upstream**: M2-T4 (artist_profiles table must exist), M1-T2 (database schema complete), M10-T1 (presigned S3 URL generation)
- **Downstream**: M6-T3 (Follow System depends on artist_profiles.id), M6-T4 (Posts feed queries artist_profiles), M3-T4 (Feed ranking uses artist profiles)
- **External services**: AWS S3 (image upload), CloudFront (CDN delivery)

---

## Technical Notes

### Database Schema (artist_profiles)

```sql
CREATE TABLE artist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  display_name TEXT NOT NULL,
  bio TEXT,
  genres TEXT[] DEFAULT '{}',
  location TEXT,
  profile_image_url TEXT,
  cover_image_url TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  follower_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_user_artist UNIQUE(user_id)
);
CREATE INDEX idx_artist_is_active ON artist_profiles(is_active);
```

### Hono Handler Example

```typescript
import { Hono } from 'hono';
import { db } from '../db';
import { artistProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

const artistRouter = new Hono();

// GET /artists/:id
artistRouter.get('/:id', async (c) => {
  const artistId = c.req.param('id');

  const profile = await db
    .select()
    .from(artistProfiles)
    .where(eq(artistProfiles.id, artistId))
    .then((rows) => rows[0]);

  if (!profile || !profile.is_active) {
    return c.json({ error: 'Artist not found' }, 404);
  }

  // Fetch linked events (status = active)
  const events = await db.query.events.findMany({
    where: and(eq(events.created_by, artistId), eq(events.status, 'active')),
    orderBy: asc(events.date_start),
  });

  return c.json({
    ...profile,
    upcoming_events: events.filter((e) => new Date(e.date_start) > new Date()),
    past_events: events.filter((e) => new Date(e.date_start) <= new Date()),
  });
});

// PUT /artists/me
artistRouter.put('/me', async (c) => {
  const user = c.get('user');
  if (user.current_role !== 'artist') {
    return c.json({ error: 'Not in artist persona' }, 401);
  }

  const body = await c.req.json();

  const updated = await db
    .update(artistProfiles)
    .set({
      ...body,
      updated_at: new Date(),
    })
    .where(eq(artistProfiles.user_id, user.id))
    .returning()
    .then((rows) => rows[0]);

  return c.json(updated, 200);
});

export default artistRouter;
```

### React Native Component (Edit Profile)

```typescript
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Image, ScrollView, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';

export function EditArtistProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [genres, setGenres] = useState([]);
  const [location, setLocation] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/artists/me');
      setProfile(response.data);
      setDisplayName(response.data.display_name);
      setBio(response.data.bio);
      setGenres(response.data.genres);
      setLocation(response.data.location);
      setProfileImageUrl(response.data.profile_image_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await uploadProfileImage(uri);
    }
  };

  const uploadProfileImage = async (imageUri) => {
    try {
      // Get presigned URL
      const presignedResponse = await api.get('/upload/presigned?type=profile_image');
      const { upload_url, cdn_url } = presignedResponse.data;

      // Upload to S3
      const response = await fetch(imageUri);
      const blob = await response.blob();
      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      setProfileImageUrl(cdn_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/artists/me', {
        display_name: displayName,
        bio,
        genres,
        location,
        profile_image_url: profileImageUrl,
      });
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
      <Button title="Change Profile Picture" onPress={handleImagePicker} />

      <TextInput
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
      />
      <TextInput
        placeholder="Bio"
        value={bio}
        onChangeText={setBio}
        style={styles.input}
        multiline
      />
      <TextInput
        placeholder="Location"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      <Button title="Save Profile" onPress={handleSave} disabled={loading} />
    </ScrollView>
  );
}
```

### Common Gotchas

- **Inactive profile 404**: Returning 404 for is_active = false protects artist privacy when they switch away. Profile owner can still fetch via context (check auth token).
- **Social links flexibility**: Store social_links as JSONB to avoid schema updates when new platforms emerge. No validation of URL format in V1.
- **Event filtering**: Always filter upcoming events by date_start > NOW() in the API, not on the client (clock skew can cause bugs).
- **Profile image caching**: CloudFront CDN caches for 24h. Old images stay cached. Use querystring versioning in V2 if frequent updates needed.
- **Empty bio**: Bio is optional — render gracefully when null. Don't show "Bio: null" or placeholder text.
- **Concurrent edits**: Two simultaneous PUT /artists/me calls can race. Last-write-wins is acceptable for V1 scale.
