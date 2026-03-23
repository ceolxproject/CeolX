# Cache Adapter Package - Redis Abstraction Layer

## Description

Create `packages/cache` as a Redis abstraction adapter supporting local Redis in development and Upstash Redis in production. Provide a unified cache interface with get/set/delete/invalidate operations, TTL support, cache key namespacing for multi-tenant isolation, and type-safe generics. Enable seamless caching of user sessions, course data, search results, and API responses across the platform without vendor lock-in.

## Affected Apps/Packages

- `packages/cache` - Cache adapter library
- Backend API - Server-side caching
- `apps/web` - Optional: client-side cache layer
- API client package - Response caching
- Database queries - Query result caching
- Session management - Session storage

## Requirements

### Core Architecture

- Adapter pattern for pluggable cache providers
- Provider interface: get, set, delete, invalidate, clear, exists, ttl
- Support for two providers:
  1. **Local Redis** (development) - `redis` package
  2. **Upstash Redis** (production) - `@upstash/redis` package
- Single source of truth (no dual-writing)
- Type-safe generics for all operations
- Error handling and fallbacks to database

### Operations

1. **Get** - Retrieve value by key with type safety
2. **Set** - Store value with optional TTL (time-to-live)
3. **Delete** - Remove key from cache
4. **Invalidate** - Remove keys matching pattern (wildcard support)
5. **Clear** - Clear all keys (dangerous, dev only)
6. **Exists** - Check if key exists
7. **TTL** - Get remaining TTL or set new TTL
8. **Increment/Decrement** - Atomic counters for rate limiting
9. **Expire** - Set expiration on existing key
10. **Keys** - List keys matching pattern

### TTL Configuration

- Default TTL: 1 hour (3600 seconds)
- Configurable per operation
- Extended TTL for stable data (courses: 24 hours)
- Short TTL for session data (15 minutes)
- No TTL for reference data
- Automatic cleanup of expired keys (Redis default)

### Key Namespacing Strategy

Prevent collisions and enable easy invalidation by tenant/context:

```
Format: {namespace}:{context}:{identifier}
Examples:
  - cache:user:123 (user profile)
  - cache:course:456 (course data)
  - cache:search:cosmetics-beginner (search results)
  - cache:session:abc123 (session data)
  - cache:ratelimit:user:123 (rate limiting counter)
```

### Caching Strategies

1. **Session Caching** - User sessions, auth tokens (15min TTL)
2. **User Data** - Profiles, preferences, roles (1 hour TTL)
3. **Course Data** - Course info, modules, lessons (24 hour TTL)
4. **Search Cache** - Search results by query (1 hour TTL)
5. **API Response** - Paginated lists, aggregated data (varies)
6. **Rate Limiting** - Request counters (1 minute TTL)
7. **Temporary Data** - OTP codes, reset tokens (5-30 min TTL)

### Development Features

- Redis connection status checking
- Cache statistics (hit rate, size, keys count)
- Cache key inspection tools
- Manual cache invalidation CLI
- Cache population helpers for testing
- Debug mode for cache operations logging

### Error Handling

- Connection failures don't crash application
- Fallback to direct database queries on cache miss
- Graceful degradation if Redis unavailable
- Retry logic for transient failures
- Error logging and monitoring
- Circuit breaker for failing cache operations

## Acceptance Criteria

