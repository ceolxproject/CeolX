---
name: database
description: Use when writing Drizzle ORM schemas, creating database tables, adding indexes, writing SQL migrations, defining relations, or optimizing PostgreSQL queries. Use for foreign key indexes, JSONB columns, composite indexes, or prepared statements.
---

# Database Development

## Overview

Every foreign key needs an index. Every frequent filter needs an index. Use Drizzle ORM patterns correctly and think about query patterns before defining tables.

## When to Use

- Designing new database schemas
- Adding tables with Drizzle ORM
- Optimizing slow queries
- Choosing between UUID vs serial IDs
- Deciding index strategy

## The Iron Rules

### 1. Every Foreign Key Gets an Index

Foreign keys don't automatically create indexes in PostgreSQL. You MUST add them.

```typescript
// ❌ BAD: FK without index
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id), // No index!
});

// ✅ GOOD: FK with explicit index
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    userIdIdx: index('orders_user_id_idx').on(table.userId),
  })
);
```

### 2. Index Frequently Filtered Columns

If you WHERE on it, index it.

```typescript
// ✅ GOOD: Index on status and timestamps
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('orders_user_id_idx').on(table.userId),
    statusIdx: index('orders_status_idx').on(table.status),
    createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
    // Composite for common query: "user's orders by status"
    userStatusIdx: index('orders_user_status_idx').on(table.userId, table.status),
  })
);
```

### 3. Use Partial Indexes for Filtered Subsets

When you frequently query a subset, use a partial index.

```typescript
// ✅ GOOD: Partial index for active products only
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
  },
  (table) => ({
    // Only index active products - smaller, faster
    activeIdx: index('products_active_idx')
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
    // Featured products (active AND featured)
    featuredIdx: index('products_featured_idx')
      .on(table.isFeatured)
      .where(sql`${table.isActive} = true AND ${table.isFeatured} = true`),
  })
);
```

### 4. JSONB with GIN Index for JSON Columns

Never store JSON as text. Use JSONB with GIN index for queries.

```typescript
import { jsonb } from "drizzle-orm/pg-core";

// ❌ BAD: JSON as text
imageUrls: text("image_urls"), // Can't query efficiently

// ✅ GOOD: JSONB with GIN index
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  metadata: jsonb("metadata").$type<ProductMetadata>(),
  tags: jsonb("tags").$type<string[]>().default([]),
}, (table) => ({
  tagsGinIdx: index("products_tags_gin_idx")
    .using("gin", table.tags),
}));
```

### 5. Auto-Update Timestamps

Use `$onUpdate` for automatic timestamp updates.

```typescript
// ✅ GOOD: Auto-updating timestamps
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
```

### 6. Primary Key Strategy

| Strategy        | Use When                        | Pros                        | Cons                   |
| --------------- | ------------------------------- | --------------------------- | ---------------------- |
| **UUID**        | Distributed systems, public IDs | No collisions, hide growth  | Larger, slower indexes |
| **Identity**    | Single DB, internal IDs (2025+) | Compact, fast, SQL standard | Exposes growth         |
| **ULID/NanoID** | Need sortability + randomness   | Sortable, compact           | Custom generation      |

```typescript
// UUID (default for distributed/public IDs)
id: uuid("id").defaultRandom().primaryKey(),

// ✅ GOOD: Identity columns (PostgreSQL 10+, preferred over serial)
id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

// For bigint IDs
id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),

// ❌ AVOID: Serial (legacy, has sequence ownership issues)
id: serial("id").primaryKey(), // Use identity instead

// ULID for sortable + random
id: varchar("id", { length: 26 }).primaryKey().$default(() => ulid()),
```

**Why Identity over Serial:**

- SQL standard (serial is PostgreSQL-specific)
- No sequence ownership issues during migrations
- Better `COPY` and `pg_dump` behavior
- Cannot be overwritten accidentally (`GENERATED ALWAYS`)

### 7. Full-Text Search with GIN

For searchable text columns, use PostgreSQL's built-in full-text search:

```typescript
import { sql } from 'drizzle-orm';
import { index, pgTable, text, tsvector } from 'drizzle-orm/pg-core';

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    // Generated tsvector column for search
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(${products.name}, '') || ' ' || coalesce(${products.description}, ''))`
    ),
  },
  (table) => ({
    // GIN index for fast full-text search
    searchIdx: index('products_search_idx').using('gin', table.searchVector),
  })
);

// Query with full-text search
const results = await db
  .select()
  .from(products)
  .where(sql`${products.searchVector} @@ plainto_tsquery('english', ${query})`);
```

**Key patterns:**

- Use `tsvector` for searchable content
- `generatedAlwaysAs` auto-updates on row changes
- GIN index makes searches fast (vs sequential scan)
- `plainto_tsquery` for simple user queries

## Migration Strategy

### Generate vs Push

| Command                | Use When                      | Output                          |
| ---------------------- | ----------------------------- | ------------------------------- |
| `drizzle-kit generate` | Production, team environments | SQL migration files + snapshots |
| `drizzle-kit migrate`  | Apply versioned migrations    | Executes generated SQL files    |
| `drizzle-kit push`     | Local dev, rapid prototyping  | Direct schema push, no files    |

```bash
# Production workflow: versioned migrations
npx drizzle-kit generate  # Creates migrations/0001_*.sql
npx drizzle-kit migrate   # Applies to database

# Dev workflow: quick iteration
npx drizzle-kit push      # Direct push, no migration files
```

**Always use `generate` + `migrate` for:**

- Production databases
- Team collaboration
- Audit trail requirements
- Rollback capability

### Migration Files Structure

```
migrations/
├── 0001_init.sql              # First migration
├── 0002_add_orders_table.sql  # Sequential
├── meta/
│   ├── 0001_snapshot.json     # Schema snapshots
│   └── 0002_snapshot.json
```

## Relations & Nested Queries

### Define Relations in Schema

```typescript
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
  },
  (table) => ({
    userIdIdx: index('posts_user_id_idx').on(table.userId),
  })
);

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
}));
```

### Query with Relations (Avoids N+1)

```typescript
// ✅ GOOD: Single query with join
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true, // Eagerly loaded
  },
});

// ✅ GOOD: Nested relations
const usersWithPostsAndComments = await db.query.users.findMany({
  with: {
    posts: {
      with: {
        comments: true,
      },
    },
  },
});

// ✅ GOOD: Filtered nested queries
const activeUsersWithRecentPosts = await db.query.users.findMany({
  where: eq(users.status, 'active'),
  with: {
    posts: {
      where: gte(posts.createdAt, new Date('2024-01-01')),
      limit: 10,
    },
  },
});

// ❌ BAD: N+1 query problem
const users = await db.select().from(users);
for (const user of users) {
  user.posts = await db.select().from(posts).where(eq(posts.userId, user.id));
}
```

## Prepared Statements

Use prepared statements for repeated queries to cache query plans.

```typescript
// ✅ GOOD: Prepared statement with placeholders
const getUserWithPosts = db.query.users
  .findFirst({
    where: eq(users.id, sql.placeholder('userId')),
    with: {
      posts: {
        where: eq(posts.status, sql.placeholder('status')),
      },
    },
  })
  .prepare('get_user_posts'); // Name required for PostgreSQL

// Execute multiple times
const user1 = await getUserWithPosts.execute({
  userId: '123',
  status: 'published',
});
const user2 = await getUserWithPosts.execute({
  userId: '456',
  status: 'published',
});

// ✅ GOOD: Simple prepared query
const getOrdersByUser = db
  .select()
  .from(orders)
  .where(eq(orders.userId, sql.placeholder('userId')))
  .prepare('orders_by_user');

const orders = await getOrdersByUser.execute({ userId: '123' });
```

**When to use:**

- High-traffic endpoints
- Repeated queries with different params
- Query optimization critical paths

## Serverless Connection Pooling

### Neon Serverless

```typescript
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// For Node.js with WebSockets
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;
```

### Vercel Postgres

```typescript
import { drizzle } from 'drizzle-orm/vercel-postgres';

const db = drizzle(); // Automatically uses POSTGRES_URL from env
```

### Edge Runtime (HTTP-based)

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle({ client: sql });
```

**Key considerations:**

- HTTP drivers for edge: no TCP connections
- Pool for serverless: handles connection lifecycle
- WebSocket for Node: better performance

