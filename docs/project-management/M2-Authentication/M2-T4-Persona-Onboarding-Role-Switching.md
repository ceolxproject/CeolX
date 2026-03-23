# M2-T4 · Persona Onboarding + Role Switching Logic

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1, M2-T2 (auth must work), M1-T2 (artist_profiles + venue_profiles tables) |
| **PRD Ref** | Section 4.2 (Onboarding), Section 4.3 (Persona Switching) |

---

## Description

The core persona system that governs all feature access in the app. Every screen, API route, and notification uses the user's current role. User selects their initial persona after first sign-up, and can switch at any time from Settings. This task must be implemented correctly — it underpins every other feature in M3+.

There are three user personas: spectator (music fan), artist (performer), and venue (venue/business). Spectator is the default after sign-up. Switching to Venue triggers subscription requirements and Postmark activation email. Switching away from Venue deactivates the profile but does not cancel the subscription. Pending events stay in moderation queue regardless of the creator's current role.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | Role update endpoint, profile creation/deactivation logic, `GET /users/me` |
| `apps/mobile` | Onboarding screen (post-signup), role-specific sub-flows, Settings > Switch Account Type, FCM notification tap routing |
| `packages/shared` | `UserRole` enum (`spectator \| artist \| venue`) |

---

## API Endpoints

### POST /api/v1/users/onboarding

Called once after email verification (M2-T1) to select initial persona.

**Request Body:**
```json
{
  "persona": "artist"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "currentRole": "artist"
  },
  "message": "Persona selected. Complete your profile."
}
```

### PATCH /api/v1/users/role

Switch to a different persona at any time.

**Request Body:**
```json
{
  "role": "venue"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "currentRole": "venue"
  }
}
```

### GET /api/v1/users/me

Return authenticated user with current role and active profile data.

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "currentRole": "artist",
    "emailVerified": true,
    "artist": {
      "id": "uuid",
      "isActive": true,
      "bio": "Trad music musician",
      "stageName": "Seán"
    }
  }
}
```

---

## Requirements

### Post-Sign-Up Onboarding

- Onboarding screen shown immediately after email verification (M2-T1) — shown once only
- Three buttons: "I'm a Spectator", "I'm an Artist", "I'm a Venue/Business"
- Spectator: skips sub-flow, goes directly to Map screen
- Artist: completes sub-flow (bio, stage name, genre, image), then Map screen
- Venue: completes sub-flow (name, address, bio, image), sets `subscription_status = inactive`, triggers Postmark activation email
- Sub-flows store data in `artist_profiles` or `venue_profiles` table with `is_active = true`

### Artist Sub-Flow

- Fields: Stage Name (required), Bio (optional), Genre (required), Profile Image (optional)
- Genre dropdown: predefined list from shared enums
- Profile image upload: integrated with S3 (wired in M6)
- On save: creates `artist_profiles` row with `is_active = true`

### Venue Sub-Flow

- Fields: Venue Name (required), Address (required), Bio (optional), Profile Image (optional)
- On save: creates `venue_profiles` row with `is_active = false` and `subscription_status = inactive`
- Triggers Postmark activation email with deep link to `ceolx.ie/subscribe`
- In-app message: "Your profile is not yet visible to artists. Check your email to activate."

### Role Switching (Settings)

- Settings > Switch Account Type screen shows current role and available options
- User can tap to switch to any role
- Switching to Spectator: no sub-flow, immediate switch
- Switching to Artist: if first time, show sub-flow; if returning, skip sub-flow
- Switching to Venue: if first time, show sub-flow and set `subscription_status = inactive`; if returning, restore `is_active = true`

### State Management

- `users.current_role` is the single source of truth for feature access
- Never derive role from profile tables (`artist_profiles.is_active`, etc.)
- Switching role updates `users.current_role` and flips `is_active` on relevant profile
- Switching away from Venue: `venue_profiles.is_active = false`, subscription stays active
- Switching away from Artist: `artist_profiles.is_active = false`; past approved events stay live
- Pending events: if user switches role while events are in `pending_review`, events stay in queue

### FCM Notification Routing

- FCM payload includes: `{ persona: 'artist' | 'venue' | 'spectator', route: '/events/123' }`
- On notification tap: if user already in correct persona, navigate directly
- If wrong persona: auto-switch persona, show brief toast, then navigate
- Cold start with notification: read payload → switch persona → open correct screen

---

## Acceptance Criteria

- [ ] Onboarding screen shown immediately after first sign-up (any auth method)
- [ ] Selecting Spectator routes to Map screen with no sub-flow
- [ ] Selecting Artist completes sub-flow and creates `artist_profiles` row with `is_active = true`
- [ ] Selecting Venue completes sub-flow, creates `venue_profiles` row with `subscription_status = inactive`, and triggers activation email
- [ ] Switch Account Type in Settings shows current role and available options
- [ ] Switching to Artist for first time triggers Artist sub-flow; switching back skips it
- [ ] Switching to Venue without subscription shows pending activation state in-app
- [ ] Switching away from Venue deactivates profile (`is_active = false`) but does not cancel subscription
- [ ] Switching away from Artist deactivates profile but keeps past events live
- [ ] `GET /users/me` returns correct `current_role` and relevant profile data
- [ ] Notification tap auto-switches role and navigates to correct screen with toast
- [ ] Events in `pending_review` status stay in admin queue regardless of creator's current role
- [ ] No duplicate profiles created when switching roles multiple times

---

## Dependencies

### Upstream
- M2-T1 (Email/Password Auth — token issued before onboarding)
- M2-T2 (Google/Apple OAuth — tokens issued before onboarding)
- M1-T2 (Database schema with `artist_profiles` and `venue_profiles` tables)

### Downstream
- M3+ (All feature development) — every feature gates access by `users.current_role`
- M8 (Venue Subscription) — activation email sent from Venue onboarding
- M7 (Push Notifications) — notification payload includes persona for auto-switching

### External services
- Postmark API (for Venue activation email)
- Firebase FCM (for persona in notification payload)

---

## Technical Notes

### Onboarding Endpoint

```typescript
// apps/api/src/routes/users.ts (POST /onboarding)

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/db';
import { users, artistProfiles, venueProfiles } from '../schema';
import { sendVenueActivationEmail } from '../services/emailService';
import { authMiddleware } from '../middleware/auth';

