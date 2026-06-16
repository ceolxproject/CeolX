# Artist Co-Artist Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Artist invite other artists (platform + outside-platform) on the event form, in parity with the Venue invite flow, backed by the bookings model.

**Architecture:** Extend the `bookings` table with a nullable `venue_id`, a new `inviter_artist_id`, and an `artist_to_artist` direction. Reuse `event_collaborators` and the booking accept/reject state machine. Ungate the platform-invite path in the event router for artist creators, make the Requests Sent/Received tabs participation-based, add 5 artist↔artist notification triggers, and render the co-artist (not a venue) on the Requests card.

**Tech Stack:** Drizzle ORM + Postgres (Neon), tRPC (Hono), Zod, Vitest, React Native (Expo), `@CeolX/shared`.

**Spec:** `docs/superpowers/specs/2026-06-05-artist-coartist-invites-design.md`

---

## File Structure

| File                                                             | Responsibility                                                   | Action |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| `packages/shared/src/enums.ts`                                   | `artist_to_artist` booking direction                             | Modify |
| `packages/shared/src/types.ts`                                   | `BookingSummary` inviter fields + `viewerIsSender`               | Modify |
| `packages/shared/src/notifications/triggers.ts`                  | 5 a2a notification triggers                                      | Modify |
| `packages/db/src/schema/bookings.ts`                             | nullable `venue_id`, `inviter_artist_id`, index, relation        | Modify |
| `packages/db/src/migrations/*`                                   | generated migration + hand-written enum/constraint SQL           | Create |
| `packages/api/src/routers/events/crud.ts`                        | artist invite branch + self/dedup guards                         | Modify |
| `packages/api/src/routers/bookings.ts`                           | `update` auth/trigger, `list` tabs, `byId` auth, summary mapping | Modify |
| `apps/native/components/events/BasicDetailsStep.tsx`             | ungate `InviteArtistPicker`, pass self id                        | Modify |
| `apps/native/components/events/InviteArtistPicker.tsx`           | exclude self from results                                        | Modify |
| `apps/native/components/requests/RequestCard.tsx`                | a2a counterpart resolution                                       | Modify |
| `apps/native/components/requests/RequestActions.tsx`             | a2a sender/recipient button gating                               | Modify |
| `apps/native/app/(app)/events/create.tsx` + `edit/[eventId].tsx` | pass `myUserId` to step                                          | Modify |

**Commit convention (commitlint):** emoji prefix + `type(scope): lowercase subject`. Valid scopes include `shared`, `db` (→ `database`? use actual dir name), `api` (→ package scope), `native`, and meta `docs`. Packages map to `<dir>-pkg` when an app of the same name exists; here use `shared`, `api`, `native`, and `database` per `packages/` dir names. Verify the exact scope with `node -e "import('./commitlint.config.js')"` if a commit is rejected. End every commit body with the `Co-Authored-By` trailer.

---

## Phase 1 — Shared foundation

### Task 1: Add `artist_to_artist` booking direction

**Files:**

- Modify: `packages/shared/src/enums.ts:41-46`
- Test: `packages/shared/src/notifications/__tests__/triggers.test.ts` (existing) — direction is exercised indirectly; add a focused assertion file is unnecessary.

- [ ] **Step 1: Modify the enum**

In `packages/shared/src/enums.ts`, change:

```ts
export const BOOKING_DIRECTIONS = [
  'venue_to_artist',
  'artist_to_venue',
  'artist_to_artist',
] as const;
export type BookingDirection = (typeof BOOKING_DIRECTIONS)[number];
export const BookingDirection = {
  VENUE_TO_ARTIST: 'venue_to_artist',
  ARTIST_TO_VENUE: 'artist_to_venue',
  ARTIST_TO_ARTIST: 'artist_to_artist',
} as const satisfies Record<string, BookingDirection>;
```

- [ ] **Step 2: Typecheck shared**

Run: `pnpm --filter @CeolX/shared run build` (or `pnpm -w turbo run typecheck --filter=@CeolX/shared`)
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/enums.ts
git commit -m "$(cat <<'EOF'
✨ feat(shared): add artist_to_artist booking direction

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: Extend `BookingSummary` with inviter fields + `viewerIsSender`

**Files:**

- Modify: `packages/shared/src/types.ts:102-122`

The Requests card cannot tell sender from recipient for an artist↔artist row by role alone (both parties are artists). The server knows the caller, so it provides `viewerIsSender`. The inviter's display fields let the card show the correct counterpart.

- [ ] **Step 1: Add the optional fields**

In `packages/shared/src/types.ts`, inside `interface BookingSummary`, after `venueImage?: string;` add:

```ts
  /** Inviting artist — populated only for artist_to_artist rows. */
  inviterArtistId?: string;
  inviterArtistName?: string;
  inviterArtistImage?: string;
  /**
   * Whether the viewer initiated this booking. Server-computed per request.
   * Used by the Requests card/actions for artist_to_artist rows where role +
   * direction alone cannot distinguish sender from recipient. Undefined for
   * venue↔artist rows (the card falls back to role/direction).
   */
  viewerIsSender?: boolean;
```

- [ ] **Step 2: Typecheck shared**

Run: `pnpm --filter @CeolX/shared run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "$(cat <<'EOF'
✨ feat(shared): add inviter + viewerIsSender fields to BookingSummary

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Notification triggers

### Task 3: Add 5 artist↔artist notification triggers

**Files:**

- Modify: `packages/shared/src/notifications/triggers.ts` (enum block ~line 30; registry block ~line 79)
- Test: `packages/shared/src/notifications/__tests__/triggers.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `triggers.test.ts`:

```ts
import { buildNotification, NotificationTrigger, NotificationSurface } from '../triggers';

describe('artist↔artist booking triggers', () => {
  const vars = {
    bookingId: 'b1',
    coArtistName: 'Tune Bomb',
    eventTitle: 'Trad Night',
    date: 'Fri 6 Jun',
  };

  it('builds the co-artist invite push with the inviter name', () => {
    const n = buildNotification(
      NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
      NotificationSurface.PUSH,
      vars
    );
    expect(n.body).toContain('Tune Bomb');
    expect(n.route).toBe('/(app)/(tabs)/bookings/b1');
    expect(n.persona).toBe('artist');
  });

  it('builds accepted / rejected / withdrawn / cancelled to-artist copy', () => {
    for (const trigger of [
      NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER,
      NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER,
      NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE,
      NotificationTrigger.BOOKING_COARTIST_CANCELLED,
    ]) {
      const n = buildNotification(trigger, NotificationSurface.IN_APP, vars);
      expect(n.body).toContain('Tune Bomb');
      expect(n.persona).toBe('artist');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @CeolX/shared exec vitest run src/notifications/__tests__/triggers.test.ts`
Expected: FAIL — `BOOKING_INVITE_TO_COARTIST` is undefined.

- [ ] **Step 3: Add the trigger IDs**

In `triggers.ts`, inside the `NotificationTrigger` object (after `BOOKING_CANCELLED_TO_VENUE`):

```ts
  BOOKING_INVITE_TO_COARTIST: 'booking_invite_to_coartist',
  BOOKING_COARTIST_ACCEPTED_TO_INVITER: 'booking_coartist_accepted_to_inviter',
  BOOKING_COARTIST_REJECTED_TO_INVITER: 'booking_coartist_rejected_to_inviter',
  BOOKING_COARTIST_WITHDRAWN_TO_INVITEE: 'booking_coartist_withdrawn_to_invitee',
  BOOKING_COARTIST_CANCELLED: 'booking_coartist_cancelled',
```

- [ ] **Step 4: Add the registry entries**

In `NOTIFICATION_TRIGGERS`, after the `BOOKING_CANCELLED_TO_VENUE` entry, add:

```ts
  [NotificationTrigger.BOOKING_INVITE_TO_COARTIST]: {
    matrixRef: 'A-09a',
    type: 'booking_invitation',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'New collab invite',
      body: '{coArtistName} invited you to play "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New collab invite',
      body: '{coArtistName} invited you to play "{eventTitle}" on {date}. Respond before it expires.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER]: {
    matrixRef: 'A-10a',
    type: 'booking_accepted',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab Accepted ✓',
      body: '{coArtistName} accepted your invite for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Collab Accepted ✓',
      body: '{coArtistName} is confirmed for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER]: {
    matrixRef: 'A-11a',
    type: 'booking_rejected',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab Declined',
      body: '{coArtistName} declined your invite for "{eventTitle}".',
    },
    inApp: {
      title: 'Collab Declined',
      body: '{coArtistName} declined your invite for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE]: {
    matrixRef: 'A-13a',
    type: 'booking_withdrawn',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Invite withdrawn',
      body: '{coArtistName} withdrew the invite for "{eventTitle}".',
    },
    inApp: {
      title: 'Invite withdrawn',
      body: '{coArtistName} withdrew the invite for "{eventTitle}" on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.BOOKING_COARTIST_CANCELLED]: {
    matrixRef: 'A-12a',
    type: 'booking_cancelled',
    persona: 'artist',
    routeTemplate: '/(app)/(tabs)/bookings/{bookingId}',
    push: {
      title: 'Collab cancelled',
      body: '{coArtistName} cancelled the collab for "{eventTitle}".',
    },
    inApp: {
      title: 'Collab cancelled',
      body: '{coArtistName} cancelled the collab for "{eventTitle}" on {date}.',
    },
    email: null,
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @CeolX/shared exec vitest run src/notifications/__tests__/triggers.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/notifications/triggers.ts packages/shared/src/notifications/__tests__/triggers.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(shared): add artist-to-artist booking notification triggers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **Note for Pratiksha (notification matrix owner):** copy above is a draft; matrix rows A-09a…A-13a are new and need sign-off. Not a code blocker.

---

## Phase 3 — Database schema + migration

### Task 4: Extend the bookings schema

**Files:**

- Modify: `packages/db/src/schema/bookings.ts:23-44` (table) and `:74-91` (relations)

- [ ] **Step 1: Make `venue_id` nullable + add `inviter_artist_id` + index**

Replace the column block and indexes in the `bookings` table definition:

```ts
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artistProfiles.id, { onDelete: 'cascade' }),
    // Nullable: artist_to_artist rows have no venue. venue_to_artist /
    // artist_to_venue rows still require it (enforced by a DB CHECK in the
    // migration). (Artist co-artist invites — spec 2026-06-05)
    venueId: uuid('venue_id').references(() => venueProfiles.id, { onDelete: 'cascade' }),
    // Inviting artist for artist_to_artist rows; NULL for venue directions.
    inviterArtistId: uuid('inviter_artist_id').references(() => artistProfiles.id, {
      onDelete: 'cascade',
    }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    status: bookingStatusEnum('status').notNull().default('pending'),
    direction: bookingDirectionEnum('direction').notNull(),
    cancelledBy: text('cancelled_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('bookings_artist_status_idx').on(t.artistId, t.status),
    index('bookings_venue_status_idx').on(t.venueId, t.status),
    index('bookings_inviter_status_idx').on(t.inviterArtistId, t.status),
  ]
);
```

- [ ] **Step 2: Add the `inviterArtist` relation**

Replace `bookingsRelations`:

```ts
export const bookingsRelations = relations(bookings, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [bookings.artistId],
    references: [artistProfiles.id],
    relationName: 'booking_invited_artist',
  }),
  inviterArtist: one(artistProfiles, {
    fields: [bookings.inviterArtistId],
    references: [artistProfiles.id],
    relationName: 'booking_inviter_artist',
  }),
  venue: one(venueProfiles, {
    fields: [bookings.venueId],
    references: [venueProfiles.id],
  }),
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.id],
  }),
  cancelledByUser: one(user, {
    fields: [bookings.cancelledBy],
    references: [user.id],
  }),
}));
```

> **Why `relationName`:** two relations now point from `bookings` to `artistProfiles` (invited + inviter). Drizzle requires explicit `relationName` on both to disambiguate. The reverse relations on `artistProfiles` do not need updating unless they reference bookings; check `packages/db/src/schema/users.ts` — if `artistProfilesRelations` declares a `bookings` many-relation it must also carry the matching `relationName`. If it does not declare one, no change needed.

- [ ] **Step 3: Verify the artistProfiles reverse relation**

Run: `grep -n "bookings" packages/db/src/schema/users.ts`

- If a `many(bookings ...)` relation exists, add `relationName: 'booking_invited_artist'` to it (the original FK was `artist_id`). If none exists, skip.

- [ ] **Step 4: Typecheck db**

Run: `pnpm --filter @CeolX/db run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/bookings.ts packages/db/src/schema/users.ts
git commit -m "$(cat <<'EOF'
✨ feat(database): make booking venue nullable, add inviter_artist_id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Generate + augment the migration

