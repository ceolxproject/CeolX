# Session Management

## Description

Implement comprehensive session management with role-based expiration times (30 days for learners, 24 hours for super admin), session refresh with sliding window, cross-device session listing, bulk session revocation, and secure logout. Sessions are database-backed for persistence and security.

## Affected Apps/Packages

- `packages/auth`
- Backend: Hono API
- Frontend: All web apps and mobile

## API Endpoints

### GET /auth/user/sessions

List all active sessions for current user across all devices.

**Response** (200 OK):

```json
{
  "sessions": [
    {
      "id": "session_abc123",
      "device": {
        "name": "Chrome on Windows",
        "type": "desktop",
        "browser": "Chrome",
        "os": "Windows 10"
      },
      "ipAddress": "192.168.1.1",
      "location": "San Francisco, CA",
      "createdAt": "2024-02-18T10:30:00Z",
      "lastActivityAt": "2024-02-18T14:30:00Z",
      "expiresAt": "2024-03-19T10:30:00Z",
      "isCurrent": true
    }
  ]
}
```

### DELETE /auth/sessions/{sessionId}

Revoke a specific session.

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

### POST /auth/sessions/revoke-all

Revoke all sessions except current.

**Request Body**:

```json
{
  "excludeCurrentSession": true
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "All other sessions revoked",
  "revokedCount": 3
}
```

### POST /auth/logout

Logout current session.

**Request Body**:

```json
{
  "allDevices": false // If true, revoke all sessions
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /auth/refresh-session

Explicitly refresh session (sliding window).

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Session refreshed",
  "expiresAt": "2024-03-19T10:30:00Z"
}
```

## Requirements

### Session Configuration

**By Role**:

- **Learner**: 30-day expiration
- **Mentor**: 30-day expiration
- **Team Member**: 24-hour expiration
- **Super Admin**: 24-hour expiration

**Cookie Settings**:

- `httpOnly: true` (prevent JavaScript access)
- `secure: true` (HTTPS only in production)
- `sameSite: 'Lax'` (CSRF protection)
- `maxAge`: Set per role
- `domain`: Platform-specific domain

### Database-Backed Sessions

- Store all session data in `session` table
- Session fields:
  - `id`: Unique session ID (UUID)
  - `token`: Secure random token (never exposed in response)
  - `userId`: Foreign key to user
  - `userAgent`: Browser user agent (for device detection)
  - `ipAddress`: Client IP address
  - `deviceInfo`: Parsed device info (browser, OS, etc.)
  - `location`: Geolocation (country, city) from IP
  - `expiresAt`: Session expiration timestamp
  - `createdAt`: Session creation timestamp
  - `lastActivityAt`: Last API request timestamp
  - `refreshedAt`: Last refresh timestamp
  - `revokedAt`: Revocation timestamp (if revoked)

### Session Persistence

- Sessions survive server restarts (database-backed)
- Session data replicated across multiple servers
- Use database with proper backup and recovery
- Index on `token`, `userId`, `expiresAt` for performance

### Session Refresh (Sliding Window)

- Automatically extend session on user activity
- Check session age: if `lastActivityAt` > 5 minutes ago
- Extend expiration by original duration:
  - Learner: +30 days
  - Admin: +24 hours
- Update `refreshedAt` timestamp
- Emit refresh event to update frontend cookie
- Max 1 refresh per 5 minutes (prevent excessive updates)

### Session Refresh Endpoint

- Optional explicit refresh via `/auth/refresh-session`
- Useful for mobile apps or long-running sessions
- Returns new expiration time
- Updates cookie in response

### Device Detection

- Parse `User-Agent` header to detect:
  - Browser type (Chrome, Safari, Firefox, etc.)
  - Browser version
  - Operating system (Windows, macOS, iOS, Android)
  - Device type (desktop, mobile, tablet)
- Use library like `ua-parser-js`
- Store parsed info for session display

### Geolocation

- Get location from client IP
- Use GeoIP database or API (MaxMind GeoLite2)
- Store country and city (privacy-friendly)
- Display in session list for security awareness

### Session Revocation

- **Manual**: User clicks "Sign out" on session
- **Admin**: Admin revokes user session
- **Automatic**: Session expires
- Mark session `revokedAt` instead of deleting (audit trail)
- Delete after 30 days (privacy/performance)
- Prevent further API requests with revoked token

### Logout Flow

- Clear session token from cookie
- Invalidate session in database
- Option to revoke all sessions:
  - `logoutAllDevices: true`
  - Revokes all user sessions
  - User must sign in on all devices
