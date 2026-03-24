---
name: code-quality
description: Use when refactoring functions, extracting helpers, splitting large files, improving naming conventions, or reducing complexity. Use when functions exceed 30 lines, have too many parameters, or contain magic numbers. NOT for React/backend/database-specific patterns.
---

# Code Quality

## Overview

Clean code reveals intent and minimizes complexity. Every function should do one thing, have a clear name, and fit on one screen.

## When to Use

- Writing any new function or module
- Reviewing code for clarity
- Refactoring messy code
- Under time pressure (especially then)

**When NOT to use:** Quick prototypes explicitly marked as throwaway (rare).

## The Iron Rules

### 1. Function Length: Max 30 Lines

Functions over 30 lines are doing too much. Extract helpers.

**Exception:** Orchestration functions (calling other functions, minimal logic) may reach 50 lines. If you have conditionals or loops, max is 30.

**Cyclomatic Complexity:** Max 10 branches per function. Count: `if`, `else`, `case`, `&&`, `||`, `?:`, `catch`.

```typescript
// ❌ BAD: 100+ line processOrder doing everything
async function processOrder(order: Order) {
  // validation...
  // pricing...
  // inventory...
  // payment...
  // email...
  // analytics...
}

// ✅ GOOD: Orchestrator with extracted concerns
async function processOrder(order: Order) {
  const validation = validateOrder(order);
  if (!validation.valid) return failure(validation.error);

  const pricing = calculateOrderTotal(order);
  const reservation = await reserveInventory(order);

  const payment = await processPayment(order, pricing.total);
  if (!payment.success) {
    await releaseInventory(reservation);
    return failure(payment.error);
  }

  await sendConfirmationEmail(order, pricing);
  await recordAnalytics(order, pricing);

  return success(order.id, pricing.total);
}
```

### 2. No Magic Numbers

Every number with meaning needs a name.

```typescript
// ❌ BAD: What do these numbers mean?
if (totalItems >= 10) {
  total = total * 0.9;
}
if (password.length < 8) {
}

// ✅ GOOD: Self-documenting
const BULK_DISCOUNT_THRESHOLD = 10;
const BULK_DISCOUNT_RATE = 0.1;
const MIN_PASSWORD_LENGTH = 8;

if (totalItems >= BULK_DISCOUNT_THRESHOLD) {
  total = total * (1 - BULK_DISCOUNT_RATE);
}
if (password.length < MIN_PASSWORD_LENGTH) {
}
```

### 3. DRY: Extract Repeated Logic

If you copy-paste, extract.

```typescript
// ❌ BAD: Rollback logic repeated 5 times
if (!paymentInfo) {
  for (const item of order.items) {
    inventoryDb[item.productId] += item.quantity;
  }
  delete reservedInventory[order.id];
  return { success: false, error: "Payment required" };
}
// ...same rollback code repeated 4 more times...

// ✅ GOOD: Extracted once
function rollbackInventory(orderId: string, items: OrderItem[]) {
  for (const item of items) {
    inventoryDb[item.productId] += item.quantity;
  }
  delete reservedInventory[orderId];
}

// Then use: rollbackInventory(order.id, order.items);
```

### 4. Single Responsibility

One function = one reason to change.

| Bad                         | Good                                 |
| --------------------------- | ------------------------------------ |
| `validateAndProcessOrder()` | `validateOrder()` + `processOrder()` |
| `fetchDataAndRender()`      | `fetchData()` + `renderData()`       |
| `parseAndValidateAndSave()` | `parse()` + `validate()` + `save()`  |

### 5. Naming Conventions

| Type          | Convention                   | Examples                                  |
| ------------- | ---------------------------- | ----------------------------------------- |
| Functions     | camelCase, verb-first        | `validateEmail()`, `calculateTotal()`     |
| Booleans      | `is`, `has`, `should`, `can` | `isValid`, `hasPermission`, `shouldRetry` |
| Constants     | SCREAMING_SNAKE_CASE         | `MAX_RETRIES`, `API_TIMEOUT_MS`           |
| Classes/Types | PascalCase                   | `OrderProcessor`, `ValidationResult`      |

