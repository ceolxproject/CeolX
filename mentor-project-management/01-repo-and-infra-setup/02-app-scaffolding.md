# Task 2: Scaffold All 5 Apps with Base Configuration

## Description

Create the foundational structure for all five applications: three Next.js 15 (App Router) web apps, one Hono API server, and one React Native Expo mobile app. Each app will have its base configuration, basic folder structure, and essential config files needed to run and build independently while integrating with the monorepo.

## Affected Apps/Packages

- apps/api (Hono)
- apps/web-learner (Next.js 15)
- apps/web-mentor (Next.js 15)
- apps/web-admin (Next.js 15)
- apps/mobile (React Native Expo)

## Requirements

### Next.js 15 Apps (web-learner, web-mentor, web-admin)

#### Directory Structure

```
apps/web-{learner,mentor,admin}/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── .gitkeep
│   ├── lib/
│   │   └── .gitkeep
│   └── types/
│       └── index.ts
├── public/
│   └── .gitkeep
├── .env.example
├── .env.local (in .gitignore)
├── next.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml (in .gitignore - shared at root)
└── README.md
```

#### package.json

- Set `name` to `@mentor/web-{learner|mentor|admin}`
- Include scripts:
  - `dev`: `next dev -p 3000` (port varies: learner=3000, mentor=3001, admin=3002)
  - `build`: `next build`
  - `start`: `next start`
  - `lint`: `eslint .`
  - `type-check`: `tsc --noEmit`
- Dependencies:
  - `next@15.x`, `react@19.x`, `react-dom@19.x`
  - `@mentor/auth`, `@mentor/api-client`, `@mentor/validators`, `@mentor/ui`, `@mentor/i18n`
  - `tailwindcss@4.x`, `postcss`, `autoprefixer`
- DevDependencies:
  - `@types/node`, `@types/react`, `@types/react-dom`, `typescript`
  - `@next/env`

#### next.config.ts

