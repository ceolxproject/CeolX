# M6-T4 · Posts & Promotional Content (All Media Types)

| Field          | Value                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Milestone**  | M6 — Profiles & Social                                                                                                               |
| **Status**     | 🔲 To Do                                                                                                                             |
| **Depends on** | M6-T1 (artist_profiles), M6-T2 (venue_profiles), M10-T1 (media upload — S3 presigned, Mux), M6-T3 (Follow System for feed inclusion) |
| **PRD Ref**    | Section 5.1 (End User Features), Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 9.3 (Data Model)               |

---

## Description

Posts enable Artists and Venues to publish lightweight promotional content to their followers. All four media types are fully in scope for V1: text-only posts, images (JPG/PNG/WebP), video (MP4/MOV via Mux HLS streaming), and audio (MP3/AAC). Posts go live immediately (no moderation) and appear inline in the Discover feed for followers of the creator. Posts are simple — no hashtags, reactions to comments, or comment replies in V1. Each post can include a caption (required or optional depending on media type) and optional media. Likes and comments enable light social engagement without complexity.

---

## Affected Apps / Packages

| App / Package       | Role                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`          | POST /api/v1/posts (create), GET /api/v1/posts/feed (paginated feed), DELETE /api/v1/posts/:id (soft delete), POST/DELETE /api/v1/posts/:id/like, POST/GET /api/v1/posts/:id/comments, media endpoints for S3 presigned URLs and Mux upload URLs |
| `apps/mobile`       | Create Post screen, post rendering in Discover feed, artist/venue profile posts section, like/comment UI, image picker, video upload to Mux, audio player (expo-av)                                                                              |
| `packages/shared`   | Post types, media type enum (image \| video \| audio \| text), comment types                                                                                                                                                                     |
| AWS S3 + CloudFront | Image and audio file storage and CDN delivery                                                                                                                                                                                                    |
| Mux                 | Video upload, transcoding, HLS playback, thumbnail generation                                                                                                                                                                                    |

---

## API Endpoints

### POST /api/v1/posts

Create a new post. Artist or Venue only. Media upload is a separate operation (presigned URL or Mux URL).

**Authentication:** Required, Artist or Venue persona only

**Request Body:**

```json
{
  "caption": "Come see us live at the Galway Arts Festival! 🎵",
  "media_type": "image",
  "media_url": "https://d123.cloudfront.net/posts/artist-uuid-post1.jpg",
  "thumbnail_url": null
}
```

All fields optional except caption (must be non-empty or media must be present). At least one of caption or media_url must be provided.

**Response (201 Created):**

```json
{
  "id": "post-uuid",
  "author_profile_id": "artist-profile-uuid",
  "author_profile_type": "artist",
  "author_name": "Síle Na Gealach",
  "author_image": "https://d123.cloudfront.net/profiles/...",
  "caption": "Come see us live at the Galway Arts Festival! 🎵",
  "media_type": "image",
  "media_url": "https://d123.cloudfront.net/posts/artist-uuid-post1.jpg",
  "thumbnail_url": null,
  "like_count": 0,
  "comment_count": 0,
  "created_at": "2026-03-23T15:30:00Z",
  "updated_at": "2026-03-23T15:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — No caption and no media, invalid media_type, caption exceeds length limit
- `401 Unauthorized` — Not authenticated or not in Artist/Venue persona
- `404 Not Found` — Artist/Venue profile not found
- `500 Internal Server Error` — Database error

---

### GET /api/v1/posts/feed

Paginated feed of posts from followed profiles and own posts. Chronological order (newest first). Includes feed ranking algorithm (deferred to M3-T4).

**Authentication:** Required

**Query Params:**

```
?page=0              (optional: default 0)
?limit=20            (optional: default 20, max 50)
```

**Response (200 OK):**

```json
{
  "posts": [
    {
      "id": "post-uuid-1",
      "author_profile_id": "artist-uuid-1",
      "author_profile_type": "artist",
      "author_name": "Síle Na Gealach",
      "author_image": "https://...",
      "caption": "Great session last night!",
      "media_type": "image",
      "media_url": "https://d123.cloudfront.net/posts/...",
      "thumbnail_url": null,
      "like_count": 42,
      "comment_count": 8,
      "liked_by_me": true,
      "created_at": "2026-03-22T20:00:00Z"
    }
  ],
  "page": 0,
  "total": 156
}
```

---

### GET /api/v1/artists/:id/posts

List all posts by a specific artist. Paginated.

**Query Params:**

```
?page=0    (optional: default 0)
?limit=20  (optional: default 20, max 50)
```

**Response (200 OK):**

```json
{
  "posts": [...],
  "page": 0,
  "total": 12
}
```

---

### GET /api/v1/venues/:id/posts

List all posts by a specific venue. Paginated.

**Query Params:**

```
?page=0    (optional: default 0)
?limit=20  (optional: default 20, max 50)
```

---

### DELETE /api/v1/posts/:id

Soft-delete a post. Only the post creator can delete.

**Authentication:** Required

**Response (204 No Content):**

```
(no body)
```

**Error Responses:**

- `401 Unauthorized` — Not authenticated or not the post creator
- `404 Not Found` — Post not found or already deleted
- `500 Internal Server Error` — Database error

---

### POST /api/v1/posts/:id/like

Like a post. Only authenticated users.

**Authentication:** Required

**Request Body:**

```json
{}
```

**Response (201 Created):**

```json
{
  "id": "like-uuid",
  "user_id": "user-uuid",
  "post_id": "post-uuid",
  "created_at": "2026-03-23T15:45:00Z"
}
```

**Error Responses:**

- `401 Unauthorized` — Not authenticated
- `404 Not Found` — Post not found
- `409 Conflict` — Already liked this post

---

### DELETE /api/v1/posts/:id/like

Unlike a post.

**Authentication:** Required

**Response (204 No Content):**

---

### POST /api/v1/posts/:id/comments

Add a comment to a post.

**Authentication:** Required

**Request Body:**

```json
{
  "text": "Amazing performance! 🎸"
}
```

**Response (201 Created):**

```json
{
  "id": "comment-uuid",
  "post_id": "post-uuid",
  "author_user_id": "user-uuid",
  "author_name": "John Doe",
  "author_image": "https://...",
  "text": "Amazing performance! 🎸",
  "created_at": "2026-03-23T15:50:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Empty comment text
- `401 Unauthorized` — Not authenticated
- `404 Not Found` — Post not found

---

### GET /api/v1/posts/:id/comments

List comments on a post. Chronological order (oldest first).

**Query Params:**

```
?page=0    (optional: default 0)
?limit=50  (optional: default 50, max 100)
```

**Response (200 OK):**

```json
{
  "comments": [
    {
      "id": "comment-uuid",
      "post_id": "post-uuid",
      "author_user_id": "user-uuid",
      "author_name": "John Doe",
      "author_image": "https://...",
      "text": "Amazing performance! 🎸",
      "created_at": "2026-03-23T15:50:00Z",
      "deleted": false
    }
  ],
  "total": 42
}
```

---

### DELETE /api/v1/posts/:id/comments/:commentId

Delete a comment. Only the comment author or post creator can delete.

**Authentication:** Required

**Response (204 No Content):**

**Error Responses:**

- `401 Unauthorized` — Not authorized to delete this comment
- `404 Not Found` — Comment not found

---

### GET /api/v1/upload/presigned?type=post_image

Request presigned S3 URL for post image upload.

**Query Params:**

```
type=post_image  (required)
```

**Response (200 OK):**

```json
{
  "upload_url": "https://ceolx-uploads.s3.amazonaws.com/posts/...",
  "cdn_url": "https://d123.cloudfront.net/posts/...",
  "expires_in_seconds": 900
}
```

---

### GET /api/v1/upload/mux-url

Request Mux Direct Upload URL for video upload.

**Query Params:**

```
None
```

**Response (200 OK):**

```json
{
  "upload_url": "https://upload.mux.com/v1/uploads",
  "upload_token": "mux-upload-token-uuid",
  "expires_in_seconds": 3600,
  "mux_input_id": "input-uuid"
}
```

---

## Requirements

### Post Creation

- R1: Only Artists and Venues can create posts (Spectators cannot)
- R2: Post must have a caption (text) OR media; both optional but at least one required
- R3: Caption max 500 characters (short promotional snippets, not long-form)
- R4: media_type enum: 'image' | 'video' | 'audio' | 'text'
- R5: media_type = 'text' has no media_url (caption only)
- R6: media_type = 'image' requires media_url (CloudFront CDN URL after S3 upload), thumbnail_url = null
- R7: media_type = 'video' requires media_url (Mux HLS playback URL) and thumbnail_url (Mux-generated thumbnail)
- R8: media_type = 'audio' requires media_url (CloudFront CDN URL after S3 upload), thumbnail_url = null
- R9: Posts go live immediately (no moderation queue)
- R10: Author profile info denormalized in posts table: author_name, author_image (for fast feed rendering)

### Image Upload

- R11: Image formats: JPG, PNG, WebP; max 10 MB
- R12: Presigned S3 upload URL valid for 15 minutes
- R13: Mobile uploads directly to S3 presigned URL (bypasses backend)
- R14: After upload, mobile calls POST /api/v1/posts with CloudFront CDN URL in media_url

### Video Upload

- R15: Video formats: MP4, MOV; max 500 MB, max 10 minutes
- R16: Mux Direct Upload URL used; expires in 60 minutes
- R17: Mux processes upload asynchronously; webhook notification fires when ready (playback URL available)
- R18: Mux webhook (POST /api/v1/webhooks/mux) updates posts.media_url with HLS playback URL
- R19: Mux generates thumbnail automatically; mobile stores in thumbnail_url
- R20: Video plays inline in feed via HLS streaming (react-native-video or expo-av)

### Audio Upload

- R21: Audio formats: MP3, AAC; max 50 MB, max 5 minutes
- R22: Presigned S3 upload URL valid for 15 minutes
- R23: Mobile uploads directly to S3 presigned URL
- R24: After upload, mobile calls POST /api/v1/posts with CloudFront CDN URL in media_url
- R25: Audio player rendered in feed using expo-av (native media player)

### Post Display

- R26: Posts appear in Discover feed for users following the creator
- R27: Posts appear on creator's Artist/Venue profile under Posts section
- R28: Post card shows: author image, author name, caption, media (if present), like count, comment count, created_at
- R29: Media renders appropriately: image (Image component), video (HLS player), audio (expo-av player), text (caption only)
- R30: Deleted posts (soft delete) display as "Post deleted" placeholder in feed (preserve thread continuity)

### Likes

- R31: Any authenticated user can like a post
- R32: Each user can like a post at most once (unique constraint on user_id + post_id)
- R33: Like count is denormalized on posts table and incremented/decremented on like/unlike
- R34: Like count displayed on post card
- R35: Tapping like toggles state and updates count immediately (optimistic UI)

### Comments

- R36: Any authenticated user can comment on a post
- R37: Comment text max 300 characters
- R38: Comments displayed below the post in chronological order (oldest first)
- R39: Comment count displayed on post card
- R40: Comment author can delete their own comment; post creator can delete any comment
- R41: Deleted comments (soft delete) display as "Comment deleted" placeholder to preserve thread continuity
- R42: No comment replies (no parent_id column) in V1; flat comment list only
- R43: No reactions to comments in V1

---

## Acceptance Criteria

### Post Creation

- [ ] Artist can create text-only post (caption, no media)
- [ ] Artist can create post with caption + image
- [ ] Artist can create post with caption + video (Mux upload)
- [ ] Artist can create post with caption + audio
- [ ] Venue can create posts with all four media types
- [ ] Spectator cannot see Create Post option or button
- [ ] Post created with empty caption + no media returns 400 error

### Image Upload

- [ ] GET /api/v1/upload/presigned?type=post_image returns valid presigned URL (15 min expiry)
- [ ] Mobile uploads image directly to S3 (not through backend)
- [ ] CloudFront CDN URL returned and stored in posts.media_url
- [ ] Image renders correctly in feed

### Video Upload

- [ ] GET /api/v1/upload/mux-url returns Mux Direct Upload URL (60 min expiry)
- [ ] Mobile uploads video directly to Mux
- [ ] Mux webhook confirms processing complete; posts.media_url updated with HLS URL
- [ ] Thumbnail generated and stored in posts.thumbnail_url
- [ ] Video plays inline in feed with HLS streaming

### Audio Upload

- [ ] Audio upload to S3 presigned URL works
- [ ] CloudFront URL stored in posts.media_url
- [ ] Audio player renders in feed using expo-av

### Feed Display

- [ ] Posts appear in Discover feed /api/v1/posts/feed (only from followed profiles + own)
- [ ] Posts appear on artist/venue profile under Posts section (/api/v1/artists/:id/posts)
- [ ] Post card shows all fields (author image, name, caption, media, like/comment counts)
- [ ] Images, videos, audio render correctly in feed

### Likes

- [ ] Like button on post card; tapping increments like_count
- [ ] Like icon/color toggles to indicate liked state
- [ ] Unlike (tapping again) decrements like_count
- [ ] Like count displayed on post card
- [ ] Attempting to like twice returns 409 Conflict

### Comments

- [ ] Comment count shown on post card
- [ ] Tapping comment count expands comment list below post
- [ ] Text input field visible for adding comment
- [ ] Submitting comment displays immediately with author name and timestamp
- [ ] Comments listed in chronological order (oldest first)
- [ ] Comment author can delete their own comment; comment disappears or shows "Comment deleted"
- [ ] Post creator can delete any comment on their post

### Deletion

- [ ] Creator can delete their own post; post disappears from feed or shows "Post deleted"
- [ ] Deleted post is soft-deleted (deleted_at timestamp set, post remains in DB)
- [ ] Other users cannot delete posts they don't own (401 error)

---

## Dependencies

- **Upstream**: M6-T1 (artist_profiles), M6-T2 (venue_profiles), M10-T1 (presigned S3 URLs, Mux integration), M6-T3 (Follow System for feed queries)
- **Downstream**: M3-T4 (Feed algorithm includes posts from followed accounts), M7-T1 (FCM notifications for new posts)
- **External services**: AWS S3 (image/audio storage), CloudFront (CDN), Mux (video upload/streaming), Firebase FCM (optional: notify on new posts from followed accounts in V2)

---

## Technical Notes

### Database Schema (posts table)

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_profile_id UUID NOT NULL,
  author_profile_type TEXT NOT NULL CHECK (author_profile_type IN ('artist', 'venue')),
  author_name TEXT NOT NULL,
  author_image TEXT,
  caption TEXT,
  media_url TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'text')),
  thumbnail_url TEXT,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP,

  CONSTRAINT caption_or_media CHECK (
    (caption IS NOT NULL AND caption != '') OR (media_url IS NOT NULL)
  )
);

CREATE INDEX idx_posts_author ON posts(author_profile_id, author_profile_type);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_deleted ON posts(deleted_at);
```

```sql
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  post_id UUID NOT NULL REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_like UNIQUE(user_id, post_id)
);

CREATE INDEX idx_post_likes_user ON post_likes(user_id);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
```

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_user_id);
```

### Hono Handler Example (Post Creation)

```typescript
import { Hono } from "hono";
import { db } from "../db";
import { posts, artistProfiles, venueProfiles } from "../db/schema";