### 6. Comments: WHY, Not WHAT

```typescript
// ❌ BAD: Describes what code does (obvious)
// Check if user is admin
if (user.role === "admin") {
}

// ✅ GOOD: Explains why (not obvious)
// Admins bypass rate limiting per security policy SEC-2024-001
if (user.role === "admin") {
}
```

### 7. No `any` Type - Use Proper Types

The `any` type disables TypeScript's type checking entirely. It's almost always a sign of giving up.

```typescript
// ❌ BAD: any hides bugs
function processData(data: any) {
  return data.items.map((item: any) => item.toUpperCase());
}
// Runtime crash if data.items is undefined or items aren't strings

// ✅ GOOD: Explicit types catch bugs at compile time
interface DataPayload {
  items: string[];
}

function processData(data: DataPayload) {
  return data.items.map((item) => item.toUpperCase());
}
```

**Alternatives to `any`:**

| Instead of `any`        | Use This                                         | When                                             |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `any`                   | `unknown`                                        | When type is truly unknown (validate before use) |
| `any[]`                 | `T[]` or `unknown[]`                             | For arrays of unknown type                       |
| `Record<string, any>`   | `Record<string, unknown>`                        | For object dictionaries                          |
| `(arg: any) => any`     | Generics: `<T>(arg: T) => T`                     | For flexible function signatures                 |
| API response: `any`     | Zod schema + `z.infer<typeof schema>`            | For external data validation                     |
| Event handler: `any`    | DOM types: `React.MouseEvent<HTMLButtonElement>` | For event callbacks                              |
| Third-party data: `any` | Interface definition                             | For known external structures                    |

**Working with `unknown`:**

```typescript
// ❌ BAD: any bypasses all checks
function parseJSON(text: string): any {
  return JSON.parse(text);
}
const result = parseJSON('{"name": "John"}');
console.log(result.name); // No error, even if wrong

// ✅ GOOD: unknown requires validation
function parseJSON(text: string): unknown {
  return JSON.parse(text);
}

const result = parseJSON('{"name": "John"}');
// console.log(result.name); // Error: Object is of type 'unknown'

// Must validate first:
if (typeof result === "object" && result !== null && "name" in result) {
  console.log((result as { name: string }).name); // Safe
}

// ✅ BEST: Use Zod for runtime validation
import { z } from "zod";

const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});
type User = z.infer<typeof UserSchema>;

function parseUser(text: string): User {
  const data = JSON.parse(text);
  return UserSchema.parse(data); // Throws if invalid
}
```

**Test file exception:** In test files, `any` may be used sparingly for mocking (ESLint allows `warn` instead of `error`). Prefer `Partial<T>` or `as unknown as Type` for type-safe mocking.

### 8. Reuse Existing Types First

**Don't create types unnecessarily.** Before defining a new type, check if one already exists:

1. **Codebase types** - domain types, shared types, schema definitions
2. **Library inference** - Drizzle `$inferSelect`, Zod `z.infer<typeof Schema>`
3. **Framework/runtime types** - React event types, DOM types, Node.js types

```typescript
// ❌ BAD: Creating a type that already exists in the schema
type UserData = { id: string; email: string; name: string };
function getUser(): UserData { ... }

// ✅ GOOD: Reuse the existing type from schema/model
import type { User } from '@/db/schema';
function getUser(): User { ... }

// ❌ BAD: Manually defining a type that Zod already provides
const UserSchema = z.object({ id: z.string(), email: z.string() });
type User = { id: string; email: string };  // Duplicated!

// ✅ GOOD: Infer from Zod schema - single source of truth
const UserSchema = z.object({ id: z.string(), email: z.string() });
type User = z.infer<typeof UserSchema>;

// ❌ BAD: Custom event type when React provides one
type ButtonClickHandler = (e: { target: HTMLButtonElement }) => void;

// ✅ GOOD: Use React's built-in event types
type ButtonClickHandler = React.MouseEventHandler<HTMLButtonElement>;
```

