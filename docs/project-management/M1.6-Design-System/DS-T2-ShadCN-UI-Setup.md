# DS-T2 · ShadCN/UI Initialisation + CeolX Theme

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages              |
| **Status**     | ✅ Done                                             |
| **Depends on** | DS-T1 (Tailwind v4 + brand tokens must exist first) |
| **PRD Ref**    | Section 10.1 (Admin Dashboard — ShadCN/UI)          |

---

## Description

Initialise ShadCN/UI in `apps/admin` with CeolX brand theme overrides. ShadCN components are copied into the codebase (not installed as a dependency) and are fully editable. Configure base components — Button, Input, Dialog, Table, Badge, Toast, Card — all styled with the Irish green primary colour. This is the component foundation for the admin dashboard and Venue subscription page.

---

## Affected Apps / Packages

| App / Package | Role                                                                |
| ------------- | ------------------------------------------------------------------- |
| `apps/admin`  | ShadCN components live in `src/components/ui/` — owned and editable |

---

## Requirements

### Initialisation

- Run `npx shadcn@latest init` in `apps/admin`
- Style: `default` (New York variant preferred — cleaner for admin UIs)
- Base colour mapped to CeolX primary purple (`--primary: oklch(...)` from `#662FFF`)
- CSS variables mode: enabled
- Tailwind config: points to `globals.css` (DS-T1)

### Base Components to Add

| Component       | Used in                                         |
| --------------- | ----------------------------------------------- |
| `button`        | All CTAs — Approve, Reject, Subscribe           |
| `input`         | Search bar, forms                               |
| `dialog`        | Reject event modal (with reason field)          |
| `table`         | Users table, events moderation queue            |
| `badge`         | Event status labels (pending, active, rejected) |
| `toast`         | Success/error feedback                          |
| `card`          | KPI overview cards on admin dashboard           |
| `dropdown-menu` | User actions menu                               |
| `avatar`        | User profile display                            |
| `separator`     | Layout dividers                                 |

### Theme Customisation

- Override `--primary` with CeolX purple `#662FFF` in `globals.css`
- Override `--primary-foreground` with white `#FFFFFF`
- Override `--destructive` with `#EF4444` (reject/error actions)
- Override `--radius` with `0.5rem` (8px — matches brand radius)
- Override `--background` with `#363636` (dark surface — matches Figma)
- Override `--foreground` with `#FFFFFF` (white text on dark background)

### Component Export Pattern

```
apps/admin/src/components/ui/   ← ShadCN generated components (do not edit manually)
apps/admin/src/components/      ← Custom composed components (build on top of ui/)
```

---

## Acceptance Criteria

- [ ] `npx shadcn@latest init` completed with CeolX theme
- [ ] All 10 base components added and rendering correctly
- [ ] `<Button>` renders with `#662FFF` background in primary variant
- [ ] `<Badge variant="destructive">` renders with error red `#EF4444`
- [ ] `<Dialog>` opens and closes correctly
- [ ] `<Table>` renders with correct column/row structure on `#363636` background
- [ ] `<Toast>` appears on trigger and auto-dismisses
- [ ] No TypeScript errors in generated components
- [ ] Components import cleanly from `@/components/ui/button` etc.

---

## Dependencies

### Upstream

- DS-T1 (Tailwind v4 with CSS custom properties — ShadCN reads these)

### Downstream

- DS-T3 (Shared admin components built on top of these base components)
- M8 (Venue Subscription page uses Button, Card, Input)
- M9 (Super Admin dashboard uses Table, Badge, Dialog, Toast)

---

## Technical Notes

### Init Command

```bash
cd apps/admin
npx shadcn@latest init
```

Select when prompted:

- Style: `New York`
- Base color: `Custom` → enter `#00a86b`
- CSS variables: `Yes`

### Add Components

```bash
npx shadcn@latest add button input dialog table badge toast card dropdown-menu avatar separator
```

### Theme Override in `globals.css`

```css
/* apps/admin/src/styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 21.2%; /* #363636 — dark surface */
    --foreground: 0 0% 100%; /* #FFFFFF */
    --primary: 258 100% 59%; /* #662FFF */
    --primary-foreground: 0 0% 100%; /* #FFFFFF */
    --destructive: 0 84% 60%; /* #EF4444 */
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 30%; /* slightly lighter than surface */
    --radius: 0.5rem;
  }
}
```

### Component Usage Example

```tsx
// apps/admin/src/components/ui usage
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Event status badge — primary variant uses #662FFF
const statusVariant = {
  pending_review: 'secondary',
  active: 'default',    // renders #662FFF background
  rejected: 'destructive',
  archived: 'outline',
} as const;

<Badge variant={statusVariant[event.status]}>{event.status}</Badge>
<Button variant="default" onClick={approveEvent}>Approve</Button>
<Button variant="destructive" onClick={rejectEvent}>Reject</Button>
```

---

## Common Gotchas

- **ShadCN copies files — not a package**: Running `npx shadcn add` writes files into your `src/components/ui/`. Never `npm install shadcn-ui` — that's a different, unofficial package.
- **Re-running `add` overwrites**: Adding a component that already exists will overwrite your customisations. Edit components in-place after adding.
- **Tailwind v4 + ShadCN**: ShadCN v2+ supports Tailwind v4. Ensure you're using `shadcn@latest`, not an older version.
- **`cn()` utility**: ShadCN requires `clsx` + `tailwind-merge` for the `cn()` helper. The init command installs these automatically.

---
