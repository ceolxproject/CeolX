# Design

The visual system for CeolX. One token system powers two surfaces: the **mobile app** (`apps/native`, dark-only) and the **admin dashboard** (`apps/admin`, light). Shared primitives live in `packages/ui`; brand constants for non-CSS contexts live in `packages/shared/src/brand.ts`.

> Sources of truth:
>
> - `packages/ui/src/styles/globals.css` — base tokens (dark), Tailwind `@theme`, typography, radius, charts
> - `apps/admin/src/index.css` — admin light-mode overrides + shadow utilities
> - `apps/native/global.css` — mobile Tailwind 4 / Uniwind theme (dark)
> - `packages/shared/src/brand.ts` — brand color constants for TS contexts

## Theme

- **Mobile (`apps/native`):** dark-only in V1. Theme is forced to `dark` at startup (Uniwind). A light-mode context exists but is unused.
- **Admin (`apps/admin`):** light mode, optimized for readability during content moderation. `color-scheme: light`. Theme switching wired via `next-themes`.
- **Color space:** OKLCH throughout, with hex fallbacks/equivalents.

## Color

### Brand

| Role              | Value                              | Notes                                                                                                                            |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Primary (Blue)    | `#662FFF` · `oklch(0.44 0.27 278)` | CeolX brand purple-blue. Buttons, links, focus rings, active states. Admin light-mode nudges to `#7c6fff` for contrast on white. |
| Secondary (Green) | `#C8FF2F`                          | Lime accent. Success, highlights, category badges, persona icons, complementary CTAs.                                            |
| Logo gradient     | `#6155F5` → `#FFFFFF`              | Vertical gradient on the `CEOLX` wordmark (Urbanist 900).                                                                        |

Both brand hues ship as **10-step opacity scales** (`--color-blue-1`…`-10`, `--color-green-1`…`-10`), where step 10 is full strength and lower steps are transparencies — used for tints, hovers, and layered surfaces.

### Neutrals & surfaces

| Token                            | Dark (mobile / base)             | Light (admin)                                               |
| -------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `background`                     | `#363636` · `oklch(0.24 0 0)`    | `#f7f8fa` · `oklch(0.985 0.003 250)` (faint cool off-white) |
| `foreground`                     | `#FFFFFF`                        | `#1f1f23` · `oklch(0.21 0 0)`                               |
| `card` / `popover`               | `#2B2B2B` · `oklch(0.19 0 0)`    | `#FFFFFF`                                                   |
| `secondary` / `muted` / `accent` | `#4D4D4D` · `oklch(0.3 0 0)`     | `#f8f8f8` · `oklch(0.97 0 0)`                               |
| `muted-foreground`               | `#B3B3B3` · `oklch(0.7 0 0)`     | `#808080` · `oklch(0.5 0 0)`                                |
| `border` / `input`               | `oklch(1 0 0 / 12%)` (12% white) | `#ebebeb` / `#e6e6e6`                                       |
| `surface-dark` (sidebar)         | `#080808` · `oklch(0.14 0 0)`    | —                                                           |

Gray ramp: `--color-gray-1` `#f4f4f4` → `--color-gray-10` `#8d8d8d` (explicit hex, not opacity-based).

### Semantic

| Role                | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| Error / Destructive | `#EF4444` · `oklch(0.63 0.22 27)`                             |
| Warning             | `#F59E0B`                                                     |
| Success             | `#C8FF2F` (brand green; admin uses darker `#16a34a` on white) |
| Info                | `#662FFF` (brand blue)                                        |

Chart palette: blue `oklch(0.44 0.27 278)`, lime `oklch(0.79 0.23 122)`, red `oklch(0.63 0.22 27)`, gold `oklch(0.74 0.17 64)`, gray `oklch(0.6 0 0)`.

> **A11y note:** the purple/green/red roles must always be paired with an icon or label, never color alone (see PRODUCT.md). Verify AA contrast when placing brand hues on dark surfaces.

## Typography

- **Display / headings:** **Urbanist** — geometric sans, weights 500–900. Headings use bold (700+) with `letter-spacing: -0.01em`. The logo wordmark uses 900.
- **Body / secondary:** **Inter** — weights 400–600.
- **Stacks:**
  - `--font-sans`: `'Urbanist', ui-sans-serif, system-ui, sans-serif`
  - body default: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
- **Loading:** admin via Google Fonts CDN (`index.html` preconnect + link); mobile via `@expo-google-fonts/urbanist` + `@expo-google-fonts/inter` (`useFonts` in `app/_layout.tsx`).
- **Scale:** Tailwind defaults. Observed mobile usage: 11px badge → 12px (`text-xs`) meta → 14px (`text-sm`) → 16px (`text-base`) buttons → 18px (`text-lg`) → 24px (`text-2xl`) card titles.