**Files:**

- Create: `packages/db/src/migrations/<timestamp>_artist_to_artist_bookings.sql` (generated, then hand-edited)

- [ ] **Step 1: Generate the migration**

Run: `pnpm --filter @CeolX/db run db:generate`
Expected: a new SQL file under `packages/db/src/migrations/` containing the `venue_id DROP NOT NULL` and `ADD COLUMN inviter_artist_id` statements + index.

- [ ] **Step 2: Hand-add the enum value + CHECK constraint**

Drizzle generates the column changes but the enum value and CHECK need care. Open the generated file and ensure it contains these statements. **The enum `ALTER TYPE ... ADD VALUE` must be the first statement and cannot share a transaction with statements that use the new value** — since this migration does not use the value in data, keeping them in one file is fine, but add the enum alter at the very top:

```sql
ALTER TYPE "booking_direction" ADD VALUE IF NOT EXISTS 'artist_to_artist';
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "venue_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "inviter_artist_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_inviter_artist_id_artist_profiles_id_fk"
  FOREIGN KEY ("inviter_artist_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_inviter_status_idx" ON "bookings" ("inviter_artist_id","status");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_participants_chk" CHECK (
  ("direction" IN ('venue_to_artist','artist_to_venue') AND "venue_id" IS NOT NULL AND "inviter_artist_id" IS NULL)
  OR
  ("direction" = 'artist_to_artist' AND "venue_id" IS NULL AND "inviter_artist_id" IS NOT NULL)
);
```

> If drizzle-kit refuses the CHECK in the same migration as the `ADD VALUE` (some versions wrap migrations in a transaction, and Postgres forbids using a freshly-added enum value in the same transaction), split into two files: file 1 = `ADD VALUE` only; file 2 = the rest. The CHECK references the literal `'artist_to_artist'`, which Postgres allows once the value is committed.

- [ ] **Step 3: Apply the migration to a dev/branch DB**

Run: `pnpm --filter @CeolX/db run db:migrate`
Expected: applies cleanly. Verify: `pnpm --filter @CeolX/db run db:check` (or `db:studio`) shows `venue_id` nullable and `inviter_artist_id` present.

- [ ] **Step 4: Sanity-check the CHECK constraint**

Using `db:studio` or a psql shell, attempt to insert an `artist_to_artist` row with a non-null `venue_id`. Expected: rejected by `bookings_participants_chk`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "$(cat <<'EOF'
✨ feat(database): migration for artist_to_artist bookings + check constraint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Backend: artist invite path in `events.create`

### Task 6: Branch the platform-invite block for artist creators (create)

**Files:**

- Modify: `packages/api/src/routers/events/crud.ts:330-385`
- Test: `packages/api/src/__tests__/event-create-coartist.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/__tests__/event-create-coartist.test.ts`, mirroring the harness in `event-create-collaborators.test.ts` (hoisted `mockDb`, `vi.mock('@CeolX/db', ...)`, schema mocks, build a caller with `currentRole: 'artist'`). The test asserts that when an **artist** creates an event with `platformInvites: ['invited-user-id']`:

- an `artist_to_artist` booking is inserted with `inviterArtistId = creatorProfile.id`, `venueId: null`;
- an `event_collaborators` row is inserted with `artistProfileId: 'invited-user-id'`;
- a `BOOKING_INVITE_TO_COARTIST` dispatch is queued;
- the creator's own id is excluded if present in `platformInvites`.

Model it on the existing collaborators test. Minimal assertion skeleton:

```ts
it('artist create with platform invite creates an artist_to_artist booking', async () => {
  // creator artist profile lookup
  mockArtistsFindFirst.mockResolvedValueOnce({ id: 'creator-profile', stageName: 'Vivek' });
  // invited artist profiles (inArray)
  mockSelectInArray.mockResolvedValueOnce([
    { id: 'invited-profile', userId: 'invited-user-id', stageName: 'Tune Bomb' },
  ]);
  mockInsertReturning
    .mockResolvedValueOnce([
      { id: 'evt1', title: 'Trad Night', dateStart: new Date(), status: 'active' },
    ]) // event
    .mockResolvedValueOnce([{ id: 'bk1' }]); // booking

  const caller = makeArtistCaller('creator-user-id');
  await caller.events.create({
    /* valid event input */ platformInvites: ['invited-user-id', 'creator-user-id'],
  });

  // booking insert received inviterArtistId + null venueId
  expect(insertedBookingValues).toMatchObject({
    artistId: 'invited-profile',
    inviterArtistId: 'creator-profile',
    venueId: null,
    direction: 'artist_to_artist',
    status: 'pending',
  });
  expect(dispatched).toContainEqual(
    expect.objectContaining({
      trigger: 'booking_invite_to_coartist',
      recipientUserId: 'invited-user-id',
    })
  );
});
```

(Use the same capture technique the sibling test uses for insert values + dispatches. If the sibling captures via `mockInsertValues`, reuse it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/event-create-coartist.test.ts`
Expected: FAIL — artist branch not implemented; invites dropped.

- [ ] **Step 3: Implement the artist branch**

In `crud.ts`, replace the existing platform-invite block (`if (platformInvites && platformInvites.length > 0 && isVenue) { ... }`, lines ~330-385) with a role-branching version. First, near the top of the resolver where `isVenue` is computed, add the self-invite filter:

```ts
// Exclude the creator from their own invite list (artists could otherwise
// search and invite themselves). platformInvites carry userIds.
const inviteUserIds = (platformInvites ?? []).filter((id) => id !== ctx.userId);
```

Then inside the transaction, replace the venue-only block:

```ts
// Platform invites → pending bookings for invited artists.
if (inviteUserIds.length > 0) {
  const inviteProfiles = await tx
    .select({
      id: artistProfiles.id,
      userId: artistProfiles.userId,
      stageName: artistProfiles.stageName,
    })
    .from(artistProfiles)
    .where(inArray(artistProfiles.userId, inviteUserIds));

  if (isVenue) {
    // ── Venue → Artist (existing behaviour) ──
    const venueProfile = await tx.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, ctx.userId),
      columns: { id: true, venueName: true },
    });
    if (venueProfile) {
      for (const ap of inviteProfiles) {
        const [booking] = await tx
          .insert(bookings)
          .values({
            artistId: ap.id,
            venueId: venueProfile.id,
            eventId: inserted.id,
            status: BookingStatus.PENDING,
            direction: BookingDirection.VENUE_TO_ARTIST,
          })
          .returning();
        if (booking) {
          await tx.insert(eventCollaborators).values({
            eventId: inserted.id,
            artistProfileId: ap.userId,
            bookingId: booking.id,
          });
          pendingDispatches.push({
            trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
            recipientUserId: ap.userId,
            vars: {
              bookingId: booking.id,
              venueName: venueProfile.venueName,
              artistName: ap.stageName,
              eventTitle: inserted.title,
              date: formatNotificationDate(inserted.dateStart),
            },
          });
        }
      }
    }
  } else {
    // ── Artist → Artist (new) ──
    const creatorProfile = await tx.query.artistProfiles.findFirst({
      where: eq(artistProfiles.userId, ctx.userId),
      columns: { id: true, stageName: true },
    });
    if (creatorProfile) {
      for (const ap of inviteProfiles) {
        const [booking] = await tx
          .insert(bookings)
          .values({
            artistId: ap.id,
            inviterArtistId: creatorProfile.id,
            venueId: null,
            eventId: inserted.id,
            status: BookingStatus.PENDING,
            direction: BookingDirection.ARTIST_TO_ARTIST,
          })
          .returning();
        if (booking) {
          await tx.insert(eventCollaborators).values({
            eventId: inserted.id,
            artistProfileId: ap.userId,
            bookingId: booking.id,
          });
          pendingDispatches.push({
            trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
            recipientUserId: ap.userId,
            vars: {
              bookingId: booking.id,
              coArtistName: creatorProfile.stageName,
              eventTitle: inserted.title,
              date: formatNotificationDate(inserted.dateStart),
            },
          });
        }
      }
    }
  }
}
```

> The destructure at the top (`const { platformInvites, ... } = input;`) stays; we now read `inviteUserIds` instead of `platformInvites` directly inside the block.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/event-create-coartist.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full api event suite for regressions**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/event-create-collaborators.test.ts src/__tests__/event-venue-approval.test.ts`
Expected: PASS (venue path unchanged).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/events/crud.ts packages/api/src/__tests__/event-create-coartist.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(api): create artist-to-artist bookings from the event form

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 7: Artist invite path in `events.update` (edit)

**Files:**

- Modify: `packages/api/src/routers/events/crud.ts:680-743`

- [ ] **Step 1: Write the failing test**

Add to `event-create-coartist.test.ts` (or a new `event-update-coartist.test.ts`): an artist editing their event with a new `platformInvites` entry creates an `artist_to_artist` booking for the **new** invitee only (dedup against existing collaborators), excludes self, and does not touch event status.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/event-update-coartist.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In the `update` resolver, the existing block is `if (platformInvites !== undefined && platformInvites.length > 0 && isVenue) { ... }` (lines ~680-743). Mirror the create branch. Replace with:

```ts
// Platform invites — create pending bookings for newly invited artists.
if (platformInvites !== undefined && platformInvites.length > 0) {
  const existingCollabs = await tx.query.eventCollaborators.findMany({
    where: eq(eventCollaborators.eventId, input.id),
    columns: { artistProfileId: true },
  });
  const existingArtistUserIds = new Set(
    existingCollabs.map((c) => c.artistProfileId).filter((id): id is string => id !== null)
  );
  const newInviteUserIds = platformInvites.filter(
    (id) => id !== ctx.userId && !existingArtistUserIds.has(id)
  );

  if (newInviteUserIds.length > 0) {
    const inviteProfiles = await tx
      .select({
        id: artistProfiles.id,
        userId: artistProfiles.userId,
        stageName: artistProfiles.stageName,
      })
      .from(artistProfiles)
      .where(inArray(artistProfiles.userId, newInviteUserIds));

    if (isVenue) {
      const venueProfile = await tx.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, ctx.userId),
        columns: { id: true, venueName: true },
      });
      if (venueProfile) {
        for (const ap of inviteProfiles) {
          const [booking] = await tx
            .insert(bookings)
            .values({
              artistId: ap.id,
              venueId: venueProfile.id,
              eventId: input.id,
              status: BookingStatus.PENDING,
              direction: BookingDirection.VENUE_TO_ARTIST,
            })
            .returning();
          if (booking) {
            await tx.insert(eventCollaborators).values({
              eventId: input.id,
              artistProfileId: ap.userId,
              bookingId: booking.id,
            });
            pendingDispatches.push({
              trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
              recipientUserId: ap.userId,
              vars: {
                bookingId: booking.id,
                venueName: venueProfile.venueName,
                artistName: ap.stageName,
                eventTitle: result.title,
                date: formatNotificationDate(result.dateStart),
              },
            });
          }
        }
      }
    } else {
      const creatorProfile = await tx.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
        columns: { id: true, stageName: true },
      });
      if (creatorProfile) {
        for (const ap of inviteProfiles) {
          const [booking] = await tx
            .insert(bookings)
            .values({
              artistId: ap.id,
              inviterArtistId: creatorProfile.id,
              venueId: null,
              eventId: input.id,
              status: BookingStatus.PENDING,
              direction: BookingDirection.ARTIST_TO_ARTIST,
            })
            .returning();
          if (booking) {
            await tx.insert(eventCollaborators).values({
              eventId: input.id,
              artistProfileId: ap.userId,
              bookingId: booking.id,
            });
            pendingDispatches.push({
              trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
              recipientUserId: ap.userId,
              vars: {
                bookingId: booking.id,
                coArtistName: creatorProfile.stageName,
                eventTitle: result.title,
                date: formatNotificationDate(result.dateStart),
              },
            });
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/event-update-coartist.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routers/events/crud.ts packages/api/src/__tests__/event-update-coartist.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(api): support artist co-artist invites on event edit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Backend: bookings router

### Task 8: Participation-based auth + trigger resolver in `bookings.update`

**Files:**

- Modify: `packages/api/src/routers/bookings.ts:55-89` (resolver), `:354-480` (update)
- Test: `packages/api/src/__tests__/bookings.test.ts`

- [ ] **Step 1: Write the failing tests**

Add cases to `bookings.test.ts`:

- invited artist accepts an `artist_to_artist` booking → allowed; dispatch `BOOKING_COARTIST_ACCEPTED_TO_INVITER` to the inviter; event status NOT flipped;
- inviter withdraws a pending a2a booking → allowed; dispatch `BOOKING_COARTIST_WITHDRAWN_TO_INVITEE` to the invited;
- a non-party artist is rejected with `FORBIDDEN`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/bookings.test.ts -t artist_to_artist`
Expected: FAIL.

- [ ] **Step 3: Extend the `update` resolver**

In `bookings.update`, the booking is fetched `with: { artist: true, venue: true, event: true }`. Add `inviterArtist: true`:

```ts
const booking = await db.query.bookings.findFirst({
  where: eq(bookings.id, input.id),
  with: { artist: true, inviterArtist: true, venue: true, event: true },
});
```

Replace the party detection (currently `isArtist` / `isVenue` on lines ~370-371) and downstream sender/recipient logic with an a2a-aware version:

```ts
const isA2A = booking.direction === BookingDirection.ARTIST_TO_ARTIST;

// Party detection
const isInvitedArtist = booking.artist.userId === ctx.userId;
const isInviterArtist = booking.inviterArtist?.userId === ctx.userId;
const isVenue = booking.venue?.userId === ctx.userId;
const isArtist = isInvitedArtist; // back-compat alias used by venue-flow trigger resolver

if (!isInvitedArtist && !isInviterArtist && !isVenue) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a party to this booking' });
}

// ...state-machine validation unchanged...

// Sender / recipient
const isRecipient = isA2A
  ? isInvitedArtist
  : (booking.direction === BookingDirection.VENUE_TO_ARTIST && isInvitedArtist) ||
    (booking.direction === BookingDirection.ARTIST_TO_VENUE && isVenue);
const isSender = isA2A
  ? isInviterArtist
  : (booking.direction === BookingDirection.VENUE_TO_ARTIST && isVenue) ||
    (booking.direction === BookingDirection.ARTIST_TO_VENUE && isInvitedArtist);
```

The `pending_review → active` flip block (lines ~442-461) is already guarded on `booking.direction === BookingDirection.ARTIST_TO_VENUE`, so it never fires for a2a — **leave it unchanged**.

For the notification (lines ~463-477), branch the counter-party + trigger:

