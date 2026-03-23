# M6-T4 · Posts (Promotional Content from Artists & Venues)

| Field | Value |
|-------|-------|
| **Milestone** | M6 — Profiles & Social |
| **Status** | 🔲 To Do |
| **Depends on** | M6-T1 (Artist profile), M6-T2 (Venue profile), M10-T1 (media upload for images/video) |
| **PRD Ref** | Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 5.1 (Feed — inline posts) |

---

## Description
Artists and Venues can publish short promotional posts (image, video, audio, or text) that appear inline in the Discover feed for their followers. This is a lightweight content publishing feature — not a full social network. All four media types are in scope for V1.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Post create endpoint, post feed inclusion logic |
| `apps/mobile` | Create Post screen, post rendering in Discover feed, post on profile page |
| `apps/api` (also) | Media URL storage — S3 for images, Mux for video |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/posts` | Create a post (Artist or Venue only) |
| GET | `/posts/:id` | Get single post |
| DELETE | `/posts/:id` | Delete own post |
| POST | `/posts/:id/comments` | Add a comment to a post |
| GET | `/posts/:id/comments` | List comments on a post |
| DELETE | `/posts/:id/comments/:commentId` | Delete own comment |

---

## Requirements
- R1: Artists and Venues can create posts with a caption and optional media (image, video, audio, or text-only)
- R2: `media_type` enum: `image | video | audio | text` — text-only posts require no media attachment
- R3: **Image**: JPG / PNG / WebP, max 10 MB → upload to S3 via pre-signed URL → store CloudFront CDN URL
- R4: **Video**: MP4 / MOV, max 500 MB, max 10 min → upload via Mux Direct Upload → store Mux HLS playback URL; Mux webhook updates `posts.media_url` when processing is complete
- R5: **Audio**: MP3 / AAC, max 50 MB, max 5 min → upload to S3 via pre-signed URL → store CloudFront CDN URL
- R6: **Text**: Caption only — no media attachment required; `media_url` is null
- R7: Posts appear inline in the Discover feed (M3-T4) for followers of the creator
- R8: Posts also appear on the creator's Artist/Venue profile page in a Posts section
- R9: Spectators can view posts but cannot create them
- R10: Post creator can delete their own post; deletion is soft (content marked deleted, not hard-removed)
- R11: Like count displayed on posts (tap to like — lightweight, no complex social graph needed in V1)
- R12: Any authenticated user can leave a text comment on a post — no character limit defined but intended to be short
- R13: Comment count displayed on the post card; comments listed below the post in chronological order (oldest first)
- R14: Comment author can delete their own comment; post creator can delete any comment on their post
- R15: No reactions to comments and no replies to comments in V1 — flat comment list only

---

## Acceptance Criteria
- [ ] Artist/Venue can create a text-only post (caption, no media)
- [ ] Artist/Venue can create a post with caption + image
- [ ] Artist/Venue can create a post with caption + video; video plays inline in feed (Mux HLS)
- [ ] Artist/Venue can create a post with caption + audio; audio player renders in feed and on profile
- [ ] All four post types display correctly in Discover feed for followers
- [ ] Post visible on creator's profile page under Posts section
- [ ] Spectator can view posts but sees no Create Post option
- [ ] Creator can delete their own post; it disappears from feed
- [ ] Like count shown; tapping like increments count
- [ ] Comment count shown on post card
- [ ] Any logged-in user can type and submit a comment
- [ ] Comments listed in chronological order below the post
- [ ] Comment author can delete their own comment
- [ ] Post creator can delete any comment on their post
- [ ] No reaction or reply UI visible on comments

---

## Technical Notes
- **Video upload flow**: mobile picks video → uploads to Mux via Mux Direct Uploads API → Mux webhook fires when processing complete → stores Mux HLS playback URL in `posts.media_url`
- **Image upload flow**: mobile picks image → uploads to S3 presigned URL → stores CloudFront URL in `posts.media_url`
- **Audio upload flow**: mobile picks audio file → uploads to S3 presigned URL → stores CloudFront URL in `posts.media_url`; use a custom audio player component in the feed (React Native does not have a built-in audio player — use `expo-av`)
- **Text-only post**: `posts.media_url = null`, `posts.media_type = 'text'` — just render the caption card in feed
- Keep posts short — no character limit defined in V1 but the PRD intends short promotional snippets, not long-form content
- Post moderation is NOT in V1 — posts go live immediately (unlike events which require admin approval)
- Comments table: `id`, `post_id` (FK), `user_id` (FK), `body` (text), `created_at` — no `parent_id` column needed since replies are not supported in V1
- Comment deletion: soft-delete (`deleted_at` timestamp) — display as "Comment deleted" placeholder to preserve thread continuity
- `posts.media_type` enum must be updated in DB schema (M1-T2) to: `image | video | audio | text`