## Type Safety in Database Operations

**Never use `any` for query results or parameters.** Drizzle provides strong typing - use it.

### Use Drizzle's Type Inference - Not Manual Types

Drizzle automatically generates types from your schema. **Always use `$inferSelect` and `$inferInsert` instead of manually defining types.**

```typescript
// ❌ BAD: Manually defining a type that Drizzle already provides
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

function getUser(id: string): Promise<User | undefined> { ... }

// ✅ GOOD: Use Drizzle's type inference - single source of truth
import { users } from '@/db/schema';

type User = typeof users.$inferSelect;     // Full row type
type NewUser = typeof users.$inferInsert;  // Insert type (optionals allowed)

function getUser(id: string): Promise<User | undefined> { ... }
function createUser(data: NewUser): Promise<User> { ... }
```

**Why inference is better:**

- **Single source of truth** - schema changes automatically update types
- **No type drift** - manual types fall out of sync with schema
- **Less maintenance** - no duplicate definitions to update

### Typed Query Results

```typescript
// ❌ BAD: Untyped results lose all safety
const users: any[] = await db.select().from(users);
users[0].emial; // No error, but typo will crash at runtime

// ✅ GOOD: Drizzle infers types automatically
const users = await db.select().from(users);
users[0].email; // Typed as string
users[0].emial; // TypeScript error: Property 'emial' does not exist

// ✅ GOOD: Explicit type for complex queries
type UserWithPosts = {
  user: typeof users.$inferSelect;
  posts: (typeof posts.$inferSelect)[];
};

const result: UserWithPosts[] = await db.query.users.findMany({
  with: { posts: true },
});
```

### Typed Filter Parameters

```typescript
// ❌ BAD: any for filter values
async function findUsers(filters: any) {
  return db.select().from(users).where(filters);
}

// ✅ GOOD: Define filter types
type UserFilters = {
  status?: 'active' | 'inactive';
  role?: 'admin' | 'user';
  createdAfter?: Date;
};

async function findUsers(filters: UserFilters) {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(users.status, filters.status));
  }
  if (filters.role) {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters.createdAfter) {
    conditions.push(gte(users.createdAt, filters.createdAfter));
  }

  return db
    .select()
    .from(users)
    .where(and(...conditions));
}
```

### Drizzle Type Helpers

```typescript
import { users } from './schema';

// Infer types from schema
type User = typeof users.$inferSelect; // Full row type
type NewUser = typeof users.$inferInsert; // Insert type (optional fields allowed)

// Use in functions
async function createUser(data: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

// Partial updates with proper typing
type UserUpdate = Partial<Omit<NewUser, 'id' | 'createdAt'>>;

async function updateUser(id: string, data: UserUpdate): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return user;
}
```

## Quick Reference: Index Types

| Index Type           | Use For                    | Example                                          |
| -------------------- | -------------------------- | ------------------------------------------------ |
| **B-tree** (default) | Equality, range, ORDER BY  | `WHERE status = 'active'`, `ORDER BY created_at` |
| **GIN**              | Arrays, JSONB, full-text   | `WHERE tags @> '["sale"]'`                       |
| **BRIN**             | Large sorted tables (logs) | Time-series data ordered by timestamp            |
| **Hash**             | Only exact equality        | `WHERE id = 'abc'` (rare use)                    |

```typescript
// GIN for JSONB
index('idx').using('gin', table.tags);

// BRIN for time-series
index('idx').using('brin', table.createdAt);
```

## Schema Checklist

Before committing a schema:

- [ ] Every foreign key has an index
- [ ] Frequently filtered columns are indexed
- [ ] Composite indexes match common query patterns
- [ ] JSON columns use JSONB, not text
- [ ] `updatedAt` has `$onUpdate`
- [ ] Considered partial indexes for subsets
- [ ] Timestamps indexed if used in WHERE/ORDER BY
- [ ] Relations defined for nested queries
- [ ] Migration generated (not just pushed)

## Testing Strategy

| What to Test        | How                               |
| ------------------- | --------------------------------- |
| Migrations          | Apply to test DB, verify schema   |
| Query performance   | Use EXPLAIN ANALYZE               |
| Index usage         | Check query plans for index scans |
| Relations           | Verify single query, not N+1      |
| Prepared statements | Benchmark vs regular queries      |

