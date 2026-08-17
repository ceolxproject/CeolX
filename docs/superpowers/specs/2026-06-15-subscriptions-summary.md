# CeolX Subscriptions — Summary for Approval

> ⛔ **SUPERSEDED 17/08/2026** by `docs/project-management/M8-Venue-Subscription/M8-T0-Subscription-Decisions.md`,
> which carries Sean's signed answers. Kept as a record of what was put to the client. Do not build from it.

**Date:** 2026-06-15 · **Prepared by:** Priya Yadav · **Status:** Superseded — see above
**Full design:** `docs/superpowers/specs/2026-06-15-subscriptions-design.md` (also superseded)

---

## 1. What we're building

Artists and Venues must hold an **active paid subscription** before their profile is visible and before they can publish events or posts. Subscriptions are **purchased and managed entirely on the web** (Stripe), never inside the app. The mobile app learns whether someone is paid **only from a Stripe webhook** that flips a status flag — the app itself never touches Stripe and never shows a checkout. This keeps us compliant with Apple's rule against third-party in-app payments and lets us keep ~97% of revenue (vs ~85% with Apple's in-app billing).

## 2. How it works (end to end)

1. User signs up, picks **Artist** or **Venue**, finishes onboarding → profile is created **inactive** (not visible, cannot publish).
2. We email them (Postmark) an activation link to **`ceolx.com/subscribe`**.
3. The app shows a simple banner: _"Your profile isn't visible yet. Check your email to activate."_ with a **Resend Email** button. No prices, no links, no checkout.
4. On the web page they pick a plan and pay via a **Stripe Payment Link** (Stripe's own hosted page).
5. Stripe notifies our backend (**webhook**). We mark the account **active** → profile becomes visible, publishing unlocks.
6. The app picks up the change automatically on next refresh.
7. **Cancel / change card / invoices** are handled on Stripe's **hosted Customer Portal**. **Refunds** are issued by us in the Stripe Dashboard. Either way, the change flows back through the same webhook.

## 3. Key decisions

| Area                     | Decision                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Who pays                 | **Both Artist and Venue** (artist tier priced lower than venue)                                               |
| Where they pay           | **Web only** — `ceolx.com/subscribe`, via Stripe Payment Links                                                |
| Manage / cancel / refund | **Stripe-hosted Customer Portal** + Stripe Dashboard for refunds (no billing UI built by us)                  |
| Data model               | **One shared `subscriptions` table** for both roles (no duplication — safe because one account = one persona) |
| App ↔ web link           | **None.** The app and the pay page share no link or API — only the webhook connects them                      |
| Publish rule             | Inactive users **may save drafts** but **cannot publish** events/posts                                        |

## 4. Build effort — mostly wiring, not greenfield

A previous milestone already scaffolded ~60% of this: the database columns, the email templates, the in-app "activate" banner, and the empty webhook/route stubs all exist (left as `TODO M8`). The genuinely new work is: add the artist side of the schema, install Stripe + implement the webhook, build the public `/subscribe` page, and add the "can't publish while inactive" checks. This is a contained, well-understood scope.

---

## 5. Open questions for sign-off

### Q1 — Can we display the subscription plans / prices **inside the app** if there's no in-app purchase?

**Recommendation: No — keep the app free of any pricing or plan UI.**

Apple Guideline **3.1.1** prohibits showing prices or steering users toward an outside payment method for digital subscriptions, unless we hold a special entitlement (music/"reader" apps, or the US external-link entitlement — neither fits us cleanly, and both still carry conditions). Displaying plan tiers/prices in-app while sending users to the web to pay is one of the most common triggers for a 3.1.1 rejection. The safe, proven pattern (and what our current design does) is to show **only** a neutral "your profile isn't active yet — check your email" message, with no prices, no plans, and no links.

> **Note:** Q1 and Q2 are linked — putting plans/prices in the app would directly _increase_ the rejection risk in Q2. The two decisions should be made together.

### Q2 — If we go web-purchase only, will the App Store / Play reviewer raise concerns? Any gaps?

**Recommendation: Low risk _if_ the app has zero purchase surface — but we must prepare for review.**

Web-only purchase is an established, allowed pattern (Netflix, Spotify, most B2B SaaS). Apple permits accessing a subscription bought elsewhere as long as we **do not steer** users to the external payment method from inside the app. Our design stays in this lane because the app sells nothing and links nowhere. Two things help us a lot: (a) the **free Spectator experience is fully functional**, so the app has clear value without paying, and (b) billing is administered out-of-band, like a business tool.

**Gaps / risks to close before submitting:**

- **"Resend Email" button + banner copy** must be strictly neutral — no "subscribe", "pay", "$", "upgrade", or external link. (The email may contain the link; the app may not.) This is the one spot a reviewer could read as "indirect steering."
- **Provide App Review notes + a pre-activated demo Artist and Venue account**, so the reviewer can test the gated features instead of hitting a paywall dead-end. Missing this is a frequent cause of rejection ("we couldn't access the feature").
- **Have a short appeal ready** explaining CeolX is a multiplatform/business service with no in-app purchase surface, in case a reviewer reflexively cites 3.1.1.
- **Google Play**: same principle, generally lower risk; no purchase UI in the app keeps us clear of mandatory Play Billing.

### Q3 — Smaller items needing a decision

- **Domain:** confirm the subscribe page lives at `ceolx.com` (code currently references `ceolx.com`).
- **Grace period:** when a renewal payment fails (`past_due`), do we hide the profile immediately or keep it visible during Stripe's retry window and only hide on final cancellation? (Proposed: keep visible during grace, hide on cancel.)
- **Plan catalog:** final number of venue tiers + the artist tier, their prices, and copy — needed before the web page is finished.

---

## 6. What I need

Sign-off on the **web-only, no-in-app-pricing** approach (Q1 + Q2 together), and a steer on the three smaller items in Q3. With that, I can finalise the implementation plan.

---

### Sources (App Store policy)

- [Apple App Review Guidelines (3.1.1 / 3.1.3)](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Developer News — Guidelines updated for external purchases (May 2025)](https://developer.apple.com/news/?id=xqk627qu)
- [RevenueCat — App-to-web: navigating external purchases on iOS and Android](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines/)
- [AppleInsider — Guidelines updated to reflect court order on external purchases](https://appleinsider.com/articles/25/05/02/apples-app-store-guidelines-updated-to-reflect-court-order-over-external-purchases)