```ts
if (isA2A) {
  const recipientUserId = isInviterArtist
    ? booking.artist.userId // inviter acted → notify invited
    : booking.inviterArtist!.userId; // invited acted → notify inviter
  const actorIsInviter = isInviterArtist;
  await ctx.dispatchNotification({
    trigger: resolveA2ABookingTrigger({ actorIsInviter, currentStatus, newStatus }),
    recipientUserId,
    vars: {
      bookingId: booking.id,
      coArtistName: actorIsInviter
        ? booking.inviterArtist!.stageName // inviter acted; recipient sees inviter's name
        : booking.artist.stageName, // invited acted; recipient sees invited's name
      eventTitle: booking.event?.title ?? 'event',
      date: formatNotificationDate(booking.event?.dateStart ?? new Date()),
    },
  });
} else {
  const recipientUserId = isArtist ? booking.venue!.userId : booking.artist.userId;
  await ctx.dispatchNotification({
    trigger: resolveBookingUpdateTrigger({ isArtist, currentStatus, newStatus }),
    recipientUserId,
    vars: {
      bookingId: booking.id,
      venueName: booking.venue!.venueName,
      artistName: booking.artist.stageName,
      eventTitle: booking.event?.title ?? 'event',
      date: formatNotificationDate(booking.event?.dateStart ?? new Date()),
    },
  });
}
```

> `coArtistName` is "the name of the other party from the recipient's perspective." When the inviter acts (accept is impossible for the inviter, but reject/withdraw/cancel are), the invited artist receives a notice naming the inviter. When the invited artist acts (accept/reject/cancel), the inviter receives a notice naming the invited artist.

- [ ] **Step 4: Add the a2a trigger resolver**

Above `bookingsRouter`, beside `resolveBookingUpdateTrigger`, add:

```ts
function resolveA2ABookingTrigger(args: {
  actorIsInviter: boolean;
  currentStatus: BookingStatusType;
  newStatus: BookingStatusType;
}): NotificationTrigger {
  if (args.newStatus === BookingStatus.ACCEPTED) {
    // Only the invited artist can accept → notify inviter.
    return NotificationTrigger.BOOKING_COARTIST_ACCEPTED_TO_INVITER;
  }
  if (args.newStatus === BookingStatus.REJECTED) {
    // Only the invited artist can reject → notify inviter.
    return NotificationTrigger.BOOKING_COARTIST_REJECTED_TO_INVITER;
  }
  // CANCELLED: from PENDING = inviter withdrawing → notify invitee.
  if (args.currentStatus === BookingStatus.PENDING) {
    return NotificationTrigger.BOOKING_COARTIST_WITHDRAWN_TO_INVITEE;
  }
  // From ACCEPTED = either party cancelling a confirmed collab.
  return NotificationTrigger.BOOKING_COARTIST_CANCELLED;
}
```

Add `BookingDirection` to the existing `@CeolX/shared` import if not already present (it is).

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/bookings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/bookings.ts packages/api/src/__tests__/bookings.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(api): handle artist-to-artist accept/reject/withdraw/cancel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 9: Sent/Received tabs + byId auth + null-safe summary mapping

**Files:**

- Modify: `packages/api/src/routers/bookings.ts` — `list` (~483-612), `byId` (~615-670), and the shared summary-mapping in `list`/`byId`/`create`/`requestToPerform`.

- [ ] **Step 1: Write the failing tests**

Add to `bookings.test.ts`:

- an artist's `sent` tab includes a2a rows where `inviter_artist_id = me`;
- an artist's `received` tab includes a2a rows where `artist_id = me`;
- a venue's tabs exclude a2a rows;
- `byId` allows the inviter artist (previously FORBIDDEN);
- a list row for an a2a booking maps `viewerIsSender` and `inviterArtistName` and does not throw on null `venue`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/bookings.test.ts -t "tab"`
Expected: FAIL.

- [ ] **Step 3: OR the a2a predicate into the artist tabs**

In `list`, after building `conditions` per tab, the artist branches currently push a single `(artistId, direction)` pair. Replace the artist branch of each tab with an OR. Because the existing code pushes flat ANDed conditions, restructure the artist case to wrap an `or(...)`:

```ts
import { or } from 'drizzle-orm'; // ensure imported

// SENT tab, artist:
if (profileType === UserRole.ARTIST) {
  conditions.push(
    or(
      and(
        eq(bookings.artistId, profileId),
        eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE)
      ),
      and(
        eq(bookings.inviterArtistId, profileId),
        eq(bookings.direction, BookingDirection.ARTIST_TO_ARTIST)
      )
    )!
  );
}

// RECEIVED tab, artist:
if (profileType === UserRole.ARTIST) {
  conditions.push(
    or(
      and(
        eq(bookings.artistId, profileId),
        eq(bookings.direction, BookingDirection.VENUE_TO_ARTIST)
      ),
      and(
        eq(bookings.artistId, profileId),
        eq(bookings.direction, BookingDirection.ARTIST_TO_ARTIST)
      )
    )!
  );
}
```

Venue branches stay as-is. The trailing `input.status` / `input.direction` filters remain ANDed via `and(...conditions)`.

- [ ] **Step 4: Add `inviterArtist` to the `list` query relations + null-safe mapping**

In the `findMany` call add `inviterArtist: true` to `with`. Then update the row mapper. Replace the `venueName: row.venue.venueName` style accesses with null-safe ones and populate a2a fields:

```ts
const rowsWith = await db.query.bookings.findMany({
  where: whereClause,
  with: { artist: true, inviterArtist: true, venue: true, event: true },
  orderBy: (b, { desc }) => [desc(b.createdAt)],
  limit: input.limit,
  offset: input.offset,
});

// images: include inviter user ids
const artistUserIds = rowsWith.map((r) => r.artist.userId);
const inviterUserIds = rowsWith
  .map((r) => r.inviterArtist?.userId)
  .filter((id): id is string => !!id);
const venueUserIds = rowsWith.map((r) => r.venue?.userId).filter((id): id is string => !!id);
const allUserIds = [...new Set([...artistUserIds, ...inviterUserIds, ...venueUserIds])];
// ...imageMap as before...