- [x] `packages/cache` created with TypeScript configuration
- [x] Adapter pattern implemented for cache providers
- [x] Unified cache interface (get, set, delete, invalidate methods)
- [x] Local Redis provider implemented for development
- [x] Upstash Redis provider implemented for production
- [x] Provider factory for environment-based selection
- [x] Type-safe generics for all cache operations (e.g., `get<T>()`)
- [x] Key namespacing with `{namespace}:{context}:{identifier}` format
- [x] Default TTL configuration (1 hour) with per-operation override
- [x] Wildcard pattern support for cache invalidation
- [x] Atomic counter operations for rate limiting
- [x] Expire operation to set TTL on existing keys
- [x] Keys listing with pattern matching
- [x] Exists check for conditional cache usage
- [x] Clear operation (disabled in production)
- [x] Connection status checking and health monitoring
- [x] Error handling with database fallback
- [x] Graceful degradation when Redis unavailable
- [x] Request deduplication (avoid dogpiling on cache miss)
- [x] Cache statistics (hit rate, misses, evictions)
- [x] Debug mode with operation logging
- [x] Manual invalidation tools (CLI or admin panel)
- [x] Session caching with 15-minute TTL
- [x] Course data caching with 24-hour TTL
- [x] Search result caching with 1-hour TTL
- [x] API response caching strategy
- [x] Rate limiting counters with 1-minute TTL
- [x] Comprehensive JSDoc documentation
- [x] Unit tests for both providers
- [x] Integration tests with mock Redis
- [x] Zero build warnings or errors
- [x] Bundle size < 30KB

## Dependencies

- `redis@^4.x` - Local Redis client (development)
- `@upstash/redis@^1.x` - Upstash Redis client (production)
- TypeScript 5.x

## Technical Notes

### Project Structure

```
packages/cache/
├── src/
│   ├── types.ts               # Type definitions
│   ├── provider.ts            # Base provider interface
│   ├── providers/
│   │   ├── local.ts           # Local Redis provider
│   │   ├── upstash.ts         # Upstash Redis provider
│   │   └── index.ts           # Provider factory
│   ├── cache.ts               # Main cache class
│   ├── strategies.ts          # Cache strategies for domains
│   ├── keys.ts                # Cache key builders
│   ├── stats.ts               # Cache statistics
│   ├── utils.ts               # Utility functions
│   └── index.ts               # Main export
├── tests/
│   ├── cache.test.ts
│   ├── providers/
│   │   ├── local.test.ts
│   │   └── upstash.test.ts
│   └── keys.test.ts
├── tsconfig.json
└── package.json
```

### Type Definitions

```typescript
// src/types.ts
export type CacheProvider = "local" | "upstash";

export interface CacheConfig {
  provider: CacheProvider;
  local?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  upstash?: {
    url: string;
    token: string;
  };
  defaultTTL?: number; // seconds
  maxRetries?: number;
  debug?: boolean;
}

export interface CacheOptions {
  ttl?: number; // seconds
  compress?: boolean;
}

export interface CacheProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  invalidate(pattern: string): Promise<number>; // Returns count deleted
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number | -1 | -2>; // -1: no expiry, -2: key not found
  expire(key: string, ttl: number): Promise<boolean>;

  keys(pattern: string): Promise<string[]>;
  increment(key: string, by?: number): Promise<number>;
  decrement(key: string, by?: number): Promise<number>;

  getStats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keysCount?: number;
  memory?: string;
}
```

### Local Redis Provider