const onboardingSchema = z.object({
  persona: z.enum(['spectator', 'artist', 'venue']),
});

app.post(
  '/onboarding',
  authMiddleware,
  zValidator('json', onboardingSchema),
  async (c) => {
    const userId = c.get('userId');
    const { persona } = c.req.valid('json');

    // Update user role
    const user = await db
      .update(users)
      .set({ currentRole: persona })
      .where(eq(users.id, userId))
      .returning();

    // Create profile if needed
    if (persona === 'artist') {
      await db.insert(artistProfiles).values({
        id: uuidv4(),
        userId,
        isActive: true,
      });
    } else if (persona === 'venue') {
      await db.insert(venueProfiles).values({
        id: uuidv4(),
        userId,
        isActive: false,
        subscriptionStatus: 'inactive',
      });

      // Send activation email
      await sendVenueActivationEmail(user[0].email);
    }

    return c.json(
      {
        success: true,
        user: user[0],
        message: 'Persona selected.',
      },
      200
    );
  }
);
```

### Role Switch Endpoint

```typescript
// apps/api/src/routes/users.ts (PATCH /role)

const switchRoleSchema = z.object({
  role: z.enum(['spectator', 'artist', 'venue']),
});

app.patch(
  '/role',
  authMiddleware,
  zValidator('json', switchRoleSchema),
  async (c) => {
    const userId = c.get('userId');
    const { role } = c.req.valid('json');

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return c.json({ error: 'USER_NOT_FOUND' }, 404);
    }

    // Update current role
    const updatedUser = await db
      .update(users)
      .set({ currentRole: role })
      .where(eq(users.id, userId))
      .returning();

    // Handle profile activation/deactivation
    if (role === 'artist') {
      // Reactivate or create artist profile
      const artistProfile = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, userId),
      });

      if (artistProfile) {
        await db
          .update(artistProfiles)
          .set({ isActive: true })
          .where(eq(artistProfiles.userId, userId));
      } else {
        await db.insert(artistProfiles).values({
          id: uuidv4(),
          userId,
          isActive: true,
        });
      }

      // Deactivate venue profile
      await db
        .update(venueProfiles)
        .set({ isActive: false })
        .where(eq(venueProfiles.userId, userId));
    } else if (role === 'venue') {
      // Check if venue profile exists
      const venueProfile = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, userId),
      });

      if (!venueProfile) {
        // First time: create profile and send activation email
        await db.insert(venueProfiles).values({
          id: uuidv4(),
          userId,
          isActive: false,
          subscriptionStatus: 'inactive',
        });
        await sendVenueActivationEmail(user.email);
      } else if (!venueProfile.isActive) {
        // Returning: reactivate profile
        await db
          .update(venueProfiles)
          .set({ isActive: true })
          .where(eq(venueProfiles.userId, userId));
      }

      // Deactivate artist profile
      await db
        .update(artistProfiles)
        .set({ isActive: false })
        .where(eq(artistProfiles.userId, userId));
    } else if (role === 'spectator') {
      // Deactivate all profiles
      await db
        .update(artistProfiles)
        .set({ isActive: false })
        .where(eq(artistProfiles.userId, userId));

      await db
        .update(venueProfiles)
        .set({ isActive: false })
        .where(eq(venueProfiles.userId, userId));
    }

    return c.json({
      success: true,
      user: updatedUser[0],
    });
  }
);
```

### Get User Endpoint

```typescript
// apps/api/src/routes/users.ts (GET /me)

