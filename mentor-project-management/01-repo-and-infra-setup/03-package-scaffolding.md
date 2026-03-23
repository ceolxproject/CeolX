# Task 3: Create All Shared Packages with Base Configuration

## Description

Set up all 10 shared packages that provide reusable functionality across the monorepo. Each package will have proper TypeScript configuration, a well-structured `package.json` with correct dependencies, barrel exports for clean imports, and clear architectural boundaries. These packages form the foundation for code sharing and consistency across all apps.

## Affected Apps/Packages

- packages/db (Drizzle ORM schemas, migrations, seed data)
- packages/auth (BetterAuth configuration and utilities)
- packages/api-client (Type-safe API client)
- packages/validators (Zod validation schemas)
- packages/i18n (Internationalization, shared locales)
- packages/analytics (Analytics adapter using Strategy Pattern)
- packages/ui (Shared shadcn/ui web components)
- packages/ui-mobile (Shared React Native components)
- packages/cache (Redis adapter for local Redis and Upstash)
- packages/utils (Shared utility functions)

## Requirements

### Common Package Structure (All Packages)

```
packages/{package-name}/
├── src/
│   ├── index.ts (barrel export)
│   └── {feature-files}
├── tsconfig.json
├── package.json
├── README.md
└── .gitkeep (for empty directories)
```

---

## packages/db

### Purpose

Centralized database schema, migrations, and seed data using Drizzle ORM.

### Directory Structure

```
packages/db/
├── src/
│   ├── index.ts
│   ├── schema.ts
│   ├── client.ts
│   ├── migrations/
│   │   └── .gitkeep
│   └── seeds/
│       └── .gitkeep
├── drizzle.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/db",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "migrate": "drizzle-kit migrate",
    "migrate:generate": "drizzle-kit generate:pg",
    "migrate:drop": "drizzle-kit drop",
    "seed": "tsx src/seeds/index.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.30.x",
    "postgres": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.x",
    "tsx": "^4.x",
    "typescript": "^5.4.0",
    "@types/node": "^20.x"
  }
}
```

### src/index.ts

```typescript
export * from "./schema";
export { getDB } from "./client";
```

### src/client.ts

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var db: ReturnType<typeof drizzle> | undefined;
}

let db: ReturnType<typeof drizzle>;

if (!global.db) {
  const client = postgres(process.env.DATABASE_URL || "");
  global.db = drizzle(client, { schema });
}

db = global.db;

export const getDB = () => db;
```

### drizzle.config.ts

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./src/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || "",
  },
} satisfies Config;
```

### src/schema.ts

```typescript
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Example placeholder schema structure
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Add relations as needed
export const usersRelations = relations(users, ({ many }) => ({
  // Add relationships
}));
```

---

## packages/auth

### Purpose

BetterAuth configuration, session management, and authentication utilities.

### Directory Structure

```
packages/auth/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── client.ts
│   └── utils/
│       ├── jwt.ts
│       └── .gitkeep
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/auth",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config.ts",
    "./client": "./src/client.ts",
    "./utils": "./src/utils/index.ts"
  },
  "dependencies": {
    "better-auth": "^0.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.x"
  }
}
```

### src/index.ts

```typescript
export * from "./config";
export * from "./client";
export * from "./utils/jwt";
```

### src/config.ts

```typescript
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    type: "postgres",
    url: process.env.DATABASE_URL || "",
  },
  secret: process.env.AUTH_SECRET || "secret",
  trustedOrigins: (
    process.env.TRUSTED_ORIGINS || "http://localhost:3000"
  ).split(","),
  redirects: {
    signIn: "/dashboard",
    signUp: "/signup",
  },
});
```

### src/client.ts

```typescript
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.AUTH_API_URL || "http://localhost:3200",
});
```

### src/utils/jwt.ts

