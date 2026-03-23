# M1-T5 · Next.js Admin Dashboard Scaffold

| Field | Value |
|-------|-------|
| **Milestone** | M1 — Project Setup & Infrastructure |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T1 (Turborepo), M1-T2 (Drizzle schema) |
| **PRD Ref** | Section 10.1 (Admin Dashboard), Section 8 (Super Admin Features), Section 9.8 (Venue Subscription) |

---

## Description

Bootstrap the admin web app which serves two purposes: the Super Admin dashboard (internal tools for event moderation and user management) and the public Venue subscription page (`ceolx.ie/subscribe`). No business logic yet — just route structure, layout components, and placeholder pages. The subscription page is critical because Venues access it from their Postmark activation email; the dashboard is critical for content moderation before events go live.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/admin` | Entire Next.js admin application (dashboard + subscribe) |
| `packages/shared` | Shared enums and types for typing |

---

## API Endpoints

None — this is a frontend scaffold task. API calls wired up in M8 (Venue Subscription) and M9 (Super Admin).

---

## Requirements

### Project Initialization

- Next.js 14+ initialized in `apps/admin` with TypeScript
- App Router (not legacy Pages Router)
- Node >= 20, npm >= 10
- Tailwind CSS configured via NativeWind or PostCSS
- ShadCN/UI installed and configured as component library

### Route Structure

- `/login` — Super Admin login page (public)
- `/dashboard` — Admin dashboard home (authenticated)
- `/users` — User management table (authenticated)
- `/events/pending` — Pending events queue for moderation (authenticated)
- `/subscribe` — Public Venue subscription page (public, no auth required)
- `/account` — Admin account settings (authenticated)

### Layout Structure

**Admin Routes** (`/dashboard`, `/users`, `/events/pending`, `/account`):
- Sidebar navigation with links: Dashboard, Users, Pending Events, Account
- Header with admin user info (avatar, name) and Logout button
- Main content area with proper spacing and padding
- Logout functionality wired in M9

**Public Routes** (`/login`, `/subscribe`):
- No sidebar
- No authentication required
- `/login` uses a simple centered layout
- `/subscribe` uses a clean form layout (Stripe checkout page)

### Sidebar Navigation

- Navigation items:
  - Dashboard (icon: chart-bar)
  - Users (icon: users)
  - Pending Events (icon: clock) — with badge showing pending count (wired in M9)
  - Account (icon: settings)
- Active link highlighting
- Responsive collapse on mobile (drawer instead of sidebar)

### Header Component

- Logo/branding on left
- Admin name and avatar on right
- Logout button (wired in M9)
- Breadcrumb navigation (optional but recommended)

### Placeholder Pages

- **Dashboard**: KPI cards (total users, total events, pending events, active venues) — values hardcoded for now
- **Users**: Empty table with columns (Name, Email, Role, Created At) — data wired in M9
- **Pending Events**: Empty table with columns (Title, Creator, Submitted, Actions) — data wired in M9
- **Account**: Profile form with email, change password form (wired in M9)
- **Login**: Email and password inputs, submit button (auth wired in M9)
- **Subscribe**: Stripe checkout placeholder, loading states (checkout wired in M8)

### Component Library (ShadCN/UI)

- Install components: Button, Card, Input, Select, Table, Sidebar, Breadcrumb, Avatar, Badge, Dialog
- Example component usage on at least two pages to verify setup

### Configuration Files

- `app.config.ts` or `app.config.js` for environment-specific configs
- `tsconfig.json` extending root config with app-specific paths
- `package.json` with correct scripts: `dev`, `build`, `start`, `lint`, `type-check`
- Environment variables: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` (wired in M8)

---

## Acceptance Criteria

- [ ] `npm run dev` in `apps/admin` starts without errors on `http://localhost:3000`
- [ ] All five routes accessible: `/login`, `/dashboard`, `/users`, `/events/pending`, `/subscribe`
- [ ] `/subscribe` and `/login` are publicly accessible (no auth guard)
- [ ] `/dashboard`, `/users`, `/events/pending`, `/account` show auth guard message (actual auth wired in M9)
- [ ] ShadCN/UI components render correctly on at least two pages
- [ ] Sidebar visible on `/dashboard` and other admin routes; absent on `/login` and `/subscribe`
- [ ] Header with admin info visible on admin routes; absent on public routes
- [ ] Placeholder content visible on all pages (cards, tables, forms)
- [ ] `packages/shared` types importable in `apps/admin`
- [ ] TypeScript compilation passes (`npm run type-check` in `apps/admin`)
- [ ] Responsive layout works on mobile (sidebar collapses to drawer or menu)

