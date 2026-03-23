# M1-T1 · Turborepo Monorepo Setup + GitHub Branch Strategy

| Field | Value |
|-------|-------|
| **Milestone** | M1 — Project Setup & Infrastructure |
| **Status** | 🔲 To Do |
| **Depends on** | Nothing — first task |
| **PRD Ref** | Section 10.1 (Tech Stack), Section 10.2 (Infrastructure) |

---

## Description

Establish the complete project scaffolding and version control strategy before any feature code is written. This foundational task creates a Turborepo monorepo with four workspaces (mobile app, admin dashboard, backend API, shared packages), configures workspace dependencies, and sets up a three-environment Git strategy (dev, staging, production) that mirrors the database branching approach. Every downstream task in M1–M11 depends on this being correct — misconfiguration here creates rework across the entire project.

CeolX is a solo-developer project, so the monorepo structure prioritizes clarity, type safety, and minimal boilerplate. Turborepo was chosen over Yarn/PNPM workspaces for its superior build caching and npm compatibility. The three-branch strategy (dev, staging, main) ensures that code and database schemas stay in sync across environments, preventing accidental schema drift and enabling safe feature development without touching production data.

---

## Affected Apps / Packages

- `apps/mobile` — React Native + Expo app (iOS and Android); empty scaffold created here
- `apps/admin` — Next.js admin dashboard and public Venue subscription page; empty scaffold created here
- `apps/api` — Hono backend API deployed as AWS Lambda; empty scaffold created here
- `packages/shared` — Shared TypeScript types, enums, utility functions; imported by all three apps

---

## API Endpoints

None — this is a setup task. No HTTP endpoints created here.

---

## Requirements

### Repository Initialization

- Monorepo initialized as a Turborepo with `npm` as the package manager (not pnpm or yarn)
- Root `package.json` with `workspaces` array pointing to `apps/*` and `packages/*`
- Root `turbo.json` with task definitions for `build`, `dev`, `lint`, `type-check`, `test`
- All four workspaces created with empty scaffolds ready for installation in M1-T3, M1-T4, M1-T5

### TypeScript Configuration

- Root `tsconfig.json` with project references pointing to each workspace's `tsconfig.json`
- `compilerOptions` in root include `strict: true`, `moduleResolution: "node"`, `skipLibCheck: true`
- Each workspace has its own `tsconfig.json` extending root config with workspace-specific paths
- `packages/shared/tsconfig.json` exports types cleanly; other workspaces can import with `import type { ... } from '@ceolx/shared'`
- TypeScript project references configured so `turbo build` compiles in dependency order

### Shared Enums and Types

- `packages/shared/src/enums/index.ts` exports all platform-wide enums
- `UserRole` enum: `spectator | artist | venue | super_admin`
- `EventStatus` enum: `draft | pending_review | rejected | active | archived`
- `BookingStatus` enum: `pending | accepted | rejected | cancelled`
- `BookingDirection` enum: `venue_to_artist | artist_to_venue`
- `SubscriptionStatus` enum: `inactive | active | past_due | cancelled`
- `MediaType` enum: `image | video | audio | text`
- `NotificationType` enum: `event_approved | event_rejected | booking_invitation | booking_update | artist_message | venue_message`
- All enums exported from `@ceolx/shared` package with barrel export pattern

### GitHub Repository Structure

- Repository initialized with three long-lived branches: `dev`, `staging`, `main`
- `main` branch protection: require PR reviews, enforce passing status checks, dismiss stale reviews on new pushes
- `staging` branch protection: require passing status checks, allow force push by maintainer (Priya)
- `dev` branch: no protection (development flexibility)
- All branches track their corresponding Neon database (dev → dev DB, staging → staging DB, main → prod DB)
- `.gitignore` includes: `node_modules/`, `dist/`, `.env.local`, `.env*.local`, `*.log`, `build/`, `.turbo/`
- `.github/workflows/` directory prepared (CI/CD setup in later milestones)

### Environment Variable Strategy

- `.env.example` in root documents all required variables for each environment
- Local development uses `.env.local` (git-ignored)
- Neon branch secrets stored in GitHub Environments matching git branches
- API base URL configurable: `apps/mobile` reads `EXPO_PUBLIC_API_BASE_URL` (Expo requires `EXPO_PUBLIC_` prefix)
- Admin dashboard reads `NEXT_PUBLIC_API_BASE_URL`

### Build and Development Commands

- `turbo build` — builds all apps and packages in correct dependency order
- `turbo dev` — runs all dev servers concurrently (mobile Expo, admin Next.js, API local Hono server)
- `turbo lint` — lints all workspaces (wired up in M1-T3, M1-T4, M1-T5)
- `turbo type-check` — type-checks all workspaces with TypeScript compiler
- `turbo test` — runs test suites (optional for V1, can stub)

---

## Acceptance Criteria