const postsRouter = new Hono();

// POST /posts
postsRouter.post("/", async (c) => {
  const user = c.get("user");
  if (!["artist", "venue"].includes(user.current_role)) {
    return c.json({ error: "Only artists and venues can create posts" }, 401);
  }

  const { caption, media_type, media_url, thumbnail_url } = await c.req.json();

  // Validate caption or media
  if ((!caption || caption.trim() === "") && !media_url) {
    return c.json({ error: "Post must have caption or media" }, 400);
  }

  if (caption && caption.length > 500) {
    return c.json({ error: "Caption max 500 characters" }, 400);
  }

  if (!["image", "video", "audio", "text"].includes(media_type)) {
    return c.json({ error: "Invalid media_type" }, 400);
  }

  // Get author profile
  const profileTable =
    user.current_role === "artist" ? artistProfiles : venueProfiles;
  const profile = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.user_id, user.id))
    .then((rows) => rows[0]);

  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  // Create post
  const newPost = await db
    .insert(posts)
    .values({
      author_profile_id: profile.id,
      author_profile_type: user.current_role,
      author_name: profile.display_name || profile.name,
      author_image: profile.profile_image_url,
      caption,
      media_type,
      media_url,
      thumbnail_url,
    })
    .returning()
    .then((rows) => rows[0]);

  return c.json(newPost, 201);
});

