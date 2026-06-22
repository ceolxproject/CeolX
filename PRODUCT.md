# Product

## Register

product

## Users

CeolX serves four personas. One account supports exactly one persona, chosen at sign-up and fixed for the life of the account (Artist ↔ Venue switching is not supported — separate accounts are required).

- **Spectator (end user)** — Free. Music fans discovering Irish-music events. No public profile. Their context is mobile and on-the-move: browsing a map or feed to find a gig near them, often during festival season, sometimes with poor signal or location denied.
- **Musician / Artist** — Paid (lower tier). Public profile. Promotes performances, accepts/requests bookings, wants to get found and booked by venues. Profile is invisible until the subscription is active.
- **Venue / Business** — Paid (higher tier). Pubs, cultural hubs, promoters. Lists gigs, invites artists, runs promotional ads. Profile is invisible until the subscription is active.
- **Super Admin** — One internal account, web dashboard only. Reviews live content after publication, removes inappropriate events with a reason, views users, exports CSV. Not a power user of the mobile app.

The job to be done: **fans find the right gig nearby; artists and venues fill those gigs; admin keeps the content clean** — without anyone being blocked by missing location, empty areas, or payment friction.

## Product Purpose

CeolX is a **location-aware Irish-music discovery platform** for Chongie Entertainment Services (Ireland). It exists so Irish-music fans can discover live events around them (interactive map + feed) and so artists and venues can promote and book performances.

Scope is deliberately narrow: Irish music only, English only, controlled sub-1,000-user launch timed to the Irish festival season. Two paid roles (Artist, Venue) fund it via web-based Stripe; events go live immediately and are moderated after the fact.

Success looks like: a fan opens the app and immediately sees relevant nearby gigs (or a useful fallback when there are none); a paying artist/venue feels the platform is worth the subscription; the admin can keep content trustworthy with minimal effort.

## Brand Personality

**Bold, modern, energetic.** This is a music product, and it should feel like one — electric and high-contrast, not corporate.

- **Three words:** bold, modern, energetic.
- **Voice:** confident and direct, music-first, warm but not folksy. It speaks to people who love live music, not to enterprise buyers.
- **Feel:** the existing identity — electric purple (`#662FFF`) against dark surfaces, with a lime-green (`#C8FF2F`) accent and geometric Urbanist display type — is the brand. Lean into it. Energy comes from contrast and confident accent use, not from clutter.
- **Irish-music context** is carried through content, events, and place — not through twee or traditional visual cliché. Modern, not heritage-kitsch.

## Anti-references

CeolX should explicitly NOT look like:

- **A generic SaaS dashboard** — no hero-metric template (big number + small label + gradient accent), no endless identical icon-heading-text card grids, no tiny uppercase tracked eyebrow above every section, no blue-gray corporate blandness.
- **A cluttered event-listing site** — avoid Eventbrite/Ticketmaster density: ad-heavy, noisy, overwhelming lists with no hierarchy. Discovery should feel curated and calm, not like a directory dump.
- **Cold fintech minimalism** — avoid sterile, emotionless navy-and-gray restraint that strips out music-culture warmth and energy. CeolX has a pulse; don't flatten it.
- **Childish / gimmicky** — avoid over-rounded, cartoonish, emoji-heavy styling. Artists and venues pay for this; it must read as a professional, premium platform.

## Design Principles

1. **Discovery is the product.** The map and feed are the core. Prioritize clarity of "what's near me / what's on" over chrome and decoration. Every screen should make the next gig easy to find.
2. **Energetic, not noisy.** The electric purple and lime accents are powerful precisely because they're used with discipline. Bold accents earn their place against dark surfaces; restraint is what makes the energy land.
3. **One system, two themes.** The mobile app (dark) and admin dashboard (light) draw from a single token system and brand. They should read as unmistakably the same product despite the theme inversion.
4. **Respect the paywall.** Paying artists and venues must feel the platform is premium and trustworthy. Polish, precision, and reliability signal that the subscription is worth it.
5. **Never block the user.** Location-first, but with graceful fallbacks (GPS → IP → Ireland default; silent radius auto-expand; always-available search). The interface degrades gracefully and always offers a manual override.

## Accessibility & Inclusion

- **Target WCAG 2.1 AA** across both the mobile app and the admin dashboard as the baseline.
- **Contrast care for the brand palette:** electric purple on dark and lime-green on dark both need verification at AA (4.5:1 body, 3:1 large/UI). Don't let the energetic palette undercut legibility.
- **Don't rely on color alone for state.** Green = success / red = error / purple = active must be paired with icons or labels, given the purple↔green brand pairing.
- **Reduced motion:** any motion added should ship with a `prefers-reduced-motion` alternative.
- GDPR-conscious context (Irish client): consent, on-demand location only, right to erasure and portability — design flows accordingly.
