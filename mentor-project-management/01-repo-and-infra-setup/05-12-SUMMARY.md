# Tasks 5-12: Quick Reference Guide

Complete reference for remaining infrastructure tasks.

## Task 5: ESLint, Prettier, EditorConfig

**Files:** `.eslintrc.json`, `.prettierrc.json`, `.editorconfig`

**Key ESLint Rules:**

- Strict TypeScript checking
- No unused variables (except \_-prefixed)
- React hooks validation
- Import ordering
- No floating promises

**Prettier Settings:**

- Print width: 100
- Semi: true
- Trailing commas: es5
- Single quotes: true

## Task 6: Husky, CommitLint, Lint-Staged

**Hooks:** `.husky/pre-commit` (lint-staged), `.husky/commit-msg` (commitlint)

**Commit Format:**

```
<type>(scope): <description>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci

**Scopes:** api, web-learner, web-mentor, web-admin, mobile, db, auth, ui, etc.

## Task 7: GitHub Actions Workflows

**Workflows:**

- `lint-and-test.yml` - PR: lint, type-check, build
- `build-and-preview.yml` - PR: Vercel preview
- `deploy-production.yml` - Main: production deploy
- `mobile-build.yml` - Mobile: EAS builds

**Secrets Needed:**

- TURBO_TOKEN, VERCEL_TOKEN, EXPO_TOKEN, SENTRY_AUTH_TOKEN

## Task 8: Vercel Projects

**Projects:**

- mentor-api (Hono)
- mentor-web-learner (Next.js)
- mentor-web-mentor (Next.js)
- mentor-web-admin (Next.js)

**Domains:**

- api.example.com
- learner.example.com
- mentor.example.com
- admin.example.com

**Build Command:** `pnpm turbo build --filter=<app>`

## Task 9: Neon Database

**Setup:**

- Create account at neon.tech
- Create project (region: eu-central-1)
- Create branches: main, staging, development
- Enable connection pooling (transaction mode)

**Drizzle ORM:**

- Create `packages/db` with schema.ts
- Configure `drizzle.config.ts`
- Run migrations with `pnpm db:push`

## Task 10: Cloudflare R2

**Buckets:**

- mentor-public-assets (public, cached)
- mentor-private-uploads (private, signed URLs)

**Setup:**

- Generate API token
- Create buckets with CORS
- Create CDN at cdn.example.com
- Implement signed URL utility

## Task 11: Environment Variables

**Create:** `packages/env` with Zod validation

**Schema Pattern:**

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]),
  DATABASE_URL: z.string().url(),
  // ... all required variables
});
```

**Environment Files:**

- `.env.example` (template)
- `.env.local` (development, .gitignored)
- GitHub Secrets (CI/CD)
- Vercel Environment Variables

## Task 12: Sentry

**Projects:**

- mentor-api (Node.js)
- mentor-web-learner (React)
- mentor-web-mentor (React)
- mentor-web-admin (React)
- mentor-mobile (React Native)

**Setup:**

- Initialize in each app
- Enable source maps upload
- Set environment and release tags
- Configure alerts in Slack

**Sampling:**

- Transactions: 10% (0.1)
- Sessions: 10% (0.1)
- Errors: 100% (1.0)

---

## Implementation Order

1. **ESLint/Prettier** → Enable code quality from start
2. **Husky/CommitLint** → Enforce standards on commits
3. **GitHub Actions** → Automate testing and deployment
4. **Vercel** → Deploy and preview changes
5. **Neon** → Database infrastructure
6. **R2** → File storage
7. **Environment** → Centralized config
8. **Sentry** → Error tracking

## Critical Environment Variables

```
# Required for all environments
NODE_ENV
DATABASE_URL
API_URL
CORS_ORIGIN
AUTH_SECRET (32+ chars)
SESSION_SECRET (32+ chars)
JWT_SECRET (32+ chars)

# External services
SENTRY_DSN
STRIPE_SECRET_KEY
CLOUDFLARE_R2_*
POSTMARK_API_KEY

# Client-side public
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SENTRY_DSN
EXPO_PUBLIC_API_URL
```

## Verification Checklist

- [ ] Task 1-4 completed and tested
- [ ] GitHub Actions workflows created
- [ ] Vercel projects deployed
- [ ] Database migrations applied
- [ ] R2 buckets configured
- [ ] Environment variables set
- [ ] Sentry projects created
- [ ] All services communicate
- [ ] `pnpm build` succeeds
- [ ] `pnpm dev` starts all servers
