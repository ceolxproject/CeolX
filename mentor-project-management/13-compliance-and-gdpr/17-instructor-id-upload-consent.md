# Explicit Consent for Instructor ID Upload

## Description

Implement a dedicated consent screen and flow before instructors upload their identity documents (Photo ID/Passport) during the application process. This is a GDPR compliance requirement — before collecting sensitive identity data, the platform must clearly explain why it's being collected, how long it will be retained, who has access, and obtain explicit consent with a recorded audit trail. The consent screen must appear before the ID upload step in the instructor application form (Milestone 04: `13-instructor-application-form.md`).

## PRD Reference

- Section 5.3.7 — Compliance & Privacy Features (Instructor GDPR): "Before ID upload step: explicit consent screen explaining purpose (identity verification for platform trust & legal compliance); Explanation of how long ID will be retained and who has access; Consent checkbox required before upload proceeds; Consent record stored with timestamp, version, and IP; ID stored in private R2 bucket with signed URL access only (no public access)"
- Section 11.3 — Data Classification: Identity documents classified as "Restricted" — "Never exposed in logs/URLs, private R2 bucket, signed URLs only, server-side only, retention-limited"

## Affected Apps/Packages

- `apps/web-mentor` (Next.js) — Consent screen UI in application flow
- `apps/api` (Hono) — Consent recording endpoint
- `packages/db` — Consent records table (Drizzle schema)
- `packages/validators` — Consent payload validation
- `packages/i18n` — Consent screen translations (EN, ES, FR, RU)

## API Endpoints

- `POST /api/consent/id-verification` — Record ID upload consent
  - Request: `{ "consentType": "id_verification", "policyVersion": "id-consent-v1.0", "accepted": true }`
  - Response: `{ "consentId": "uuid", "timestamp": "...", "canProceed": true }`
- `GET /api/consent/id-verification/status` — Check if user has given consent (to gate upload step)
  - Response: `{ "consented": true, "consentId": "uuid", "version": "id-consent-v1.0" }`

## Requirements

### 1. Consent Screen (Pre-Upload)

- Displayed as a dedicated step/screen in the instructor application wizard, immediately before the ID upload step
- Cannot be skipped — must interact with consent before proceeding
- Screen content:
  - **Heading**: "Identity Verification — Data Collection Notice"
  - **Purpose explanation**: "To maintain platform trust and comply with legal requirements, we verify the identity of all instructors. Your government-issued ID will be used solely for identity verification purposes."
  - **What we collect**:
    - "A photo of your government-issued ID (passport, national ID card, or driver's license)"
  - **How it's stored**:
    - "Your ID is stored in a private, encrypted storage bucket"
    - "Access is restricted to authorized Super Admin personnel only"
    - "Your ID is never publicly accessible or shared with third parties"
  - **Retention period**:
    - "Your ID will be retained for the duration of your active instructor account"
    - "Upon account deletion, your ID will be permanently deleted within 30 days"
    - "If your application is rejected, your ID will be deleted within 30 days of rejection"
  - **Your rights**:
    - "You can request deletion of your ID at any time via account settings"
    - "You can request a copy of your stored data (GDPR Art. 15)"
  - Link to full privacy policy (opens in new tab)

### 2. Consent Checkbox

- Unchecked by default (GDPR requires explicit opt-in, never pre-checked)
- Checkbox label: "I understand and consent to the collection and storage of my identity document for verification purposes as described above."
- "Continue to Upload" button disabled until checkbox is checked
- If user unchecks after checking: button disables again

### 3. Consent Recording

- On checkbox acceptance + "Continue" click:
  - API call to record consent
  - Consent record stored with:
    - `user_id`: Instructor's user ID
    - `consent_type`: `id_verification`
    - `action`: `granted`
    - `policy_version`: Version string (e.g., `id-consent-v1.0`)
    - `timestamp`: ISO 8601 timestamp
    - `ip_address`: User's IP (anonymized after 90 days per Milestone 13: `16-ip-anonymization-cron.md`)
    - `device_metadata`: User agent, browser, OS
    - `source`: `web_mentor`
  - Consent record is immutable (append-only, never updated or deleted)
- Only after successful consent recording does the UI proceed to the upload step

### 4. Re-Consent on Policy Change

- If the ID verification consent policy version changes:
  - Instructors who previously consented are prompted to re-consent on next login
  - Previous consent record remains (historical audit trail)
  - New consent record created with updated `policy_version`
  - If instructor does not re-consent, ID upload access is paused until they do

### 5. ID Storage Security

- ID documents uploaded to private R2 bucket (not the public content bucket)
- Access only via signed URLs with 15-minute expiry
- Signed URLs generated server-side only — never exposed to client
- Only Super Admin can view uploaded IDs (via admin dashboard with audit logging)
- No ID data in application logs, error reports, or analytics
- Bucket name and structure:
  - `mentor-id-documents/{userId}/{filename}` (private bucket)

### 6. Consent Withdrawal

- From instructor account settings, provide option: "Withdraw ID verification consent"
- Warning: "Withdrawing consent will trigger deletion of your stored ID and may affect your instructor status"
- On withdrawal:
  - New consent record: `action: revoked`
  - ID document queued for deletion (QStash background job)
  - Admin notified of consent withdrawal
  - Instructor status may be suspended pending re-verification

## Acceptance Criteria

- [ ] Consent screen displayed before ID upload step in application wizard
- [ ] Screen clearly explains purpose, storage, retention, and rights
- [ ] Link to full privacy policy opens in new tab
- [ ] Consent checkbox unchecked by default (not pre-checked)
- [ ] "Continue" button disabled until checkbox is checked
- [ ] Consent recorded via API with all required fields (user_id, type, version, timestamp, IP, device)
- [ ] Consent record stored in `consent_records` table (immutable, append-only)
- [ ] UI only proceeds to upload step after successful consent recording
- [ ] If API fails, error shown and user cannot proceed
- [ ] Re-consent triggered when policy version changes
- [ ] ID stored in private R2 bucket with signed URL access only
- [ ] Signed URLs expire after 15 minutes
- [ ] No ID data appears in logs or error reports
- [ ] Consent withdrawal option available in instructor settings
- [ ] Consent withdrawal creates `revoked` record and triggers ID deletion
- [ ] All consent screen text uses i18n translation keys (EN, ES, FR, RU)
- [ ] Screen is responsive and accessible (WCAG 2.1 AA)
- [ ] Keyboard navigable: Tab to checkbox, Enter/Space to toggle, Tab to button

## Dependencies

- Milestone 04: `13-instructor-application-form.md` (integrates into application wizard)
- Milestone 02: `14-consent-records-table.md` (consent record database schema)
- Milestone 13: `07-consent-logging-system.md` (shared consent recording infrastructure)
- Milestone 13: `16-ip-anonymization-cron.md` (IP address anonymization)
- Milestone 04: `15-privacy-terms-acceptance.md` (shared consent UI patterns)
- Cloudflare R2 private bucket for ID storage

## Technical Notes

- This task enhances the existing instructor application form — it does not replace it
- The consent screen should be a distinct wizard step (e.g., Step 3 of 5) with clear progress indicator
- Use the shared consent logging infrastructure from Milestone 13 to avoid duplication
- Policy version should be configurable via environment variable or admin settings
- Consider using a content management approach for consent text so legal team can update without code changes
- IP address capture: use `X-Forwarded-For` header (Vercel proxy) — same approach as Milestone 01: `08-api-rate-limiting.md`
- Test with ad blockers: ensure consent recording works even if analytics scripts are blocked