app.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return c.json({ error: 'USER_NOT_FOUND' }, 404);
  }

  // Fetch active profile
  let profile = null;
  if (user.currentRole === 'artist') {
    profile = await db.query.artistProfiles.findFirst({
      where: eq(artistProfiles.userId, userId),
    });
  } else if (user.currentRole === 'venue') {
    profile = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, userId),
    });
  }

  return c.json({
    success: true,
    user: {
      ...user,
      [user.currentRole]: profile,
    },
  });
});
```

### Mobile Onboarding Screen

```typescript
// apps/mobile/src/screens/Onboarding/PersonaSelectionScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';

const PersonaSelectionScreen = ({ navigation }: any) => {
  const { sessionToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePersonaSelect = async (persona: 'spectator' | 'artist' | 'venue') => {
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/users/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ persona }),
        }
      );

      if (response.ok) {
        if (persona === 'spectator') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs', params: { screen: 'MapStack' } }],
          });
        } else if (persona === 'artist') {
          navigation.navigate('ArtistOnboarding');
        } else if (persona === 'venue') {
          navigation.navigate('VenueOnboarding');
        }
      }
    } catch (err) {
      console.error('Persona selection error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who are you?</Text>
      <Text style={styles.subtitle}>
        You can change this anytime in Settings.
      </Text>

      <TouchableOpacity
        style={[styles.card, loading && styles.cardDisabled]}
        onPress={() => handlePersonaSelect('spectator')}
        disabled={loading}
      >
        <Text style={styles.cardTitle}>Spectator</Text>
        <Text style={styles.cardDescription}>
          Discover Irish music events and artists near you
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, loading && styles.cardDisabled]}
        onPress={() => handlePersonaSelect('artist')}
        disabled={loading}
      >
        <Text style={styles.cardTitle}>Musician / Artist</Text>
        <Text style={styles.cardDescription}>
          Promote your performances and connect with venues
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, loading && styles.cardDisabled]}
        onPress={() => handlePersonaSelect('venue')}
        disabled={loading}
      >
        <Text style={styles.cardTitle}>Venue / Business</Text>
        <Text style={styles.cardDescription}>
          List gigs and recruit artists for your venue
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" color="#00a86b" />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default PersonaSelectionScreen;
```

### Mobile Switch Account Type Screen

```typescript
// apps/mobile/src/screens/Settings/SwitchAccountTypeScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';

const SwitchAccountTypeScreen = ({ navigation }: any) => {
  const { user, sessionToken } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSwitch = async (role: 'spectator' | 'artist' | 'venue') => {
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/users/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ role }),
        }
      );

      if (response.ok) {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Switch role error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Switch Account Type</Text>
      <Text style={styles.subtitle}>Current: {user?.currentRole}</Text>

      {['spectator', 'artist', 'venue'].map((role) => (
        <TouchableOpacity
          key={role}
          style={[
            styles.option,
            user?.currentRole === role && styles.optionActive,
            loading && styles.optionDisabled,
          ]}
          onPress={() => handleSwitch(role as any)}
          disabled={loading || user?.currentRole === role}
        >
          <Text
            style={[
              styles.optionText,
              user?.currentRole === role && styles.optionTextActive,
            ]}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}

      {loading && <ActivityIndicator size="large" color="#00a86b" />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  option: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  optionActive: {
    borderColor: '#00a86b',
    backgroundColor: '#e6f5f0',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#00a86b',
  },
});

export default SwitchAccountTypeScreen;
```

---

## Common Gotchas

- **`users.current_role` is source of truth**: Never derive the role from profile tables. Always check `users.current_role`.
- **FCM notification payload structure**: Must include `{ persona, route }` so mobile can auto-switch and navigate correctly.
- **Venue activation email**: Not triggered on every switch to venue, only first time. Subsequent switches just reactivate the profile.
- **Events in pending_review**: Stay in queue regardless of creator's current role. Moderation must be role-agnostic.
- **Subscription stays active**: Switching away from Venue deactivates the profile but does NOT cancel the subscription. Billing continues.
- **Past events stay live**: When Artist switches away, past approved events remain visible until their date passes.

---