```typescript
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@mentor/auth",
    "@mentor/api-client",
    "@mentor/validators",
    "@mentor/ui",
    "@mentor/i18n",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.example.com", // Will be replaced with actual Cloudflare R2 CDN
      },
    ],
  },
  headers: () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
      ],
    },
  ],
};

export default config;
```

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/lib/*": ["lib/*"]
    },
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "jsxImportSource": "react"
  },
  "include": ["src", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

#### .env.example

```
# Next.js Environment
NEXT_PUBLIC_API_URL=http://localhost:3200
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ANALYTICS_KEY=
NEXT_PUBLIC_SENTRY_DSN=

# App-specific
NEXT_PUBLIC_APP_NAME=Mentor Learner
NEXT_PUBLIC_APP_VERSION=0.0.1
```

#### src/app/layout.tsx

```typescript
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mentor - Learn Cosmetics',
  description: 'Premium online cosmetics education platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

#### src/app/page.tsx

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Mentor</h1>
      <p className="text-gray-600 mt-4">Learning Platform</p>
    </main>
  )
}
```

#### src/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
    "Cantarell", "Fira Sans", "Droid Sans", "Source Sans Pro", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

### Hono API Server (apps/api)

#### Directory Structure

```
apps/api/
├── src/
│   ├── index.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── cors.ts
│   ├── routes/
│   │   ├── health.ts
│   │   └── index.ts
│   ├── services/
│   │   └── .gitkeep
│   ├── types/
│   │   └── index.ts
│   └── lib/
│       └── .gitkeep
├── .env.example
├── .env.local (in .gitignore)
├── tsconfig.json
├── package.json
├── wrangler.json (for Vercel Serverless Functions)
└── README.md
```

#### package.json

```json
{
  "name": "@mentor/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "hono dev",
    "build": "hono build",
    "start": "hono start",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.x",
    "@mentor/db": "workspace:*",
    "@mentor/auth": "workspace:*",
    "@mentor/validators": "workspace:*",
    "@mentor/cache": "workspace:*",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "typescript": "^5.4.0",
    "tsx": "^4.x"
  }
}
```

#### src/index.ts

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import healthRoutes from "./routes/health";

const app = new Hono();

// Middleware
app.use(logger());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

// Routes
app.route("/health", healthRoutes);

export default app;
```

#### src/routes/health.ts

```typescript
import { Hono } from "hono";

const routes = new Hono();

routes.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || "0.0.1",
  });
});

export default routes;
```

#### wrangler.json (for Vercel Serverless)

```json
{
  "name": "mentor-api",
  "main": "src/index.ts",
  "compatibility_date": "2025-02-01",
  "env": {
    "production": {
      "routes": [{ "pattern": "api.example.com/*", "zone_name": "example.com" }]
    },
    "staging": {
      "routes": [{ "pattern": "staging-api.example.com/*" }]
    }
  }
}
```

#### .env.example

```
# Database
DATABASE_URL=postgresql://...

# API Configuration
API_PORT=3200
API_VERSION=0.0.1
CORS_ORIGIN=http://localhost:3000

# Authentication
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# External Services
SENTRY_DSN=
```

---

### React Native Expo App (apps/mobile)

#### Directory Structure

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── _layout.tsx
│   └── +html.tsx
├── components/
│   └── .gitkeep
├── hooks/
│   └── .gitkeep
├── lib/
│   └── .gitkeep
├── types/
│   └── index.ts
├── assets/
│   ├── images/
│   └── icons/
├── .env.example
├── app.json
├── eas.json
├── tsconfig.json
├── package.json
└── README.md
```

#### package.json

```json
{
  "name": "@mentor/mobile",
  "version": "0.0.1",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build": "eas build --platform all",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~3.x",
    "expo-splash-screen": "~0.x",
    "expo-status-bar": "~1.x",
    "react": "~18.3.0",
    "react-native": "0.76.x",
    "react-native-safe-area-context": "~4.x",
    "react-native-screens": "~4.x",
    "@react-navigation/native": "^6.x",
    "@mentor/auth": "workspace:*",
    "@mentor/api-client": "workspace:*",
    "@mentor/validators": "workspace:*",
    "@mentor/ui-mobile": "workspace:*",
    "@mentor/i18n": "workspace:*",
    "tailwindcss": "^4.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "@types/react": "~18.3.0",
    "typescript": "^5.4.0",
    "expo-cli": "^6.x"
  }
}
```

#### app.json

```json
{
  "expo": {
    "name": "Mentor",
    "slug": "mentor",
    "version": "0.0.1",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.example.mentor"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.example.mentor"
    },
    "web": {
      "bundler": "metro",
      "output": "static"
    },
    "plugins": ["expo-router"]
  }
}
```

#### eas.json

```json
{
  "build": {
    "production": {
      "node": "20.x",
      "npm": "10.x",
      "env": {
        "EXPO_USE_FAST_RESOLVER": "true"
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "development": {
      "distribution": "internal",
      "ios": {
        "buildType": "simulator"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": ""
      },
      "android": {
        "googlePlayAppId": ""
      }
    }
  }
}
```

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "lib": ["ES2020"]
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

#### .env.example

```
# API
EXPO_PUBLIC_API_URL=http://localhost:3200
EXPO_PUBLIC_APP_URL=http://localhost:8081

# Analytics
EXPO_PUBLIC_ANALYTICS_KEY=
EXPO_PUBLIC_SENTRY_DSN=

# App Info
EXPO_PUBLIC_APP_NAME=Mentor
EXPO_PUBLIC_APP_VERSION=0.0.1
```

---

## Acceptance Criteria

### All Apps

- [ ] Each app has a valid `package.json` with proper workspace references (`workspace:*`)
- [ ] Each app has a `tsconfig.json` extending root config
- [ ] Each app has `.env.example` documenting required environment variables
- [ ] Each app has a basic README.md describing purpose and setup

### Next.js Apps (web-learner, web-mentor, web-admin)

- [ ] `pnpm install` works without peer dependency warnings
- [ ] `pnpm dev` starts each app successfully on correct port (3000, 3001, 3002)
- [ ] `pnpm build` completes without errors
- [ ] Homepage renders with basic layout
- [ ] TypeScript strict mode enabled and no type errors
- [ ] ESLint runs without errors on base structure
- [ ] Tailwind CSS classes are recognized and compiled

### Hono API

- [ ] `pnpm dev` starts API on port 3200
- [ ] Health endpoint `/health` returns status 200
- [ ] CORS headers properly configured
- [ ] TypeScript strict mode enabled
- [ ] ESLint runs without errors

### Expo Mobile

- [ ] `pnpm start` launches Metro bundler successfully
- [ ] `pnpm ios` or `pnpm android` can start simulator/emulator
- [ ] Basic navigation structure is in place
- [ ] TypeScript strict mode enabled

## Dependencies

- Task 1: Turborepo monorepo init must be completed
- Node.js >= 20.0.0
- pnpm >= 9.0.0

## Technical Notes

### Next.js 15 Specific Notes

- App Router is default in Next.js 15, no `/pages` directory needed
- `reactStrictMode: true` helps catch component issues during development
- `transpilePackages` ensures workspace packages are bundled correctly
- Server Components are the default in App Router

### Hono Specific Notes

- Hono is lightweight and suitable for serverless deployment on Vercel
- Middleware order matters in Hono (CORS before routes)
- Use `hono/middleware` for common patterns
- For Vercel deployment, ensure `wrangler.json` is properly configured

### Expo Specific Notes

- Expo Router provides file-based routing similar to Next.js
- `app.json` must have unique `slug` for EAS builds
- iOS builds require Apple Developer account setup
- Android builds require Google Play Console setup (later)
- Environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in client code

### Port Configuration Rationale

- Learner: 3000 (main consumer app)
- Mentor: 3001 (instructor app)
- Admin: 3002 (administrative app)
- API: 3200 (clearly separated from web apps)
- Mobile: 8081 (default Expo Metro bundler)

### Monorepo Integration

- All apps reference shared packages using `workspace:*` protocol
- This allows local development with live updates when dependencies change
- Turborepo will automatically build dependencies before building dependent apps
