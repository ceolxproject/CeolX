# M1-T2 · Neon Database Setup + Drizzle Schema (All 14 Tables)

| Field          | Value                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                             |
| **Status**     | 🔲 To Do                                                                        |
| **Depends on** | M1-T1 (Git branches must exist, shared enums defined)                           |
| **PRD Ref**    | Section 9.3 (Event Data Model), Section 10.1 (Tech Stack), Section 4 (Personas) |

---

## Description

Define the complete database schema for all 14 tables before any feature development begins. This task establishes the structural foundation on which every API endpoint, mobile screen, and admin feature is built. Schema changes after M2 is complete are expensive and break dependent code. All tables must be defined with correct column types, nullability, foreign key constraints, composite unique constraints, and indexes — the database design reflects the business logic of CeolX.

Neon PostgreSQL is configured with three isolated environments (dev, staging, prod) that mirror the Git branch strategy. Drizzle ORM, a TypeScript-first relational query builder, is used for type-safe migrations and runtime queries. The schema includes 14 tables: 3 for user management (users, artist_profiles, venue_profiles), 3 for events (events, collections, saved_events), 4 for social features (posts, comments, post_likes, follows), 1 for booking management, 1 for subscriptions, and 2 for notifications and device tokens. Spatial indexing on the events table enables fast bounding-box queries for the map feature.

---

## Affected Apps / Packages

- `apps/api` — Drizzle ORM schema files live here; database connection, migrations, type generation
- `packages/shared` — Enums (EventStatus, UserRole, etc.) used in schema definitions and exported

---

## API Endpoints

None — this is a schema/infrastructure task. No HTTP endpoints created here.

---

## Requirements

### Core User Tables Setup

- `users` table created with columns: `id` (UUID primary key), `email` (unique, varchar), `name` (varchar, nullable), `avatar` (URL string, nullable), `hashed_password` (varchar, nullable — null for OAuth users), `current_role` (enum: spectator|artist|venue|super_admin), `last_login_at` (timestamp, nullable), `flagged_inactive` (boolean, default false), `consent_at` (timestamp — when Privacy Policy + ToS accepted), `marketing_consent` (boolean), `created_at` (timestamp), `updated_at` (timestamp)
- `artist_profiles` table created with columns: `id` (UUID primary key), `user_id` (FK to users, unique), `stage_name` (varchar), `bio` (text, nullable), `genre` (varchar — single genre for V1), `links` (JSON array of social/website links, nullable), `is_active` (boolean, default true), `created_at` (timestamp), `updated_at` (timestamp)
- `venue_profiles` table created with columns: `id` (UUID primary key), `user_id` (FK to users, unique), `venue_name` (varchar), `address` (varchar), `bio` (text, nullable), `subscription_status` (enum: inactive|active|past_due|cancelled, default inactive), `stripe_customer_id` (varchar, nullable), `is_active` (boolean, default false — not visible until subscription active), `created_at` (timestamp), `updated_at` (timestamp)

### Event Tables Setup

- `events` table created with columns: `id` (UUID primary key), `title` (varchar), `description` (text), `cover_image` (S3 URL string, nullable), `date_start` (timestamp), `date_end` (timestamp, nullable), `lat` (numeric(10,7)), `lng` (numeric(10,7)), `venue_id` (FK to venue_profiles, nullable), `venue_address` (text, nullable), `category` (varchar — e.g., "Traditional", "Contemporary", "Fusion"), `ticket_link` (URL string, nullable), `is_gig_opportunity` (boolean, default false), `collection_id` (FK to collections, nullable), `created_by` (FK to users), `status` (enum: draft|pending_review|rejected|active|archived), `rejection_reason` (text, nullable — populated only when status = rejected), `view_count` (integer, default 0), `created_at` (timestamp), `updated_at` (timestamp)
- `collections` table created with columns: `id` (UUID primary key), `name` (varchar — e.g., "Summer Festival 2026"), `description` (text, nullable), `logo` (S3 URL string, nullable), `created_by` (FK to venue_profiles), `created_at` (timestamp), `updated_at` (timestamp)
- `saved_events` table created with columns: `id` (UUID primary key), `user_id` (FK to users), `event_id` (FK to events), `created_at` (timestamp) — composite unique constraint on (user_id, event_id)

