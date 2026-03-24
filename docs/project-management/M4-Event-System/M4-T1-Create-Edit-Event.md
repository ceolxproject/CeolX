# M4-T1 · Create Event + Edit Event (Artist & Venue)

| Field          | Value                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M4 — Event System                                                                                                           |
| **Status**     | 🔲 To Do                                                                                                                    |
| **Depends on** | M2-T4 (persona system), M1-T2 (events table + GIST index), M1-T3 (API scaffold), M10-T1 (S3 + CloudFront media)             |
| **PRD Ref**    | Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 9.3 (Event Data Model), Section 9.4 (Event Moderation) |

---

## Description

Artists and Venues (but not Spectators) can create new events and edit existing ones through the mobile app. Every new event automatically enters `pending_review` status and is invisible on the map/feed until the Super Admin approves it (see M4-T3). Creators can edit events in `draft`, `pending_review`, or `rejected` status — editing an `active` event is blocked (admin must reject it first to re-enter the submission flow). When a creator edits and resubmits a rejected event, the `rejection_reason` is cleared and the event re-enters `pending_review` for admin re-review. Event cover images are uploaded directly to AWS S3 via presigned URLs and served through CloudFront CDN. Location is captured via a tap-to-place mini-map (pin sets lat/lng) or free-text venue address fallback.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | POST /events (create), PUT /events/:id (edit), presigned S3 URL generation, validation, status transitions                          |
| `apps/mobile`     | Create Event form screen, Edit Event screen, image picker (expo-image-picker), embedded map (react-native-maps), image upload to S3 |
| `packages/shared` | Event and EventStatus types, category enum, validation schemas                                                                      |

---

## API Endpoints

### POST /api/v1/events

Create a new event.

**Request Body:**

```json
{
  "title": "string (required, max 150 chars)",
  "description": "string (optional, max 5000 chars)",
  "cover_image": "string (optional, CloudFront CDN URL after S3 upload)",
  "date_start": "ISO 8601 datetime (required)",
  "date_end": "ISO 8601 datetime (optional, must be >= date_start)",
  "lat": "number (required if venue_address is empty)",
  "lng": "number (required if venue_address is empty)",
  "venue_address": "string (optional, free-text fallback if no venue_id)",
  "venue_id": "UUID (optional, FK to venues table)",
  "category": "enum: 'trad_session' | 'ceili' | 'concert' | 'workshop' | 'competition' | ... (required)",
  "ticket_link": "string (optional, external URL only)",
  "is_gig_opportunity": "boolean (optional, default false, venue-only)",
  "collection_id": "UUID (optional, FK to collections, venue-only)",
  "collaborators": "array of artist profile UUIDs (optional)"
}
```

**Response (201 Created):**

