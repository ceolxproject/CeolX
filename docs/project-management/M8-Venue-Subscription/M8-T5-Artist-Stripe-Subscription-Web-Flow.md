# M8-T5 · Artist Stripe Subscription Web Flow (ceolx.ie/subscribe)

| Field          | Value                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Milestone**  | M8 — Subscription & Payments                                                                                       |
| **Status**     | 🔲 To Do                                                                                                           |
| **Depends on** | M1-T5 (admin scaffold + /subscribe route), M2-T4 (artist persona system), M7-T3 (Postmark artist activation email) |
| **PRD Ref**    | Section 7.2 (Subscription — Web-based Stripe)                                                                      |

> **Why this task exists (08/04/2026 — MoM 3rd Apr 2026, Section 2.2)**: Both Artist and Venue require paid subscriptions. Artist pricing is lower than Venue. This task mirrors M8-T1 (Venue checkout) for the Artist persona using `STRIPE_ARTIST_PRICE_ID`.

---

## Description

Build the Artist subscription flow at `ceolx.ie/subscribe`. Artists subscribe via web-based Stripe Checkout (Apple Rule 3.1.1 prohibits in-app payments). The flow: Artist registers → Postmark activation email sent with `ceolx.ie/subscribe` link → Artist logs in → redirected to Stripe Checkout → on success, Stripe webhook activates the Artist profile → app detects activation.

Artist profile is not visible to Venues or on the platform until subscription is active.

---

## Affected Apps / Packages

| App / Package  | Role                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| `apps/admin`   | `/subscribe` route — same page as Venue flow, role-detected to show correct copy       |
| `packages/api` | `stripe.createArtistCheckoutSession` tRPC mutation                                     |
| `apps/server`  | `POST /api/webhooks/stripe` — extend existing handler to cover `artist` metadata field |

---

## API

### `stripe.createArtistCheckoutSession` (protectedProcedure · mutation)

Create a Stripe Checkout session for Artist subscription.

**Input:**

```typescript
{
  artistProfileId: string;
}
```

**Output:**

```typescript
{
  checkoutUrl: string;
  sessionId: string;
}
```

**tRPC errors:**

- `BAD_REQUEST` — missing artistProfileId or artist not found
- `UNAUTHORIZED` — not authenticated
- `CONFLICT` — artist already has active subscription

### POST /api/webhooks/stripe (extended)

Extend the existing webhook handler (M8-T1) to handle Artist checkout completion. Differentiate via `metadata.profileType`:

```typescript
// metadata sent in checkout session:
{ artistProfileId, userId, profileType: 'artist' }
// vs Venue:
{ venueProfileId, userId, profileType: 'venue' }
```

---

## Requirements

### Web Page — Role Detection

- R1.1: `/subscribe` page detects authenticated user's role (`current_role`)
- R1.2: If `current_role = 'artist'` → show Artist-specific copy: _"Activate Your Artist Profile"_
- R1.3: If `current_role = 'venue'` → show Venue-specific copy (existing M8-T1 flow)
- R1.4: Non-Artist/Venue users see: _"Please sign up as an Artist or Venue to subscribe."_
- R1.5: No external URL shown inside mobile app — link sent via Postmark email only

### Checkout Session Creation

- R2.1: Authenticated Artist clicks "Subscribe Now"
- R2.2: Calls `trpc.stripe.createArtistCheckoutSession.mutate({ artistProfileId })`
- R2.3: Backend validates: user is authenticated, has Artist profile, `subscription_status ≠ active`
- R2.4: Stripe API call:
  - Mode: `subscription`
  - Customer email: user's email
  - Line items: `[{ price: STRIPE_ARTIST_PRICE_ID, quantity: 1 }]`
  - Success URL: `https://ceolx.ie/subscribe?success=true`
  - Cancel URL: `https://ceolx.ie/subscribe?cancelled=true`
  - Metadata: `{ artistProfileId, userId, profileType: 'artist' }`
- R2.5: Return checkout URL; frontend redirects to Stripe-hosted checkout

### Webhook Handler (Extended from M8-T1)

- R3.1: On `checkout.session.completed` where `metadata.profileType = 'artist'`:
  - Update `artist_profiles`: set `subscription_status = 'active'`, `stripe_customer_id`, `stripe_subscription_id`, `is_active = true`
  - Create record in `artist_subscriptions` table
  - Send Postmark confirmation email to Artist
  - Send FCM: "Subscription Activated ✓ — Your profile is now live!"