### Social Tables Setup

- `posts` table created with columns: `id` (UUID primary key), `created_by` (FK to users), `caption` (text), `media_type` (enum: image|video|audio|text), `media_url` (URL string, nullable — null for text-only posts), `like_count` (integer, default 0, denormalized for fast feed ranking), `deleted_at` (timestamp, nullable — soft delete), `created_at` (timestamp), `updated_at` (timestamp)
- `comments` table created with columns: `id` (UUID primary key), `post_id` (FK to posts), `user_id` (FK to users), `body` (text), `deleted_at` (timestamp, nullable — soft delete, display as "Comment deleted"), `created_at` (timestamp), `updated_at` (timestamp)
- `post_likes` table created with columns: `id` (UUID primary key), `post_id` (FK to posts), `user_id` (FK to users), `created_at` (timestamp) — composite unique constraint on (post_id, user_id)
- `follows` table created with columns: `id` (UUID primary key), `follower_id` (FK to users), `followee_id` (FK to users), `created_at` (timestamp) — composite unique constraint on (follower_id, followee_id)

### Booking Table Setup

- `bookings` table created with columns: `id` (UUID primary key), `artist_id` (FK to artist_profiles), `venue_id` (FK to venue_profiles), `event_id` (FK to events, nullable — may be a general inquiry not tied to a specific event), `status` (enum: pending|accepted|rejected|cancelled), `direction` (enum: venue_to_artist|artist_to_venue), `created_at` (timestamp), `updated_at` (timestamp)

### Subscription Table Setup

- `venue_subscriptions` table created with columns: `id` (UUID primary key), `venue_id` (FK to venue_profiles), `stripe_customer_id` (varchar), `stripe_subscription_id` (varchar), `plan` (enum: lite|pro — for future feature gating), `status` (enum: inactive|active|past_due|cancelled), `current_period_start` (timestamp), `current_period_end` (timestamp), `created_at` (timestamp), `updated_at` (timestamp)

### Notification & Device Tables Setup

- `notifications` table created with columns: `id` (UUID primary key), `user_id` (FK to users), `type` (varchar — e.g., "event_approved", "booking_invitation"), `payload` (JSONB — includes `persona` (role), `route` (deep link), `action` (optional)), `read` (boolean, default false), `created_at` (timestamp)
- `device_tokens` table created with columns: `id` (UUID primary key), `user_id` (FK to users), `fcm_token` (text), `platform` (enum: ios|android), `created_at` (timestamp), `updated_at` (timestamp) — composite unique constraint on (user_id, fcm_token)

### Indexes & Constraints

- GIST spatial index on `events(lat, lng)` for fast bounding-box map queries (essential for M3-T1)
- B-tree index on `events(status, date_start)` for filtering active, upcoming events in feed/map queries
- B-tree index on `events(created_by, status)` for creator's event list
- B-tree index on `notifications(user_id, read)` for unread notification count and filtering
- B-tree index on `bookings(artist_id, status)` for artist's bookings tab
- B-tree index on `bookings(venue_id, status)` for venue's bookings tab
- Composite unique constraint on `saved_events(user_id, event_id)` to prevent duplicate saves
- Composite unique constraint on `post_likes(post_id, user_id)` to prevent duplicate likes (essential for idempotent like/unlike)
- Composite unique constraint on `follows(follower_id, followee_id)` to prevent duplicate follows
- Composite unique constraint on `device_tokens(user_id, fcm_token)` to prevent duplicate tokens per device
- Foreign key constraints on all FK columns with `ON DELETE CASCADE` or `ON DELETE RESTRICT` as appropriate
- Check constraint on `events`: `date_end IS NULL OR date_end >= date_start` to prevent invalid date ranges
- Check constraint on `lat, lng`: values must be valid for Irish coordinates (lat 51–55, lng -11 to -5)

