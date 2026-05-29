# Admin UI — Token Discipline Refactor

**Date:** 2026-05-26 (drafted) · **As-built revision:** 2026-05-28
**Owner:** Foram Mavani
**Branch:** `feat/admin-ui-improvements` (off `development`)
**Related design docs:**

- [docs/project-management/M1.6-Design-System/DS-T1-Tailwind-v4-Brand-Config.md](../project-management/M1.6-Design-System/DS-T1-Tailwind-v4-Brand-Config.md)
- [docs/project-management/M1.6-Design-System/DS-T2-ShadCN-UI-Setup.md](../project-management/M1.6-Design-System/DS-T2-ShadCN-UI-Setup.md)
- [docs/project-management/M1.6-Design-System/DS-T3-Shared-Admin-Web-Components.md](../project-management/M1.6-Design-System/DS-T3-Shared-Admin-Web-Components.md)

---

## Why this exists

The admin app rendered with three visible UI failures:

1. **White sidebar + white top header** on a dark canvas — high-contrast clash, looks broken.
2. **Event Moderation Status dropdown was white-on-white** — text invisible.
3. **Account page rendered white cards** with dark text that was unreadable against the rest of the shell.

The original draft of this plan assumed the fix was to flip `defaultTheme` to `"dark"` and lean on the shared ShadCN dark tokens. During implementation we pivoted: the admin dashboard hosts long moderation sessions, so a **light main content area with a dark sidebar (Linear / Vercel style)** reads better than an all-dark shell while still giving the brand purple a strong place to live. The mobile app remains dark-first; only the admin is light-shell.

The bugs themselves came from three independent failures stacked together in the admin app only:

| #   | Failure                                                                                                            | Where                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| F1  | `next-themes` `storageKey` was reused across the visual rework, so old client cache pinned stale CSS variables.    | [`apps/admin/src/routes/__root.tsx`](../../apps/admin/src/routes/__root.tsx)                       |
| F2  | Custom shell components hard-coded `bg-white`, `text-gray-700`, `border-gray-200`, `[#0d0c0f]` — bypassing tokens. | `apps/admin/src/components/{Sidebar,AdminHeader}.tsx`                                              |
| F3  | Routes hard-coded the same raw Tailwind greys / whites.                                                            | `apps/admin/src/routes/_admin/{account,events/moderation,users,dashboard}.tsx`, `routes/login.tsx` |

There was also dead duplication: `apps/admin/src/index.css` redefined `--ceolx-*` variables that nothing meaningful referenced.

## Goal

Make the admin app render consistently against a coherent token set — dark sidebar tokens from `packages/ui` + admin-local light shell tokens in `apps/admin/src/index.css` — with **zero raw Tailwind greys/whites** in `apps/admin/src/**`. Prevent regression with a lint rule.

## Out of scope

- Changing the brand palette beyond what the admin shell needs.
- Mobile app changes.
- Any feature work (routes, queries, mutations) outside the refactor.
- Touching `packages/ui` **beyond** corner-radius + control-height polish that was needed for the light shell to look right (see Step 10).

---

## Step-by-step plan (as shipped)

### Step 1 — Reset the theme provider; keep default `light`

**File:** [`apps/admin/src/routes/__root.tsx`](../../apps/admin/src/routes/__root.tsx)
**Change:** `defaultTheme="light"` kept. `storageKey` bumped `"ceolx-admin-theme"` → `"ceolx-admin-theme-v2"` to invalidate any cached theme selection from before the refactor.
**Why we did not flip to `dark`:** during preview Priya called the light-shell + dark-sidebar layout (Linear-style) as the better fit for long moderation sessions. We keep the sidebar dark via the shared `--sidebar-*` tokens; the rest of the shell uses an admin-only light palette declared in [`apps/admin/src/index.css`](../../apps/admin/src/index.css) (see Step 7).

---

### Step 2 — Refactor `Sidebar.tsx` onto tokens

**Files:** [`apps/admin/src/components/Sidebar.tsx`](../../apps/admin/src/components/Sidebar.tsx) + [`apps/admin/src/components/CeolxLogo.tsx`](../../apps/admin/src/components/CeolxLogo.tsx)

**Design call (Priya, after three iterations):**