```json
{
  "id": "evt_abc123def456",
  "created_by": "artist_or_venue_profile_id",
  "title": "Live at Temple Bar",
  "description": "...",
  "cover_image": "https://d1234.cloudfront.net/evt_abc123.jpg",
  "date_start": "2026-03-28T19:00:00Z",
  "date_end": "2026-03-28T23:00:00Z",
  "lat": 53.3432,
  "lng": -6.2545,
  "venue_address": "Temple Bar, Dublin",
  "venue_id": null,
  "category": "trad_session",
  "ticket_link": "https://ticketmaster.ie/...",
  "is_gig_opportunity": false,
  "collection_id": null,
  "collaborators": ["artist_001", "artist_002"],
  "status": "pending_review",
  "rejection_reason": null,
  "created_at": "2026-03-20T10:30:00Z",
  "updated_at": "2026-03-20T10:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Missing required fields or invalid input (validation errors returned in detail)
- `401 Unauthorized`: User not authenticated or does not have artist/venue persona
- `403 Forbidden`: User trying to create as an inactive persona (e.g., artist with `is_active: false`)
- `413 Payload Too Large`: Cover image exceeds size limit (max 10MB)

### PUT /api/v1/events/:id

Edit an existing event.

**Request Body:** Same structure as POST, but all fields optional (only provided fields are updated).

**Response (200 OK):** Updated event object (same structure as POST response).

**Error Responses:**

- `400 Bad Request`: Invalid input
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not the event creator, or event status is `active` or `archived`
- `404 Not Found`: Event not found

### GET /api/v1/events/:id/presigned-url

Get a presigned S3 URL for uploading cover image.

**Query Parameters:**

```json
{
  "filename": "string (original filename, e.g., 'photo.jpg')",
  "content_type": "string (MIME type, e.g., 'image/jpeg')"
}
```

**Response (200 OK):**

```json
{
  "upload_url": "https://ceolx-uploads.s3.eu-west-1.amazonaws.com/...?AWSAccessKeyId=...",
  "cdn_url": "https://d1234.cloudfront.net/evt_abc123def456/photo.jpg",
  "expiry": 3600
}
```

---

## Requirements

### Authentication & Authorization

- Verify JWT token is present and valid
- Confirm user has active artist or venue persona (M2-T4): `current_role = 'artist'` or `current_role = 'venue'` and respective profile is `is_active: true`
- For edits: verify user is the event creator or admin
- Spectators cannot create events

### Event Schema Validation

- `title`: Required, non-empty, max 150 characters, non-null
- `description`: Optional, max 5000 characters
- `date_start`: Required, ISO 8601 datetime, must be >= current time
- `date_end`: Optional, ISO 8601 datetime, if provided must be >= `date_start`
- `lat`: Required if `venue_address` is empty, valid float between -90 and 90
- `lng`: Required if `venue_address` is empty, valid float between -180 and 180
- `venue_address`: Optional, max 255 characters, free-text venue or location name
- `venue_id`: Optional, must be valid UUID and reference existing venue if provided
- `category`: Required, must exist in pre-seeded categories table (enum: trad_session, ceili, concert, workshop, competition, etc.)
- `ticket_link`: Optional, must be valid URL if provided
- `cover_image`: Optional, must be valid CloudFront CDN URL if provided
- `is_gig_opportunity`: Optional boolean, default false, only settable by venue persona
- `collection_id`: Optional, must be valid UUID and owned by the same venue if provided
- `collaborators`: Optional array of artist profile UUIDs, max 10, must all be valid

### Status Transitions

- On create: `status = pending_review` automatically (never `active`)
- On edit of rejected event + resubmit: `status = pending_review`, `rejection_reason = null`
- Edit only allowed if `status IN ('draft', 'pending_review', 'rejected')` — editing `active` or `archived` events is blocked
- Approval and archival are admin-only operations (M4-T3)

### Cover Image Upload

- Presigned URL generated server-side; mobile uploads directly to S3
- After upload, mobile calls PUT /events/:id with the CloudFront CDN URL (not raw S3 URL)
- Images stored in `s3://ceolx-uploads/events/{event_id}/{filename}`
- CloudFront distribution configured to serve from this path: `https://d1234.cloudfront.net/events/{event_id}/{filename}`
- Max file size: 10MB per image
- Supported formats: JPEG, PNG, WebP
- Old cover images are NOT deleted when replaced (manual cleanup via admin dashboard in future)

### Location Input

- Provide two UX paths: (1) Tap-to-place mini-map showing a pin, and (2) Free-text address/venue name search
- Mini-map embedded in the form, centered on user's current location (from M3-T2)
- User taps map to drop a pin; pin's lat/lng are auto-populated
- User can drag the pin to adjust
- Address search is optional convenience — if user doesn't use search, pin coordinates suffice
- Store both `lat/lng` (precise) and `venue_address` (human-readable) for UI flexibility

### Gig Opportunity Events

- `is_gig_opportunity: true` flag only editable by venue persona
- Artist cannot create gig opportunities; error if attempted
- Gig opportunities are visible to Artists on map/feed (they can apply, M5), hidden from Spectators

### Collaborators

- Artist can invite other artists to collaborate on an event
- Collaborator list is read-only from the attendee perspective; only creator can edit
- Collaborators appear on Event Detail screen with links to their profiles

---

## Acceptance Criteria