```typescript
export function generateToken(payload: Record<string, unknown>): string {
  // Placeholder for JWT generation
  return "";
}

export function verifyToken(token: string): Record<string, unknown> | null {
  // Placeholder for JWT verification
  return null;
}
```

---

## packages/api-client

### Purpose

Type-safe, auto-generated API client for consuming the Hono API.

### Directory Structure

```
packages/api-client/
├── src/
│   ├── index.ts
│   ├── client.ts
│   ├── endpoints/
│   │   ├── health.ts
│   │   └── index.ts
│   └── types.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/api-client",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./endpoints": "./src/endpoints/index.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "axios": "^1.x",
    "@mentor/validators": "workspace:*",
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.x"
  }
}
```

### src/index.ts

```typescript
export { createApiClient } from "./client";
export * from "./endpoints";
export * from "./types";
```

### src/client.ts

```typescript
import axios, { type AxiosInstance } from "axios";

export function createApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add interceptors for auth, error handling, etc.
  client.interceptors.request.use((config) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
}
```

### src/types.ts

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### src/endpoints/health.ts

```typescript
import type { AxiosInstance } from "axios";

export function createHealthEndpoints(client: AxiosInstance) {
  return {
    check: () => client.get("/health"),
  };
}
```

---

## packages/validators

### Purpose

Zod validation schemas shared across frontend and backend.

### Directory Structure

```
packages/validators/
├── src/
│   ├── index.ts
│   ├── auth.ts
│   ├── user.ts
│   ├── course.ts
│   └── common.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/validators",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/auth.ts",
    "./user": "./src/user.ts",
    "./course": "./src/course.ts",
    "./common": "./src/common.ts"
  },
  "dependencies": {
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### src/index.ts

```typescript
export * from "./auth";
export * from "./user";
export * from "./course";
export * from "./common";
```

### src/auth.ts

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
    name: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
```

### src/common.ts

```typescript
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export type Pagination = z.infer<typeof paginationSchema>;
```

---

## packages/i18n

### Purpose

Centralized internationalization with shared locale files.

### Directory Structure

```
packages/i18n/
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── locales/
│   │   ├── en.json
│   │   ├── es.json
│   │   ├── fr.json
│   │   └── .gitkeep
│   └── types.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/i18n",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config.ts",
    "./locales": "./src/locales/en.json"
  },
  "dependencies": {
    "i18next": "^23.x",
    "i18next-browser-languagedetector": "^8.x",
    "i18next-http-backend": "^2.x",
    "react-i18next": "^14.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### src/index.ts

```typescript
export * from "./config";
export { default as enLocale } from "./locales/en.json";
export { default as esLocale } from "./locales/es.json";
export { default as frLocale } from "./locales/fr.json";
```

### src/config.ts

```typescript
import i18next from "i18next";
import enLocale from "./locales/en.json";
import esLocale from "./locales/es.json";
import frLocale from "./locales/fr.json";

export function initI18n() {
  i18next.init({
    fallbackLng: "en",
    resources: {
      en: { translation: enLocale },
      es: { translation: esLocale },
      fr: { translation: frLocale },
    },
  });
}
```

### src/locales/en.json

```json
{
  "common": {
    "welcome": "Welcome",
    "logout": "Logout",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "auth": {
    "login": "Login",
    "signup": "Sign Up",
    "email": "Email",
    "password": "Password"
  }
}
```

---

## packages/analytics

### Purpose

Strategy Pattern-based analytics adapter supporting multiple providers.

### Directory Structure

```
packages/analytics/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── strategies/
│   │   ├── base.ts
│   │   ├── gtm.ts
│   │   ├── amplitude.ts
│   │   └── .gitkeep
│   └── client.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/analytics",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./client": "./src/client.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.x"
  }
}
```

### src/index.ts

```typescript
export { AnalyticsClient } from "./client";
export type { AnalyticsStrategy, AnalyticsEvent } from "./types";
```

### src/types.ts

```typescript
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