- Redirect to login page
- Clear local storage/cookies on frontend

### Cross-Device Session List

- Show all active sessions with device details
- Current session marked as "This device"
- Sorted by `lastActivityAt` (most recent first)
- Show time since last activity
- Show last IP and location
- Allow individual session revocation
- "Sign out from other devices" button

### Concurrent Session Limits (Optional)

- Maximum concurrent sessions per user (e.g., 5)
- If limit exceeded, revoke oldest inactive session
- Notify user of limit reached
- Configurable per role

### Session-Based CSRF Protection

- Session ID tied to origin (domain)
- Validate origin header on requests
- SameSite cookie prevents cross-site submission
- Combine with origin validation middleware

### Activity Tracking

- Update `lastActivityAt` on each authenticated request
- Track in background (debounced, batched updates)
- Use for:
  - Sliding window refresh
  - Session list "last active" display
  - Idle session cleanup
- Don't track every microsecond (DB overhead)

### Idle Session Cleanup

- Delete sessions older than expiration + 7 days
- Run nightly job
- Prevents DB bloat

### Frontend Session Management

**Session Context**:

- Store current session in React context
- Track session expiration time
- Show session expiration warnings (5 min before)
- Handle automatic logout on expiration
- Refresh session on activity

**Session Expiration Warning**:

- Show modal 5 minutes before expiration
- "Your session is expiring"
- Options: "Continue Session" (refresh), "Logout"
- Auto-logout if not interacted
- Clear all local state on logout

**Device Management UI**:

- Show all sessions in account settings
- Device type + browser + OS
- IP address and location
- Last activity time
- "Sign out this device" button for each
- "Sign out all other devices" button

## Acceptance Criteria

- [ ] Sessions stored in database with all required fields
- [ ] Learner sessions expire in 30 days
- [ ] Admin sessions expire in 24 hours
- [ ] Session token stored in HttpOnly secure cookie
- [ ] Session persists across server restarts
- [ ] Sliding window refresh extends expiration
- [ ] Refresh triggered at 5-minute threshold
- [ ] Max 1 refresh per 5 minutes
- [ ] GET /auth/user/sessions returns all active sessions
- [ ] Session list shows device, IP, location info
- [ ] Current session marked as "This device"
- [ ] DELETE /auth/sessions/{sessionId} revokes session
- [ ] POST /auth/sessions/revoke-all revokes all except current
- [ ] POST /auth/logout logs out current session
- [ ] POST /auth/logout with allDevices revokes all
- [ ] Device detection works for major browsers
- [ ] Geolocation shows city and country
- [ ] Session display shows time since last activity
- [ ] User can revoke individual sessions
- [ ] Frontend shows session expiration warning (5 min)
- [ ] Frontend shows all sessions with device details
- [ ] Revoked sessions cannot make API requests
- [ ] Old sessions deleted after 37 days (30 + 7)
- [ ] Origin validation prevents CSRF
- [ ] Session activity tracked efficiently (debounced)

## Dependencies

- BetterAuth (from task 01)
- ua-parser-js for user agent parsing
- GeoIP library (MaxMind or similar)
- Drizzle ORM for database operations
- Node.js cron for cleanup jobs

## Technical Notes

### Database Schema

```typescript
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  deviceInfo: jsonb("device_info"), // { browser, os, type, version }
  location: jsonb("location"), // { country, city, coordinates }
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  refreshedAt: timestamp("refreshed_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"), // NULL if active
});

// Indexes
createIndex("session_token_idx").on(sessions.token).unique();
createIndex("session_user_id_idx").on(sessions.userId);
createIndex("session_user_id_expires_at_idx").on(
  sessions.userId,
  sessions.expiresAt,
);
createIndex("session_expires_at_idx").on(sessions.expiresAt);
```

### Device Detection Function

```typescript
import { UAParser } from "ua-parser-js";

function parseDeviceInfo(userAgent: string | undefined) {
  if (!userAgent) {
    return {
      browser: "Unknown",
      os: "Unknown",
      type: "unknown",
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "Unknown",
    os: result.os.name || "Unknown",
    osVersion: result.os.version || "Unknown",
    type: result.device.type || "desktop", // 'mobile', 'tablet', 'desktop'
    device: result.device.name || "Unknown",
  };
}

function getDeviceDisplayName(deviceInfo: any): string {
  const { browser, os } = deviceInfo;
  const type = deviceInfo.type === "mobile" ? "Mobile" : "Desktop";
  return `${browser} on ${os}`;
}
```