- **Iteration 1:** blue rail + green active pill (mirror mobile exactly). Felt overwhelming.
- **Iteration 2:** dark rail (`#080808`) + brand-spec blue `#662FFF` + brand-spec green `#C8FF2F` hover. Admin's `#662FFF` looked too blue vs mobile's purple-leaning equivalent.
- **Iteration 3:** dark rail + mobile-drift blue `#6155F5`. Closer but slightly muddy against the new light shell.
- **Final (shipped):** dark rail `bg-sidebar` (`#080808`) + active pill **`#7C6FFF`** (a brighter purple that pops against both the dark sidebar and the light shell) + neutral hover (`hover:bg-sidebar-foreground/10`) instead of a brand-green hover. The brand-green felt loud once the rest of the dashboard went light; neutral hover lets the active state carry the brand alone.

**Brand-colour drift acknowledgement (still open):** there is a real discrepancy between DS-T1 spec (`#662FFF` / `#C8FF2F`), what mobile ships (`#6155F5` / `#D4FC5A`), and what the admin sidebar now ships (`#7C6FFF`). Mobile remains the source of truth for the mobile app. For the admin shell, `#7C6FFF` is used directly as a raw hex because it lives in the sidebar `activeProps` className and in `--primary` / `--ring` in `index.css`. A follow-up should align all three to one canonical brand purple — needs stakeholder sign-off (Aravind / Pratiksha) since DS-T1 is the design system contract.

**Sidebar structural changes (vs original):**

- Sidebar is now three regions: **top** (centred logo + "Admin Dashboard" subtitle), **middle** (`flex-1` nav, `space-y-2`, `py-2.5`), **bottom** (user email + Logout button).
- Width: `w-60` (down from `w-64`) — gives the light shell more breathing room.
- Mobile drawer: same structure, drawer overlay uses `bg-surface-dark/40` instead of raw `bg-black/40`.
- Active link `activeProps.className` is appended to (not replaced with) the base layout classes, so padding/rounding survive — Tanstack Router's `activeProps` merges in this setup. The active classes are `bg-[#7C6FFF] hover:!bg-[#7C6FFF] text-primary-foreground hover:!text-primary-foreground font-semibold` — the `!` important flags on hover overrides prevent the inactive hover styles from leaking in.

**`CeolxLogo.tsx` rewrite:** SVG `<text>` → HTML `<span>` with `background-clip: text` for the purple→white gradient. Default `fontSize` bumped 22 → 28. Sidebar invokes at `fontSize={28}` (desktop) / `fontSize={26}` (mobile drawer). Login still uses `fontSize={22}` for the header lockup.

---

### Step 3 — Delete `AdminHeader`; move email + logout into the sidebar footer

**Decision change (Priya, 2026-05-26):** the white top header strip held nothing but the email + logout dropdown — content that belongs in the sidebar bottom. Side benefits: no white-strip problem to fix, more vertical screen space, cleaner shell.

**Files touched:**

- [`apps/admin/src/components/AdminHeader.tsx`](../../apps/admin/src/components/AdminHeader.tsx) — **deleted**. Grep confirmed nothing else imported it.
- [`apps/admin/src/components/AdminShell.tsx`](../../apps/admin/src/components/AdminShell.tsx) — simplified: `<Sidebar />` + `<main className="flex-1 overflow-auto p-6">`. Inner column wrapper dropped.
- [`apps/admin/src/components/Sidebar.tsx`](../../apps/admin/src/components/Sidebar.tsx) — added `SidebarFooter` inner component pinned to the bottom: shows user icon + email (truncated) on the top line, Logout button on the bottom. Session + `signOut` logic lifted from the old `AdminHeader`.

**Visible impact:** the white strip across the top of every admin page is gone. Sidebar now reads top-to-bottom: CEOLX wordmark → Admin Dashboard subtitle → nav → email + Logout (with a separator line above the footer).

---

### Step 4 — Refactor `account.tsx` route

**File:** [`apps/admin/src/routes/_admin/account.tsx`](../../apps/admin/src/routes/_admin/account.tsx)
**Shipped changes:**

- `text-gray-900` headings → `text-foreground`.
- Card containers `bg-white border-gray-200` → `bg-card text-card-foreground border-border` (still hand-built containers — not converted to ShadCN `<Card>` since the form layout is small and bespoke).
- Labels `text-gray-700` → `text-foreground`.
- Read-only `<Input className="bg-gray-50" />` → `<Input disabled />` so ShadCN's disabled styling drives the look.

**Visible impact:** Profile + Change Password cards are now pure-white cards lifted off the page by the `.bg-card` box-shadow rule in Step 7. Email field reads correctly.

---

### Step 5 — Refactor `events/moderation.tsx` route

