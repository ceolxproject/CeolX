# M1-T1 · Turborepo Monorepo Setup + GitHub Branch Strategy

| Field          | Value                                                    |
| -------------- | -------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                      |
| **Status**     | ✅ Done                                                  |
| **Depends on** | Nothing — first task                                     |
| **PRD Ref**    | Section 10.1 (Tech Stack), Section 10.2 (Infrastructure) |

---

## Description

Establish the complete project scaffolding and version control strategy before any feature code is written. This foundational task creates a Turborepo monorepo with four workspaces (mobile app, admin dashboard, backend API, shared packages), configures workspace dependencies, and sets up a three-environment Git strategy (dev, staging, production) that mirrors the database branching approach. Every downstream task in M1–M11 depends on this being correct — misconfiguration here creates rework across the entire project.

CeolX is a solo-developer project, so the monorepo structure prioritizes clarity, type safety, and minimal boilerplate. Turborepo was chosen over pnpm/Yarn workspaces for its superior build caching and npm compatibility. The three-branch strategy (dev, staging, main) ensures that code and database schemas stay in sync across environments, preventing accidental schema drift and enabling safe feature development without touching production data.

---

## Affected Apps / Packages

| App / Package   | Role                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| `apps/native`   | React Native + Expo iOS/Android app (NativeWind)                         |
| `apps/web`      | React + Vite + TanStack Router admin dashboard + Venue subscription page |
| `apps/server`   | Hono + tRPC backend API (AWS Lambda)                                     |
| `packages/db`   | Drizzle ORM schema, migrations, CeolX enums                              |
| `packages/api`  | tRPC router type definitions (shared between server and web)             |
| `packages/auth` | BetterAuth configuration                                                 |
| `packages/ui`   | Shared UI components                                                     |
| `packages/env`  | Environment variable validation (@t3-oss/env)                            |

---

## API Endpoints

None — this is a setup task. No HTTP endpoints created here.

---

## Requirements

### Repository Initialization

- Monorepo initialized as a Turborepo with `npm` as the package manager
- Root `package.json` with `workspaces` array pointing to `apps/*` and `packages/*`
- Root `turbo.json` with task definitions for `build`, `dev`, `lint`, `type-check`, `test`, `db:migrate`, `db:seed`
- All four workspaces created with empty scaffolds ready for M1-T3, M1-T4, M1-T5
- Node >= 20, npm >= 10, TypeScript >= 5.4

### TypeScript Configuration

- Root `tsconfig.json` with project references pointing to each workspace's `tsconfig.json`
- Compiler options: `strict: true`, `moduleResolution: "node"`, `skipLibCheck: true`, `target: "es2020"`
- Each workspace has its own `tsconfig.json` extending root config with workspace-specific paths
- `packages/shared/tsconfig.json` exports types cleanly via barrel exports
- TypeScript project references configured so builds compile in dependency order

### Shared Enums and Types

All exported from `packages/shared/src/enums/index.ts`:

- `UserRole` enum: `spectator | artist | venue | super_admin`
- `EventStatus` enum: `draft | pending_review | rejected | active | archived`
- `BookingStatus` enum: `pending | accepted | rejected | cancelled`
- `BookingDirection` enum: `venue_to_artist | artist_to_venue`
- `SubscriptionStatus` enum: `inactive | active | past_due | cancelled`
- `MediaType` enum: `image | video | audio | text`
- `NotificationType` enum: `event_approved | event_rejected | booking_invitation | booking_update | artist_message | venue_message`

### GitHub Repository Structure

- Repository initialized with three long-lived branches: `dev`, `staging`, `main`
- `main` branch protection: require PR reviews, enforce passing status checks, dismiss stale reviews
- `staging` branch protection: require passing status checks, allow force push by maintainer
- `dev` branch: no protection (development flexibility)
- All branches track their corresponding Neon database (dev DB, staging DB, prod DB)
- `.gitignore` excludes: `node_modules/`, `dist/`, `.env.local`, `.env*.local`, `*.log`, `build/`, `.turbo/`
- `.github/workflows/` directory prepared for CI/CD (setup in later milestones)

### Environment Variable Strategy

- `.env.example` in root documents all required variables for each environment
- Local development uses `.env.local` (git-ignored)
- Neon branch secrets stored in GitHub Environments matching git branches
- API base URL configurable: `apps/mobile` reads `EXPO_PUBLIC_API_BASE_URL`
- Admin dashboard reads `NEXT_PUBLIC_API_BASE_URL`

### Build and Development Commands

- `npm run build` (via Turborepo) — builds all apps and packages in correct dependency order
- `npm run dev` (via Turborepo) — runs all dev servers concurrently
- `npm run lint` (via Turborepo) — lints all workspaces
- `npm run type-check` (via Turborepo) — type-checks all workspaces with TypeScript compiler
- `npm run test` (via Turborepo) — runs test suites (optional for V1)

---

## Acceptance Criteria

- [x] `pnpm install` from root completes without errors; all dependencies resolved
- [x] `pnpm turbo check-types` passes across all workspaces (3/3 successful)
- [x] `packages/db` enums importable in all apps with correct IDE autocomplete
- [x] Root `tsconfig.json` references all workspace `tsconfig.json` files correctly
- [x] GitHub repo has `dev`, `staging`, `main` branches created
- [ ] GitHub branch protection rules applied (manual step — requires GitHub dashboard or `gh` CLI with auth)
- [x] All seven CeolX enums defined and exported from `packages/db/src/schema/enums.ts`
- [x] `.env.example` documents all required environment variables for dev/staging/prod
- [x] Project structure verified: `apps/native`, `apps/web`, `apps/server`, `packages/*`
- [x] TypeScript compilation passes (`pnpm turbo check-types`)

