# DS-T1 · Tailwind CSS v4 + CeolX Brand Token Configuration

| Field          | Value                                       |
| -------------- | ------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages      |
| **Status**     | 🔲 To Do                                    |
| **Depends on** | M1-T1 (Turborepo), M1-T5 (Admin scaffold)   |
| **PRD Ref**    | Section 10.1 (Tech Stack — Admin Dashboard) |

---

## Description

Establish a centralised Tailwind CSS v4 configuration for `apps/admin` with CeolX brand tokens. Define the Irish green primary colour, full shade spectrums, typography presets, spacing scale, and semantic colours as CSS custom properties. This is the foundation all admin UI components (ShadCN/UI, custom layouts) are built on. Must be done before DS-T2.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `apps/admin`      | Consumes Tailwind config — all UI classes derive from here                                        |
| `packages/shared` | Brand token constants exported for use in non-Tailwind contexts (e.g. React Native inline styles) |

---

## Requirements

### CeolX Brand Colour System

Sourced from Figma Design System page (Page 1 — "Color" frame). The palette uses a **10-step opacity model**: steps 1–9 are the base hue at 10%–90% opacity; step 10 is the solid full-saturation value.

- **Primary (Blue)**: `#662FFF` — 10-step opacity scale (`blue-1` → `blue-10`)
- **Secondary (Green)**: `#C8FF2F` — 10-step opacity scale (`green-1` → `green-10`)
- **Tertiary (Gray)**: explicit hex values per step (`gray-1` → `gray-10`)
- **Surface**: Dark `#363636` (default background), Near-black `#080808`, White `#FFFFFF`
- **Semantic**:
  - Error: `#EF4444`
  - Warning: `#F59E0B`
  - Success: `#C8FF2F` (maps to green secondary)
  - Info: `#662FFF` (maps to blue primary)

> **Note**: The Figma design is dark-themed by default (`#363636` canvas background). All surface tokens reflect this.

### CSS Custom Properties Strategy

- All colour tokens defined as CSS variables in `:root`
- Enables light mode override without a rebuild
- Variables follow Figma naming: `--color-blue-10`, `--color-green-5`, `--color-gray-1`, etc.

### Typography

Sourced from Figma Typography frame. Font family: **`Urbanist`** (Google Fonts) — all weights used.

| Token       | Size | Line Height | Weight         | Letter Spacing | Transform |
| ----------- | ---- | ----------- | -------------- | -------------- | --------- |
| `heading-1` | 36px | 40px        | 700 (Bold)     | 0              | —         |
| `heading-2` | 28px | 32px        | 700 (Bold)     | 0              | —         |
| `heading-3` | 20px | 24px        | 700 (Bold)     | 0              | —         |
| `heading-4` | 18px | 22px        | 700 (Bold)     | 0              | —         |
| `heading-5` | 16px | 20px        | 700 (Bold)     | 0              | —         |
| `heading-6` | 14px | 20px        | 700 (Bold)     | 0              | —         |
| `body-1`    | 16px | 20px        | 400 (Regular)  | 0              | —         |
| `body-2`    | 14px | 18px        | 400 (Regular)  | 0              | —         |
| `body-3`    | 12px | 16px        | 600 (SemiBold) | 0              | —         |
| `button-1`  | 16px | 20px        | 700 (Bold)     | 1px            | Uppercase |
| `button-2`  | 12px | 16px        | 700 (Bold)     | 2px            | Uppercase |

### Spacing & Layout

- Base unit: 4px
- Spacing scale: 1–96 (4px increments)
- Border radius tokens: `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full`
- Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)

### Tailwind v4 Config

- Use `@theme` directive (Tailwind v4 syntax — no `tailwind.config.ts`)
- Import in `apps/admin/src/styles/globals.css`
- PostCSS configured with `@tailwindcss/vite` plugin

---

## Acceptance Criteria

- [ ] Tailwind v4 installed in `apps/admin` with `@tailwindcss/vite` plugin
- [ ] `globals.css` defines all brand colour tokens as CSS custom properties
- [ ] `bg-blue-10` renders `#662FFF` in the browser
- [ ] `bg-green-10` renders `#C8FF2F` in the browser
- [ ] `bg-blue-1` renders `rgba(102, 47, 255, 0.1)` (10% opacity blue)
- [ ] All 10 gray steps available as `bg-gray-1` through `bg-gray-10`
- [ ] Semantic colour utilities available: `text-error`, `bg-success`, etc.
- [ ] Urbanist font loaded and applied as default sans-serif
- [ ] Admin scaffold compiles with zero Tailwind errors

