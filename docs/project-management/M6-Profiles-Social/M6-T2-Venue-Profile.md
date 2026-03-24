# M6-T2 · Venue Profile (Public + Edit)

| Field          | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M6 — Profiles & Social                                                                                                 |
| **Status**     | 🔲 To Do                                                                                                               |
| **Depends on** | M2-T4 (venue_profiles table), M8-T1 (Stripe subscription logic), M4-T1 (events linked to venue), M10-T1 (image upload) |
| **PRD Ref**    | Section 7.1 (Venue Features), Section 9.3 (Data Model), Section 9.8 (Subscription)                                     |

---

## Description

The Venue's public profile showcases their identity, location, upcoming events, and gig opportunities (recruitment posts). Visibility is **gated by subscription status**: only active, paying Venues appear publicly. This design prevents abuse (spam venues) and protects the platform's reputation. Venue operators can edit their profile at any time; no moderation required. The profile serves as both a discovery mechanism and a booking marketplace.

---

## Affected Apps / Packages

| App / Package       | Role                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/api`          | GET /api/v1/venues/:id (public profile, subscription-gated), PUT /api/v1/venues/me (auth, venue role)                 |
| `apps/mobile`       | Public Venue Profile screen, Edit Profile screen (Venue persona), resend activation email UI, image picker and upload |
| `packages/shared`   | Venue profile types, validation schemas                                                                               |
| AWS S3 + CloudFront | Profile and cover image storage                                                                                       |
| Postmark            | Activation email with Stripe subscription link                                                                        |

---

## API Endpoints

### GET /api/v1/venues/:id

Fetch public venue profile. **Subscription-gated**: returns 404 if subscription_status != 'active' (unless requester is the venue owner viewing their own profile).

**Query Params:**

```
None
```

**Response (200 OK):**

```json
{
  "id": "venue-profile-uuid",
  "user_id": "user-uuid",
  "name": "The Brazen Head",
  "description": "Historic Dublin pub with traditional Irish music every night",
  "address": "20 Bridge Street Lower, Dublin 8",
  "county": "Dublin",
  "lat": 53.3444,
  "lng": -6.2739,
  "profile_image_url": "https://d123.cloudfront.net/profiles/venue-uuid-profile.jpg",
  "cover_image_url": "https://d123.cloudfront.net/profiles/venue-uuid-cover.jpg",
  "website_url": "https://brazenhead.com",
  "phone": "+353 1 679 5549",
  "social_links": {
    "instagram": "https://instagram.com/brazenhead",
    "facebook": "https://facebook.com/BrazenHeadDublin"
  },
  "is_active": true,
  "subscription_status": "active",
  "follower_count": 234,
  "created_at": "2026-02-01T10:00:00Z",
  "updated_at": "2026-03-20T15:30:00Z",
  "upcoming_events": [
    {
      "id": "event-uuid-1",
      "title": "Thursday Night Traditional Session",
      "date_start": "2026-03-27T20:00:00Z",
      "is_gig_opportunity": false,
      "status": "active"
    }
  ],
  "gig_opportunities": [
    {
      "id": "event-uuid-2",
      "title": "Easter Festival Performer Wanted",
      "date_start": "2026-04-15T18:00:00Z",
      "is_gig_opportunity": true,
      "status": "active"
    }
  ]
}
```

**Error Responses:**

- `404 Not Found` — Venue does not exist, subscription_status != 'active', or is_active = false
- `500 Internal Server Error` — Database error

---

### GET /api/v1/venues/:id (Venue Owner View)

When the authenticated user owns the venue, returns full profile including subscription status and activation message.

**Response (200 OK):**

```json
{
  "id": "venue-profile-uuid",
  "user_id": "user-uuid",
  "name": "The Brazen Head",
  "subscription_status": "inactive",
  "subscription_message": "Your profile is not yet visible to artists. Check your email to activate.",
  "activation_email_sent_at": "2026-03-23T10:00:00Z",
  ...rest of fields
}
```

---

### PUT /api/v1/venues/me

Update authenticated venue's own profile. Profile image upload is a separate presigned S3 request.

**Authentication:** Required, Venue role only

**Request Body:**

```json
{
  "name": "The Brazen Head",
  "description": "Historic Dublin pub with traditional Irish music",
  "address": "20 Bridge Street Lower, Dublin 8",
  "county": "Dublin",
  "lat": 53.3444,
  "lng": -6.2739,
  "profile_image_url": "https://d123.cloudfront.net/profiles/venue-uuid-profile.jpg",
  "cover_image_url": "https://d123.cloudfront.net/profiles/venue-uuid-cover.jpg",
  "website_url": "https://brazenhead.com",
  "phone": "+353 1 679 5549",
  "social_links": {
    "instagram": "https://instagram.com/brazenhead",
    "facebook": "https://facebook.com/BrazenHeadDublin"
  }
}
```

All fields optional. Only provided fields are updated.

**Response (200 OK):**

```json
{
  "id": "venue-profile-uuid",
  "user_id": "user-uuid",
  "name": "The Brazen Head",
  ...updated fields...
  "updated_at": "2026-03-23T12:50:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Invalid data (bad URL format, missing required fields)
- `401 Unauthorized` — Not authenticated or not in Venue persona
- `404 Not Found` — Venue profile does not exist
- `500 Internal Server Error` — Database error

---

### POST /api/v1/venues/me/resend-activation

Resend the Stripe subscription activation email. Used if the venue didn't receive the original email or lost it.

**Authentication:** Required, Venue owner only

**Request Body:**

```json
{}
```

**Response (200 OK):**

```json
{
  "message": "Activation email sent to your registered email address",
  "sent_at": "2026-03-23T13:00:00Z"
}
```

**Error Responses:**

- `400 Bad Request` — Venue already has active subscription (no need to resend)
- `401 Unauthorized` — Not authenticated or not venue owner
- `404 Not Found` — Venue profile not found
- `500 Internal Server Error` — Email service error

---

### GET /api/v1/upload/presigned?type=profile_image

Request a presigned S3 URL for uploading venue profile image. Image is stored in a user-scoped S3 prefix.

**Query Params:**

```
type=profile_image  (required)
```

**Response (200 OK):**

```json
{
  "upload_url": "https://ceolx-uploads.s3.amazonaws.com/venues/venue-uuid/profile.jpg?X-Amz-Algorithm=...",
  "cdn_url": "https://d123.cloudfront.net/profiles/venue-uuid-profile.jpg",
  "expires_in_seconds": 900
}
```

---

## Requirements

### Profile Display

- R1: Public profile displays name, description, address, county, lat/lng, profile_image_url, cover_image_url, website_url, phone, social_links, follower count
- R2: Venue profile **only visible if subscription_status = 'active'**; inactive/cancelled subscriptions return 404 to other users
- R3: Venue owner viewing their own inactive profile sees banner: "Your profile is not yet visible to artists. Check your email to activate." + Resend Email button
- R4: Upcoming events (status = active, date_start > now, is_gig_opportunity = false) listed chronologically
- R5: Gig opportunities (status = active, is_gig_opportunity = true) listed separately — visible to Artists only, hidden from Spectators
- R6: Address stored as free-text string (no structured address fields in V1); location coordinates (lat/lng) optional
- R7: Social links stored as flexible JSON object; no hard-coded list of allowed platforms
- R8: Profile images stored in AWS S3 via CloudFront CDN with 24h caching

### Profile Editing

- R9: Venue can edit all profile fields at any time without moderation
- R10: Edit Profile screen shows form with all fields prefilled from database
- R11: Profile image upload via presigned S3 URL (GET /api/v1/upload/presigned?type=profile_image)
- R12: After successful S3 upload, mobile calls PUT /api/v1/venues/me with new cdn_url to update database
- R13: Profile edits are NOT moderated — changes go live immediately

### Subscription Gating

- R14: subscription_status enum: 'inactive' | 'active' | 'cancelled'
- R15: Venue created via persona switch → subscription_status = 'inactive'
- R16: Postmark sends activation email with unclickable link text "ceolx.ie/subscribe" (no in-app URL; Apple Rule 3.1.1)
- R17: Email link is a standard web URL — user leaves the app, logs into Stripe via web browser on ceolx.ie/subscribe page
- R18: Stripe webhook (POST /api/v1/webhooks/stripe) confirms payment → updates subscription_status = 'active' in database
- R19: Resend Email button (POST /api/v1/venues/me/resend-activation) sends another activation email
- R20: Venue can switch away from Venue persona (is_active = false) but subscription remains active and billing continues

### Visibility & Access Control

- R21: Follow button visible on all profiles (venue cannot follow themselves)
- R22: Follower count displayed prominently
- R23: Switching away from Venue persona sets is_active = false; profile returns 404 publicly
- R24: Past approved events remain visible on the map/feed until their date passes, even if venue becomes inactive

### Role-Based UI

- R25: Edit Profile button visible only when viewing own venue profile as Venue persona
- R26: Spectators see read-only view; Artists see both upcoming events AND gig opportunities
- R27: Spectators do NOT see the Gig Opportunities section
- R28: Follow/Unfollow button state reflects real-time follow status

---

## Acceptance Criteria

### Public Profile Rendering

- [ ] Active venue profile displays all fields (name, description, address, images, contact info)
- [ ] Inactive subscription (subscription_status != 'active') returns 404 for other users
- [ ] Venue owner viewing own inactive profile sees banner with activation message + Resend Email button
- [ ] Upcoming events listed in chronological order (active events only, is_gig_opportunity = false)
- [ ] Gig opportunities section visible to Artists; hidden from Spectators
- [ ] Follower count displayed and updates after follow/unfollow
- [ ] Social media links render as clickable buttons/icons

### Profile Editing (Venue Only)

- [ ] Edit Profile button visible only when logged in as Venue viewing own profile
- [ ] Editing all fields saves immediately to database (no moderation)
- [ ] Profile image upload via presigned S3 URL works end-to-end
- [ ] Changes reflected on public profile page after refresh

### Subscription Gating

- [ ] New Venue created with subscription_status = 'inactive'
- [ ] Postmark email sent with activation link (plain text "ceolx.ie/subscribe", not clickable button)
- [ ] Clicking email link opens web browser to ceolx.ie/subscribe page
- [ ] After Stripe payment confirmed, webhook updates subscription_status = 'active' in database
- [ ] Profile becomes visible publicly after subscription activation
- [ ] Resend Email button triggers another activation email

### Image Upload

- [ ] GET /api/v1/upload/presigned?type=profile_image returns valid presigned URL (15 min expiry)
- [ ] Mobile uploads image directly to S3 (not through backend)
- [ ] CloudFront CDN URL returned and stored in database
- [ ] Old profile images remain in S3 (no cleanup in V1)

### Follow Integration

- [ ] Follow button functional on all venue profiles (except own)
- [ ] Follower count increments on follow, decrements on unfollow
- [ ] Attempting to follow self returns error

### Subscription Lifecycle

- [ ] Switching away from Venue persona sets is_active = false but keeps subscription active
- [ ] Subscription billing continues even if venue is inactive
- [ ] Venue can reactivate (switch back to Venue persona) and profile becomes public again

---

## Dependencies

- **Upstream**: M2-T4 (venue_profiles table), M1-T2 (database schema), M8-T1 (Stripe subscription), M10-T1 (presigned S3 URLs)
- **Downstream**: M6-T3 (Follow System), M6-T4 (Posts feed), M4-T1 (events linked to venue), M3-T4 (feed ranking uses venue profiles)
- **External services**: AWS S3 (image upload), CloudFront (CDN), Stripe (subscription), Postmark (activation email)

---

## Technical Notes

### Database Schema (venue_profiles)

```sql
CREATE TABLE venue_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  county TEXT,
  lat FLOAT8,
  lng FLOAT8,
  profile_image_url TEXT,
  cover_image_url TEXT,
  website_url TEXT,
  phone TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled')),
  stripe_customer_id TEXT,
  follower_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_user_venue UNIQUE(user_id)
);
CREATE INDEX idx_venue_subscription ON venue_profiles(subscription_status);
CREATE INDEX idx_venue_is_active ON venue_profiles(is_active);
```

### Hono Handler Example

```typescript
import { Hono } from "hono";
import { db } from "../db";
import { venueProfiles } from "../db/schema";
import { eq } from "drizzle-orm";
import { sendPostmarkEmail } from "../services/postmark";

const venueRouter = new Hono();

// GET /venues/:id
venueRouter.get("/:id", async (c) => {
  const venueId = c.req.param("id");
  const user = c.get("user"); // authenticated user, may be null

  const profile = await db
    .select()
    .from(venueProfiles)
    .where(eq(venueProfiles.id, venueId))
    .then((rows) => rows[0]);

  if (!profile) {
    return c.json({ error: "Venue not found" }, 404);
  }

  // Gating: if not the owner, check subscription_status
  const isOwner = user && user.id === profile.user_id;
  if (!isOwner && profile.subscription_status !== "active") {
    return c.json({ error: "Venue not found" }, 404);
  }

  // Fetch linked events
  const events = await db.query.events.findMany({
    where: eq(events.created_by, venueId),
  });

  const upcomingEvents = events.filter(
    (e) =>
      e.status === "active" &&
      !e.is_gig_opportunity &&
      new Date(e.date_start) > new Date(),
  );
  const gigOpportunities = events.filter(
    (e) => e.status === "active" && e.is_gig_opportunity,
  );

  return c.json({
    ...profile,
    upcoming_events: upcomingEvents,
    gig_opportunities: gigOpportunities,
  });
});

// PUT /venues/me
venueRouter.put("/me", async (c) => {
  const user = c.get("user");
  if (user.current_role !== "venue") {
    return c.json({ error: "Not in venue persona" }, 401);
  }

  const body = await c.req.json();

  const updated = await db
    .update(venueProfiles)
    .set({
      ...body,
      updated_at: new Date(),
    })
    .where(eq(venueProfiles.user_id, user.id))
    .returning()
    .then((rows) => rows[0]);

  return c.json(updated, 200);
});

// POST /venues/me/resend-activation
venueRouter.post("/me/resend-activation", async (c) => {
  const user = c.get("user");
  if (user.current_role !== "venue") {
    return c.json({ error: "Not in venue persona" }, 401);
  }

  const profile = await db
    .select()
    .from(venueProfiles)
    .where(eq(venueProfiles.user_id, user.id))
    .then((rows) => rows[0]);

  if (!profile) {
    return c.json({ error: "Venue profile not found" }, 404);
  }

  if (profile.subscription_status === "active") {
    return c.json({ error: "Subscription already active" }, 400);
  }

  // Resend activation email
  await sendPostmarkEmail({
    to: user.email,
    template: "venue-activation",
    data: {
      venue_name: profile.name,
      activation_link: "https://ceolx.ie/subscribe",
    },
  });

  return c.json({ message: "Activation email sent", sent_at: new Date() }, 200);
});

export default venueRouter;
```

### React Native Component (Edit Venue Profile)

```typescript
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Image, ScrollView, Alert, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';

export function EditVenueProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/venues/me');
      setProfile(response.data);
      setName(response.data.name);
      setDescription(response.data.description);
      setAddress(response.data.address);
      setCounty(response.data.county);
      setProfileImageUrl(response.data.profile_image_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const uploadProfileImage = async (imageUri) => {
    try {
      const presignedResponse = await api.get('/upload/presigned?type=profile_image');
      const { upload_url, cdn_url } = presignedResponse.data;

      const response = await fetch(imageUri);
      const blob = await response.blob();
      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      setProfileImageUrl(cdn_url);
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/venues/me', {
        name,
        description,
        address,
        county,
        profile_image_url: profileImageUrl,
      });
      Alert.alert('Success', 'Venue profile updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (profile?.subscription_status !== 'active') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Activate Your Venue</Text>
        <Text style={styles.message}>
          Your profile is not yet visible to artists. Check your email to activate.
        </Text>
        <Button title="Resend Activation Email" onPress={() => {
          api.post('/venues/me/resend-activation').then(() => {
            Alert.alert('Success', 'Email sent');
          });
        }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: profileImageUrl }} style={styles.profileImage} />
      <Button title="Change Profile Picture" onPress={async () => {
        const result = await ImagePicker.launchImageLibraryAsync();
        if (!result.canceled) {
          await uploadProfileImage(result.assets[0].uri);
        }
      }} />

      <TextInput placeholder="Venue Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Description" value={description} onChangeText={setDescription} style={styles.input} multiline />
      <TextInput placeholder="Address" value={address} onChangeText={setAddress} style={styles.input} />
      <TextInput placeholder="County" value={county} onChangeText={setCounty} style={styles.input} />

      <Button title="Save Venue Profile" onPress={handleSave} disabled={loading} />
    </ScrollView>
  );
}
```

### Common Gotchas

- **Subscription gating on every fetch**: Never cache subscription_status. Always check on GET /venues/:id because Stripe webhooks update status asynchronously.
- **Address as free-text**: Don't validate address format in V1. Store as-is and let Venue enter whatever they want.
- **Email link in Postmark**: The activation email should NOT have a clickable link button (Apple Rule 3.1.1). Use plain text "ceolx.ie/subscribe" so the Venue manually types it or copies it.
- **Inactive profiles return 404**: Even if is_active = false, the profile data stays in DB. Only return 404 publicly, not in internal queries.
- **Concurrent edits**: Last-write-wins is acceptable for V1 scale.
- **Profile owner still sees inactive profile**: When fetching own profile, always return full data including subscription_status and activation message, even if inactive.