export interface AnalyticsStrategy {
  track(event: AnalyticsEvent): void;
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}
```

### src/strategies/base.ts

```typescript
import type { AnalyticsStrategy, AnalyticsEvent } from "../types";

export abstract class BaseAnalyticsStrategy implements AnalyticsStrategy {
  abstract track(event: AnalyticsEvent): void;
  abstract identify(userId: string, traits?: Record<string, unknown>): void;
  abstract reset(): void;
}
```

### src/client.ts

```typescript
import type { AnalyticsStrategy, AnalyticsEvent } from "./types";

export class AnalyticsClient {
  private strategies: AnalyticsStrategy[] = [];

  constructor(strategies: AnalyticsStrategy[]) {
    this.strategies = strategies;
  }

  track(event: AnalyticsEvent) {
    this.strategies.forEach((strategy) => strategy.track(event));
  }

  identify(userId: string, traits?: Record<string, unknown>) {
    this.strategies.forEach((strategy) => strategy.identify(userId, traits));
  }

  reset() {
    this.strategies.forEach((strategy) => strategy.reset());
  }

  addStrategy(strategy: AnalyticsStrategy) {
    this.strategies.push(strategy);
  }
}
```

---

## packages/ui

### Purpose

Shared shadcn/ui web components for Next.js applications.

### Directory Structure

```
packages/ui/
├── src/
│   ├── index.ts
│   ├── components/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── .gitkeep
│   └── styles/
│       └── globals.css
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/ui",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles": "./src/styles/globals.css",
    "./components/*": "./src/components/*.tsx"
  },
  "peerDependencies": {
    "react": "^19.x",
    "react-dom": "^19.x"
  },
  "dependencies": {
    "@radix-ui/react-primitive": "^2.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x",
    "tailwindcss": "^4.x"
  }
}
```

### src/index.ts

```typescript
export { Button } from "./components/button";
export { Card } from "./components/card";
export { Input } from "./components/input";
```

### src/components/button.tsx

```typescript
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-sm',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { Button }
```

---

## packages/ui-mobile

### Purpose

Shared React Native components for Expo app.

### Directory Structure

```
packages/ui-mobile/
├── src/
│   ├── index.ts
│   ├── components/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── text.tsx
│   │   └── .gitkeep
│   └── styles/
│       └── theme.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/ui-mobile",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./theme": "./src/styles/theme.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "peerDependencies": {
    "react": "^18.x",
    "react-native": "^0.76.x"
  },
  "dependencies": {
    "tailwindcss": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/react": "^18.x"
  }
}
```

### src/index.ts

```typescript
export { Button } from "./components/button";
export { Card } from "./components/card";
export { Text } from "./components/text";
export { theme } from "./styles/theme";
```

### src/components/button.tsx

```typescript
import { TouchableOpacity, Text as RNText } from 'react-native'

interface ButtonProps {
  onPress: () => void
  title: string
  variant?: 'primary' | 'secondary'
}