---

## Acceptance Criteria

- [ ] All 14 tables created in Neon dev database and verified via `psql` or Neon console
- [ ] All enum columns use proper PostgreSQL `CREATE TYPE ... AS ENUM` or Drizzle enum equivalents
- [ ] GIST spatial index on `events(lat, lng)` created and verified with `\d events` command
- [ ] Composite unique constraints verified on `saved_events`, `post_likes`, `follows`, `device_tokens`
- [ ] Foreign key constraints verified on all FK columns
- [ ] `drizzle-kit generate` produces clean migration SQL with no errors or warnings
- [ ] Migration runs successfully on Neon dev branch; all tables and indexes confirmed created
- [ ] `EXPLAIN ANALYSE` on bounding-box query shows GIST index being used: `WHERE lat BETWEEN x AND y AND lng BETWEEN a AND b`
- [ ] Sample data inserted into `users`, `artist_profiles`, `venue_profiles`, `events` for manual testing
- [ ] Drizzle type generation (`drizzle-kit generate`) produces correct TypeScript types in `drizzle/generated/` or similar

---

## Technical Notes

### Drizzle Schema File Structure

```typescript
// apps/api/src/db/schema.ts

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  json,
  jsonb,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "spectator",
  "artist",
  "venue",
  "super_admin",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "pending_review",
  "rejected",
  "active",
  "archived",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);

export const bookingDirectionEnum = pgEnum("booking_direction", [
  "venue_to_artist",
  "artist_to_venue",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "inactive",
  "active",
  "past_due",
  "cancelled",
]);

export const mediaTypeEnum = pgEnum("media_type", [
  "image",
  "video",
  "audio",
  "text",
]);

export const platformEnum = pgEnum("platform", ["ios", "android"]);

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    avatar: text("avatar"),
    hashedPassword: varchar("hashed_password", { length: 255 }),
    currentRole: userRoleEnum("current_role").notNull().default("spectator"),
    lastLoginAt: timestamp("last_login_at"),
    flaggedInactive: boolean("flagged_inactive").default(false),
    consentAt: timestamp("consent_at").notNull(),
    marketingConsent: boolean("marketing_consent").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

// Artist profiles table
export const artistProfiles = pgTable("artist_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stageName: varchar("stage_name", { length: 255 }).notNull(),
  bio: text("bio"),
  genre: varchar("genre", { length: 100 }).notNull(),
  links: json("links"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Venue profiles table
export const venueProfiles = pgTable("venue_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  venueName: varchar("venue_name", { length: 255 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  bio: text("bio"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status")
    .notNull()
    .default("inactive"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Events table
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    coverImage: text("cover_image"),
    dateStart: timestamp("date_start").notNull(),
    dateEnd: timestamp("date_end"),
    lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
    lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),
    venueId: uuid("venue_id").references(() => venueProfiles.id, {
      onDelete: "set null",
    }),
    venueAddress: text("venue_address"),
    category: varchar("category", { length: 100 }).notNull(),
    ticketLink: text("ticket_link"),
    isGigOpportunity: boolean("is_gig_opportunity").default(false),
    collectionId: uuid("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: eventStatusEnum("status").notNull().default("draft"),
    rejectionReason: text("rejection_reason"),
    viewCount: integer("view_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Spatial index for map bounding-box queries
    spatialIdx: index("events_spatial_idx")
      .using("gist", sql`(ll_to_earth(${table.lat}, ${table.lng}))`)
      .where(sql`${table.status} = 'active'`),
    statusDateIdx: index("events_status_date_idx").on(
      table.status,
      table.dateStart,
    ),
    createdByIdx: index("events_created_by_idx").on(table.createdBy),
  }),
);

// Collections table
export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logo: text("logo"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => venueProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved events table
export const savedEvents = pgTable(
  "saved_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserEvent: uniqueIndex("saved_events_user_event_unique").on(
      table.userId,
      table.eventId,
    ),
  }),
);

// Posts table
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caption: text("caption").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    mediaUrl: text("media_url"),
    likeCount: integer("like_count").default(0),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    createdByIdx: index("posts_created_by_idx").on(table.createdBy),
  }),
);

// Comments table
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index("comments_post_id_idx").on(table.postId),
  }),
);

// Post likes table
export const postLikes = pgTable(
  "post_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniquePostUser: uniqueIndex("post_likes_post_user_unique").on(
      table.postId,
      table.userId,
    ),
  }),
);

// Follows table
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueFollowerFollowee: uniqueIndex("follows_follower_followee_unique").on(
      table.followerId,
      table.followeeId,
    ),
  }),
);

// Bookings table
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venueProfiles.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    direction: bookingDirectionEnum("direction").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    artistStatusIdx: index("bookings_artist_status_idx").on(
      table.artistId,
      table.status,
    ),
    venueStatusIdx: index("bookings_venue_status_idx").on(
      table.venueId,
      table.status,
    ),
  }),
);

// Venue subscriptions table
export const venueSubscriptions = pgTable("venue_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .unique()
    .references(() => venueProfiles.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", {
    length: 255,
  }).notNull(),
  plan: varchar("plan", { length: 50 }).notNull().default("lite"),
  status: subscriptionStatusEnum("status").notNull().default("inactive"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notifications table
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    read: boolean("read").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.read,
    ),
  }),
);

// Device tokens table
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fcmToken: text("fcm_token").notNull(),
    platform: platformEnum("platform").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserToken: uniqueIndex("device_tokens_user_token_unique").on(
      table.userId,
      table.fcmToken,
    ),
  }),
);
```