- R3.2: Webhook idempotent — duplicate events don't create double records
- R3.3: Fire-and-forget for email/FCM failures (log, don't fail response)

### Artist Subscription Lifecycle

The full renewal/failure/cancellation lifecycle for Artists follows the same Stripe webhook events as M8-T3 (Venue), but targets `artist_profiles` and `artist_subscriptions`. A follow-up task (M8-T6) should cover the Artist subscription lifecycle webhooks.

### Database

- R4.1: `artist_profiles.subscription_status` enum: `'inactive' | 'active' | 'past_due' | 'cancelled'`
- R4.2: `artist_subscriptions` table: `{ id, artist_profile_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at }`
- R4.3: Artist profile hidden from Venues and platform until `subscription_status = 'active'`

### Environment Variables

- `STRIPE_SECRET_KEY` — shared with M8-T1
- `STRIPE_WEBHOOK_SECRET` — shared with M8-T1
- `STRIPE_ARTIST_PRICE_ID` — Artist-tier price (lower than `STRIPE_VENUE_PRICE_ID`)

---

## Acceptance Criteria

- [ ] `/subscribe` shows Artist-specific copy when `current_role = 'artist'`
- [ ] Artist sees "Subscribe Now" button after login
- [ ] Clicking redirects to Stripe Checkout with Artist price
- [ ] Completing payment redirects to `/subscribe?success=true`
- [ ] Stripe webhook updates `artist_profiles.subscription_status = 'active'`
- [ ] `artist_profiles.is_active = true` after webhook — profile visible
- [ ] Webhook signature verification rejects tampered payloads (400)
- [ ] Confirmation email sent to Artist via Postmark
- [ ] FCM notification sent: "Subscription Activated ✓"
- [ ] Duplicate webhook events handled idempotently
- [ ] No Stripe URL shown inside mobile app
- [ ] `STRIPE_ARTIST_PRICE_ID` is a different (lower) price than `STRIPE_VENUE_PRICE_ID`

---

## Dependencies

### Upstream

- **M8-T1** — Stripe webhook handler base; this task extends it for Artist
- **M2-T4** — Artist persona and `artist_profiles` table
- **M7-T3** — Postmark integration for activation email

### Downstream

- **M8-T6** _(new)_ — Artist subscription lifecycle webhooks (renewal, failure, cancellation) — mirrors M8-T3 for Artists
- **M12** — Launch checklist: confirm both `STRIPE_ARTIST_PRICE_ID` and `STRIPE_VENUE_PRICE_ID` configured in prod

### External Services

- **Stripe** — payment processor
- **Postmark** — activation + confirmation emails
- **Firebase FCM** — push notification on activation

---

## Technical Notes

### Extended Webhook Handler

```typescript
// apps/server/routes/webhooks/stripe.ts — extended checkout handler

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const { profileType, userId } = session.metadata as any;

  if (profileType === 'venue') {
    // Existing M8-T1 logic
    await activateVenueProfile(session);
  } else if (profileType === 'artist') {
    await activateArtistProfile(session);
  }
}

async function activateArtistProfile(session: Stripe.Checkout.Session) {
  const { artistProfileId, userId } = session.metadata as any;

  await db
    .update(artistProfiles)
    .set({
      subscriptionStatus: 'active',
      stripeCustomerId: session.customer as string,
      isActive: true,
    })
    .where(eq(artistProfiles.id, artistProfileId));

  await db.insert(artistSubscriptions).values({
    artistProfileId,
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string,
    status: 'active',
  });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const artist = await db.query.artistProfiles.findFirst({
    where: eq(artistProfiles.id, artistProfileId),
  });

  await sendEmail({
    to: user.email,
    templateAlias: 'artist-subscription-activated',
    templateModel: {
      artistName: artist.name,
      ManageLink: 'https://ceolx.ie/account',
    },
  }).catch((err) => console.error('Artist activation email failed:', err));

  await fcmDispatcher
    .sendNotification({
      userId,
      title: 'Subscription Activated ✓',
      body: 'Your artist profile is now live. Venues can find and book you!',
      data: { persona: 'artist', route: '/profile' },
    })
    .catch((err) => console.error('Artist FCM failed:', err));
}
```

### tRPC Artist Checkout Procedure

```typescript
// packages/api/src/routers/stripe.ts — add alongside createCheckoutSession

createArtistCheckoutSession: protectedProcedure
  .input(z.object({ artistProfileId: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const artist = await db
      .select()
      .from(artistProfiles)
      .where(eq(artistProfiles.id, input.artistProfileId))
      .then((rows) => rows[0]);

    if (!artist || artist.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Artist profile not found' });
    }

    if (artist.subscriptionStatus === 'active') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Already subscribed' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: ctx.session.user.email,
      line_items: [{ price: process.env.STRIPE_ARTIST_PRICE_ID!, quantity: 1 }],
      success_url: `${process.env.APP_URL}/subscribe?success=true`,
      cancel_url: `${process.env.APP_URL}/subscribe?cancelled=true`,
      metadata: {
        artistProfileId: input.artistProfileId,
        userId: ctx.session.user.id,
        profileType: 'artist',
      },
    });

    return { checkoutUrl: session.url!, sessionId: session.id };
  }),
```

### Common Gotchas

- **`profileType` in metadata is critical**: The shared webhook handler routes to Venue or Artist logic based on this field. If missing or misspelled, the webhook silently does nothing. Validate it on the way in.
- **Separate price IDs**: `STRIPE_ARTIST_PRICE_ID` must be a different Stripe product/price from `STRIPE_VENUE_PRICE_ID`. Confirm both exist in Stripe Dashboard before testing.
- **`artist_subscriptions` table**: Must be created in DB migration before deploying this task. Mirror the `venue_subscriptions` schema.
- **M8-T6 dependency**: This task activates the Artist subscription but does not handle renewal, failure, or cancellation webhooks. Those are M8-T6. Don't ship Artist subscriptions to prod without M8-T6.