---

## Technical Notes

### Next.js App Router Structure

```
apps/admin/
├── app/
│   ├── (public)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── subscribe/
│   │       └── page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx          # Admin layout with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── events/
│   │   │   └── pending/
│   │   │       └── page.tsx
│   │   └── account/
│   │       └── page.tsx
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Redirect to /dashboard
├── components/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── AdminLayout.tsx
│   └── ...ShadCN components
├── lib/
│   └── api.ts                  # API client (wired in M8/M9)
├── tsconfig.json
├── next.config.js
└── package.json
```

### Root Layout

```typescript
// apps/admin/app/layout.tsx

import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'CeolX Admin',
  description: 'Admin dashboard for CeolX Irish music platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Admin Layout with Sidebar

```typescript
// apps/admin/app/(admin)/layout.tsx

import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Sidebar Component

```typescript
// apps/admin/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Users,
  Clock,
  Settings,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Pending Events', href: '/events/pending', icon: Clock },
  { name: 'Account', href: '/account', icon: Settings },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-green-600">CeolX</h1>
      </div>
      <nav className="px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                isActive
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
```

### Header Component

```typescript
// apps/admin/components/Header.tsx

'use client';

import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
        </div>
        <div className="flex items-center gap-4 relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100"
          >
            <User size={20} />
            <span className="text-sm font-medium">Admin</span>
          </button>
          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 top-full">
              <Button
                variant="ghost"
                className="w-full justify-start text-red-600"
                onClick={() => {
                  // Logout logic wired in M9
                  console.log('Logout clicked');
                }}
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
```

### Dashboard Page Placeholder

```typescript
// apps/admin/app/(admin)/dashboard/page.tsx

import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Events</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Pending Events</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Venues</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </Card>
      </div>
    </div>
  );
}
```

### Login Page

```typescript
// apps/admin/app/(public)/login/page.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Login logic wired in M9
    console.log('Login attempt:', { email, password });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-3xl font-bold text-center mb-6 text-green-600">CeolX</h1>
        <h2 className="text-xl font-semibold text-center mb-8">Admin Login</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ceolx.ie"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
```

### Subscribe Page (Venue Activation)

```typescript
// apps/admin/app/(public)/subscribe/page.tsx

'use client';

export default function SubscribePage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Activate Your Venue</h1>
        <p className="text-gray-600 mb-6">
          Choose a subscription plan to activate your venue profile and start receiving bookings.
        </p>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Basic Plan</h3>
            <p className="text-gray-600 text-sm mb-3">Perfect for getting started</p>
            <p className="text-2xl font-bold mb-4">€9.99<span className="text-sm text-gray-600">/month</span></p>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
              Subscribe Now (Wired in M8)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Package Configuration

```json
{
  "name": "@ceolx/admin",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@radix-ui/react-primitive": "^1.0.0",
    "@shadcn/ui": "latest",
    "lucide-react": "^0.292.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## Common Gotchas

- **The `/subscribe` route must be public** — it's what Venues land on from their Postmark activation email. No auth guard here.
- **Admin routes require auth** — auth middleware added in M9, not here. For now, show a placeholder message.
- **Sidebar "Pending Events" badge** — will show a count wired up in M9. For now, hardcode a number.
- **Use App Router, not Pages Router** — Next.js 14+ defaults to App Router; do not use `/pages` directory.
- **Environment variables** — Must prefix with `NEXT_PUBLIC_` to be available in the browser (e.g., `NEXT_PUBLIC_API_BASE_URL`).
- **API base URL** — Set via `NEXT_PUBLIC_API_BASE_URL` so the client can call the backend. Wired in M8/M9.
- **Mobile responsiveness** — Sidebar should collapse on mobile (drawer/menu icon); test on small screens.

---