### Geolocation Function

```typescript
import { Reader } from "@maxmind/geoip2-node";
import fs from "fs";

const geoReader = new Reader(fs.readFileSync(process.env.GEOIP_DB_PATH!));

function getLocationFromIP(ipAddress: string) {
  try {
    const response = geoReader.city(ipAddress);
    return {
      country: response.country.isoCode,
      countryName: response.country.names?.en,
      city: response.city?.names?.en,
      timezone: response.location?.timeZone,
      latitude: response.location?.latitude,
      longitude: response.location?.longitude,
    };
  } catch (error) {
    console.error(`GeoIP lookup failed for ${ipAddress}:`, error);
    return {
      country: "Unknown",
      countryName: "Unknown",
      city: "Unknown",
      timezone: "Unknown",
    };
  }
}
```

### Session Creation Helper

```typescript
import crypto from "crypto";

async function createSession(
  userId: string,
  userAgent: string | undefined,
  ipAddress: string,
  role: string,
) {
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomBytes(16).toString("hex");

  // Calculate expiration based on role
  const roleExpirations: Record<string, number> = {
    learner: 30 * 24 * 60 * 60 * 1000,
    mentor: 30 * 24 * 60 * 60 * 1000,
    team_member: 24 * 60 * 60 * 1000,
    super_admin: 24 * 60 * 60 * 1000,
  };

  const expirationMs = roleExpirations[role] || roleExpirations["learner"];
  const expiresAt = new Date(Date.now() + expirationMs);

  // Parse device info
  const deviceInfo = parseDeviceInfo(userAgent);
  const location = getLocationFromIP(ipAddress);

  // Create session
  const session = await db
    .insert(sessions)
    .values({
      id: sessionId,
      token: sessionToken,
      userId,
      userAgent,
      ipAddress,
      deviceInfo,
      location,
      expiresAt,
    })
    .returning();

  return {
    session: session[0],
    sessionToken,
  };
}
```

### Session Refresh Logic

```typescript
// Debounced activity update (max once per 5 minutes)
const activityDebounce = new Map<string, number>();

async function recordSessionActivity(
  sessionId: string,
  sessionToken: string,
): Promise<void> {
  const now = Date.now();
  const lastUpdate = activityDebounce.get(sessionId);

  // Skip if updated within 5 minutes
  if (lastUpdate && now - lastUpdate < 5 * 60 * 1000) {
    return;
  }

  activityDebounce.set(sessionId, now);

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) return;

  // Check if should refresh
  const refreshThresholdMs = 5 * 60 * 1000; // 5 minutes
  const shouldRefresh =
    session.lastActivityAt.getTime() + refreshThresholdMs < now &&
    session.expiresAt.getTime() > now; // Only if not already expired

  if (shouldRefresh) {
    // Calculate new expiration
    const originalDurationMs =
      session.expiresAt.getTime() - session.createdAt.getTime();
    const newExpiresAt = new Date(now + originalDurationMs);

    // Update session
    await db
      .update(sessions)
      .set({
        lastActivityAt: new Date(now),
        refreshedAt: new Date(now),
        expiresAt: newExpiresAt,
      })
      .where(eq(sessions.id, sessionId));

    return newExpiresAt;
  }

  // Just update activity
  await db
    .update(sessions)
    .set({
      lastActivityAt: new Date(now),
    })
    .where(eq(sessions.id, sessionId));

  return undefined;
}
```

### Middleware for Session Handling

```typescript
export async function withSessionActivity(c: Context, next: Next) {
  const sessionToken = c.req.cookie("authToken");
  if (!sessionToken) return next();

  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.token, sessionToken), isNull(sessions.revokedAt)),
  });

  if (!session || session.expiresAt < new Date()) {
    // Session expired or revoked
    c.cookie("authToken", "", { maxAge: 0 });
    return next();
  }

  // Record activity and refresh if needed
  const newExpiresAt = await recordSessionActivity(session.id, sessionToken);

  if (newExpiresAt) {
    // Refresh cookie with new expiration
    const expirationSeconds = Math.floor(
      (newExpiresAt.getTime() - Date.now()) / 1000,
    );
    c.cookie("authToken", sessionToken, {
      httpOnly: true,
      secure: c.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: expirationSeconds,
    });
  }

  // Attach session to context
  c.set("auth.session", session);

  await next();
}
```

### Session List Endpoint