- [ ] Artist and Venue can open Create Event form on mobile
- [ ] Form includes fields: title, description, date (start/end), location (map + text), category, cover image, ticket link, collaborators
- [ ] All required fields enforced; validation errors shown inline (red border or error message under field)
- [ ] Cover image picker opens device camera roll; user selects image
- [ ] Image upload generates presigned S3 URL and uploads directly (no backend intermediate)
- [ ] Cover image preview shown in form after upload
- [ ] Location mini-map embedded and responsive; user can tap to drop a pin
- [ ] Pin coordinates captured as `lat` and `lng` (precise to 7 decimal places)
- [ ] User can enter venue address as free-text fallback
- [ ] Form submission calls POST /api/v1/events and validates response
- [ ] On success, event created with `status = pending_review` (not visible on map/feed yet)
- [ ] Creator receives confirmation: "Event submitted for review. You'll be notified when approved."
- [ ] Edit Event screen accessible from My Events (M4-T4) for draft/pending/rejected events
- [ ] Editing a rejected event clears the rejection reason on resubmission
- [ ] Attempting to edit an active event shows error: "You cannot edit a live event. Contact support if needed."
- [ ] Only the creator can edit their own event; other users receive 403 Forbidden
- [ ] `is_gig_opportunity` checkbox only visible to Venue persona in form
- [ ] Category dropdown pre-populated from backend categories list
- [ ] Collaborators can be searched and added (optional multi-select)
- [ ] Collection assignment available only for Venue persona (M4-T4)

---

## Dependencies

### Upstream

- **M1-T2** — Events table schema with GIST spatial index
- **M1-T3** — Hono API scaffold, authentication, input validation framework
- **M2-T4** — Persona system; create endpoint checks `current_role`
- **M10-T1** — AWS S3 setup, CloudFront CDN, presigned URL generation

### Downstream

- **M4-T2** — Event Detail screen displays created events
- **M4-T3** — Admin moderation queue polls pending_review events (this task creates them)
- **M3-T1** — Map view queries events; created events appear after admin approval
- **M3-T4** — Feed view ranks events; created events appear after approval

### External Services

- **AWS S3** — Image storage
- **AWS CloudFront** — CDN for image delivery

---

## Technical Notes

### S3 Presigned URL Generation (Hono Backend)

```typescript
// apps/api/src/routes/events.ts

import { Hono } from "hono";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: "eu-west-1" });

export const generatePresignedUrl = async (
  filename: string,
  contentType: string,
  eventId?: string,
): Promise<{ uploadUrl: string; cdnUrl: string; expiry: number }> => {
  const fileId = uuidv4();
  const key = `events/${eventId || "temp"}/${fileId}_${filename}`;

  const command = new PutObjectCommand({
    Bucket: "ceolx-uploads",
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  const cdnUrl = `https://d1234.cloudfront.net/${key}`;

  return {
    uploadUrl,
    cdnUrl,
    expiry: 3600,
  };
};

// GET /events/presigned-url endpoint
app.get("/events/presigned-url", async (c) => {
  const auth = await requireAuth(c);
  const filename = c.req.query("filename");
  const contentType = c.req.query("content_type") || "image/jpeg";

  if (!filename) {
    return c.json({ error: "filename required" }, 400);
  }

  const result = await generatePresignedUrl(filename, contentType);
  return c.json(result);
});
```

### Create Event Handler (Hono)

```typescript
// apps/api/src/routes/events.ts

import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const EventCreateSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(5000).optional(),
  cover_image: z.string().url().optional(),
  date_start: z.string().datetime(),
  date_end: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  venue_address: z.string().max(255).optional(),
  venue_id: z.string().uuid().optional(),
  category: z.enum([
    "trad_session",
    "ceili",
    "concert",
    "workshop",
    "competition",
  ]),
  ticket_link: z.string().url().optional(),
  is_gig_opportunity: z.boolean().optional().default(false),
  collection_id: z.string().uuid().optional(),
  collaborators: z.array(z.string().uuid()).max(10).optional(),
});

