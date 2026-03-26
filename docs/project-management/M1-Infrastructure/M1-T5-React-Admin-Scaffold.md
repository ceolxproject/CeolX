# M1-T5 · React Admin Dashboard Scaffold (TanStack Router + Vite)

| Field          | Value                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                                                                |
| **Status**     | ✅ Done                                                                                            |
| **Depends on** | M1-T1 (Turborepo), M1-T2 (Drizzle schema)                                                          |
| **PRD Ref**    | Section 10.1 (Admin Dashboard), Section 8 (Super Admin Features), Section 9.8 (Venue Subscription) |

---

## Description

Bootstrap the admin web app which serves two purposes: the Super Admin dashboard (internal tools for event moderation and user management) and the public Venue subscription page (`ceolx.ie/subscribe`). No business logic yet — just route structure, layout components, and placeholder pages. The subscription page is critical because Venues access it from their Postmark activation email; the dashboard is critical for content moderation before events go live.

Built as a React SPA with Vite and TanStack Router. No SSR needed for an internal admin dashboard.

---

## Affected Apps / Packages

| App / Package     | Role                                                   |
| ----------------- | ------------------------------------------------------ |
| `apps/admin`      | Entire React admin application (dashboard + subscribe) |
| `packages/shared` | Shared enums and types for typing                      |

---

## API Endpoints

None — this is a frontend scaffold task. API calls wired up in M8 (Venue Subscription) and M9 (Super Admin).

---

## Requirements

### Project Initialization

- Vite initialized in `apps/admin` with React + TypeScript template
- TanStack Router (`@tanstack/react-router`) with file-based routing
- Node >= 20, npm >= 10
- Tailwind CSS configured via PostCSS
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
- Active link highlighting via TanStack Router's `Link` `activeProps`
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

- `vite.config.ts` with `@tanstack/router-plugin/vite` plugin for file-based routing
- `tsconfig.json` extending root config with app-specific paths
- `package.json` with correct scripts: `dev`, `build`, `preview`, `lint`, `type-check`
- Environment variables: `VITE_API_BASE_URL`, `VITE_STRIPE_PUBLIC_KEY` (wired in M8)

---

## Acceptance Criteria

- [x] `npm run dev` in `apps/admin` starts without errors on `http://localhost:3000`
- [x] All routes accessible: `/login`, `/dashboard`, `/users`, `/events/pending`, `/account` — `/subscribe` deferred to M8 (Venue Subscription task)
- [x] `/login` is publicly accessible (no auth guard)
- [x] `/dashboard`, `/users`, `/events/pending`, `/account` have auth guard placeholder in `_admin.tsx` (wired in M9)
- [x] ShadCN/UI components render correctly on at least two pages (Button+Input on login, Card on dashboard, Input+Button on account)
- [x] Sidebar visible on admin routes; absent on `/login`
- [x] Header with admin info visible on admin routes; absent on public routes
- [x] Placeholder content visible on all pages (cards, tables, forms)
- [x] `packages/shared` types importable in `apps/admin` (`UserRole` used in `_admin/users.tsx`)
- [x] TypeScript compilation passes (`pnpm type-check` in `apps/admin`)
- [x] Responsive layout works on mobile (sidebar collapses to drawer with overlay)
- [x] `routeTree.gen.ts` auto-generated by TanStack Router Vite plugin

---

## Technical Notes

### TanStack Router File-Based Route Structure

```
apps/admin/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout (renders <Outlet />)
│   │   ├── index.tsx               # Redirect to /dashboard
│   │   ├── login.tsx               # Public login page
│   │   ├── subscribe.tsx           # Public venue subscription page
│   │   ├── _admin.tsx              # Admin layout route (sidebar + header)
│   │   └── _admin/
│   │       ├── dashboard.tsx
│   │       ├── users.tsx
│   │       ├── events/
│   │       │   └── pending.tsx
│   │       └── account.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ...ShadCN components
│   ├── lib/
│   │   └── api.ts                  # API client (wired in M8/M9)
│   ├── routeTree.gen.ts            # Auto-generated — do not edit
│   ├── router.ts                   # Router instance
│   └── main.tsx                    # App entry point
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Vite Config

```typescript
// apps/admin/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: "./src/routes" }), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
});
```

### Router Instance

```typescript
// apps/admin/src/router.ts

import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

### App Entry Point

```typescript
// apps/admin/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

### Root Route

```typescript
// apps/admin/src/routes/__root.tsx

import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <Outlet />,
});
```

### Index Route (Redirect)

```typescript
// apps/admin/src/routes/index.tsx

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
```

### Admin Layout Route

```typescript
// apps/admin/src/routes/_admin.tsx

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

export const Route = createFileRoute('/_admin')({
  component: AdminLayout,
});

function AdminLayout() {
  // Auth guard wired in M9 — placeholder for now
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### Sidebar Component

```typescript
// apps/admin/src/components/Sidebar.tsx

import { Link } from '@tanstack/react-router';
import { BarChart3, Users, Clock, Settings } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', to: '/dashboard', icon: BarChart3 },
  { name: 'Users', to: '/users', icon: Users },
  { name: 'Pending Events', to: '/events/pending', icon: Clock },
  { name: 'Account', to: '/account', icon: Settings },
] as const;

export const Sidebar = () => {
  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-green-600">CeolX</h1>
      </div>
      <nav className="px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-2 rounded-lg transition text-gray-700 hover:bg-gray-100"
              activeProps={{ className: 'flex items-center gap-3 px-4 py-2 rounded-lg transition bg-green-100 text-green-700' }}
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
// apps/admin/src/components/Header.tsx

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

### Dashboard Page

```typescript
// apps/admin/src/routes/_admin/dashboard.tsx

import { createFileRoute } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';

export const Route = createFileRoute('/_admin/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
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
// apps/admin/src/routes/login.tsx

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ceolx.ie"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full">Sign In</Button>
        </form>
      </div>
    </div>
  );
}
```

### Subscribe Page

```typescript
// apps/admin/src/routes/subscribe.tsx

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/subscribe')({
  component: SubscribePage,
});

function SubscribePage() {
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
    "dev": "vite --port 3000",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-router": "^1.0.0",
    "lucide-react": "^0.292.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## Common Gotchas

- **`routeTree.gen.ts` is auto-generated** — never edit it manually. It regenerates on every `vite dev` run via the `@tanstack/router-plugin/vite` plugin.
- **`_admin` prefix = layout route** — files prefixed with `_` create pathless layout routes. Routes inside `_admin/` inherit the layout but the `_admin` segment does not appear in the URL.
- **Active link styling** — use `activeProps` on TanStack `<Link>` instead of manually checking the current path. TanStack Router handles exact vs. partial matching automatically.
- **The `/subscribe` route must be public** — it's what Venues land on from their Postmark activation email. No auth guard here.
- **Environment variables** — Must prefix with `VITE_` (not `NEXT_PUBLIC_`) to be exposed in the browser (e.g., `VITE_API_BASE_URL`).
- **SPA hosting** — When deployed (e.g., on Vercel or S3/CloudFront), configure the server to serve `index.html` for all routes so client-side routing works on direct URL load.
- **Auth guard placeholder** — The `_admin.tsx` layout's `beforeLoad` will enforce auth in M9. For now, it just renders without checking.

---