**Where to look for existing types:**

| Instead of        | Check for            | Example                               |
| ----------------- | -------------------- | ------------------------------------- |
| New interface     | Existing domain type | `User` from `@/db/schema`             |
| Manual type       | Zod inference        | `z.infer<typeof Schema>`              |
| Custom event type | React/DOM types      | `React.MouseEvent<HTMLButtonElement>` |
| New return type   | Library inference    | Drizzle `$inferSelect`, Prisma types  |
| API response type | Generated types      | OpenAPI codegen, tRPC inference       |

## Automated Enforcement

### ESLint Configuration (Flat Config - v9+)

ESLint 9+ uses flat config (`eslint.config.js`). Enforce code quality automatically:

```javascript
// eslint.config.js (ESLint v9+ flat config)
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Max function length
      "max-lines-per-function": [
        "error",
        {
          max: 30,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // Cyclomatic complexity
      complexity: ["error", { max: 10 }],

      // Max file length
      "max-lines": [
        "error",
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // Max function params
      "max-params": ["error", 3],

      // Max nested callbacks
      "max-nested-callbacks": ["error", 2],

      // No magic numbers
      "no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
        },
      ],
    },
  },
  {
    // Ignore patterns (replaces .eslintignore)
    ignores: ["node_modules/", "dist/", "*.config.js"],
  },
);
```

**Legacy config?** ESLint 9+ still supports `.eslintrc.js` via `ESLINT_USE_FLAT_CONFIG=false`, but flat config is the future.

### TypeScript-Specific Patterns

```typescript
// ✅ GOOD: Type-safe options object (not 5 params)
interface CreateUserOptions {
  email: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  sendWelcomeEmail?: boolean;
}

function createUser(options: CreateUserOptions): User {
  // Single param, clear structure
}

// ✅ GOOD: Discriminated union for type-safe control flow
type Result<T> = { success: true; data: T } | { success: false; error: string };

function processOrder(order: Order): Result<OrderConfirmation> {
  if (!isValid(order)) {
    return { success: false, error: "Invalid order" };
  }

  const confirmation = executeOrder(order);
  return { success: true, data: confirmation };
}

// ✅ GOOD: Branded types for type safety
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function getUser(id: UserId): User {
  /* ... */
}

// Won't compile - prevents mixing up IDs
const orderId: OrderId = "123" as OrderId;
getUser(orderId); // Type error!
```

## Testing Strategy

```typescript
// Test function length and complexity
describe("Code Quality", () => {
  it("functions stay under 30 lines", () => {
    const functionSource = processOrder.toString();
    const lines = functionSource.split("\n").filter((l) => l.trim()).length;
    expect(lines).toBeLessThanOrEqual(30);
  });

  it("maintains low cyclomatic complexity", () => {
    // Use eslint-plugin-complexity or similar
    const complexity = calculateComplexity(processOrder);
    expect(complexity).toBeLessThanOrEqual(10);
  });
});

// Test extracted helpers
describe("Helper Functions", () => {
  it("validateOrder handles invalid input", () => {
    const result = validateOrder({ items: [] });
    expect(result.valid).toBe(false);
  });

  it("calculateOrderTotal sums items correctly", () => {
    const total = calculateOrderTotal(mockOrder);
    expect(total).toBe(99.99);
  });
});
```

## Quick Reference

