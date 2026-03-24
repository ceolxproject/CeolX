# Promo Banner Management

## Description

Management system for a single promotional banner displayed on the learner app homepage. Admin can change the banner image, set an optional CTA button with a link (to a specific course, an internal platform page, or an external URL). Only one banner can be active/posted at any given time.

## Affected Apps/Packages

- Frontend: `apps/web-admin` (Next.js), `apps/web` (customer site), `apps/learner-mobile` (React Native)
- Backend: `apps/hono-api` (Hono)
- Shared: `packages/shared` (types)

## API Endpoints

- `GET /api/admin/banner` — Get the current active banner (if any)
- `POST /api/admin/banner` — Create or replace the active banner
- `PATCH /api/admin/banner` — Update the current active banner (image, CTA, link)
- `DELETE /api/admin/banner` — Remove the active banner (no banner displayed)
- `GET /api/banner/active` — Public endpoint: get the active banner for display on learner apps

## Requirements

- Single banner management: only one banner can be active at any given time
- Create/edit banner form with:
  - Banner image upload (with preview)
  - Optional CTA button text (e.g., "Claim Offer", "Shop Now", "Learn More")
  - CTA link destination:
    - Link to a specific course (search/select from published courses)
    - Link to an internal platform page (no new page creation)
    - Link to an external URL
- Publishing: admin posts the banner, it immediately becomes active and replaces any existing banner
- Remove banner: admin can remove the active banner so nothing is displayed
- Banner preview: shows how banner will appear to users before posting
- All create/update/remove actions logged to audit trail

## Acceptance Criteria

- [ ] Admin can upload a banner image with preview
- [ ] Only one banner can be active at a time
- [ ] Posting a new banner replaces the existing one
- [ ] Optional CTA button with customizable text
- [ ] CTA can link to a specific course (search/select)
- [ ] CTA can link to an internal platform page
- [ ] CTA can link to an external URL
- [ ] Admin can remove the active banner (no banner shown)
- [ ] Banner preview shows exact layout as displayed to end users
- [ ] Banner displays on learner web app and mobile app homepage
- [ ] All create/update/remove actions logged to audit trail
- [ ] Mobile: banner is responsive and displays correctly

## Dependencies

- Database table: promo_banner (single-row table or upsert pattern)
- File storage service (R2) for banner images
- Web app and mobile app integration for banner display

## Technical Notes

- **Single Banner Model**: Use an upsert pattern — only one row in the promo_banner table at a time, or use a `is_active` flag with constraint
- **Banner Fields**: image_url, cta_text (nullable), cta_link (nullable), cta_link_type (course | internal | external), created_at, updated_at
- **Image Storage**: Upload to R2, store URL in promo_banner.image_url
- **Public Endpoint**: `GET /api/banner/active` returns the active banner (or 204 if none); cached with short TTL
- **Audit Log**: Log all create, update, remove actions