---

## Dependencies

### Upstream

- M1-T1 (Turborepo — workspace package setup)
- M1-T5 (Admin app scaffolded — Vite config exists)

### Downstream

- DS-T2 (ShadCN/UI reads these tokens for component theming)
- DS-T3 (Shared web components use these classes)
- All admin UI screens (M8, M9)

---

## Technical Notes

### Tailwind v4 Setup (`apps/admin`)

```bash
pnpm add -D tailwindcss @tailwindcss/vite --filter @ceolx/admin
```

```typescript
// apps/admin/vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* apps/admin/src/styles/globals.css */
@import 'tailwindcss';

@theme {
  /* Primary — Blue (opacity scale) */
  --color-blue-1: rgba(102, 47, 255, 0.1);
  --color-blue-2: rgba(102, 47, 255, 0.2);
  --color-blue-3: rgba(102, 47, 255, 0.3);
  --color-blue-4: rgba(102, 47, 255, 0.4);
  --color-blue-5: rgba(102, 47, 255, 0.5);
  --color-blue-6: rgba(102, 47, 255, 0.6);
  --color-blue-7: rgba(102, 47, 255, 0.7);
  --color-blue-8: rgba(102, 47, 255, 0.8);
  --color-blue-9: rgba(102, 47, 255, 0.9);
  --color-blue-10: #662fff; /* CeolX brand primary */

  /* Secondary — Green (opacity scale) */
  --color-green-1: rgba(200, 255, 47, 0.1);
  --color-green-2: rgba(200, 255, 47, 0.2);
  --color-green-3: rgba(200, 255, 47, 0.3);
  --color-green-4: rgba(200, 255, 47, 0.4);
  --color-green-5: rgba(200, 255, 47, 0.5);
  --color-green-6: rgba(200, 255, 47, 0.6);
  --color-green-7: rgba(200, 255, 47, 0.7);
  --color-green-8: rgba(200, 255, 47, 0.8);
  --color-green-9: rgba(200, 255, 47, 0.9);
  --color-green-10: #c8ff2f; /* CeolX brand secondary */

  /* Tertiary — Gray (explicit hex per step) */
  --color-gray-1: #f4f4f4;
  --color-gray-2: #e8e8e8;
  --color-gray-3: #dddddd;
  --color-gray-4: #d1d1d1;
  --color-gray-5: #c6c6c6;
  --color-gray-6: #bbbbbb;
  --color-gray-7: #afafaf;
  --color-gray-8: #a4a4a4;
  --color-gray-9: #989898;
  --color-gray-10: #8d8d8d;

  /* Surface */
  --color-surface: #363636; /* default dark background */
  --color-surface-dark: #080808; /* near-black */
  --color-surface-white: #ffffff;

  /* Semantic */
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #c8ff2f; /* maps to green-10 */
  --color-info: #662fff; /* maps to blue-10 */

  /* Typography */
  --font-sans: 'Urbanist', ui-sans-serif, system-ui, sans-serif;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

### Shared Brand Constants

```typescript
// packages/shared/src/brand.ts
export const brand = {
  colors: {
    // Primary palette
    blue10: '#662FFF', // CeolX primary
    green10: '#C8FF2F', // CeolX secondary
    // Gray scale
    gray1: '#F4F4F4',
    gray5: '#C6C6C6',
    gray10: '#8D8D8D',
    // Surface
    surface: '#363636',
    surfaceDark: '#080808',
    // Semantic
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#C8FF2F',
    info: '#662FFF',
  },
} as const;
```

---

## Common Gotchas

- **Tailwind v4 uses `@theme` not `tailwind.config.ts`** — do not create a `tailwind.config.ts` file; v4 reads tokens directly from CSS.
- **`@tailwindcss/vite` not `postcss`** — v4 uses the Vite plugin, not the PostCSS plugin used in v3.
- **ShadCN expects specific CSS variable names** — ensure variable names match ShadCN's expected format (`--primary`, `--primary-foreground`) in DS-T2. Map `--primary` to `#662FFF`.
- **Opacity-based color tokens in Tailwind v4** — using `rgba()` directly in `@theme` works in v4. These render as static values (not Tailwind opacity modifiers). Do not try to use the `/<opacity>` modifier syntax with these tokens.
- **Urbanist font loading** — load via `@import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@400;600;700&display=swap')` at the top of `globals.css`. On mobile (DS-T4), use `expo-font` instead.
- **Dark-first design** — the Figma design uses `#363636` as the default background. Ensure `<body>` background and admin shell background use `--color-surface`, not white.

---