app.post("/events", zValidator("json", EventCreateSchema), async (c) => {
  const auth = await requireAuth(c);
  const data = c.req.valid("json");

  // Verify artist or venue persona
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, auth.user.id),
  });

  if (!user || !["artist", "venue"].includes(user.current_role)) {
    return c.json({ error: "Only artists or venues can create events" }, 403);
  }

  // Validate location
  if (!data.lat || !data.lng) {
    if (!data.venue_address) {
      return c.json({ error: "Either lat/lng or venue_address required" }, 400);
    }
  }

  // Venue-only fields
  if (data.is_gig_opportunity && user.current_role !== "venue") {
    return c.json({ error: "Only venues can create gig opportunities" }, 403);
  }

  // Create event
  const event = await db
    .insert(events)
    .values({
      created_by:
        user.current_role === "artist"
          ? (await getArtistProfile(user.id)).id
          : (await getVenueProfile(user.id)).id,
      title: data.title,
      description: data.description || null,
      cover_image: data.cover_image || null,
      date_start: new Date(data.date_start),
      date_end: data.date_end ? new Date(data.date_end) : null,
      lat: data.lat || null,
      lng: data.lng || null,
      venue_address: data.venue_address || null,
      venue_id: data.venue_id || null,
      category: data.category,
      ticket_link: data.ticket_link || null,
      is_gig_opportunity: data.is_gig_opportunity || false,
      collection_id: data.collection_id || null,
      status: "pending_review",
      rejection_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning();

  // Add collaborators (optional)
  if (data.collaborators && data.collaborators.length > 0) {
    await db.insert(event_collaborators).values(
      data.collaborators.map((collab_id) => ({
        event_id: event[0].id,
        artist_id: collab_id,
      })),
    );
  }

  setResponseStatus(c, 201);
  return c.json(event[0]);
});
```

### Edit Event Handler (Hono)

```typescript
app.put(
  "/events/:id",
  zValidator("json", EventCreateSchema.partial()),
  async (c) => {
    const auth = await requireAuth(c);
    const eventId = c.req.param("id");
    const data = c.req.valid("json");

    // Fetch event and verify ownership
    const event = await db.query.events.findFirst({
      where: (events, { eq }) => eq(events.id, eventId),
    });

    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }

    if (event.created_by !== auth.user.id) {
      return c.json({ error: "You can only edit your own events" }, 403);
    }

    // Check status
    if (!["draft", "pending_review", "rejected"].includes(event.status)) {
      return c.json(
        { error: `Cannot edit event with status ${event.status}` },
        403,
      );
    }

    // Update event
    const updated = await db
      .update(events)
      .set({
        title: data.title !== undefined ? data.title : event.title,
        description:
          data.description !== undefined ? data.description : event.description,
        cover_image:
          data.cover_image !== undefined ? data.cover_image : event.cover_image,
        date_start: data.date_start
          ? new Date(data.date_start)
          : event.date_start,
        date_end: data.date_end ? new Date(data.date_end) : event.date_end,
        lat: data.lat !== undefined ? data.lat : event.lat,
        lng: data.lng !== undefined ? data.lng : event.lng,
        venue_address:
          data.venue_address !== undefined
            ? data.venue_address
            : event.venue_address,
        category: data.category !== undefined ? data.category : event.category,
        ticket_link:
          data.ticket_link !== undefined ? data.ticket_link : event.ticket_link,
        status: event.status === "rejected" ? "pending_review" : event.status,
        rejection_reason:
          event.status === "rejected" ? null : event.rejection_reason,
        updated_at: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    return c.json(updated[0]);
  },
);
```

### Create Event Screen (React Native)

```typescript
// apps/mobile/src/screens/CreateEventScreen.tsx

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useUserLocation } from '../hooks/useLocationPermission';

