# M2-T6 · Session Management

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| **Milestone**  | M2 — Authentication & Persona System                 |
| **Status**     | 🔲 To Do                                             |
| **Depends on** | M2-T1 (BetterAuth sessions), M2-T5 (auth middleware) |
| **PRD Ref**    | Section 4.1 (Authentication)                         |

---

## Description

Allow users to view all active sessions across devices and revoke individual sessions or all sessions at once. Uses BetterAuth's built-in session management APIs. On mobile, the current device session is shown; in the future, this is where "Log out of all devices" lives. This is a security feature — if a user believes their account is compromised, they can end all active sessions immediately.

---

## Affected Apps / Packages

| App / Package | Role                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| `apps/api`    | Session list and revocation endpoints (thin wrappers over BetterAuth session API) |
| `apps/mobile` | Settings > Active Sessions screen                                                 |

---

## API Endpoints

### GET /api/v1/sessions

List all active sessions for the authenticated user.

**Response (200 OK):**

```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-uuid",
      "deviceInfo": "iPhone 15 Pro · iOS 17",
      "ipAddress": "83.45.120.10",
      "createdAt": "2026-03-20T10:00:00Z",
      "expiresAt": "2026-04-19T10:00:00Z",
      "isCurrent": true
    }
  ]
}
```

### DELETE /api/v1/sessions/:sessionId

Revoke a specific session by ID.

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Session revoked."
}
```

**Error Responses:**

- `403 Forbidden` — Attempting to revoke a session that belongs to another user
- `404 Not Found` — Session ID not found

### DELETE /api/v1/sessions

Revoke all sessions for the authenticated user (except current session).

**Response (200 OK):**

```json
{
  "success": true,
  "message": "All other sessions revoked."
}
```

---

## Requirements

### Session Listing

- Returns all non-expired sessions for the authenticated user
- Each session shows: `id`, device info (user-agent parsed), IP address, creation date, expiry date, and `isCurrent` flag
- `isCurrent: true` marks the session making the request (matched by session token)
- Sessions sorted newest first

### Session Revocation

- User can revoke any session by ID — except the current session
- Attempting to revoke current session returns `400 Bad Request` with message: "Cannot revoke your active session. Use logout instead."
- Revoking all sessions: deletes all sessions except the currently active one
- BetterAuth's `revokeSession` / `revokeSessions` APIs handle the deletion

### Mobile Frontend

- **Settings > Active Sessions screen**:
  - Lists all sessions with device info and last active date
  - Current session labelled "This device"
  - "Revoke" button on each non-current session
  - "Log out of all other devices" button at bottom
  - Confirmation prompt before bulk revocation

---

## Acceptance Criteria

- [ ] `GET /api/v1/sessions` returns all active sessions for authenticated user
- [ ] Current session is flagged with `isCurrent: true`
- [ ] `DELETE /api/v1/sessions/:sessionId` revokes the specified session
- [ ] Cannot revoke current session via DELETE endpoint (returns 400)
- [ ] `DELETE /api/v1/sessions` revokes all sessions except current
- [ ] Sessions screen in Settings shows all active sessions with device info
- [ ] "This device" label on current session
- [ ] Revoking another session removes it from the list immediately
- [ ] Bulk "log out all other devices" requires confirmation before executing
- [ ] Revoked session token no longer authenticates (returns 401 on next request)

---

## Dependencies

### Upstream

- M2-T1 (BetterAuth session table — sessions are stored and managed there)
- M2-T5 (authMiddleware — all endpoints require authenticated user)

### Downstream

- Security-sensitive features in M3+ benefit from users being able to revoke sessions

### External services

- BetterAuth session management API

---

## Technical Notes

### Session List Endpoint

```typescript
// apps/api/src/routes/sessions.ts

import { Hono } from 'hono';
import { auth } from '../lib/auth';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

app.get('/sessions', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // BetterAuth lists sessions for the user
  const sessions = await auth.api.listSessions({ headers: c.req.raw.headers });

  return c.json({
    success: true,
    sessions: sessions.map((s) => ({
      id: s.id,
      deviceInfo: parseUserAgent(s.userAgent),
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.token === getTokenFromRequest(c),
    })),
  });
});
```

### Revoke Single Session

```typescript
app.delete('/sessions/:sessionId', authMiddleware, async (c) => {
  const sessionId = c.req.param('sessionId');
  const currentToken = getTokenFromRequest(c);

  // Prevent revoking current session
  const sessions = await auth.api.listSessions({ headers: c.req.raw.headers });
  const target = sessions.find((s) => s.id === sessionId);

  if (!target) {
    return c.json({ error: 'SESSION_NOT_FOUND' }, 404);
  }

  if (target.token === currentToken) {
    return c.json(
      {
        error: 'CANNOT_REVOKE_CURRENT_SESSION',
        message: 'Cannot revoke your active session. Use logout instead.',
      },
      400
    );
  }

  await auth.api.revokeSession({ headers: c.req.raw.headers, body: { token: target.token } });

  return c.json({ success: true, message: 'Session revoked.' });
});
```

### Revoke All Other Sessions

```typescript
app.delete('/sessions', authMiddleware, async (c) => {
  // BetterAuth revokes all sessions except the current one
  await auth.api.revokeOtherSessions({ headers: c.req.raw.headers });

  return c.json({ success: true, message: 'All other sessions revoked.' });
});
```

### Mobile Sessions Screen

```typescript
// apps/native/src/screens/Settings/ActiveSessionsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';

interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  isCurrent: boolean;
}

const ActiveSessionsScreen = () => {
  const { sessionToken } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/sessions`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await response.json();
    setSessions(data.sessions);
    setLoading(false);
  };

  const revokeSession = async (sessionId: string) => {
    await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const revokeAllOthers = () => {
    Alert.alert(
      'Log out of all other devices?',
      'This will end all sessions except this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: async () => {
            await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/sessions`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${sessionToken}` },
            });
            setSessions((prev) => prev.filter((s) => s.isCurrent));
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#00a86b" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={styles.sessionRow}>
            <View>
              <Text style={styles.deviceInfo}>{item.deviceInfo}</Text>
              {item.isCurrent && <Text style={styles.currentLabel}>This device</Text>}
              <Text style={styles.ipAddress}>{item.ipAddress}</Text>
            </View>
            {!item.isCurrent && (
              <TouchableOpacity onPress={() => revokeSession(item.id)}>
                <Text style={styles.revokeText}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      <TouchableOpacity style={styles.logoutAllButton} onPress={revokeAllOthers}>
        <Text style={styles.logoutAllText}>Log out of all other devices</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceInfo: { fontSize: 15, fontWeight: '600', color: '#000' },
  currentLabel: { fontSize: 12, color: '#00a86b', marginTop: 2 },
  ipAddress: { fontSize: 12, color: '#999', marginTop: 2 },
  revokeText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
  logoutAllButton: { marginTop: 24, paddingVertical: 12 },
  logoutAllText: { color: '#dc2626', textAlign: 'center', fontSize: 15, fontWeight: '600' },
});

export default ActiveSessionsScreen;
```

---

## Common Gotchas

- **BetterAuth `listSessions` scope**: By default this returns all sessions for the token owner — no additional userId filtering needed.
- **`isCurrent` detection**: Match the token in the request against `session.token` in the list — do not rely on session ID alone.
- **Revoking current session**: Must be prevented at the API level, not just UI — users could call the API directly.
- **User agent parsing**: BetterAuth stores raw user-agent strings. Parse them server-side (e.g. with `ua-parser-js`) before returning to the client to show readable device names.

---
