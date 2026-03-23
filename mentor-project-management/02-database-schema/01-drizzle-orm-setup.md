# Task 1: Drizzle ORM Setup and Configuration

## Description

Configure Drizzle ORM in the `packages/db` directory to work with Neon Serverless PostgreSQL. This includes setting up the Drizzle configuration file, establishing database client exports, creating migration scripts, and setting up the infrastructure for database version control. This foundational task enables type-safe database operations throughout the application.

## Affected Apps/Packages

- `packages/db` (primary)
- `apps/api` (will consume the database client)
- `apps/web-learner` (optional API routes)
- `apps/web-mentor` (optional API routes)
- `apps/web-admin` (optional API routes)
- All packages depending on database operations

## Requirements

### Package Installation

- Install `drizzle-orm` (latest stable, currently ^0.31.x)
- Install `@neondatabase/serverless` for Neon Postgres driver
- Install `drizzle-kit` (^0.24.x) as dev dependency for migrations
- Install `postgres` package (^3.x) as alternative driver for local development
- Install `dotenv` (^16.x) for environment variable loading in migration scripts

### Directory Structure

```
packages/db/
├── src/
│   ├── client.ts                 # Main database client export
│   ├── index.ts                  # Public exports
│   └── config/
│       └── env.ts                # Environment variable validation
├── drizzle.config.ts             # Drizzle Kit configuration
├── migrations/                   # Generated migration files
├── package.json
└── tsconfig.json
```

### drizzle.config.ts Configuration

- Set `dialect` to `"postgresql"`
- Configure `schema` path to point to schema files (will be created in later tasks)
- Set `out` to `"migrations"` directory
- Configure `dbCredentials` with:
  - `url` from `NEON_DATABASE_URL` environment variable
  - Fallback `host`, `port`, `user`, `password`, `database` for local development
- Use `NEON_DATABASE_URL` format: `postgresql://user:password@neon-host/database`
- Enable `schemaFilter: ["public"]` to avoid system schema migrations

### Database Client (src/client.ts)

- Create a singleton database client using `drizzle()`
- Support both Neon serverless (`@neondatabase/serverless`) and local Postgres connections
- Use environment variable `DATABASE_URL` or `NEON_DATABASE_URL` to determine connection type
- Export the client as default and named export `db`
- Include connection pool configuration:
  - Max connections: 10 for serverless
  - Connection timeout: 30 seconds
  - Idle timeout: 900 seconds
- Add error handling for connection failures

### Environment Variables

Required `.env` variables:

- `NEON_DATABASE_URL` (connection string for production)
- `DATABASE_URL` (alternative, takes precedence in some contexts)
- `NODE_ENV` (development|production|test)
- Optional: `DB_LOGGING` (set to `true` for SQL query logging)

### Migration Scripts in package.json

Add scripts section:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg --config=drizzle.config.ts",
    "db:migrate": "drizzle-kit migrate:pg --config=drizzle.config.ts",
    "db:push": "drizzle-kit push:pg --config=drizzle.config.ts",
    "db:drop": "drizzle-kit drop --config=drizzle.config.ts",
    "db:studio": "drizzle-kit studio --config=drizzle.config.ts",
    "db:introspect": "drizzle-kit introspect:pg --config=drizzle.config.ts"
  }
}
```

### TypeScript Configuration

- Set up `src/config/env.ts` to validate required environment variables at runtime
- Use `z.ZodError` pattern or similar for environment validation
- Export validated config object for use in database client
- Ensure strict TypeScript configuration in `packages/db/tsconfig.json`

### Public Exports (src/index.ts)

```typescript
export { db } from "./client";
export * from "./schema"; // Schema exports (added in later tasks)
```

### Local Development Setup

- Support `.env.local` for development database configuration
- Document how to use local Postgres vs Neon for development
- Include connection string examples for both setups

## Database Tables

No tables are created in this task; configuration only. Table schemas are defined in subsequent tasks.

## Acceptance Criteria

- [ ] `packages/db/drizzle.config.ts` exists and points to correct schema location
- [ ] Database client can successfully connect to Neon Serverless PostgreSQL
- [ ] `db:generate` script creates a migrations folder with proper naming convention
- [ ] `db:push` script can execute schema changes to database without errors
- [ ] `db:migrate` script runs migration files sequentially
- [ ] Database client is exported from `packages/db/src/index.ts`
- [ ] Environment variables are validated before database connection
- [ ] SQL query logging can be enabled via `DB_LOGGING=true`
- [ ] TypeScript types are properly inferred from database client
- [ ] `db:studio` command opens Drizzle Studio UI for local inspection
- [ ] Database connection pools properly configured (max 10 connections)
- [ ] All migration scripts are gitignored but tracked in version control structure
- [ ] Connection to local Postgres works alongside Neon configuration
- [ ] Zero migration files exist after initial setup (clean slate)

## Dependencies

- Node.js >= 20.0.0
- Neon account with database instance created
- pnpm workspace initialized (Task 01-repo-and-infra-setup/01-turborepo-monorepo-init)
- `packages/db` directory created in monorepo

## Technical Notes

### Drizzle ORM Best Practices

- Always use `drizzle()` function for client instantiation, not direct pool creation
- Connection pools should be created once and reused across the application
- Use prepared statements for all dynamic queries (Drizzle does this automatically)
- Never expose raw SQL strings; use Drizzle's query builder API

### Neon Serverless Considerations

- `@neondatabase/serverless` package is optimized for serverless environments
- Connection pooling works differently in serverless vs persistent connections
- Cold starts may add 100-200ms to first query; use connection pooling to minimize
- Neon provides connection pooling out of the box via HTTP/WebSocket
- Set appropriate timeouts for queries in serverless functions

### Migration Strategy

- Migrations are timestamped and should be immutable once applied
- Never manually edit migration files; regenerate if changes needed
- Use `db:push` for development (quick iterations), `db:migrate` for production
- Keep migrations small and focused on single logical changes
- Test all migrations locally before applying to staging/production

### Schema File Organization

- Schemas will be created in `packages/db/src/schema/` directory
- Split schemas by domain (users.ts, courses.ts, etc.) for maintainability
- Import all schemas in central index file for Drizzle Kit
- Use relations for type-safe joins in Drizzle queries

### Environment Variable Handling

- Never hardcode database URLs in source code
- Use `NEON_DATABASE_URL` for production (add to GitHub secrets)
- Support local `.env.local` for development (in .gitignore)
- Validate environment at application startup, not silently fail
- Document all required environment variables in README

### Troubleshooting Common Issues

- If `drizzle-kit generate` fails, ensure schema files are properly exported
- Connection timeouts usually indicate invalid credentials or firewall issues
- "Cannot find module 'drizzle-orm'" means dependencies not installed properly
- Neon connection strings include `@` and `/` which need proper URL encoding if using env vars
- For local Postgres testing, ensure postgresql service is running on port 5432

### SQL Logging and Debugging

- Enable `DB_LOGGING=true` to see all executed SQL queries
- Useful for optimization and understanding Drizzle's query generation
- Never enable in production (performance impact and sensitive data exposure)
- Use Drizzle Studio for visual database inspection: `pnpm db:studio`

### Monorepo Integration

- Database client should be imported from `packages/db` in all apps
- Never create separate database clients in different packages
- Use Turborepo to ensure `packages/db` builds before dependent apps
- All database operations must go through the single exported client