### Spatial Index Setup (PostGIS Alternative)

For high-scale production, PostGIS would be ideal, but for V1 under 1,000 users, a simple numeric index suffices. The GIST index on `(ll_to_earth(lat, lng))` provides efficient bounding-box queries without PostGIS overhead.

Example bounding-box query that uses the index:

```sql
SELECT * FROM events
WHERE status = 'active'
  AND lat BETWEEN 53.0 AND 54.0
  AND lng BETWEEN -8.5 AND -7.5
ORDER BY date_start DESC;
```

### Database Migrations Workflow

```bash
# Generate migration from schema changes
cd apps/api
drizzle-kit generate:pg --out ./drizzle

# Apply migration to current environment
npm run db:push  # or drizzle-kit push:pg

# View migration history
drizzle-kit studio:pg
```

### Denormalization Strategy

- `posts.like_count` — denormalized integer, incremented on like/decremented on unlike for fast feed sorting
- `venue_profiles.subscription_status` — denormalized from `venue_subscriptions.status`, updated by Stripe webhook handler (M8-T2)
- `events.view_count` — incremented on each `GET /events/:id` for analytics (M11-T3)

---

## Common Gotchas

- **Lat/lng precision**: Use `numeric(10,7)` for sufficient decimal places (~1.1 meter precision); float types lose precision
- **Spatial index only on active events**: The GIST index includes a WHERE clause (`WHERE status = 'active'`) to avoid indexing draft/archived events
- **Soft deletes require `deleted_at` checks**: Always filter `WHERE deleted_at IS NULL` when querying posts and comments
- **Cascade deletes**: FK columns have `ON DELETE CASCADE` where appropriate (e.g., deleting a user deletes their artist profile); be cautious with deletion operations
- **Enum case sensitivity**: PostgreSQL enums are case-sensitive; store as lowercase strings and convert in application layer
- **Foreign key conflicts on profile tables**: `artist_profiles.user_id` and `venue_profiles.user_id` are unique to prevent duplicate profiles; switching personas requires deactivating the old profile, not deleting it
- **Neon branch sync**: Always ensure the Git branch and Neon database branch match; accidental schema drift across environments causes production issues
- **GIST index query tuning**: Test bounding-box queries with `EXPLAIN ANALYSE` to confirm index usage; if not using index, increase the bounding-box size slightly

---