```typescript
// src/providers/local.ts
import { createClient, RedisClient } from "redis";
import type {
  CacheConfig,
  CacheOptions,
  CacheProvider,
  CacheStats,
} from "../types";

export class LocalRedisProvider implements CacheProvider {
  private client: RedisClient | null = null;
  private config: Required<CacheConfig>;
  private stats = { hits: 0, misses: 0 };

  constructor(config: CacheConfig) {
    this.config = {
      ...config,
      defaultTTL: config.defaultTTL ?? 3600,
      maxRetries: config.maxRetries ?? 3,
    } as Required<CacheConfig>;
  }

  async connect(): Promise<void> {
    const { local, maxRetries } = this.config;

    this.client = createClient({
      host: local?.host || "localhost",
      port: local?.port || 6379,
      password: local?.password,
      db: local?.db || 0,
      retry_strategy: (options) => {
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error("Redis connection retry timeout");
        }
        if (options.attempt > maxRetries) {
          return new Error("Redis maximum retries exceeded");
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    return new Promise((resolve, reject) => {
      this.client!.on("connect", resolve);
      this.client!.on("error", reject);
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.quit();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);

      if (value) {
        this.stats.hits++;
        if (this.config.debug) {
          console.log(`[Cache] HIT: ${key}`);
        }
        return JSON.parse(value);
      }

      this.stats.misses++;
      if (this.config.debug) {
        console.log(`[Cache] MISS: ${key}`);
      }
      return null;
    } catch (error) {
      console.error(`[Cache] Get error for ${key}:`, error);
      return null;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.client) return;

    try {
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl ?? this.config.defaultTTL;

      if (ttl > 0) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      if (this.config.debug) {
        console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
      }
    } catch (error) {
      console.error(`[Cache] Set error for ${key}:`, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.del(key);
      if (this.config.debug) {
        console.log(`[Cache] DELETE: ${key}`);
      }
      return result > 0;
    } catch (error) {
      console.error(`[Cache] Delete error for ${key}:`, error);
      return false;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      const result = await this.client.del(...keys);
      if (this.config.debug) {
        console.log(`[Cache] INVALIDATE: ${pattern} (deleted ${result} keys)`);
      }
      return result;
    } catch (error) {
      console.error(`[Cache] Invalidate error for ${pattern}:`, error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;

    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
      console.warn("[Cache] Clear is only available in development");
      return;
    }

    try {
      await this.client.flushdb();
      this.stats = { hits: 0, misses: 0 };
      console.log("[Cache] Cleared all keys");
    } catch (error) {
      console.error("[Cache] Clear error:", error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error(`[Cache] Exists error for ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number | -1 | -2> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`[Cache] TTL error for ${key}:`, error);
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.expire(key, ttl);
      return result > 0;
    } catch (error) {
      console.error(`[Cache] Expire error for ${key}:`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`[Cache] Keys error for ${pattern}:`, error);
      return [];
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.incrby(key, by);
    } catch (error) {
      console.error(`[Cache] Increment error for ${key}:`, error);
      return 0;
    }
  }

  async decrement(key: string, by: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return await this.client.decrby(key, by);
    } catch (error) {
      console.error(`[Cache] Decrement error for ${key}:`, error);
      return 0;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
}
```

### Upstash Redis Provider

```typescript
// src/providers/upstash.ts
import { Redis } from "@upstash/redis";
import type {
  CacheConfig,
  CacheOptions,
  CacheProvider,
  CacheStats,
} from "../types";

export class UpstashRedisProvider implements CacheProvider {
  private client: Redis | null = null;
  private config: Required<CacheConfig>;
  private stats = { hits: 0, misses: 0 };
  private connected = false;

  constructor(config: CacheConfig) {
    this.config = {
      ...config,
      defaultTTL: config.defaultTTL ?? 3600,
      maxRetries: config.maxRetries ?? 3,
    } as Required<CacheConfig>;
  }

