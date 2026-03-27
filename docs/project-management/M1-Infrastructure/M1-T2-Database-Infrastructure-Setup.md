# M1-T2 · Database Infrastructure Setup (Docker Local + Neon Staging/Prod)

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                       |
| **Status**     | 🔲 To Do                                                  |
| **Depends on** | M1-T1 (Turborepo monorepo must exist)                     |
| **Blocks**     | M1.5 (Schema Design needs a working DB connection)        |
| **PRD Ref**    | Section 10.1 (Tech Stack), Section 9.3 (Event Data Model) |

---

## Description

Set up the database layer infrastructure across all three environments before any schema or API work begins. The goal is a single `DATABASE_URL` environment variable that swaps between environments — Drizzle config never changes, only the `.env` file does.

- **Local**: PostgreSQL via Docker Compose — no internet dependency, instant startup, full parity with Neon's PostgreSQL dialect
- **Staging**: Neon `staging` branch — matches the `staging` Git branch
- **Production**: Neon `main` branch — matches the `main` Git branch

---

## Affected Apps / Packages

- `apps/server` — Drizzle config, DB connection module, migration runner
- `docker-compose.yml` — root-level, shared across all apps
- `packages/shared` — no changes here; enums live in schema (M1.5-T1)

---

## Requirements

### 1. Docker Compose — Local PostgreSQL

- `docker-compose.yml` at repo root with a `postgres` service
- PostgreSQL 16 image (`postgres:16-alpine`)
- Persistent volume so data survives container restarts
- Environment variables set to match Neon's defaults for parity:
  - `POSTGRES_USER=ceolx`
  - `POSTGRES_PASSWORD=ceolx_local`
  - `POSTGRES_DB=ceolx_dev`
- Port mapped: `5432:5432`
- Health check so dependent services wait for DB to be ready
- `.env.local` entry: `DATABASE_URL=postgresql://ceolx:ceolx_local@localhost:5432/ceolx_dev`

### 2. Neon Project Setup

- Create Neon project: `ceolx`
- Create two branches:
  - `staging` → used by the `staging` Git branch
  - `main` → used by the `main` Git branch (production)
- Note: Neon auto-creates a `main` branch; rename or use it as production
- Copy connection strings from Neon console for each branch
- Store connection strings as GitHub Secrets / CI env vars:
  - `DATABASE_URL_STAGING`
  - `DATABASE_URL_PROD`

### 3. Drizzle ORM Configuration

- Install: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `pg` (for local Docker)
- `apps/server/src/db/client.ts` — single DB client export that reads `DATABASE_URL` from env:
  - Uses `@neondatabase/serverless` driver when `DATABASE_URL` contains `neon.tech`
  - Uses `pg` driver (node-postgres) for local Docker connection
- `apps/server/drizzle.config.ts` — Drizzle Kit config pointing to schema file and migrations folder
- `apps/server/.env.local` — local DATABASE_URL (gitignored)
- `apps/server/.env.example` — template with placeholder values (committed)

### 4. Verify Connection

- `npm run db:check` script that runs `SELECT 1` and prints the PostgreSQL version
- Must succeed on local Docker and against Neon staging branch

---

## File Structure

```
/                               ← repo root
  docker-compose.yml
  docker-compose.override.yml   ← optional; local overrides (gitignored)

apps/server/
  drizzle.config.ts
  .env.local                    ← gitignored
  .env.example                  ← committed
  src/
    db/
      client.ts                 ← DB connection factory
      index.ts                  ← re-exports client + schema (added in M1.5)
```

---

## docker-compose.yml (Reference)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ceolx_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ceolx
      POSTGRES_PASSWORD: ceolx_local
      POSTGRES_DB: ceolx_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ceolx -d ceolx_dev']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## drizzle.config.ts (Reference)

```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default {
  schema: './src/db/schema',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

---

## DB Client (Reference)

```typescript
// apps/server/src/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool } from 'pg';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL!;

export const db = url.includes('neon.tech')
  ? drizzleNeon(neon(url))
  : drizzle(new Pool({ connectionString: url }));
```

---

## npm Scripts (Reference)

Add to `apps/server/package.json`:

```json
{
  "scripts": {
    "db:check": "tsx src/db/check.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Acceptance Criteria

- [ ] `docker compose up -d` starts PostgreSQL locally with no errors
- [ ] `docker compose ps` shows the `ceolx_postgres` container as healthy
- [ ] `npm run db:check` prints PostgreSQL version against local Docker
- [ ] Neon project created with `staging` and `main` branches visible in Neon console
- [ ] `npm run db:check` passes against Neon staging branch (swap `DATABASE_URL`)
- [ ] `drizzle.config.ts` present and `drizzle-kit generate` runs without errors (schema files may be empty stubs at this point)
- [ ] `.env.example` committed with placeholder values; `.env.local` is gitignored
- [ ] No hardcoded credentials anywhere in committed code

---

## Common Gotchas

- **Neon requires SSL**: `?sslmode=require` must be appended to Neon connection strings or the `@neondatabase/serverless` driver handles it automatically (it does — no extra config needed)
- **Port conflict**: If another Postgres is running locally, change the Docker host port to `5433:5432`
- **Volume on re-init**: If you change `POSTGRES_DB` after first run, you must `docker compose down -v` to wipe the volume before the new DB name takes effect
- **drizzle-kit dialect**: Use `"postgresql"` not `"pg"` in `drizzle.config.ts` (changed in drizzle-kit v0.20+)
