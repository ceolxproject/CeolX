# Task 9: CORS Middleware Configuration

## Description

Configure and implement Cross-Origin Resource Sharing (CORS) middleware for the Hono API backend. This task establishes secure cross-origin communication with whitelisted web and mobile applications while enforcing environment-specific security policies. CORS configuration must support cookie-based authentication via BetterAuth sessions while preventing unauthorized access from unregistered origins.

## Affected Apps/Packages

- **Hono** (web framework - main API backend)
- **BetterAuth** (authentication library - session/credential support)
- **Cloudflare Workers** (deployment platform - may have platform-specific CORS handling)
- **Web Apps**: web-learner, web-mentor, web-admin
- **Mobile App**: Mentor Mobile (iOS/Android)

## API Endpoints

All API endpoints under `/api/*` will be protected by this CORS middleware. Examples:

- `/api/v1/courses`
- `/api/v1/videos/:assetId/playback-token`
- `/api/v1/auth/*`
- `/api/admin/*`
- `/api/v1/resources/:resourceId/download`

## Requirements

### Core CORS Configuration

- **Whitelist Management**: Maintain separate origin whitelists for development and production environments
  - Development: Allow `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3002`, `http://localhost:5173`, and all production web/mobile origins
  - Production: Allow only `https://learner.example.com`, `https://mentor.example.com`, `https://admin.example.com`, and mobile app origin
  - Origins stored as environment variables (`CORS_ALLOWED_ORIGINS`) with pipe-separated values: `origin1|origin2|origin3`

### HTTP Methods

- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- OPTIONS should return 200 status for preflight requests
- All methods require credentials support for session cookies

### HTTP Headers

- **Allowed Request Headers**:
  - Content-Type
  - Authorization
  - X-Requested-With
  - Accept
  - X-CSRF-Token
  - X-API-Key (for API authentication fallback)

- **Exposed Response Headers**:
  - X-RateLimit-Limit (current rate limit ceiling)
  - X-RateLimit-Remaining (remaining requests in window)
  - X-RateLimit-Reset (Unix timestamp of rate limit reset)
  - Content-Disposition (for file downloads)
  - Content-Type

### Credentials & Sessions

- **Credentials**: Set `credentials: 'include'` on CORS response headers to support cookie-based BetterAuth sessions
- **Cookie Access**: Allow HttpOnly, Secure, and SameSite cookies from trusted origins
- **BetterAuth Integration**: Ensure CORS allows BetterAuth session validation without triggering preflight failures

### Preflight Caching

- **Max-Age**: 86400 seconds (24 hours)
- Reduces unnecessary OPTIONS preflight requests for complex requests
- Must be verified in browser DevTools Network tab

### Environment-Specific Behavior

- **Development**:
  - Loose whitelist including localhost on multiple ports
  - Allow credentials: true
  - Allow all required headers without strict validation

- **Production**:
  - Strict origin matching (exact domain required)
  - credentials: true (required for sessions)
  - Additional security headers enforcement
  - Logging of rejected CORS requests

### Error Handling

- Requests from non-whitelisted origins must receive 403 Forbidden response
- Log rejected CORS requests for security monitoring
- Return descriptive error messages (development) vs. generic errors (production)
- Do NOT expose internal error details to unauthorized origins

### Mobile App Support

- Define a specific mobile app origin identifier (can be a custom scheme or domain)
- Support Android and iOS with different origin identifiers if necessary
- Document the expected User-Agent or custom header for mobile app identification

## Acceptance Criteria