| Smell                       | Fix                         | ESLint Rule                          |
| --------------------------- | --------------------------- | ------------------------------------ |
| Function > 30 lines         | Extract helpers             | `max-lines-per-function`             |
| Cyclomatic complexity > 10  | Extract conditionals        | `complexity`                         |
| Repeated code block         | Extract function            | Manual review                        |
| Magic number                | Named constant              | `no-magic-numbers`                   |
| `validateAndProcess()`      | Split into two functions    | Manual review                        |
| Nested callbacks > 2 levels | Extract or use async/await  | `max-nested-callbacks`               |
| Parameter list > 3          | Use options object          | `max-params`                         |
| `any` type                  | `unknown`, generics, or Zod | `@typescript-eslint/no-explicit-any` |
| Duplicate type definition   | Reuse from schema/library   | Manual review                        |

## Red Flags - STOP and Refactor

These thoughts mean you're about to write bad code:

| Thought                                        | Reality                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| "It's faster to write it all in one function"  | It's faster to read small functions. Write for the reader.    |
| "We'll refactor later"                         | Later never comes. Write it right the first time.             |
| "It's just prototype code"                     | Prototypes become production. No excuse.                      |
| "The deadline is tight"                        | Bad code slows you down MORE. Clean code is faster.           |
| "I'll add helpers if it gets complex"          | It's already complex. Extract NOW.                            |
| "This is a special case"                       | There are no special cases for quality.                       |
| "It's only 35 lines, close enough"             | The limit exists for a reason. Extract a helper.              |
| "The user specifically asked for one function" | Push back. Explain why splitting is better.                   |
| "I need all this context in one place"         | That's what orchestrator functions are for.                   |
| "I'll just use `any` for now"                  | `any` disables type safety. Use `unknown` or define the type. |
| "The API response is complex, I'll use `any`"  | Define an interface or use Zod for validation.                |
| "I'll create a quick type for this"            | Check if it already exists in schema/library first.           |

## Pressure Response

When someone says "just make it work fast":

1. **Small functions ARE faster** - easier to debug, test, modify
2. **Tech debt has interest** - every shortcut costs 10x later
3. **Extract as you go** - takes 30 seconds, saves hours

**Violating code quality under pressure is violating code quality.**

## References

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new) - ESLint 9+ configuration
- [ESLint Complexity Rule](https://eslint.org/docs/latest/rules/complexity) - Cyclomatic complexity enforcement
- [typescript-eslint](https://typescript-eslint.io/) - TypeScript ESLint integration
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) - Advanced type patterns
- [Clean Code (Martin)](https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882) - Function length rationale

**Version Notes:**

- ESLint 9+: Flat config (`eslint.config.js`), replaces `.eslintrc.*`
- TypeScript 5+: Improved discriminated union narrowing, const type parameters
- typescript-eslint 8+: Native flat config support
- Cyclomatic complexity: Default threshold 20, recommended 10

## Common Mistakes

| Mistake                   | Impact                         | Fix                                                 |
| ------------------------- | ------------------------------ | --------------------------------------------------- |
| God function              | Untestable, unreadable         | Max 30 lines, single responsibility                 |
| Copy-paste code           | Bugs multiply                  | Extract shared logic                                |
| Cryptic names             | Confusion                      | Descriptive, verb-first names                       |
| No constants              | Magic numbers everywhere       | SCREAMING_SNAKE_CASE for all config                 |
| No ESLint enforcement     | Quality drifts over time       | Add `complexity` and `max-lines-per-function` rules |
| 5+ function parameters    | Hard to call, hard to test     | Use options object pattern                          |
| Comments describe WHAT    | Redundant, unmaintained        | Comment WHY, not WHAT                               |
| Mixing ID types (string)  | Runtime bugs                   | Use branded types for type safety                   |
| Using `any` type          | Type safety disabled           | Use `unknown`, generics, or Zod                     |
| `as any` type assertions  | Bypasses all checks            | Use `as unknown as Type` in tests only              |
| Defining type that exists | Maintenance burden, type drift | Check schema/library for existing types             |
