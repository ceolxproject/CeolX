# BetterAuth Core Setup

## Description

Install and configure BetterAuth as the primary authentication provider. BetterAuth is a self-hosted authentication solution that will support email/password authentication, OAuth (Google, Apple), and RBAC roles. This task establishes the foundational authentication infrastructure across the entire platform.

## Affected Apps/Packages

- `packages/auth` (new package)
- `packages/database`
- Backend: Hono API
- Frontend: Next.js web apps (Learner, Mentor, Admin)
- Mobile: React Native Expo app

## API Endpoints

- All BetterAuth endpoints are handled via standard OAuth/session endpoints
- Custom session endpoints managed by Hono middleware

## Requirements

### Core Installation

- Install BetterAuth package and dependencies
- Create `packages/auth` directory with proper structure
- Configure BetterAuth instance with environment variables
- Set up database adapter for Neon PostgreSQL via Drizzle ORM

### Database Configuration

- Create BetterAuth schema tables using Drizzle migration
- Tables: `user`, `session`, `verificationToken`, `account`, `role` (with RBAC plugin)
- Index key columns for performance: `user.email`, `session.userId`, `session.token`

### Session Configuration

- Database-backed sessions (not JWT-based)
- Session storage in `session` table
- Implement custom session refresh logic
- Sliding window session extension on user activity

### Cookie Configuration

- **Secure Cookies**:
  - `httpOnly: true` (prevent JavaScript access)
  - `sameSite: 'Lax'` (CSRF protection for forms)
  - `secure: true` in production (HTTPS only)
  - `maxAge` set per role (learner: 30 days, admin: 24 hours)
  - Domain: platform-specific (e.g., `.example.com` for wildcard)

### CORS Configuration

- **Learner Web App**: `https://learn.example.com` (dev: `http://localhost:3001`)
- **Mentor Web App**: `https://teach.example.com` (dev: `http://localhost:3002`)
- **Admin Web App**: `https://admin.example.com` (dev: `http://localhost:3003`)
- **Mobile App**: Deep links and expo-auth-session handlers
- CORS headers: `credentials: 'include'`

### CSRF Protection

- Implement SameSite cookie policy (`Lax` for safe, `Strict` for sensitive operations)
- Origin validation middleware in Hono
- CSRF token verification for POST/PUT/DELETE requests (optional, cookie-based is primary)
- Whitelist allowed origins in environment config

### Environment Variables

```
# BetterAuth Config
BETTER_AUTH_SECRET=<cryptographically-secure-32-char-key>
BETTER_AUTH_URL=https://api.example.com/auth

# Database
DATABASE_URL=postgresql://user:pass@db.neon.tech/mentor

# CORS Origins
CORS_ORIGINS=https://learn.example.com,https://teach.example.com,https://admin.example.com

# Environment
NODE_ENV=production
```

## Acceptance Criteria

- [ ] `packages/auth` directory created with proper TypeScript configuration
- [ ] BetterAuth installed and initialized in the auth package
- [ ] Drizzle ORM schema includes all BetterAuth required tables
- [ ] Database migration runs successfully, creating BetterAuth tables
- [ ] Session table created with indexes on `userId` and `token`
- [ ] Hono middleware wraps BetterAuth and exports `auth` instance
- [ ] Cookie settings configured per role: `sameSite`, `httpOnly`, `secure`, `maxAge`
- [ ] CORS middleware in Hono allows credentials for all three web origins + mobile
- [ ] Origin validation middleware rejects requests from untrusted origins
- [ ] CSRF protection via SameSite cookies tested and verified
- [ ] Environment variables documented in `.env.example`
- [ ] Hono auth routes (`/auth/*`) properly proxied to BetterAuth
- [ ] Session persistence works across server restarts
- [ ] Health check endpoint returns auth system status

## Dependencies

- betterauth (latest)
- @better-auth/core
- @better-auth/drizzle-adapter
- drizzle-orm
- hono
- postgres adapter (or Neon JS)

## Technical Notes

### Package Structure

```
packages/auth/
├── src/
│   ├── index.ts          # Export auth instance
│   ├── config.ts         # BetterAuth configuration
│   ├── middleware.ts     # Hono middleware wrapper
│   ├── session.ts        # Custom session logic
│   ├── csrf.ts           # CSRF protection utilities
│   ├── cookies.ts        # Cookie configuration per role
│   └── types.ts          # TypeScript types
├── tsconfig.json
└── package.json
```

### BetterAuth Initialization

- Use `initAuthConfig()` pattern for environment-aware setup
- Export Hono handler: `export const authHandler = createAuthHandler(auth)`
- Implement type-safe middleware: `withAuth()` HOF for Hono routes

### Session Refresh Strategy

- Use database-backed sessions with sliding window
- Extend expiry on successful API calls within threshold (5 min before expiry)
- Track `lastActivity` timestamp in session table
- Emit refresh events for frontend to update cookie

### CORS & CSRF Tradeoffs

- SameSite=Lax allows safe cross-site requests (form submissions)
- Use CORS for API requests with credentials
- Desktop apps use in-app tabs (same-origin context)
- Mobile app uses OAuth redirect + custom URL scheme

### Monitoring & Debugging

- Log session creation/revocation events
- Track failed auth attempts (for lockout feature)
- Monitor CORS rejections for development debugging
- Add debug mode environment variable for local development