---

## Dependencies

### Upstream

None — this is the first task in the project.

### Downstream (this task blocks)

- **M1-T2** — Neon Database + Drizzle (requires Git branches and TypeScript enums)
- **M1-T3** — Hono API (requires Turborepo config and shared types)
- **M1-T4** — React Native + Expo (requires Turborepo dev server)
- **M1-T5** — React Admin (requires Turborepo dev server)
- **All M2–M11 tasks** — depend on this foundational structure

### External services

- GitHub account and repository
- Neon PostgreSQL account (free tier sufficient)

---

## Technical Notes

### Root package.json Setup

```json
{
  "name": "@ceolx/monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.11.0",
    "eslint": "^9.0.0",
    "prettier": "^3.2.0"
  },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "db:migrate": "turbo db:migrate",
    "db:seed": "turbo db:seed"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

### turbo.json Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.json", ".env.local"],
  "tasks": {
    "build": {
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true,
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": []
    },
    "lint": {
      "outputs": [],
      "cache": false
    },
    "type-check": {
      "outputs": [],
      "cache": true,
      "dependsOn": ["^type-check"]
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true,
      "dependsOn": ["^build"]
    },
    "db:migrate": {
      "cache": false,
      "dependsOn": []
    },
    "db:seed": {
      "cache": false,
      "dependsOn": ["db:migrate"]
    }
  }
}
```

### Root tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "lib": ["es2020"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "references": [
    { "path": "apps/api" },
    { "path": "apps/admin" },
    { "path": "apps/mobile" },
    { "path": "packages/shared" }
  ]
}
```

### Shared Enums Implementation

```typescript
// packages/shared/src/enums/index.ts

export enum UserRole {
  SPECTATOR = "spectator",
  ARTIST = "artist",
  VENUE = "venue",
  SUPER_ADMIN = "super_admin",
}

export enum EventStatus {
  DRAFT = "draft",
  PENDING_REVIEW = "pending_review",
  REJECTED = "rejected",
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export enum BookingStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

export enum BookingDirection {
  VENUE_TO_ARTIST = "venue_to_artist",
  ARTIST_TO_VENUE = "artist_to_venue",
}

export enum SubscriptionStatus {
  INACTIVE = "inactive",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
}

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  TEXT = "text",
}

export enum NotificationType {
  EVENT_APPROVED = "event_approved",
  EVENT_REJECTED = "event_rejected",
  BOOKING_INVITATION = "booking_invitation",
  BOOKING_UPDATE = "booking_update",
  ARTIST_MESSAGE = "artist_message",
  VENUE_MESSAGE = "venue_message",
}

export * as Enums from "./index";
```

### GitHub Branch Protection Configuration

**main branch:**

- Require pull request reviews (1 approval)
- Require status checks to pass
- Require branches up to date
- Dismiss stale reviews
- No force push allowed

**staging branch:**

- Require status checks to pass
- Allow force push by Priya (maintainer)
- No deletions

**dev branch:**

- No protection rules

### Environment Variables Example

```bash
# .env.example (root)

# Database (branch-specific)
DATABASE_URL=postgresql://user:pass@branch.neon.tech/dbname
DIRECT_URL=postgresql://user:pass@branch.neon.tech/dbname

# API Configuration
API_BASE_URL=http://localhost:3001
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Authentication (BetterAuth)
BETTER_AUTH_SECRET=<32-char-random-secret>

# OAuth (Google/Apple)
GOOGLE_OAUTH_CLIENT_ID_IOS=...
GOOGLE_OAUTH_CLIENT_ID_ANDROID=...
APPLE_OAUTH_CLIENT_ID=...

# Email (Postmark)
POSTMARK_API_TOKEN=...

# AWS S3
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=ceolx-media

# Firebase FCM
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Mux
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
```

### Monorepo Directory Structure

> Scaffolded via `better-t-stack` (BTS). Package names differ from original plan — `apps/server` not `apps/api`, `apps/web` not `apps/admin`, `apps/native` not `apps/mobile`.

```
CeolX/
├── apps/
│   ├── server/           # Hono + tRPC API (AWS Lambda)
│   ├── web/              # React + Vite + TanStack Router (admin + /subscribe)
│   └── native/           # React Native + Expo + NativeWind
├── packages/
│   ├── db/               # Drizzle schema, migrations, CeolX enums
│   ├── api/              # tRPC router types (shared server ↔ web)
│   ├── auth/             # BetterAuth configuration
│   ├── ui/               # Shared UI components
│   ├── env/              # Environment variable validation
│   └── config/           # Shared TS/ESLint config
├── .github/
│   └── workflows/        # CI/CD (placeholder — wired in M12)
├── package.json          # Root workspace config (pnpm)
├── pnpm-workspace.yaml   # pnpm workspace + catalog
├── turbo.json            # Turborepo tasks
├── tsconfig.json         # Root TypeScript config
├── bts.jsonc             # BTS project config
├── .env.example          # Environment variable template
└── .gitignore            # Git ignore rules
```

---

## Common Gotchas

- **pnpm workspaces**: Use `pnpm --filter apps/server add <pkg>` syntax
- **Module resolution**: If `@CeolX/db` imports fail, verify `tsconfig.json` paths are configured in each workspace
- **Circular dependencies**: `packages/*` must never import from `apps/*`; only apps import packages
- **Turborepo cache**: If a type change causes a cache miss, run `npm run build -- --no-cache`
- **Git branch sync**: Always ensure local branches match remote before pushing (use `git fetch origin`)
- **Environment variable isolation**: Each GitHub Environment (dev/staging/prod) has separate secrets; never push `.env.local`
- **TypeScript references**: Ensure `tsconfig.json` references are listed in correct dependency order

---