// GET /posts/feed
postsRouter.get("/feed", async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "0");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = page * limit;

  // Get user's follows
  const userFollows = await db.query.follows.findMany({
    where: eq(follows.follower_user_id, user.id),
  });

  const followedProfileIds = userFollows.map((f) => f.following_profile_id);

  // Query posts from followed profiles + own
  const userProfile =
    (await db.query.artistProfiles.findFirst({
      where: eq(artistProfiles.user_id, user.id),
    })) ||
    (await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.user_id, user.id),
    }));

  const profileIds = [
    ...followedProfileIds,
    ...(userProfile ? [userProfile.id] : []),
  ];

  const feedPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        inArray(posts.author_profile_id, profileIds),
        isNull(posts.deleted_at),
      ),
    )
    .orderBy(desc(posts.created_at))
    .limit(limit)
    .offset(offset);

  return c.json({
    posts: feedPosts,
    page,
    total: feedPosts.length,
  });
});

// POST /posts/:id/like
postsRouter.post("/:id/like", async (c) => {
  const user = c.get("user");
  const postId = c.req.param("id");

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }

  // Check for duplicate like
  const existingLike = await db.query.postLikes.findFirst({
    where: and(eq(postLikes.user_id, user.id), eq(postLikes.post_id, postId)),
  });

  if (existingLike) {
    return c.json({ error: "Already liked" }, 409);
  }

  // Create like
  const like = await db
    .insert(postLikes)
    .values({ user_id: user.id, post_id: postId })
    .returning()
    .then((rows) => rows[0]);

  // Increment like_count
  await db
    .update(posts)
    .set({ like_count: db.raw(`like_count + 1`) })
    .where(eq(posts.id, postId));

  return c.json(like, 201);
});

