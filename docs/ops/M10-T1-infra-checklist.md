# M10-T1 — Infrastructure Checklist

This document covers the **manual / one-time** steps M10-T1 cannot perform from code: AWS console clicks, Mux dashboard configuration, and env-var population. Run through this once per environment (staging, prod) before the upload pipeline can serve real users.

---

## 1. AWS S3 bucket

Create one bucket per environment (e.g. `ceolx-media-staging`, `ceolx-media-prod`) in `eu-west-1`.

- **Block all public access** — yes, every checkbox. CloudFront serves objects via OAC; raw S3 URLs are never exposed.
- **Server-side encryption** — SSE-S3 (AES256). KMS not required in V1.
- **Versioning** — disabled.
- **Lifecycle policy:**
  - Rule name: `expire-orphans`
  - Scope: whole bucket
  - Action: expire current versions after **90 days**
  - Rationale: catches uploads where the client crashed before persisting the CDN URL. Real media is referenced by DB rows, which mobile clients clean up via presigned DELETE on row deletion / replacement.
- **CORS policy** (under Permissions → CORS configuration):
  ```json
  [
    {
      "AllowedMethods": ["PUT", "DELETE"],
      "AllowedOrigins": ["*"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
  Mobile clients PUT and DELETE directly via presigned URLs.

## 2. AWS CloudFront distribution

- Origin: the S3 bucket from step 1, accessed via **Origin Access Control (OAC)** — _not_ the older Origin Access Identity (OAI).
- Origin policy: attach the auto-generated OAC bucket policy back to the bucket so CloudFront can read it.
- Allowed methods: GET, HEAD only.
- Cache policy:
  - TTL: `max-age=2592000` (30 days)
  - Compression: gzip + brotli enabled
- Viewer protocol policy: redirect HTTP → HTTPS.
- Alternate domain (CNAME): `cdn.ceolx.com` (with an ACM cert in `us-east-1` covering it).
- Geo-restriction: none.

After creating: hit `https://cdn.ceolx.com/healthcheck.txt` (after uploading a placeholder via `aws s3 cp`) and confirm 200.

## 3. AWS IAM credentials for the api server

The Hono server only needs `s3:PutObject` and `s3:DeleteObject` permission so it can mint presigned URLs. Use a dedicated IAM user (not your personal credentials) with this minimal policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::ceolx-media-prod/*"
    }
  ]
}
```

Note: presigned URL minting itself does not require `s3:GetObject` or list permissions — only the action being signed. Keep credentials lean.

## 4. Mux account

1. Sign up at https://mux.com → Dashboard → Settings → Access Tokens.
2. Create a new access token with the `Mux Video` permissions (read + write). Copy `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`.
3. Settings → Webhooks → Create webhook:
   - URL: `https://<api-server>/api/webhooks/mux` (e.g. `https://api.ceolx.com/api/webhooks/mux`)
   - Events: select at minimum `video.asset.ready` and `video.asset.errored`. The handler safely ignores other events but Mux only fires what you subscribe to.
   - Copy the webhook signing secret → `MUX_WEBHOOK_SECRET`.

## 5. Environment variables

Set the following on your api host (Vercel / EC2 / wherever apps/server runs):

| Variable                | Value                                |
| ----------------------- | ------------------------------------ |
| `AWS_REGION`            | `eu-west-1`                          |
| `AWS_ACCESS_KEY_ID`     | from step 3                          |
| `AWS_SECRET_ACCESS_KEY` | from step 3                          |
| `S3_BUCKET_NAME`        | `ceolx-media-prod` (or matching env) |
| `CLOUDFRONT_DOMAIN`     | `cdn.ceolx.com`                      |
| `MUX_TOKEN_ID`          | from step 4                          |
| `MUX_TOKEN_SECRET`      | from step 4                          |
| `MUX_WEBHOOK_SECRET`    | from step 4                          |

And on the mobile client (apps/native/.env):

| Variable                        | Value           |
| ------------------------------- | --------------- |
| `EXPO_PUBLIC_CLOUDFRONT_DOMAIN` | `cdn.ceolx.com` |

The CloudFront domain on the client is needed so use-media-delete can derive S3 keys from stored URLs.

## 6. Smoke tests after deploy

1. **Image upload**: pick a profile image during artist onboarding → confirm the row in `artist_profiles` has `profile_image_url` pointing at `cdn.ceolx.com/profiles/<userId>/...` and the URL renders in the app.
2. **S3 deletion**: delete a post that has an image → confirm the S3 object is gone (`aws s3 ls s3://ceolx-media-prod/posts/<userId>/`).
3. **Video upload**: create a post with a short MP4 → confirm the post shows "Processing…" briefly, then "Ready" once Mux fires the webhook (typically 30s–2min).
4. **Mux webhook**: tail the api server logs while uploading. You should see no warnings from `[Mux] webhook verification failed` — only the 200 ack on the webhook POST.
5. **Mux delete**: delete the video post → confirm the asset is removed from Mux dashboard.
6. **Bucket privacy**: `curl https://ceolx-media-prod.s3.eu-west-1.amazonaws.com/<any-key>` should return 403. Only `https://cdn.ceolx.com/<key>` should return 200.

## 7. Failure modes worth knowing

- **CloudFront serving stale images** — this is normal when the same key is overwritten. Object keys include a UUID per upload, so this only matters if you ever re-use a key, which the presigner avoids by design.
- **Mux webhook delays** — transcoding sometimes spikes to 5+ minutes during Mux capacity events. The mobile client polls `uploads.getMuxUploadStatus` directly so the UI doesn't depend on the webhook firing. Still, monitor `mux_status='pending'` rows older than 10 minutes — that signals a stuck webhook.
- **Lifecycle expiring fresh uploads** — if a client takes longer than 90 days between picking and saving an image (impossible in practice), the S3 lifecycle would delete it. Not worth fixing.