- [x] CORS middleware is implemented as a Hono middleware function in `/src/middleware/cors.ts` — two-layer: `originGuard` + `corsHandler` (`cors.ts:31-82`, `app.ts:36-37`)
- [x] Environment variables `CORS_ALLOWED_ORIGINS`, `NODE_ENV` are configured in `.env.example` and verified in `.env.local` — (`server.ts:13,50`, `.env.example:86,117`, `turbo.json:44,51`)
- [x] All three web app origins (learner, mentor, admin) are correctly whitelisted in production — (`cors.ts:15-17`)
- [x] Mobile app origin is whitelisted in both development and production — via `CORS_ALLOWED_ORIGINS` pipe-separated env var (`cors.ts:19-26`)
- [ ] Development environment allows localhost on ports 3000, 3001, 3002, 5173 — localhost origins come from `*_WEB_URL` env vars, not auto-added; port 5173 not covered
- [x] Preflight OPTIONS requests return 204 status (Hono standard) — (`cors.test.ts:172`)
- [x] Credentials: true allows BetterAuth session cookies to pass between origins — (`cors.ts:78`, `cors.test.ts:237`)
- [x] Non-whitelisted origins receive 403 Forbidden — (`cors.ts:46-54`, `cors.test.ts:120-127`); audit logging via `console.warn`
- [x] Rate limit headers (X-RateLimit-\*) are correctly exposed on all responses — (`cors.ts:70-76`, `cors.test.ts:247-252`)
- [x] Max-Age is set to 86400 seconds — (`cors.ts:77`, `cors.test.ts:226`)
- [x] OPTIONS preflight caching test passes — Max-Age header verified in tests (`cors.test.ts:216-227`)
- [ ] BetterAuth session validation succeeds with CORS-enabled requests — no end-to-end test with full auth stack
- [x] Unit tests verify whitelisting logic for development and production — (`cors.test.ts:40-100`, `cors.test.ts:279-303`)
- [ ] Integration test: web-learner can fetch `/api/v1/courses` with valid session cookie — no such test exists
- [x] Integration test: unauthorized origin receives 403 Forbidden — tested against mock app (`cors.test.ts:120-127`)
- [ ] Postman collection includes CORS test scenarios (preflight, credentials, headers) — no Postman collection in repo
- [x] Security audit confirms no sensitive headers are exposed unintentionally — explicit allow-list test (`cors.test.ts:254-276`)
- [ ] Documentation updated in API docs with CORS configuration details — CORS mentioned in README and CLAUDE.md but no consumer-facing API docs

## Dependencies

### Must Complete Before

- **Task 1: Repository Setup** — Git repo structure, package.json, basic npm configuration
- **Task 2: Environment Setup** — Development and production environment variable setup
- **Task 3: Hono App Scaffolding** — Basic Hono app initialized with middleware pipeline
- **Task 7: BetterAuth Integration** — BetterAuth session provider configured and working

### May Be Blocked By

- None (can be implemented in parallel with other infrastructure tasks)

### Blocking Tasks

- All subsequent API development tasks depend on stable CORS configuration
- Task 10: Rate Limiting Middleware (depends on CORS being in place first)
- Task 11: API Authentication Middleware (works alongside CORS)

## Technical Notes

### Implementation Details

- Use Hono's built-in CORS middleware or implement custom middleware in middleware pipeline
- CORS middleware should execute early in the request lifecycle (before authentication, rate limiting)
- Store allowed origins as a Set or Map for O(1) lookup performance
- Origin validation must be case-sensitive; normalize to lowercase before comparison
- Preflight OPTIONS requests must NOT be rate-limited to prevent legitimate browser requests from being blocked

### BetterAuth Compatibility

- BetterAuth sessions rely on cookies sent with `credentials: 'include'`
- Ensure `Access-Control-Allow-Credentials: true` is set when credentials are used
- When credentials are allowed, `Access-Control-Allow-Origin` must be a specific origin, NOT wildcard (\*)
- BetterAuth may include additional headers; validate these are not blocked

### Mobile App Considerations

- If mobile app does not use standard HTTP origins, define a custom origin scheme (e.g., `app://mentor`)
- Document how mobile app identifies itself (User-Agent header, custom X-App-Id header)
- Test mobile CORS behavior on both iOS (WKWebView) and Android (WebView)

### Security Best Practices

- Never use `Access-Control-Allow-Origin: *` in production
- Review CORS logs weekly for suspicious patterns (e.g., repeated failed preflight requests)
- Update whitelist immediately if new web app domains are deployed
- Document the justification for each whitelisted origin in comments
- Ensure SameSite cookie attribute is set to `Strict` or `Lax` to prevent CSRF attacks

### Testing Strategy

- Unit tests: Verify origin validation logic for various inputs (valid origins, localhost, wildcards, etc.)
- Integration tests: Verify actual HTTP requests with credentials succeed from whitelisted origins
- Security tests: Verify non-whitelisted origins are rejected, error messages don't leak info
- Performance tests: Preflight requests complete within acceptable latency (<100ms)
- Manual testing: Use browser DevTools Network tab to inspect CORS headers and preflight caching

### Debugging Tips

- Browser console will show CORS errors; check Network tab for response headers
- Use curl with `-H "Origin: <origin>"` to manually test CORS headers
- Enable CORS debugging logs in development by logging origin validation decisions
- Use browser extensions like "CORS Unblock" only for testing, never in production code

### Related Documentation

- MDN CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Hono Middleware Guide: https://hono.dev/docs/guides/middleware
- BetterAuth Security: https://betterauth.dev/docs/security/cors