```typescript
// Test migration applies cleanly
import { migrate } from 'drizzle-orm/neon-serverless/migrator';

test('migrations apply successfully', async () => {
  await migrate(db, { migrationsFolder: './migrations' });
  // Verify tables exist
  const result = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  expect(result.rows).toContainEqual({ tablename: 'users' });
});

// Test index usage with EXPLAIN
test('query uses index for user lookup', async () => {
  const plan = await db.execute(sql`
    EXPLAIN (FORMAT JSON)
    SELECT * FROM orders WHERE user_id = '123'
  `);
  const planText = JSON.stringify(plan.rows);
  expect(planText).toContain('Index Scan'); // Not Seq Scan
  expect(planText).toContain('orders_user_id_idx');
});

// Test relations avoid N+1
test('users with posts executes single query', async () => {
  const startTime = Date.now();
  const users = await db.query.users.findMany({
    with: { posts: true },
  });
  const duration = Date.now() - startTime;

  expect(users).toHaveLength(100);
  expect(users[0].posts).toBeDefined();
  expect(duration).toBeLessThan(100); // Single query is fast
});
```

## Performance Validation Tools

### EXPLAIN ANALYZE

```sql
-- Check if index is used
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE user_id = 'abc' AND status = 'pending';

-- Look for:
-- ✅ Index Scan using orders_user_status_idx
-- ❌ Seq Scan on orders (missing index!)
```

### Query Metrics

```typescript
// Log slow queries in production
import { sql } from 'drizzle-orm';

const startTime = Date.now();
const result = await db.query.users.findMany({ with: { posts: true } });
const duration = Date.now() - startTime;

if (duration > 100) {
  console.warn(`Slow query: ${duration}ms`, { query: 'users.findMany' });
}
```

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) - Relations, prepared statements, migrations
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html) - Index types and usage
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html) - tsvector, GIN indexes
- [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) - Migration management

**Version Notes:**

- Drizzle ORM 0.30+: Improved relations API, identity column support
- Drizzle Kit 0.20+: Enhanced migration generation
- PostgreSQL 10+: Identity columns (prefer over serial)
- PostgreSQL 15+: Improved JSON and full-text performance

## Red Flags - STOP and Add Indexes

| Thought                                      | Reality                                             |
| -------------------------------------------- | --------------------------------------------------- |
| "I'll add indexes later if queries are slow" | Add them now. FK indexes are mandatory.             |
| "Indexes slow down writes"                   | Reads outnumber writes 100:1. Index it.             |
| "The table is small"                         | Tables grow. Index from day one.                    |
| "I don't know the query patterns yet"        | FK indexes are always needed. Start there.          |
| "JSON as text is fine for now"               | JSONB costs nothing extra. Use it.                  |
| "I'll just push for now"                     | Use generate for prod. You need migration history.  |
| "Relations are overhead"                     | They prevent N+1 and generate optimal queries.      |
| "Prepared statements are premature"          | They're free performance for repeated queries.      |
| "I'll fetch users then their posts"          | N+1 problem. Use `with` for single query.           |
| "I need to define a User type"               | Use `$inferSelect` - schema is the source of truth. |

## Common Mistakes

| Mistake                        | Fix                                                   |
| ------------------------------ | ----------------------------------------------------- |
| FK without index               | Add `.on(table.foreignKeyColumn)`                     |
| JSON as text                   | Use `jsonb()` with GIN index                          |
| No composite index             | Add for common multi-column filters                   |
| Missing $onUpdate              | Add for `updatedAt` columns                           |
| Unique without index awareness | `unique()` creates index, but document intent         |
| No partial index               | Use `where()` for subset queries                      |
| Using push in production       | Use `drizzle-kit generate` + `migrate` for versioning |
| N+1 queries with loops         | Define relations, use `with` for nested data          |
| No prepared statements         | Use `.prepare()` for repeated queries                 |
| HTTP driver in Node serverless | Use Pool with WebSockets for better performance       |
| Manually defining row types    | Use `$inferSelect` / `$inferInsert` from schema       |
