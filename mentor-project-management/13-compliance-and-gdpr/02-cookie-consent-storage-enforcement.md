# Cookie Consent Storage & Enforcement

## Description

Implement server-side consent storage with httpOnly cookie mirroring and enforce consent state via middleware before loading analytics and marketing scripts. The system must dynamically inject third-party scripts (Google Tag Manager and other analytics providers) only after explicit user consent is verified.

Consent state is stored redundantly:

1. **Database** - authoritative source for audit trail
2. **HttpOnly Cookie** - checked by middleware on every request
3. **Client-side State** - for immediate UX feedback

Middleware intercepts requests and blocks analytics/marketing scripts from loading until consent is verified.

## Affected Apps/Packages

- **Web App** (Next.js)
- **API Server** - middleware implementation
- **Shared Utils** - consent checking utilities
- **Analytics** - conditional analytics provider initialization

## API Endpoints

- `GET /api/consent/status` - Check user's current consent state
- `POST /api/consent/preferences` - Update consent preferences
- `GET /api/consent/verify` - Verify consent for middleware
- `DELETE /api/consent/revoke` - Revoke all non-essential consent

## Requirements

- **Server-Side Storage**:
  - Persist consent state in consent_preferences table
  - Include timestamp, policy version, IP address, user agent
  - Support anonymous consent via cookie_id
  - Store consent actions with immutable audit trail

- **HttpOnly Cookie Mirroring**:
  - Set httpOnly, secure, sameSite=Strict cookies
  - Cookie contains encrypted consent state (necessary, analytics, marketing)
  - Cookie name: `__mentor_consent_state`
  - Max age: 365 days (1 year)
  - Cookie value format: `{necessary:true,analytics:false,marketing:false,v:2025-02-18}`
  - Refresh cookie on every preference update
  - Separate cookie for anonymous users: `__mentor_consent_anon`

- **Middleware Consent Checking**:
  - Check httpOnly cookie on every server-side request
  - For authenticated users, also verify against database (cache with 5-min TTL)
  - Block analytics/marketing script injection if consent not present
  - Allow necessary cookies regardless (security, session)
  - Create req.consent object available to handlers
    ```javascript
    req.consent = {
      necessary: true,
      analytics: false,
      marketing: false,
      policyVersion: "2025-02-18",
      timestamp: 1708252800000,
      isConsented: true,
      isRejected: false,
    };
    ```

- **Dynamic Script Loading**:
  - Analytics providers: Only initialize if analytics consent enabled
  - GTM (Google Tag Manager): Only initialize if marketing consent enabled
  - No fallback tracking if consent not present
  - Delay script injection until DOM ready if needed
  - Clear consent state from tracking libraries when revoked

- **Consent State API** (`/api/consent/status`):

  ```json
  {
    "necessary": true,
    "analytics": false,
    "marketing": false,
    "policyVersion": "2025-02-18",
    "timestamp": 1708252800000,
    "source": "web",
    "ipAddress": "203.0.113.0",
    "isAuthenticated": true,
    "userId": "user_123"
  }
  ```

- **Enforcement Points**:
  1. **Next.js API Routes** - Check req.consent before analytics logging
  2. **Server Components** - Conditional analytics script injection
  3. **Client Components** - Conditional analytics provider initialization
  4. **Tracking Events** - Prevent event sending if consent not present
  5. **GTM** - Prevent tag firing without consent

- **No-Consent Behavior**:
  - Essential functions work normally
  - No analytics events tracked
  - No GTM tags fired
  - No cookies set for marketing/analytics
  - User can still use all features
  - Clear indication in browser console (dev mode only)

- **Re-Consent Handling**:
  - On policy version change, mark existing consent as invalid
  - Redirect authenticated users to consent screen on next request
  - Set short-lived cookie (1 hour) to track re-consent requirement
  - Show banner again for existing users
  - Preserve original consent timestamp for compliance records

## Acceptance Criteria

- [ ] consent_preferences table stores all preference changes
- [ ] httpOnly cookie set correctly with secure & sameSite flags
- [ ] Middleware checks httpOnly cookie before loading analytics/marketing scripts
- [ ] req.consent object available in all API routes with correct values
- [ ] Analytics providers initialized only if analytics consent is true
- [ ] GTM initialized only if marketing consent is true
- [ ] Consent status API returns accurate current state
- [ ] Anonymous users get separate cookie for consent tracking
- [ ] Cookie refreshed on every preference update
- [ ] Database cache invalidation works correctly (5-min TTL)
- [ ] Previous consent not blocking new policy version notice
- [ ] Re-consent required when policy version changes
- [ ] No analytics/marketing scripts loaded without consent
- [ ] Necessary cookies work regardless of opt-in status
- [ ] /api/consent/verify returns correct state for middleware
- [ ] Revoke endpoint clears all non-essential tracking
- [ ] Server-side rendered pages check consent before script injection
- [ ] Error handling for missing/invalid consent state
- [ ] Audit log entries created for all consent state changes
- [ ] IP address included in all consent records
- [ ] User agent stored for device/browser tracking

## Dependencies

- **Cookie Consent Banner** - initial consent capture
- **Consent Logging System** - immutable audit trail
- **IP Anonymization Cron** - anonymize IPs after 90 days
- Next.js middleware configuration
- Analytics SDK(s) (conditional initialization)
- Google Tag Manager SDK (conditional initialization)

## Technical Notes

- Use Next.js middleware (middleware.ts) for pre-request enforcement
- Cache consent state in-memory with Redis for performance (optional)
- Implement circuit breaker if database unavailable (allow consent assume granted for security)
- Use crypto.subtle for cookie encryption (AES-256)
- Set Content-Security-Policy headers to block unapproved scripts
- Monitor consent state changes for unusual patterns
- Implement webhook to update consent state in real-time for admins
- Log all middleware permission checks (verbose mode)
- Create metrics dashboard for consent opt-in rates by category
- Test with browser developer tools to verify httpOnly flag
- Use same-site cookie attribute to prevent CSRF
- Implement consent expiration reminder (every 365 days)
- For API-only clients (mobile), check Authorization header instead of cookies
- Consider using Vercel KV for distributed cache
- Document cookie names and values for security team review