return {
  bookings: rowsWith.map((row) => {
    const isA2A = row.direction === BookingDirection.ARTIST_TO_ARTIST;
    const viewerIsSender = isA2A ? row.inviterArtist?.id === profileId : undefined;
    return {
      id: row.id,
      status: row.status,
      direction: row.direction,
      artistId: row.artist.id,
      artistName: row.artist.stageName,
      artistImage: imageMap.get(row.artist.userId) ?? undefined,
      inviterArtistId: row.inviterArtist?.id,
      inviterArtistName: row.inviterArtist?.stageName,
      inviterArtistImage: row.inviterArtist
        ? (imageMap.get(row.inviterArtist.userId) ?? undefined)
        : undefined,
      viewerIsSender,
      venueId: row.venue?.id ?? '',
      venueName: row.venue?.venueName ?? '',
      venueImage: row.venue ? (imageMap.get(row.venue.userId) ?? undefined) : undefined,
      eventId: row.event?.id ?? '',
      eventTitle: row.event?.title ?? '',
      eventCoverImage: row.event?.coverImage ?? undefined,
      eventCategory: row.event?.category ?? '',
      eventDateStart: row.event?.dateStart?.toISOString() ?? '',
      eventDateEnd: row.event?.dateEnd?.toISOString() ?? undefined,
      eventVenueAddress: row.event?.venueAddress ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }),
  total: countResult,
};
```

> `profileId` here is the caller's artist profile id resolved at the top of `list`. For a venue caller, a2a rows never appear (filtered out), so `viewerIsSender` stays `undefined` — fine.

- [ ] **Step 5: Update `byId` auth + mapping**

In `byId`, add `inviterArtist: true` to `with`, and extend the party check + mapping:

```ts
const isParty =
  booking.artist.userId === ctx.userId ||
  booking.inviterArtist?.userId === ctx.userId ||
  booking.venue?.userId === ctx.userId;
if (!isParty)
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a party to this booking' });
```

Map `inviterArtist*`, null-safe `venue*`, and compute `viewerIsSender` (for a2a: `booking.inviterArtist?.userId === ctx.userId`). Fetch the inviter user image alongside the existing artist/venue image lookups.

- [ ] **Step 6: Null-safe the `create` (`bookingsRouter.create`) and `requestToPerform` return mappers**

These venue/artist-to-venue paths always have a venue, but to keep `BookingSummary` construction uniform and avoid a future a2a row throwing, no change is strictly required (venue is always set there). Leave unless a typecheck error appears from the new optional fields (they are optional, so none expected).

- [ ] **Step 7: Run to verify it passes**

Run: `pnpm --filter @CeolX/api exec vitest run src/__tests__/bookings.test.ts`
Expected: PASS.

- [ ] **Step 8: Full api suite regression**

Run: `pnpm --filter @CeolX/api run test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/api/src/routers/bookings.ts packages/api/src/__tests__/bookings.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(api): include artist-to-artist rows in requests tabs + summaries

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Client: event form

### Task 10: Ungate the picker + exclude self

**Files:**

- Modify: `apps/native/components/events/BasicDetailsStep.tsx:34-60,190-198`
- Modify: `apps/native/components/events/InviteArtistPicker.tsx:28-55`
- Modify: `apps/native/app/(app)/events/create.tsx:90-97` and `apps/native/app/(app)/events/edit/[eventId].tsx:154-175`

- [ ] **Step 1: Add a `myUserId` prop to `InviteArtistPicker` and exclude self from results**

In `InviteArtistPicker.tsx`, extend `Props`:

```ts
type Props = {
  platformInvites: string[];
  onPlatformInvitesChange: (ids: string[]) => void;
  unregisteredInvites: UnregisteredInvite[];
  onUnregisteredInvitesChange: (invites: UnregisteredInvite[]) => void;
  /** Current user's id — excluded from search results (artists can't invite themselves). */
  myUserId?: string;
};
```

Destructure `myUserId` and filter results (results are keyed by `a.id` which is the artist's userId):

```ts
const results = (data?.artists ?? []).filter(
  (a) => !platformInvites.includes(a.id) && a.id !== myUserId
);
```

- [ ] **Step 2: Ungate the picker in `BasicDetailsStep` and forward `myUserId`**

Add `myUserId?: string;` to `BasicDetailsStep` `Props`, destructure it, and change the render block (currently `{isVenue && (<InviteArtistPicker ... />)}`):

```tsx
{
  /* ── Invite Artists — all creators (venue invites artists, artist invites co-artists) ── */
}
<InviteArtistPicker
  platformInvites={platformInvites}
  onPlatformInvitesChange={onPlatformInvitesChange}
  unregisteredInvites={unregisteredCollaborators}
  onUnregisteredInvitesChange={onUnregisteredCollaboratorsChange}
  myUserId={myUserId}
/>;
```

Keep the `CollectionPicker` block venue-only (unchanged).

- [ ] **Step 3: Pass `myUserId` from both screens**

In `create.tsx`, the `BasicDetailsStep` usage adds `myUserId={me?.id}`. Same in `edit/[eventId].tsx`. (`me` is already available via `useMe()` in both.)

- [ ] **Step 4: Typecheck native**

Run: `pnpm --filter native run check-types`
Expected: PASS.

- [ ] **Step 5: Manual smoke (device)**

Use the `mobile-dev` skill to screenshot. As an **artist**, open Create Event → Step 1 shows "Invite Artists"; searching excludes yourself; selecting an artist adds a chip; inviting an outside name+email adds a chip. As a **venue**, behaviour unchanged (Collection + Invite both present).

- [ ] **Step 6: Commit**

```bash
git add apps/native/components/events/InviteArtistPicker.tsx apps/native/components/events/BasicDetailsStep.tsx "apps/native/app/(app)/events/create.tsx" "apps/native/app/(app)/events/edit/[eventId].tsx"
git commit -m "$(cat <<'EOF'
✨ feat(native): show invite artists field for artist event creators

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Client: Requests card

### Task 11: Resolve the co-artist counterpart on the card + actions

**Files:**

- Modify: `apps/native/components/requests/RequestCard.tsx:40-47,107-126`
- Modify: `apps/native/components/requests/RequestActions.tsx:27-29`

- [ ] **Step 1: Update `RequestCard` counterpart resolution**

Replace the `isSentByUser` / `otherPartyName` / `otherPartyImage` block (lines ~40-47) with an a2a-aware version:

```tsx
const isA2A = booking.direction === BookingDirection.ARTIST_TO_ARTIST;

const isSentByUser = isA2A
  ? booking.viewerIsSender === true
  : (userRole === UserRole.VENUE && booking.direction === BookingDirection.VENUE_TO_ARTIST) ||
    (userRole === UserRole.ARTIST && booking.direction === BookingDirection.ARTIST_TO_VENUE);

// "Other party" is whoever is NOT the viewer.
const otherPartyName = isA2A
  ? isSentByUser
    ? booking.artistName // I'm the inviter → other is the invited artist
    : (booking.inviterArtistName ?? 'Artist')
  : userRole === UserRole.VENUE
    ? booking.artistName
    : booking.venueName;
const otherPartyImage = isA2A
  ? isSentByUser
    ? booking.artistImage
    : booking.inviterArtistImage
  : userRole === UserRole.VENUE
    ? booking.artistImage
    : booking.venueImage;
const directionLabel = isSentByUser ? 'Sent Request to:' : 'Request Sent by:';
```

For the accepted "CONTACT VENUE/ARTIST" affordance (line ~121), for a2a always show "CONTACT ARTIST":

```tsx
{
  userRole === UserRole.ARTIST && !isA2A ? 'CONTACT VENUE' : 'CONTACT ARTIST';
}
```

- [ ] **Step 2: Update `RequestActions` sender detection**

Replace `isSentByUser` (lines ~27-29):

```tsx
const isSentByUser =
  booking.direction === BookingDirection.ARTIST_TO_ARTIST
    ? booking.viewerIsSender === true
    : (userRole === UserRole.VENUE && booking.direction === BookingDirection.VENUE_TO_ARTIST) ||
      (userRole === UserRole.ARTIST && booking.direction === BookingDirection.ARTIST_TO_VENUE);
```

The rest (sender → WITHDRAW/RESEND, recipient → ACCEPT/REJECT) works unchanged: the invited artist sees ACCEPT/REJECT, the inviter sees WITHDRAW.

- [ ] **Step 3: Typecheck native**

Run: `pnpm --filter native run check-types`
Expected: PASS.

- [ ] **Step 4: Manual smoke (device, two accounts)**

With two artist accounts: Artist A creates an event inviting Artist B. On B's Requests → Received: a card showing **A** as "Request Sent by:" with ACCEPT/REJECT. On A's Requests → Sent: a card showing **B** with WITHDRAW. B accepts → A gets a "Collab Accepted" notification; B appears as a confirmed collaborator on the event detail.

- [ ] **Step 5: Commit**

```bash
git add apps/native/components/requests/RequestCard.tsx apps/native/components/requests/RequestActions.tsx
git commit -m "$(cat <<'EOF'
✨ feat(native): render co-artist counterpart on requests card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Verify & integrate

### Task 12: Full verification + PR

- [ ] **Step 1: Run all touched suites**

Run:

```
pnpm --filter @CeolX/shared run test
pnpm --filter @CeolX/api run test
```

Expected: all PASS.

- [ ] **Step 2: Typecheck the workspace**

Run: `pnpm --filter native run check-types && pnpm --filter @CeolX/api run build && pnpm --filter @CeolX/shared run build && pnpm --filter @CeolX/db run build`
Expected: PASS. (No single workspace `typecheck` task exists; run per-package.)

- [ ] **Step 3: End-to-end manual (device) — acceptance criteria sweep**

Walk each acceptance criterion from the spec (1–8): field shows for artists; multiple platform invites; external invite; accept-to-confirm; visibility unaffected; no self-invite; Sent/Received tabs; notifications on invite + accept/decline.

- [ ] **Step 4: Push + open PR to `development`**

```bash
git push raftlabs feature/artist-coartist-invites
git push client feature/artist-coartist-invites   # Vercel watches the client remote
gh pr create --base development --title "feat: artist invites co-artists on the event form" --body "<summary + Asana link>"
```

- [ ] **Step 5: Update the Asana task**

Move the task to the appropriate section and comment a short summary with the PR link (use the asana skill).

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task — data model (T4/T5), enum (T1), `BookingSummary` (T2), triggers (T3), `events.create`/`update` (T6/T7), `bookings.update`/`list`/`byId` (T8/T9), null-safety (T9 step 4–5), client form (T10), Requests card/actions (T11). Out-of-scope items are intentionally not tasked.
- **Type consistency:** `inviterArtistId/Name/Image` + `viewerIsSender` defined in T2 are produced in T9 and consumed in T11; `resolveA2ABookingTrigger` defined and used in T8; trigger IDs defined in T3 used in T6/T7/T8.
- **Known soft spot:** the exact pnpm filter names (`native` vs `@CeolX/native`) and typecheck task names should be confirmed against `package.json` / `turbo.json` on first run; adjust the command, not the logic.
