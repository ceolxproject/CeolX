# DS-T3 · Shared Admin Web Components

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages                           |
| **Status**     | 🔲 To Do                                                         |
| **Depends on** | DS-T1 (Tailwind), DS-T2 (ShadCN base components)                 |
| **PRD Ref**    | Section 8 (Super Admin Dashboard), Section 9.8 (Venue Subscribe) |

---

## Description

Build application-level reusable components for `apps/admin` that compose ShadCN/UI primitives into CeolX-specific patterns. These are higher-level building blocks — layouts, data display, forms, and feedback components — that every admin screen reuses. Without these, each screen rebuilds the same patterns from scratch.

---

## Affected Apps / Packages

| App / Package | Role                                             |
| ------------- | ------------------------------------------------ |
| `apps/admin`  | Components live in `src/components/` (not `ui/`) |

---

## Requirements

### Layout Components

#### `AdminShell`

- Full-page layout: sidebar + main content area
- Sidebar: CeolX logo, nav links (Dashboard, Events, Users), logout button
- Top bar: page title + user avatar with dropdown
- Responsive: collapsible sidebar on smaller screens
- Active route highlighted using TanStack Router `useMatch`

#### `PageHeader`

- Reusable page header: title + optional subtitle + optional action slot (e.g. Export button)
- Used on every admin page

### Data Display Components

#### `DataTable`

- Wraps ShadCN `<Table>` with sorting, pagination, and loading skeleton
- Props: `columns`, `data`, `isLoading`, `pageSize`
- Column definitions accept `renderCell` for custom formatting
- Empty state: "No results found" with icon

#### `StatusBadge`

- Wraps ShadCN `<Badge>` with CeolX event status colours
- Variants: `pending_review` (amber), `active` (green), `rejected` (red), `archived` (gray)
- Used in events moderation table

#### `KpiCard`

- Metric display card: label + number + optional trend indicator
- Used on admin dashboard overview (total users, pending events, active events)

### Form Components

#### `FormField`

- Wraps ShadCN `<Input>` + label + error message
- Controlled — accepts `value`, `onChange`, `error`
- Supports `type`: text, email, password, textarea

#### `SearchInput`

- Debounced search input (300ms)
- Clear button when value is non-empty
- Used in Users table and Events table

### Feedback Components

#### `ConfirmDialog`

- Wraps ShadCN `<Dialog>` with confirm/cancel actions
- Props: `title`, `description`, `confirmLabel`, `onConfirm`, `isDangerous` (red confirm button)
- Used for: approve event, reject event (with reason input), logout

#### `RejectReasonDialog`

- Extension of `ConfirmDialog` with a required textarea for rejection reason
- Validates reason is not empty before enabling confirm
- Used exclusively in event moderation

#### `ToastProvider`

- Global toast setup using ShadCN `<Toaster>`
- Helper: `useToast()` hook for success/error/info toasts
- Mounted once at app root

---

## Acceptance Criteria

- [ ] `AdminShell` renders sidebar + main content with active route highlighting
- [ ] `DataTable` renders with sorting, pagination, and loading skeleton state
- [ ] `StatusBadge` shows correct colour for each event status
- [ ] `KpiCard` renders label + number correctly
- [ ] `FormField` shows error message below input when `error` prop is set
- [ ] `SearchInput` debounces 300ms and shows clear button
- [ ] `ConfirmDialog` calls `onConfirm` on confirm, closes on cancel
- [ ] `RejectReasonDialog` blocks confirm if reason is empty
- [ ] `ToastProvider` mounted at root; `useToast()` triggers visible toast

---

## Dependencies

### Upstream

- DS-T2 (ShadCN base components — all composed components build on these)

### Downstream

- M8-T1 (Venue subscription page uses `FormField`, `ToastProvider`)
- M9-T1 (Admin dashboard uses `AdminShell`, `KpiCard`, `DataTable`, `StatusBadge`)
- M9-T2 (Event moderation uses `RejectReasonDialog`, `ConfirmDialog`)

---

## Technical Notes

### AdminShell

```tsx
// apps/admin/src/components/AdminShell.tsx

import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/events', label: 'Events' },
  { to: '/users', label: 'Users' },
];

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-surface">
      <aside className="w-64 bg-surface-dark border-r border-gray-10/20 flex flex-col">
        <div className="p-6">
          <span className="text-xl font-bold text-blue-10">CeolX Admin</span>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                location.pathname.startsWith(link.to)
                  ? 'bg-blue-1 text-blue-10'
                  : 'text-gray-4 hover:bg-gray-10/10'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};
```

### StatusBadge

```tsx
// apps/admin/src/components/StatusBadge.tsx

import { Badge } from '@/components/ui/badge';
import type { EventStatus } from '@ceolx/shared';

const variantMap: Record<EventStatus, string> = {
  pending_review: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  active: 'bg-blue-1 text-blue-10',
  rejected: 'bg-[#EF4444]/20 text-[#EF4444]',
  archived: 'bg-gray-1 text-gray-8',
  draft: 'bg-blue-2 text-blue-10',
};

export const StatusBadge = ({ status }: { status: EventStatus }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantMap[status]}`}
  >
    {status.replace('_', ' ')}
  </span>
);
```

### RejectReasonDialog

```tsx
// apps/admin/src/components/RejectReasonDialog.tsx

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const RejectReasonDialog = ({ open, onClose, onConfirm }: Props) => {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Event</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="Provide a reason for rejection (shown to the creator)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason);
              setReason('');
            }}
          >
            Reject Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Common Gotchas

- **`components/ui/` vs `components/`**: ShadCN primitives go in `ui/`, composed app-level components go one level up in `components/`. Never add business logic into `ui/`.
- **TanStack Router `Link`**: Use TanStack Router's `<Link>` not React Router's — `apps/admin` uses TanStack Router.
- **`EventStatus` from shared**: Import the type from `@ceolx/shared`, not locally defined, to keep parity with the DB enum.

---