- [ ] `npm install` from root completes without errors; all dependencies resolved
- [ ] `turbo build` completes successfully across all four workspaces with no errors or warnings
- [ ] `packages/shared` types importable in `apps/api`, `apps/mobile`, and `apps/admin` with correct IDE autocomplete
- [ ] Root `tsconfig.json` references all workspace `tsconfig.json` files; TypeScript compilation respects dependency order
- [ ] GitHub repo created with `dev`, `staging`, `main` branches; protection rules applied to `main` and `staging`
- [ ] All six shared enums defined and exported from `packages/shared/src/enums/index.ts`
- [ ] `.env.example` documents all required environment variables for dev/staging/prod
- [ ] Three Neon PostgreSQL projects provisioned with connection strings (setup in M1-T2, but GitHub Environments prepared now)
- [ ] `turbo dev` starts all three dev servers without errors (may fail if packages not yet installed)
- [ ] Project structure confirmed in terminal: `tree -L 2 -I 'node_modules'` shows correct layout

---

## Dependencies

### Upstream (must be complete first)

None — this is the first task in the project.

### Downstream (this task blocks)

- **M1-T2** (Neon Database + Drizzle) — requires Git branches to exist and TypeScript enums defined
- **M1-T3** (Hono API) — requires Turborepo build config and shared types
- **M1-T4** (React Native + Expo) — requires Turborepo dev server and shared enums
- **M1-T5** (Next.js Admin) — requires Turborepo dev server and shared types
- **All M2–M11 tasks** — depend on this foundational structure

### External services / accounts needed

- GitHub account and repository (create new or use existing organization)
- Neon PostgreSQL account (free tier sufficient for dev/staging/prod databases)
- npm account (may already have via RaftLabs, but not required for private monorepo)

---

## Technical Notes

### Turborepo Configuration

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true,
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "outputs": [],
      "dependsOn": ["^type-check"]
    }
  }
}
```

### TypeScript Project References Example

```typescript
// Root tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "node",
    "skipLibCheck": true,
    "module": "esnext",
    "target": "es2020"
  },
  "references": [
    { "path": "apps/api" },
    { "path": "apps/mobile" },
    { "path": "apps/admin" },
    { "path": "packages/shared" }
  ]
}
```

```typescript
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "references": [{ "path": "../../packages/shared" }],
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Shared Enums Definition

```typescript
// packages/shared/src/enums/index.ts

export enum UserRole {
  SPECTATOR = 'spectator',
  ARTIST = 'artist',
  VENUE = 'venue',
  SUPER_ADMIN = 'super_admin',
}

export enum EventStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum BookingStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum BookingDirection {
  VENUE_TO_ARTIST = 'venue_to_artist',
  ARTIST_TO_VENUE = 'artist_to_venue',
}

export enum SubscriptionStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
}

export enum NotificationType {
  EVENT_APPROVED = 'event_approved',
  EVENT_REJECTED = 'event_rejected',
  BOOKING_INVITATION = 'booking_invitation',
  BOOKING_UPDATE = 'booking_update',
  ARTIST_MESSAGE = 'artist_message',
  VENUE_MESSAGE = 'venue_message',
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
}
```

### GitHub Branch Protection Rules

**For `main` branch:**
- Require pull request reviews before merging (1 approval minimum)
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Dismiss stale pull request approvals when new commits are pushed
- Allow deletions: false

**For `staging` branch:**
- Require status checks to pass before merging
- Allow force pushes by Priya only (maintainer override for emergency hotfixes)
- Allow deletions: false

**For `dev` branch:**
- No protection rules (fast iteration)

### Environment Variables Example

```
# .env.example (root level)

# Database connections (branch-specific)
DATABASE_URL=postgresql://...  # Neon branch connection string
DIRECT_URL=postgresql://...    # Neon direct connection (non-pooled, for migrations)

# API Configuration
API_BASE_URL=http://localhost:3001  # Local dev; override per environment
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001

# Authentication (BetterAuth — setup in M2)
BETTER_AUTH_SECRET=<random-32-char-secret>
GOOGLE_OAUTH_CLIENT_ID_IOS=...
GOOGLE_OAUTH_CLIENT_ID_ANDROID=...
GOOGLE_OAUTH_CLIENT_ID_WEB=...
APPLE_OAUTH_CLIENT_ID=...

# Email (Postmark — setup in M7)
POSTMARK_API_TOKEN=<token>

# AWS S3 (setup in M6)
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=ceolx-media

# Firebase FCM (setup in M7)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Stripe (setup in M8)
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Mux (setup in M6)
MUX_ACCESS_TOKEN_ID=...
MUX_ACCESS_TOKEN_SECRET=...
```

### Common Gotchas

- **npm workspaces syntax**: Use `npm install -w apps/api` to install in a single workspace, not the Yarn syntax
- **Module resolution in monorepos**: If imports like `@ceolx/shared` fail, ensure TypeScript `paths` are configured in each workspace's `tsconfig.json`
- **Circular dependencies**: `packages/shared` must never import from `apps/*`; only `apps/*` import from `packages/shared`
- **Turborepo cache invalidation**: If adding a new shared type causes a cache miss, run `turbo build --no-cache` and commit the lockfile changes
- **Git branch sync**: Always ensure local `dev`, `staging`, `main` branches match remote before pushing; use `git fetch origin` to stay in sync with Neon database branches
- **Environment variable isolation**: Each GitHub Environment (dev, staging, prod) has its own secrets; never hardcode credentials or push `.env.local` to git

---