```typescript
export async function handleGetSessions(c: Context) {
  const user = c.get("auth.user");
  const currentSessionId = c.get("auth.session")?.id;

  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  // Get all non-revoked sessions
  const userSessions = await db.query.sessions.findMany({
    where: and(
      eq(sessions.userId, user.id),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, new Date()),
    ),
    orderBy: desc(sessions.lastActivityAt),
  });

  return c.json({
    sessions: userSessions.map((session) => ({
      id: session.id,
      device: {
        name: getDeviceDisplayName(session.deviceInfo),
        type: session.deviceInfo?.type || "desktop",
        browser: session.deviceInfo?.browser,
        os: session.deviceInfo?.os,
      },
      ipAddress: maskIP(session.ipAddress),
      location: session.location
        ? `${session.location.city}, ${session.location.countryName}`
        : "Unknown",
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    })),
  });
}

function maskIP(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  return ip;
}
```

### Logout Handler

```typescript
export async function handleLogout(c: Context) {
  const { allDevices } = await c.req.json();
  const user = c.get("auth.user");
  const currentSession = c.get("auth.session");

  if (!user || !currentSession) {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }

  if (allDevices) {
    // Revoke all sessions
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, user.id));
  } else {
    // Revoke only current session
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, currentSession.id));
  }

  // Clear cookie
  c.cookie("authToken", "", { maxAge: 0 });

  console.log(`User logged out: ${user.id} (allDevices: ${allDevices})`);

  return c.json({
    success: true,
    message: allDevices
      ? "Logged out from all devices"
      : "Logged out successfully",
  });
}
```

### Cleanup Job for Expired Sessions

```typescript
import cron from "node-cron";

// Run daily at 2 AM
cron.schedule("0 2 * * *", async () => {
  const thirtySevenDaysAgo = new Date(Date.now() - 37 * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(sessions)
    .where(
      or(
        and(
          isNotNull(sessions.revokedAt),
          lt(sessions.revokedAt, thirtySevenDaysAgo),
        ),
        lt(sessions.expiresAt, new Date()),
      ),
    );

  console.log(`Cleaned up ${deleted} expired/revoked sessions`);
});
```

### Frontend Session Context

```typescript
// contexts/SessionContext.tsx
'use client';

import { createContext, useCallback, useEffect, useState } from 'react';

interface SessionContextType {
  session: SessionType | null;
  expiresAt: Date | null;
  isExpiringSoon: boolean;
  refreshSession: () => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionType | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  // Check session expiration
  useEffect(() => {
    if (!expiresAt) return;

    const checkExpiration = setInterval(() => {
      const now = Date.now();
      const timeLeft = expiresAt.getTime() - now;
      const fiveMinutesMs = 5 * 60 * 1000;

      setIsExpiringSoon(timeLeft < fiveMinutesMs && timeLeft > 0);

      if (timeLeft <= 0) {
        // Session expired
        logout();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkExpiration);
  }, [expiresAt]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setExpiresAt(new Date(data.expiresAt));
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  }, []);

  const logout = useCallback(async (allDevices = false) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ allDevices }),
      });

      setSession(null);
      setExpiresAt(null);
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, expiresAt, isExpiringSoon, refreshSession, logout }}
    >
      {children}
    </SessionContext.Provider>
  );
}
```

### Session Expiration Warning Modal

```typescript
// components/SessionExpirationWarning.tsx
'use client';

import { useContext, useState } from 'react';
import { SessionContext } from '@/contexts/SessionContext';

export function SessionExpirationWarning() {
  const sessionContext = useContext(SessionContext);
  const [dismissed, setDismissed] = useState(false);

  if (!sessionContext?.isExpiringSoon || dismissed) {
    return null;
  }

  const handleContinue = () => {
    sessionContext.refreshSession();
    setDismissed(true);
  };

  return (
    <div className="session-expiration-warning">
      <h3>Session Expiring Soon</h3>
      <p>Your session will expire in 5 minutes due to inactivity.</p>

      <div className="actions">
        <button onClick={handleContinue} className="btn-primary">
          Continue Session
        </button>
        <button onClick={() => sessionContext.logout()} className="btn-secondary">
          Logout
        </button>
      </div>
    </div>
  );
}
```

### Security Considerations

- Never expose session token in API response
- Store token only in HttpOnly cookie
- Validate session on every request
- Track activity for idle detection
- Revoke sessions on suspicious activity
- Delete old session records to preserve privacy
- Hash session tokens if possible (compare with stored hash)