Pairing rationale: one geometric sans (Urbanist) for display energy + a humanist sans (Inter) for body legibility — contrast on the humanist↔geometric axis, not two near-identical faces.

## Shape & Elevation

- **Radius scale:** `--radius-sm` 4px · `--radius-md` 8px (`--radius` base 0.5rem) · `--radius-lg` 12px · `--radius-xl` 16px, extending to `2xl` 16px / `3xl` 20px / `4xl` 24px. `rounded-full` for pills, badges, circular controls.
  - Inputs ≈ 4px, buttons 8–12px, cards/large surfaces 16px.
- **Elevation (admin):** Linear-style layered shadows, not color, carry card hierarchy:
  ```css
  box-shadow:
    0 1px 2px 0 rgb(15 23 42 / 0.04),
    0 4px 12px -4px rgb(15 23 42 / 0.06);
  ```
- **Elevation (mobile, dark):** hierarchy via surface tints (`#2B2B2B` cards on `#363636` bg, semi-transparent gray overlays/borders) rather than shadow.

## Spacing & Layout

- Tailwind default 4px base scale: `gap-1` 4 · `gap-2` 8 · `gap-3` 12 · `gap-4` 16, etc. No custom spacing scale.
- Mobile header baseline `px-5` (20px); cards `rounded-2xl` with `1px` semi-transparent gray borders.
- Mobile is single-column (no responsive breakpoints used); admin uses standard Tailwind responsive utilities.
- Mobile respects safe areas via `react-native-safe-area-context`.

## Components

**Shared (`packages/ui` — ShadCN over `@base-ui/react`, `base-lyra` style, `data-slot` attributes):** Avatar, Badge, Breadcrumb, Button (variants: default/outline/secondary/ghost/destructive/link; sizes xs–lg + icon variants), Card (+ Header/Title/Description/Action/Content/Footer), Checkbox, Dialog, DropdownMenu (full suite), Input, Label, Select, Skeleton, Sonner (Toaster), Table, Textarea, Tooltip.

**Mobile (`apps/native/components` — Tailwind 4 + Uniwind + HeroUI Native):**

- Primitives: `AppButton` (primary/secondary/outline/ghost; sizes sm/md; loading state), `AppTextInput` (label/error/icon/secure), `CheckboxField`, `Container`, `BottomSheet` (`@gorhom/bottom-sheet`), `AppToast`, `CeolxLogo`.
- Feature: `BaseEventCard` (slot-based: cover 208px, title/date/location, badge slots), `FeedEventCard`, `EventPreviewCard`, `CategoryFilterChips`, `EmptyState` (variants: no-events / no-results / no-bookings / no-notifications), `AppTabBar` (custom bottom nav + FAB for artists/venues), `FeedHeader`, `LocationPermissionScreen`, `LocationPicker`.
- Icons: `@expo/vector-icons` (Ionicons) + custom SVG `PersonaIcons` (Spectator/Artist/Venue on lime-green ground).

### Component patterns

- **Button** — primary: blue fill + white text; secondary: lime fill + dark text; outline: blue border; ghost: gray text. `active:opacity-80`.
- **Event card** — lime category badge (`text-[11px]`, dark text, `rounded-full`), `rounded-2xl`, faint gray border/overlay on dark.
- **Tab bar** — `#6155F5` ground, lime circular indicator for the active tab, gray-30% for inactive; gray FAB for artist/venue create.
- **Persona icons** — lime-green background with dark-surface foreground (`#080808`).

## Brand Assets

- Logo: text wordmark `CEOLX`, Urbanist 900, vertical gradient `#6155F5`→`#FFFFFF` (`CeolxLogo` component in both apps; admin uses `background-clip: text`, mobile uses SVG gradient). No SVG logo file in admin.
- Mobile app assets (`apps/native/assets/images/`): `icon.png`, `splash-icon.png`, `newLogo.png`, Android adaptive icon set (foreground/monochrome/background; adaptive background `#662FFE`, splash background `#FFFFFF`).

## Motion

No formal motion system documented yet. When adding motion: ease-out curves, no bounce; every animation needs a `prefers-reduced-motion` alternative (per PRODUCT.md accessibility). Mobile uses `active:opacity-*` press feedback as the current baseline.

## Entry points

- **Admin:** `apps/admin/index.html` → `/src/main.tsx`; Vite dev server on **port 3000** (`npm run dev`). Fonts via Google Fonts CDN.
- **Mobile:** Expo, `apps/native/app/_layout.tsx` root.