export function Button({ onPress, title, variant = 'primary' }: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={variant === 'primary' ? 'bg-blue-500 p-4 rounded' : 'bg-gray-500 p-4 rounded'}
    >
      <RNText className="text-white text-center font-bold">{title}</RNText>
    </TouchableOpacity>
  )
}
```

---

## packages/cache

### Purpose

Redis adapter supporting both local Redis and Upstash (serverless).

### Directory Structure

```
packages/cache/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── adapters/
│   │   ├── base.ts
│   │   ├── redis.ts
│   │   ├── upstash.ts
│   │   └── .gitkeep
│   └── client.ts
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/cache",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./client": "./src/client.ts"
  },
  "dependencies": {
    "redis": "^4.x",
    "@upstash/redis": "^1.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.x"
  }
}
```

### src/index.ts

```typescript
export { CacheClient } from "./client";
export type { CacheAdapter } from "./types";
```

### src/types.ts

```typescript
export interface CacheAdapter {
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  get<T = unknown>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### src/client.ts

```typescript
import type { CacheAdapter } from "./types";

export class CacheClient implements CacheAdapter {
  constructor(private adapter: CacheAdapter) {}

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    return this.adapter.set(key, value, ttl);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.adapter.get<T>(key);
  }

  async delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }

  async clear(): Promise<void> {
    return this.adapter.clear();
  }
}
```

---

## packages/utils

### Purpose

Shared utility functions and helpers.

### Directory Structure

```
packages/utils/
├── src/
│   ├── index.ts
│   ├── string.ts
│   ├── array.ts
│   ├── date.ts
│   ├── validation.ts
│   └── .gitkeep
├── tsconfig.json
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "@mentor/utils",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./string": "./src/string.ts",
    "./array": "./src/array.ts",
    "./date": "./src/date.ts",
    "./validation": "./src/validation.ts"
  },
  "dependencies": {
    "zod": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### src/index.ts

```typescript
export * from "./string";
export * from "./array";
export * from "./date";
export * from "./validation";
```

### src/string.ts

```typescript
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

### src/date.ts

```typescript
export function formatDate(date: Date, format: string = "YYYY-MM-DD"): string {
  // Placeholder for date formatting
  return date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
```

### src/array.ts

```typescript
export function chunk<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}
```

### src/validation.ts

```typescript
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
```

---

## Acceptance Criteria

- [ ] All 10 packages have valid `package.json` with correct workspace dependencies
- [ ] Each package has `tsconfig.json` extending root config
- [ ] Each package has a `README.md` describing purpose and usage
- [ ] Each package exports a barrel `index.ts` file
- [ ] `pnpm install` at root resolves all workspace dependencies correctly
- [ ] `pnpm run type-check` passes in each package
- [ ] Circular dependencies are avoided (check with `turbo graph`)
- [ ] Each package can be independently built and tested
- [ ] Type definitions are properly exported and consumable by dependent packages
- [ ] No ESLint errors in package source files

## Dependencies

- Task 1: Turborepo monorepo init completed
- Task 2: App scaffolding completed (packages need to be referenced by apps)
- Node.js >= 20.0.0
- pnpm >= 9.0.0

## Technical Notes

### Barrel Exports Strategy

- Each package must export a main `index.ts` that re-exports all public APIs
- This enables clean imports: `import { Button } from '@mentor/ui'`
- Keeps internal directory structure hidden from consumers
- Allows refactoring internal structure without breaking consumers

### Workspace Dependencies

- Use `workspace:*` in package.json to reference other packages
- Enables hot module replacement during local development
- Turborepo will automatically build dependencies before dependent packages
- For production builds, these are resolved to actual versions

### TypeScript Path Aliases

- Each app should extend root `tsconfig.json`
- Define `baseUrl` and `paths` in app-level `tsconfig.json` only
- Packages should NOT define path aliases to avoid conflicts

### Package Dependency Graph

```
apps/ and packages/
├── All apps depend on:
│   ├── @mentor/auth
│   ├── @mentor/api-client
│   ├── @mentor/validators
│   ├── @mentor/i18n
│   └── @mentor/analytics
├── Web apps depend on:
│   └── @mentor/ui
├── Mobile app depends on:
│   └── @mentor/ui-mobile
├── API depends on:
│   ├── @mentor/db
│   └── @mentor/cache
└── Database-related packages:
    └── @mentor/db depends on (no shared package dependencies)
```

### Export Strategies

- Use TypeScript 5.x `export type` for type-only exports
- Use `export * from` for barrel exports
- Define `exports` field in package.json for subpath exports
- Enables tree-shaking in consuming applications

### Development Iteration

- During development, workspace packages are linked automatically
- Changes to package source trigger rebuilds of dependent packages via Turborepo
- Use `turbo run build --filter=@mentor/db --graph` to visualize dependency chains
