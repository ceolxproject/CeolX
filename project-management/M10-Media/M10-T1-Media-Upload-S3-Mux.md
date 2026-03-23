# M10-T1 · Media Upload Pipeline (AWS S3 + Mux)

| Field | Value |
|-------|-------|
| **Milestone** | M10 — Media |
| **Status** | 🔲 To Do |
| **Depends on** | M4-T1 (event cover images), M6-T1/T2 (profile images), M6-T4 (posts with media) |
| **PRD Ref** | Section 10.1 (Tech Stack — AWS S3 + CloudFront, Mux), Section 10.2 (Infrastructure) |

---

## Description
Centralise and harden the media upload pipeline for images (AWS S3 + CloudFront CDN) and videos (Mux). Images are used for event covers, profile photos, and collection logos. Videos are used in promotional posts. This task consolidates the upload logic that was stubbed across earlier milestones into a reliable, reusable service.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | S3 presigned URL generation endpoint, Mux upload URL endpoint |
| `apps/mobile` | Image picker, video picker, upload progress UI, S3/Mux upload logic |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/media/presigned-url` | Generate S3 presigned URL for image upload |
| POST | `/media/mux-upload-url` | Create Mux Direct Upload URL for video upload |

---

## Requirements
- R1: Image upload flow — mobile picks image → `POST /media/presigned-url` → API returns presigned S3 URL + CloudFront CDN URL → mobile uploads directly to S3 → stores CloudFront URL in the relevant DB field
- R2: Video upload flow — mobile picks video → `POST /media/mux-upload-url` → API creates Mux Direct Upload → returns Mux upload URL → mobile uploads directly to Mux → stores Mux playback URL in the relevant DB field
- R3: Accepted image formats: JPEG, PNG, WebP — max 10 MB
- R4: Accepted video formats: MP4, MOV — max 500 MB; Mux handles transcoding to HLS automatically
- R5: CloudFront CDN serves all images — raw S3 URLs are never stored or returned to clients
- R6: Upload progress shown in UI (percentage or activity indicator)
- R7: Failed uploads show a retry option
- R8: S3 bucket configured for: private access (no public read), CloudFront as the only public-facing distribution

---

## Acceptance Criteria
- [ ] Image upload via presigned URL works for event cover, profile image, and collection logo
- [ ] Uploaded images served via CloudFront CDN URL
- [ ] Video upload via Mux Direct Upload works; Mux playback URL stored correctly
- [ ] Upload progress indicator shown during upload
- [ ] Files exceeding size limits are rejected with a clear error message
- [ ] Unsupported file types are rejected
- [ ] S3 bucket has no public read access — only CloudFront can serve files
- [ ] Retry works after a failed upload

---

## Technical Notes
- S3 presigned URL expires after 5 minutes — sufficient for a mobile upload; generate fresh on each request
- Mux Direct Upload URL also has a short TTL — create fresh on each request
- Mux webhook (`video.asset.ready`) fires when transcoding is complete — not needed to block V1 upload UX, but store the Mux asset ID for future use
- CloudFront distribution must have the S3 origin configured with OAC (Origin Access Control) — not the older OAI method
- AWS S3 bucket and CloudFront distribution should be in the `eu-west-1` region (Ireland) to minimise latency for Irish users