**File:** [`apps/admin/src/routes/_admin/events/moderation.tsx`](../../apps/admin/src/routes/_admin/events/moderation.tsx)
**Shipped changes (bigger than originally planned):**

- **Filter selects:** raw `<select>` → ShadCN `<Select>` from `@CeolX/ui/components/select`. Picks up the popover + highlighted/selected tokens automatically. Selected item now shows the brand purple `data-[selected]:bg-primary` highlight + check mark (see Step 10).
- **Filter layout:** search input moved to the leading position; status + creator selects sit to its right; count text floats right via `ml-auto`. Padding fixed with `pr-2` so the right-aligned count doesn't kiss the scrollbar.
- **Table:** raw `<table>` → ShadCN `<Table>` primitives (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`) from `@CeolX/ui/components/table`. Table container wears `bg-card`.
- **Cover thumbnails:** `h-10 w-10 rounded bg-gray-100` placeholder → `h-11 w-11 rounded-lg` real cover with `ring-1 ring-zinc-200 shadow-sm`. Empty state is a soft `from-zinc-100 to-zinc-200` gradient with an inline image-placeholder SVG. (Zinc literals retained intentionally — the ESLint rule in Step 8 covers the Tailwind grey/blue/green scales but not zinc; this is the one local exception.)
- **Cell text:** `text-gray-900/700/500/400` → `text-foreground` / `text-muted-foreground` / `text-muted-foreground/70`.
- **Detail dialog:** added `max-h-[85vh] overflow-y-auto` so long descriptions scroll. Header gets `space-y-2`; `<dl>` rewritten with uppercase `text-xs tracking-wider` term labels above each definition — cleaner read for the moderator.

---

### Step 6 — Refactor `login.tsx` route (Option C — bespoke + tokenised)

**File:** [`apps/admin/src/routes/login.tsx`](../../apps/admin/src/routes/login.tsx)

Plan offered Option A (keep white-on-dark, just tokenise) or B (switch to ShadCN `<Input>`). Shipped **Option C — a third path**: keep the bespoke marketing layout (it's the only page styled this way, intentionally not the standard admin shell) but tokenise every literal **and** add a password show/hide eye toggle for usability.

**Shipped changes:**

- Page wrapper `bg-[#0d0c0f] text-white` → `bg-surface-dark text-white` (token).
- Heading: inline-style `<h1>` → `text-4xl font-bold leading-tight text-center` (Tailwind classes, no inline styles). Centered.
- Error banner: `bg-red-500/15 border-red-500/30 text-red-300` → `bg-destructive/15 border-destructive/30 text-destructive`.
- Inputs: `bg-white text-black placeholder:text-gray-500 ring-[var(--ceolx-blue)]` → `bg-surface-white text-surface-dark placeholder:text-muted-foreground focus-visible:ring-ring`.
- Placeholders changed `admin@ceolx.ie` / `••••••••` → `Enter Email` / `Enter Password`.
- Password input wrapped in `relative` with an `Eye / EyeOff` toggle button (`lucide-react`) at `right-3 top-1/2 -translate-y-1/2`.
- Submit button: `bg-[var(--ceolx-blue)] rounded-full` → `bg-primary text-primary-foreground rounded-md`. Removed the inline `fontFamily: Urbanist` — body font already governs.

---

### Step 7 — Rewrite `index.css` as the admin's local light-theme contract

**File:** [`apps/admin/src/index.css`](../../apps/admin/src/index.css)

The original plan said "drop the local tokens and let the shared globals govern." Once we committed to a light shell with a dark sidebar, that was no longer right — the shared globals are dark-first, so the admin had to declare its own light surface tokens locally while keeping the shared `--sidebar-*` tokens in play.

**Shipped contents:**

- `color-scheme: light` so native form controls + scrollbars render light.
- Linear-style elevation surface set:
  - `--background: oklch(0.985 0.003 250)` — very faint cool grey page.
  - `--card: oklch(1 0 0)` — pure white. Lift comes from `box-shadow`, not colour.
  - `--popover: oklch(1 0 0)`.
  - `--muted` / `--accent` / `--secondary`: `oklch(0.97 0 0)`.
  - `--border: oklch(0.92 0 0)`, `--input: oklch(0.9 0 0)`.
  - `--foreground: oklch(0.21 0 0)`, `--muted-foreground: oklch(0.5 0 0)`.
- `--primary: #7C6FFF` and `--ring: #7C6FFF` — keeps the active sidebar pill, focus rings, primary buttons, and selected `<SelectItem>` highlight all on one brand colour.
- `--color-success: #16a34a` (darker green than the lime brand token, because lime is unreadable on white).
- Heading override block kept (Urbanist 800 with negative letter-spacing).
- Two utility rules at the bottom:
  - `.bg-card { box-shadow: layered soft shadow; }` — every card-surface lifts off the page automatically without each route declaring its own shadow.
  - `[data-slot='table-header'] { background-color: faint tint; }` — ShadCN table heads get an off-white band so they visually anchor without a hard border.

---

### Step 8 — Add ESLint rule to block raw greys/whites in admin

**File:** [`eslint.config.js`](../../eslint.config.js)

Shipped a single `no-restricted-syntax` rule scoped to `apps/admin/src/**/*.{ts,tsx,jsx}` that bans these inside `className` JSX attributes via regex:

```
\b(?:bg|text|border)-(?:white|black|(?:gray|blue|green)-(?:50|100|200|300|400|500|600|700|800|900)|red-[0-9]+)\b
```

- Bans `bg-white`, `bg-black`, `text-white`, etc.
- Bans the Tailwind default 50–900 scale on `gray`, `blue`, `green`.
- Bans the entire Tailwind `red-*` family (semantic should go through `destructive`).
- **Does not** touch brand tokens `gray-1..gray-10`, `blue-1..blue-10`, `green-1..green-10` defined by DS-T1 — the digit-prefix scheme keeps them clean of this regex.
- **Does not** touch `zinc-*` / `amber-*` / `emerald-*` — used intentionally in `StatusBadge` and the moderation cover placeholder.

Error message points future PRs to the right tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-destructive`).

---

### Step 9 — Dashboard rebuild (added during implementation, not in original plan)

**File:** [`apps/admin/src/routes/_admin/dashboard.tsx`](../../apps/admin/src/routes/_admin/dashboard.tsx)

The original `KpiCard` + `KpiBreakdown` + `TrendLine` was monochrome and lost signal once everything went white-on-white. Rebuilt around four small in-file primitives:

- `MetricCard` — wraps ShadCN `<Card>`. Layout: icon chip + uppercase label + optional `AttentionPill` on top row, large `tabular-nums` value + caption underneath, free-form grid in the body.
- `StatTile` — small labelled number tile. Optional `tone="warning" | "destructive"` paints the tile bg + value text in muted amber/red only when the number is `> 0` (no fake red zeros).
- `TrendPill` — week-over-week / month-over-month delta, pill-shaped, semantic colour.
- `AttentionPill` — uppercase chip for "Pending review" / "Past due" call-outs.
- `IconChip` — neutral rounded square holding the metric's `lucide-react` icon.

All colour comes from a single `COLOR` const map at the top of the file (`success`, `warning`, `destructive`, `brand` + `*Bg` variants + neutrals). Means tuning the palette is a single-file edit. **Note:** these are inline hex literals — they're applied via `style={{ ... }}`, so the ESLint className regex doesn't catch them. That's intentional: this file is the one place we want explicit semantic colour for state communication; the lint rule is about `className` discipline, not blanket colour bans.

Nine metric cards in a `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` layout: Total Users, Active Users, Monthly Revenue, Events, Top Categories, Bookings, Engagement, Moderation, New Users.

`KpiSkeletonGrid` updated to 9 tiles at `h-52` to match the new card height.

The standalone `apps/admin/src/components/KpiCard.tsx` import is gone. (The component file may still exist on disk — see follow-ups.)

---

### Step 10 — `packages/ui` corner-radius + control-height polish

**Note:** original plan said "no changes in `packages/ui`." That changed once the admin pivoted to a light Linear-style shell — the shared primitives shipped with `rounded-none` and `h-8`/`h-9` controls, which read as too brutalist against the light surfaces. These touches help both admin and (future) any other ShadCN consumer; mobile doesn't render these web primitives.

**Files & changes:**

- [`packages/ui/src/components/button.tsx`](../../packages/ui/src/components/button.tsx)
  - `rounded-none` → `rounded-md` on the base class and on `xs`, `sm`, `icon-xs`, `icon-sm`.
  - Default size grew `h-8 px-2.5 text-xs` → `h-9 px-3.5 text-sm` (closer to the input height for visual rhythm in forms).
- [`packages/ui/src/components/card.tsx`](../../packages/ui/src/components/card.tsx)
  - `rounded-none` → `rounded-lg`.
- [`packages/ui/src/components/dialog.tsx`](../../packages/ui/src/components/dialog.tsx)
  - Content panel `rounded-none` → `rounded-lg`.
- [`packages/ui/src/components/input.tsx`](../../packages/ui/src/components/input.tsx)
  - `h-8 px-2.5 py-1 text-xs rounded-none bg-transparent` → `h-10 px-3 py-2 text-sm rounded-md bg-background`.
  - Matches the new default button height.
- [`packages/ui/src/components/select.tsx`](../../packages/ui/src/components/select.tsx)
  - Trigger: `h-9 rounded-none` → `h-10 gap-2 rounded-md`.
  - Positioner: `sideOffset={6} alignItemWithTrigger={false}` so the popover sits below the trigger instead of overlapping it. Popover width matches the trigger via `w-[var(--anchor-width)]`.
  - Item indicator: simple dot → `<Check>` icon at `strokeWidth=3`.
  - Item states added: `data-[highlighted]` (hover / keyboard focus) uses `bg-accent text-accent-foreground`, `data-[selected]` uses `bg-primary text-primary-foreground`, and the combination `data-[selected][data-highlighted]` keeps the primary look so the highlighted state never overwrites the selected one. This is what makes the moderation filter dropdowns read correctly.

---

### Step 11 — Shared admin components: `StatusBadge`, `DataTable`, `Loader`

**StatusBadge** ([`apps/admin/src/components/StatusBadge.tsx`](../../apps/admin/src/components/StatusBadge.tsx)) — was emitting `bg-warning/20 text-warning border-warning/40` etc., which against the light shell with our token values read as oversaturated. Switched to explicit Tailwind status palettes:

- `draft` / `archived`: `zinc-100 / zinc-700 / zinc-200`
- `pending_review`: `amber-50 / amber-800 / amber-200`
- `rejected` / `removed`: `red-50 / red-700 / red-200`
- `active`: `emerald-50 / emerald-700 / emerald-200`

Added a 1.5px status dot (`STATUS_DOT` map), and on `active` the dot is wrapped in a `before:animate-ping` halo so live events visibly pulse. Test snapshot updated: `expect(badge.className).toMatch(/destructive/)` → `/red/`, etc. (These red literals are in the StatusBadge file only; the ESLint rule's `red-[0-9]+` catch is bypassed because the values come from a typed `Record<EventStatus, string>` constant — the linter only inspects literal className attribute strings.)

**DataTable** ([`apps/admin/src/components/DataTable.tsx`](../../apps/admin/src/components/DataTable.tsx)) — container `rounded-md border border-border` → `rounded-lg border border-border bg-card`. Aligns with the moderation/users tables.

**Loader** ([`apps/admin/src/components/loader.tsx`](../../apps/admin/src/components/loader.tsx)) — spinner ring `border-green-600` → `border-success` (token).

---

### Step 12 — `users.tsx` polish

**File:** [`apps/admin/src/routes/_admin/users.tsx`](../../apps/admin/src/routes/_admin/users.tsx)

- Heading moved above the search row (was inline with the Export button).
- Search input grows to `max-w-sm`, Export CSV button sits at the right via `justify-between`. Export button drops the `mr-2` icon margin in favour of the parent `gap-2`.
- DataTable wrapper inherits the new `bg-card` from Step 11.
- Inactive flag chip `bg-amber-100 text-amber-800` → `bg-warning/20 text-warning`.
- Em-dash placeholders normalised to ASCII `-` for consistency with the moderation route.

---

### Step 13 — Verify

- `pnpm --filter @CeolX/admin dev` and walk each route: `/login`, `/dashboard`, `/users`, `/events/moderation`, `/account`.
- Compare against the four screenshots from the start of the refactor.
- Confirm: dark sidebar with purple active pill, no white header strip, dropdowns readable, account cards lift correctly, dashboard cards render with semantic state colour.
- Run `pnpm lint` — the new ESLint rule must pass clean.
- Run `pnpm typecheck` — must pass clean.
- Run `pnpm --filter @CeolX/admin test` — `StatusBadge.test.tsx` snapshot was updated to match `/red/` and `/emerald/`; rerun to confirm.

---

## Files touched (as shipped)

| File                                                       | Step | Status      |
| ---------------------------------------------------------- | ---- | ----------- |
| `apps/admin/src/routes/__root.tsx`                         | 1    | modified    |
| `apps/admin/src/components/Sidebar.tsx`                    | 2, 3 | modified    |
| `apps/admin/src/components/CeolxLogo.tsx`                  | 2    | modified    |
| `apps/admin/src/components/AdminHeader.tsx`                | 3    | **deleted** |
| `apps/admin/src/components/AdminShell.tsx`                 | 3    | modified    |
| `apps/admin/src/routes/_admin/account.tsx`                 | 4    | modified    |
| `apps/admin/src/routes/_admin/events/moderation.tsx`       | 5    | modified    |
| `apps/admin/src/routes/login.tsx`                          | 6    | modified    |
| `apps/admin/src/index.css`                                 | 7    | modified    |
| `eslint.config.js`                                         | 8    | modified    |
| `apps/admin/src/routes/_admin/dashboard.tsx`               | 9    | modified    |
| `packages/ui/src/components/button.tsx`                    | 10   | modified    |
| `packages/ui/src/components/card.tsx`                      | 10   | modified    |
| `packages/ui/src/components/dialog.tsx`                    | 10   | modified    |
| `packages/ui/src/components/input.tsx`                     | 10   | modified    |
| `packages/ui/src/components/select.tsx`                    | 10   | modified    |
| `apps/admin/src/components/StatusBadge.tsx`                | 11   | modified    |
| `apps/admin/src/components/__tests__/StatusBadge.test.tsx` | 11   | modified    |
| `apps/admin/src/components/DataTable.tsx`                  | 11   | modified    |
| `apps/admin/src/components/loader.tsx`                     | 11   | modified    |
| `apps/admin/src/routes/_admin/users.tsx`                   | 12   | modified    |

**No changes** in `apps/native` or any other app/package.

## Acceptance criteria

- [x] Sidebar background is `#080808` (`--sidebar` token), foreground white, active item is `#7C6FFF` purple pill with white text.
- [x] Top header strip removed entirely; user email + Logout live in the sidebar footer.
- [x] Event Moderation Status + Creator dropdowns render as ShadCN `<Select>` with a brand-purple selected state and a check-mark indicator.
- [x] Account page Profile + Change Password sections render as white cards lifted from the page via the `.bg-card` box-shadow rule.
- [x] Login page tokenised (Option C — bespoke layout preserved, raw colours swapped for tokens, password show/hide toggle added).
- [x] Dashboard rebuilt around `MetricCard` + `StatTile` + `TrendPill` + `AttentionPill` with a single `COLOR` const driving all semantic state colour.
- [x] Zero matches for the banned regex inside `apps/admin/src/**` (verify with `pnpm lint`).
- [x] `pnpm lint`, `pnpm typecheck`, and `pnpm --filter @CeolX/admin test` all pass.

## Risks / things that bit us

- **`activeProps.className` on TanStack Router `<Link>`** appends to the base className in this setup, so we only needed to specify the _changes_ (bg, text, font-weight). The `!` important flags on `hover:!bg-[#7C6FFF]` are required to stop the inactive hover from overriding the active background.
- **`Toaster richColors`** in `__root.tsx` is independent of `next-themes` — won't be affected by the storage-key bump.
- **ShadCN `<Select>` positioning**: had to add `sideOffset={6} alignItemWithTrigger={false}` to stop the popover from overlapping the trigger, and `w-[var(--anchor-width)]` so the popover matches the trigger width.
- **`StatusBadge` red/emerald literals** evade the ESLint rule because they live in a typed `Record` map, not in an inline className. This is the only file in admin that does this on purpose; flagged as a known exception in the rule's comment block.
- **Dashboard semantic colours** come from inline `style={{ ... }}` using a `COLOR` const, not from className tokens. Same exception logic — explicit, single-file, and the linter doesn't see them.

## Follow-ups captured during this refactor

1. **Brand purple unification** — three different purples in play (`#662FFF` spec, `#6155F5` mobile, `#7C6FFF` admin). Needs DS-T1 update + stakeholder sign-off (Aravind / Pratiksha).
2. **Brand green unification** — `#C8FF2F` spec vs `#D4FC5A` mobile. Same DS-T1 update.
3. **Dead `KpiCard` component** — `apps/admin/src/components/KpiCard.tsx` is no longer imported by `dashboard.tsx`. Confirm and delete.
4. **Admin-local light shell as a documented theme** — consider promoting the `index.css` overrides into a named `.admin-light` theme block in `packages/ui` so future admin-style apps can opt in instead of redeclaring.
5. **StatusBadge token migration** — once the design tokens grow `--color-success-50` / `-700` etc. variants, swap the inline zinc/amber/red/emerald back to tokens and remove the StatusBadge exception note from the ESLint rule comment.
