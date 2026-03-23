# FairPlay Admin Checklist

Manual/external steps required to complete the `drm-setup-fairplay` milestone task. These cannot be automated in code and require human action.

## 1. Apple FairPlay Deployment Package Application

- [ ] Ensure Apple Developer account is active (Enterprise or standard)
- [ ] Visit [Apple FairPlay Streaming portal](https://fps.developer.apple.com/)
- [ ] Submit Deployment Package application with:
  - Company information and legal entity details
  - Description of intended use (educational beauty mentorship platform)
  - Technical architecture overview
  - DRM security commitments
- [ ] Track application status (expect 2-4 week review)

## 2. Certificate Receipt & Storage

- [ ] Receive approval email from Apple
- [ ] Download FairPlay Streaming Certificate (`.der` file)
- [ ] Receive Private Key (encrypted, via Apple's secure channel)
- [ ] Decrypt Private Key using Apple-provided decryption tool
- [ ] Store certificates securely (never in source code)

## 3. Mux DRM Configuration

- [ ] Purchase/enable Mux DRM add-on with FairPlay support
- [ ] Upload FairPlay Streaming Certificate to Mux dashboard
- [ ] Upload Server Certificate to Mux dashboard
- [ ] Upload decrypted Private Key to Mux secure vault
- [ ] Configure iOS bundle ID in Mux: `com.mybeautymentors.app`
- [ ] Configure web domain allowlist in Mux:
  - Production learner domain
  - Staging learner domain

## 4. Testing Checklist

- [ ] **Safari (macOS):** Play DRM-protected video, verify license request in Network tab
- [ ] **iOS device:** Play DRM-protected video, verify playback starts
- [ ] **iOS screen recording:** Verify black screen during DRM playback
- [ ] **HD enforcement:** Verify 720p+ content requires FairPlay on iOS
- [ ] **Key rotation:** Verify playback continues seamlessly during key rotation
- [ ] **Token expiry:** Verify token refresh triggers re-acquisition of license

## 5. Certificate Renewal

- FairPlay certificates are valid for **1 year**
- [ ] Set calendar reminder to reapply **30 days before expiration**
- Mux supports certificate updates without downtime (old certs honored during transition)

## Code Status

The following acceptance criteria are already implemented in code:

| #   | Criterion                       | Status                                               |
| --- | ------------------------------- | ---------------------------------------------------- |
| 5   | License server URL in players   | Done (lesson-player.tsx, mux-player-wrapper.tsx)     |
| 11  | Bundle ID configured            | Done (app.json: `com.mybeautymentors.app`)           |
| 13  | Signed token in license request | Done (drmLicense token generation)                   |
| 16  | License expiration handling     | Done (token refresh via onTokenExpired)              |
| 18  | DRM error messages              | Done (isDrmError detection + user-friendly messages) |