// DELETE /posts/:id/like
postsRouter.delete("/:id/like", async (c) => {
  const user = c.get("user");
  const postId = c.req.param("id");

  const like = await db
    .delete(postLikes)
    .where(and(eq(postLikes.user_id, user.id), eq(postLikes.post_id, postId)))
    .returning()
    .then((rows) => rows[0]);

  if (!like) {
    return c.json({ error: "Like not found" }, 404);
  }

  // Decrement like_count
  await db
    .update(posts)
    .set({ like_count: db.raw(`MAX(0, like_count - 1)`) })
    .where(eq(posts.id, postId));

  return c.json({}, 204);
});

export default postsRouter;
```

### React Native Post Creation Component

```typescript
import React, { useState } from 'react';
import { View, Button, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';

export function CreatePostScreen() {
  const [caption, setCaption] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setMediaType('image');
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri) => {
    try {
      const presignedResponse = await api.get('/upload/presigned?type=post_image');
      const { upload_url, cdn_url } = presignedResponse.data;

      const response = await fetch(imageUri);
      const blob = await response.blob();
      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      setMediaUrl(cdn_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleCreatePost = async () => {
    if (!caption.trim() && !mediaUrl) {
      Alert.alert('Error', 'Add a caption or media');
      return;
    }

    setLoading(true);
    try {
      await api.post('/posts', {
        caption: caption.trim(),
        media_type: mediaType,
        media_url: mediaUrl,
      });
      Alert.alert('Success', 'Post published!');
      setCaption('');
      setMediaUrl('');
      setMediaType('text');
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="What's new? (max 500 chars)"
        value={caption}
        onChangeText={setCaption}
        multiline
        style={styles.captionInput}
        maxLength={500}
      />

      {mediaUrl && <Image source={{ uri: mediaUrl }} style={styles.preview} />}

      <Button title="Add Image" onPress={handleImagePicker} />
      <Button title="Post" onPress={handleCreatePost} disabled={loading} />

      {loading && <ActivityIndicator />}
    </View>
  );
}
```

### Common Gotchas

- **Caption or media validation**: Enforce at API level that at least one of caption or media is provided. Don't allow empty text-only posts.
- **Mux webhook handling**: Video playback URL is only available after Mux processing completes. During the wait, posts.media_url = null or a placeholder. Update posts table on webhook.
- **Soft delete**: Comment and post deletion should set deleted_at, not hard-delete. Display "Post deleted" or "Comment deleted" placeholder in feed.
- **Denormalized author info**: Store author_name and author_image at post creation time. If artist renames themselves later, old posts keep old name (intentional).
- **Like count denormalization**: Increment/decrement synchronously. If operation fails, roll back the count.
- **Comment author lookup**: Comment response should include author_name and author_image from users table, not denormalized.
- **Video thumbnail**: Mux generates thumbnail automatically; don't ask user to upload separate thumbnail.
- **Audio player library**: expo-av is the official React Native audio player. react-native-sound is deprecated.