  async connect(): Promise<void> {
    const { upstash } = this.config;

    if (!upstash?.url || !upstash?.token) {
      throw new Error("Upstash URL and token are required");
    }

    this.client = new Redis({
      url: upstash.url,
      token: upstash.token,
    });

    // Test connection
    try {
      await this.client.ping();
      this.connected = true;
      console.log("[Cache] Connected to Upstash Redis");
    } catch (error) {
      throw new Error(`Failed to connect to Upstash Redis: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    // Upstash doesn't require explicit disconnect
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);

      if (value) {
        this.stats.hits++;
        if (this.config.debug) {
          console.log(`[Cache] HIT: ${key}`);
        }
        return value as T;
      }

      this.stats.misses++;
      if (this.config.debug) {
        console.log(`[Cache] MISS: ${key}`);
      }
      return null;
    } catch (error) {
      console.error(`[Cache] Get error for ${key}:`, error);
      return null;
    }
  }

  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    if (!this.client) return;

    try {
      const ttl = options?.ttl ?? this.config.defaultTTL;

      if (ttl > 0) {
        await this.client.setex(key, ttl, JSON.stringify(value));
      } else {
        await this.client.set(key, JSON.stringify(value));
      }

      if (this.config.debug) {
        console.log(`[Cache] SET: ${key} (TTL: ${ttl}s)`);
      }
    } catch (error) {
      console.error(`[Cache] Set error for ${key}:`, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.del(key);
      if (this.config.debug) {
        console.log(`[Cache] DELETE: ${key}`);
      }
      return result > 0;
    } catch (error) {
      console.error(`[Cache] Delete error for ${key}:`, error);
      return false;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      const result = await this.client.del(...keys);
      if (this.config.debug) {
        console.log(`[Cache] INVALIDATE: ${pattern} (deleted ${result} keys)`);
      }
      return result;
    } catch (error) {
      console.error(`[Cache] Invalidate error for ${pattern}:`, error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;

    // Never allow in production
    throw new Error("Clear operation not available on Upstash");
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Cache] Exists error for ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number | -1 | -2> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`[Cache] TTL error for ${key}:`, error);
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`[Cache] Expire error for ${key}:`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      // Upstash has scan cursor-based iteration
      const cursor = "0";
      const result = await this.client.scan(cursor, {
        match: pattern,
      });
      return result[1] || [];
    } catch (error) {
      console.error(`[Cache] Keys error for ${pattern}:`, error);
      return [];
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return (await this.client.incrby(key, by)) as number;
    } catch (error) {
      console.error(`[Cache] Increment error for ${key}:`, error);
      return 0;
    }
  }

  async decrement(key: string, by: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      return (await this.client.decrby(key, by)) as number;
    } catch (error) {
      console.error(`[Cache] Decrement error for ${key}:`, error);
      return 0;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
}
```

### Cache Keys Builder

```typescript
// src/keys.ts
/**
 * Build cache keys with consistent namespacing
 */
export const CacheKeys = {
  // User
  user: (id: string) => `cache:user:${id}`,
  userPreferences: (id: string) => `cache:user:preferences:${id}`,
  userSessions: (id: string) => `cache:user:sessions:${id}:*`,

  // Courses
  course: (id: string) => `cache:course:${id}`,
  courseList: (page: number) => `cache:course:list:${page}`,
  courseModule: (courseId: string, moduleId: string) =>
    `cache:course:module:${courseId}:${moduleId}`,
  courseLesson: (courseId: string, lessonId: string) =>
    `cache:course:lesson:${courseId}:${lessonId}`,

  // Search
  searchCourses: (query: string) => `cache:search:courses:${query}`,
  searchUsers: (query: string) => `cache:search:users:${query}`,

  // Session
  session: (id: string) => `cache:session:${id}`,
  sessionAuth: (id: string) => `cache:session:auth:${id}`,

  // Rate limiting
  rateLimit: (userId: string, endpoint: string) =>
    `cache:ratelimit:${userId}:${endpoint}`,

  // Temporary
  otp: (userId: string) => `cache:otp:${userId}`,
  resetToken: (token: string) => `cache:reset:${token}`,
  emailVerification: (code: string) => `cache:verify:${code}`,

  // Analytics
  analytics: (event: string) => `cache:analytics:${event}`,
};
```

### Main Cache Class

```typescript
// src/cache.ts
import { LocalRedisProvider } from "./providers/local";
import { UpstashRedisProvider } from "./providers/upstash";
import type {
  CacheConfig,
  CacheProvider as CacheProviderInterface,
  CacheOptions,
} from "./types";

export class Cache {
  private provider: CacheProviderInterface;

  constructor(config: CacheConfig) {
    if (config.provider === "local") {
      this.provider = new LocalRedisProvider(config);
    } else if (config.provider === "upstash") {
      this.provider = new UpstashRedisProvider(config);
    } else {
      throw new Error(`Unknown cache provider: ${config.provider}`);
    }
  }

  async initialize(): Promise<void> {
    await this.provider.connect();
  }

  async shutdown(): Promise<void> {
    await this.provider.disconnect();
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    return this.provider.get<T>(key);
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void> {
    return this.provider.set(key, value, options);
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    return this.provider.delete(key);
  }

  /**
   * Invalidate keys matching pattern
   */
  async invalidate(pattern: string): Promise<number> {
    return this.provider.invalidate(pattern);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.provider.getStats();
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  /**
   * Increment counter
   */
  async increment(key: string, by?: number): Promise<number> {
    return this.provider.increment(key, by);
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const count = await this.increment(key);

    if (count === 1) {
      // First request, set expiry
      await this.provider.expire(key, Math.ceil(windowMs / 1000));
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining };
  }
}

// Create singleton
let cacheInstance: Cache;

export function initializeCache(config: CacheConfig): Cache {
  cacheInstance = new Cache(config);
  return cacheInstance;
}

export function getCache(): Cache {
  if (!cacheInstance) {
    throw new Error("Cache not initialized. Call initializeCache first.");
  }
  return cacheInstance;
}
```

### Usage Example

```typescript
// Backend API route
import { getCache, CacheKeys } from "@mentor/cache";

export async function getCourse(req, res) {
  const { id } = req.params;
  const cache = getCache();

  // Try cache first
  const cached = await cache.get<Course>(CacheKeys.course(id));
  if (cached) {
    return res.json(cached);
  }

  // Fallback to database
  const course = await db.courses.findById(id);
  if (!course) {
    return res.status(404).json({ error: "Not found" });
  }

  // Store in cache for 24 hours
  await cache.set(CacheKeys.course(id), course, { ttl: 86400 });

  return res.json(course);
}

// Invalidate on update
export async function updateCourse(req, res) {
  const { id } = req.params;
  const data = req.body;

  const course = await db.courses.updateById(id, data);

  // Invalidate cache
  const cache = getCache();
  await cache.delete(CacheKeys.course(id));
  await cache.invalidate(CacheKeys.courseList("*"));

  return res.json(course);
}
```

### Testing

```typescript
// tests/cache.test.ts
import { Cache } from "../src/cache";

describe("Cache", () => {
  let cache: Cache;

  beforeEach(async () => {
    cache = new Cache({ provider: "local" });
    await cache.initialize();
  });

  afterEach(async () => {
    await cache.shutdown();
  });

  it("should set and get values", async () => {
    await cache.set("test", { value: "hello" });
    const result = await cache.get("test");
    expect(result).toEqual({ value: "hello" });
  });

  it("should handle expiration", async () => {
    await cache.set("temp", "value", { ttl: 1 });
    await new Promise((r) => setTimeout(r, 1100));
    const result = await cache.get("temp");
    expect(result).toBeNull();
  });

  it("should invalidate patterns", async () => {
    await cache.set("user:1", "data1");
    await cache.set("user:2", "data2");
    const deleted = await cache.invalidate("user:*");
    expect(deleted).toBe(2);
  });
});
```

### Configuration Example

```typescript
// Backend app initialization
import { initializeCache } from "@mentor/cache";

const cache = initializeCache({
  provider: process.env.NODE_ENV === "production" ? "upstash" : "local",
  upstash: {
    url: process.env.UPSTASH_REDIS_URL,
    token: process.env.UPSTASH_REDIS_TOKEN,
  },
  local: {
    host: "localhost",
    port: 6379,
  },
  defaultTTL: 3600,
  debug: process.env.NODE_ENV === "development",
});

await cache.initialize();
```

### Performance Optimization

- Implement lazy connections
- Use pipelining for batch operations
- Implement cache warming strategies
- Monitor hit/miss ratios
- Automatic cache expiry tuning

### Future Enhancements

- Memcached support
- Multi-tier caching (memory + Redis)
- Cache pre-warming strategies
- Distributed cache invalidation
- Cache analytics dashboard