export const CreateEventScreen: React.FC = () => {
  const { user } = useAuth();
  const { location } = useUserLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [mapPin, setMapPin] = useState<{ lat: number; lng: number } | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [category, setCategory] = useState('trad_session');
  const [ticketLink, setTicketLink] = useState('');
  const [isGigOpportunity, setIsGigOpportunity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      await uploadImageToS3(asset.uri, asset.fileName || 'image.jpg');
    }
  };

  const uploadImageToS3 = async (uri: string, filename: string) => {
    try {
      // Get presigned URL
      const presignedRes = await api.get('/events/presigned-url', {
        params: {
          filename,
          content_type: 'image/jpeg',
        },
      });

      // Upload to S3
      const response = await fetch(presignedRes.data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: await fetch(uri).then((r) => r.blob()),
      });

      if (response.ok) {
        setCoverImage(presignedRes.data.cdn_url);
      } else {
        Alert.alert('Upload failed', 'Could not upload image to S3');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleMapPress = (e: any) => {
    setMapPin({
      lat: e.nativeEvent.coordinate.latitude,
      lng: e.nativeEvent.coordinate.longitude,
    });
  };

  const handleSubmit = async () => {
    // Validate
    const newErrors: Record<string, string> = {};
    if (!title) newErrors.title = 'Title required';
    if (!dateStart) newErrors.dateStart = 'Start date required';
    if (!mapPin && !venueAddress) newErrors.location = 'Location required (map or address)';
    if (!category) newErrors.category = 'Category required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await api.post('/events', {
        title,
        description,
        cover_image: coverImage,
        date_start: new Date(dateStart).toISOString(),
        date_end: dateEnd ? new Date(dateEnd).toISOString() : null,
        lat: mapPin?.lat || null,
        lng: mapPin?.lng || null,
        venue_address: venueAddress,
        category,
        ticket_link: ticketLink || null,
        is_gig_opportunity: isGigOpportunity,
      });

      Alert.alert('Success', 'Event submitted for review!');
      // Navigate back
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Event Title *</Text>
      <TextInput
        style={[styles.input, errors.title && styles.inputError]}
        placeholder="Enter event title"
        value={title}
        onChangeText={setTitle}
        maxLength={150}
      />
      {errors.title && <Text style={styles.error}>{errors.title}</Text>}

      {/* Similar fields for description, dates, category, etc. */}

      <Text style={styles.label}>Location (Tap Map) *</Text>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location?.lat || 53.1424,
          longitude: location?.lng || -7.6921,
          latitudeDelta: 0.2,
          longitudeDelta: 0.2,
        }}
        onPress={handleMapPress}
      >
        {mapPin && (
          <Marker
            coordinate={{ latitude: mapPin.lat, longitude: mapPin.lng }}
            draggable
            onDragEnd={(e) =>
              setMapPin({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              })
            }
          />
        )}
      </MapView>
      {mapPin && (
        <Text style={styles.info}>
          Location: {mapPin.lat.toFixed(4)}, {mapPin.lng.toFixed(4)}
        </Text>
      )}

      <Text style={styles.label}>Or Enter Address</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Temple Bar, Dublin"
        value={venueAddress}
        onChangeText={setVenueAddress}
      />

      <Text style={styles.label}>Cover Image</Text>
      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.buttonText}>
          {coverImage ? 'Change Image' : 'Pick Image'}
        </Text>
      </TouchableOpacity>
      {coverImage && (
        <Image source={{ uri: coverImage }} style={styles.previewImage} />
      )}

      {/* Gig opportunity checkbox for venues only */}
      {user?.current_role === 'venue' && (
        <View style={styles.checkboxRow}>
          <TouchableOpacity
            onPress={() => setIsGigOpportunity(!isGigOpportunity)}
            style={styles.checkbox}
          >
            <Text>{isGigOpportunity ? '☑' : '☐'}</Text>
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>This is a gig opportunity</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Event</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  inputError: { borderColor: '#D32F2F' },
  error: { color: '#D32F2F', fontSize: 12, marginTop: 4 },
  map: { width: '100%', height: 250, marginVertical: 12, borderRadius: 8 },
  info: { fontSize: 12, color: '#666', marginVertical: 8 },
  imageButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontWeight: '600' },
  previewImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 12 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  checkbox: { marginRight: 8 },
  checkboxLabel: { fontSize: 14 },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 24,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
```

### Common Gotchas

- **Image upload race condition**: If user submits form before image upload completes, the cover_image field will be null. Show a "Uploading image..." state or block form submission until upload finishes.
- **Date validation**: Ensure `date_end` >= `date_start`. Some users might enter end time before start time; the API should reject this clearly.
- **Lat/lng precision**: Storing as `numeric(10,7)` gives 7 decimal places (~1.1cm precision globally). For Irish locations, this is overkill but acceptable.
- **Gig opportunity visibility**: Ensure the `is_gig_opportunity` flag is never exposed in the UI for artists to set — only venues should see the checkbox.
- **Collaborators list**: If adding >10 collaborators, API rejects with 400. Show clear error in mobile UI.
- **S3 presigned URL expiry**: Set expiry to 3600 seconds (1 hour). If user takes longer to upload, URL expires; regenerate on-demand.
