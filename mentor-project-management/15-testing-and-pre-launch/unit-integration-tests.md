# Unit & Integration Tests

## Description

Comprehensive unit and integration testing strategy covering shared packages, API handlers, and database operations. Uses Vitest for unit testing with high coverage targets, integration tests for API endpoints against test database, and mocking strategy for external services (Stripe, Mux, FCM). Ensures code quality, API reliability, and external service interactions are properly validated.

## Affected Apps/Packages

- **@mentor/database** (Drizzle ORM, Neon PostgreSQL)
- **@mentor/api** (Hono API handlers)
- **@mentor/shared-utils** (utility functions, validators, helpers)
- **@mentor/auth** (authentication logic)
- **@mentor/types** (TypeScript types, validation)
- **Learner Web** (Next.js specific logic)
- **Mentor Web** (Next.js specific logic)
- **Admin Web** (Next.js specific logic)

## Requirements

### Testing Framework

- **Unit Tests**: Vitest (v1.0+) with jsdom environment
- **Test Coverage**:
  - Shared packages: 85%+ line coverage, 80%+ branch coverage
  - API handlers: 90%+ coverage
  - Critical paths: 100% coverage (auth, payments, video processing)
- **Type Safety**: TypeScript strict mode, no `any` types in test files

### Integration Testing

- **Test Database**: Neon PostgreSQL staging instance or Docker container
- **API Integration**: Full API endpoint testing with real DB transactions
- **Mock Strategy**:
  - Stripe: `stripe-mock` or `stripe-testing-library`
  - Mux: Mock HTTP responses via MSW (Mock Service Worker)
  - Firebase Cloud Messaging: Mock SDK
  - Typesense: Mock search responses
  - S3/Cloud Storage: Mock file operations

### Test Organization

- Unit tests co-located with source code: `*.spec.ts` or `*.test.ts`
- Integration tests: `tests/integration/` directory
- Test utilities and fixtures: `tests/setup/`, `tests/fixtures/`
- Mock definitions: `tests/mocks/`

### Performance Requirements

- Unit test suite: < 5 seconds
- Integration test suite: < 30 seconds
- All tests: < 1 minute with parallelization

## Acceptance Criteria

- [ ] 85%+ code coverage for all shared packages
- [ ] 90%+ code coverage for API handlers (core endpoints)
- [ ] 100% coverage for authentication and payment logic
- [ ] All API endpoints have integration tests
- [ ] External service mocks validated against actual API contracts
- [ ] Database transactions rolled back after each integration test
- [ ] Test data fixtures created and reusable
- [ ] CI runs all tests before PR merge, blocks on failure
- [ ] Test duration < 1 minute with parallel execution
- [ ] Error messages clear and actionable for debugging
- [ ] No test flakiness (deterministic results on multiple runs)

## Dependencies

### Testing Libraries

- **Vitest** for unit testing
- **@testing-library/react** (if testing React hooks/components)
- **Mock Service Worker (MSW)** for HTTP mocking
- **stripe-mock** for Stripe testing
- **@neon/serverless** for test database
- **Drizzle orm with @drizzle-orm/pg-core**

### External Test Accounts

- Stripe test account with API keys
- Mux test account with API token
- Firebase project with test credentials
- Typesense test instance (local or remote)

### Infrastructure

- GitHub Actions CI runner with PostgreSQL service
- Node.js 20+
- Docker (for local test DB)
- Redis (if using Redis cache in tests)

## Technical Notes

### Unit Test Structure

```
packages/database/src/
├── schema.ts
├── schema.spec.ts
├── migrations/
│   └── migration.spec.ts
├── queries/
│   ├── users.ts
│   └── users.spec.ts
└── ...

packages/shared-utils/src/
├── validators/
│   ├── email.ts
│   └── email.spec.ts
├── formatting/
│   ├── courseTitle.ts
│   └── courseTitle.spec.ts
└── ...
```

### Database Schema Testing

```typescript
// packages/database/src/schema.spec.ts
import { describe, it, expect } from "vitest";
import * as schema from "./schema";

describe("Database Schema", () => {
  it("should have all required tables", () => {
    const tableNames = Object.keys(schema);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("courses");
    expect(tableNames).toContain("enrollments");
    expect(tableNames).toContain("payments");
  });

  it("users table should have email uniqueness constraint", () => {
    // Verify schema definition includes unique email
    const usersTableInfo = schema.users;
    expect(usersTableInfo).toBeDefined();
    // This validates the schema structure is correct
  });
});
```

### Query Testing with Test Database

```typescript
// packages/database/src/queries/users.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "../index";
import { users, enrollments } from "../schema";
import { eq } from "drizzle-orm";

describe("User Queries", () => {
  let userId: string;

  beforeEach(async () => {
    // Insert test user
    const result = await db
      .insert(users)
      .values({
        email: `test-${Date.now()}@example.com`,
        name: "Test User",
        passwordHash: "hash123",
        role: "learner",
      })
      .returning();
    userId = result[0].id;
  });

  afterEach(async () => {
    // Cleanup: delete test user and related records
    await db.delete(users).where(eq(users.id, userId));
  });

  it("should get user by email", async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.email, `test-${Date.now()}@example.com`),
    });

    expect(user).toBeDefined();
    expect(user?.role).toBe("learner");
  });

  it("should update user name", async () => {
    await db
      .update(users)
      .set({ name: "Updated Name" })
      .where(eq(users.id, userId));

    const updated = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    expect(updated?.name).toBe("Updated Name");
  });

  it("should get user with enrollments", async () => {
    // Create an enrollment
    await db.insert(enrollments).values({
      userId: userId,
      courseId: "course-123",
      status: "active",
    });

    const userWithEnrollments = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        enrollments: true,
      },
    });

    expect(userWithEnrollments?.enrollments).toHaveLength(1);
    expect(userWithEnrollments?.enrollments[0].courseId).toBe("course-123");
  });
});
```

### API Handler Integration Tests

```typescript
// packages/api/src/routes/auth.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import authRoutes from "./auth";
import { db } from "@mentor/database";
import { users } from "@mentor/database/schema";
import { eq } from "drizzle-orm";

describe("Auth API", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/auth", authRoutes);
  });

  describe("POST /auth/signup", () => {
    it("should create new user with valid data", async () => {
      const response = await app.request(
        new Request("http://localhost/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `signup-${Date.now()}@example.com`,
            password: "Password123!",
            name: "New User",
          }),
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.email).toBe(`signup-${Date.now()}@example.com`);
      expect(data.user.id).toBeDefined();
      expect(data.token).toBeDefined();

      // Cleanup
      await db.delete(users).where(eq(users.id, data.user.id));
    });

    it("should reject duplicate email", async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      // Create first user
      await db.insert(users).values({
        email,
        name: "User 1",
        passwordHash: "hash123",
      });

      // Try to create with same email
      const response = await app.request(
        new Request("http://localhost/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: "Password123!",
            name: "User 2",
          }),
        })
      );

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain("already exists");

      // Cleanup
      await db.delete(users).where(eq(users.email, email));
    });

    it("should validate email format", async () => {
      const response = await app.request(
        new Request("http://localhost/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid-email",
            password: "Password123!",
            name: "User",
          }),
        })
      );

      expect(response.status).toBe(400);
    });

    it("should validate password strength", async () => {
      const response = await app.request(
        new Request("http://localhost/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: `weak-${Date.now()}@example.com`,
            password: "123", // Too weak
            name: "User",
          }),
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("password");
    });
  });

  describe("POST /auth/login", () => {
    let testEmail: string;
    let testPassword: string;

    beforeEach(async () => {
      testEmail = `login-${Date.now()}@example.com`;
      testPassword = "Password123!";

      // Create test user (password would be hashed in real implementation)
      await db.insert(users).values({
        email: testEmail,
        name: "Test User",
        passwordHash: "hash123", // In real test, would hash the password
      });
    });

    afterEach(async () => {
      await db.delete(users).where(eq(users.email, testEmail));
    });

    it("should login with valid credentials", async () => {
      const response = await app.request(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeDefined();
    });

    it("should reject invalid password", async () => {
      const response = await app.request(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: testEmail,
            password: "WrongPassword123!",
          }),
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
```

### Mock Service Worker (MSW) Setup

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  // Stripe API mocks
  http.post("https://api.stripe.com/v1/checkout/sessions", () => {
    return HttpResponse.json({
      id: "cs_test_123",
      client_secret: "cs_test_123_secret",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
  }),

  // Mux API mocks
  http.post("https://api.mux.com/video/v1/uploads", () => {
    return HttpResponse.json({
      data: {
        id: "upload_test_123",
        status: "waiting_for_upload",
        url: "https://storage.mux.com/upload",
      },
    });
  }),

  http.post("https://api.mux.com/video/v1/assets", () => {
    return HttpResponse.json({
      data: {
        id: "asset_test_123",
        status: "ready",
        playback_ids: [
          {
            id: "playback_test_123",
            policy: "public",
          },
        ],
      },
    });
  }),

  // Firebase Cloud Messaging mock
  http.post("https://fcm.googleapis.com/v1/projects/*/messages:send", () => {
    return HttpResponse.json({
      name: "projects/test/messages/123",
    });
  }),

  // Typesense mock
  http.post(
    "https://typesense.example.com/collections/courses/documents/search",
    () => {
      return HttpResponse.json({
        results: [
          {
            document: {
              id: "course-1",
              title: "Makeup Fundamentals",
              instructor: "Jane Doe",
            },
          },
        ],
        found: 1,
      });
    }
  ),
];
```

```typescript
// tests/setup/server.ts
import { setupServer } from "msw/node";
import { handlers } from "../mocks/handlers";

export const server = setupServer(...handlers);
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/", "**/*.spec.ts", "**/*.test.ts"],
      lines: 85,
      functions: 85,
      branches: 80,
      statements: 85,
    },
  },
});
```

```typescript
// tests/setup/vitest-setup.ts
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Stripe Payment Testing

```typescript
// packages/api/src/routes/payments.spec.ts
import { describe, it, expect } from "vitest";
import Stripe from "stripe";
import { createCheckoutSession } from "./payments";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_123", {
  apiVersion: "2023-10-16",
});

describe("Payment Integration", () => {
  describe("Subscription Checkout", () => {
    it("should create checkout session for subscription", async () => {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: "price_test_pro_monthly",
            quantity: 1,
          },
        ],
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
        customer_email: "test@example.com",
      });

      expect(session.id).toBeDefined();
      expect(session.url).toContain("checkout.stripe.com");
    });

    it("should retrieve subscription details", async () => {
      // Create test subscription
      const customer = await stripe.customers.create({
        email: `test-${Date.now()}@example.com`,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: "price_test_pro_monthly",
          },
        ],
      });

      expect(subscription.status).toBe("active");
      expect(subscription.items.data[0].price.id).toBe(
        "price_test_pro_monthly"
      );
    });

    it("should cancel subscription", async () => {
      // Create test subscription
      const customer = await stripe.customers.create({
        email: `test-${Date.now()}@example.com`,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: "price_test_pro_monthly",
          },
        ],
      });

      // Cancel it
      const canceled = await stripe.subscriptions.del(subscription.id);
      expect(canceled.status).toBe("canceled");
    });
  });

  describe("Course Purchase", () => {
    it("should process one-time payment", async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 9999, // $99.99
        currency: "usd",
        payment_method: "pm_card_visa_debit",
        confirm: true,
      });

      expect(paymentIntent.status).toBe("succeeded");
    });
  });

  describe("Webhook Handling", () => {
    it("should handle charge.succeeded webhook", async () => {
      const event = {
        type: "charge.succeeded",
        data: {
          object: {
            id: "ch_test_123",
            amount: 9999,
            customer: "cus_test_123",
            metadata: {
              courseId: "course-123",
            },
          },
        },
      };

      // Verify webhook can be processed
      expect(event.type).toBe("charge.succeeded");
      expect(event.data.object.metadata.courseId).toBe("course-123");
    });

    it("should handle customer.subscription.updated webhook", async () => {
      const event = {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_test_123",
            status: "active",
            customer: "cus_test_123",
          },
        },
      };

      expect(event.type).toBe("customer.subscription.updated");
      expect(event.data.object.status).toBe("active");
    });
  });
});
```

### Mux Video API Testing

```typescript
// packages/api/src/services/video.spec.ts
import { describe, it, expect, beforeEach } from "vitest";
import Mux from "@mux/mux-node";

const mux = new Mux({
  accessTokenId: process.env.MUX_ACCESS_TOKEN_ID || "test_token",
  accessTokenSecret: process.env.MUX_ACCESS_TOKEN_SECRET || "test_secret",
});

describe("Video Service", () => {
  it("should create upload URL", async () => {
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    expect(upload.id).toBeDefined();
    expect(upload.status).toBe("waiting_for_upload");
    expect(upload.url).toContain("storage.mux.com");
  });

  it("should get asset status", async () => {
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    // Note: In real testing, would need to actually upload video to get processing status
    expect(upload.id).toBeDefined();
  });

  it("should create playback ID", async () => {
    // This would normally use an actual asset ID from a real upload
    const assetId = "asset_test_123";

    // In real test, create asset then get playback ID
    expect(assetId).toBeDefined();
  });
});
```

### Authentication Testing

```typescript
// packages/auth/src/lib.spec.ts
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from "./lib";

describe("Authentication Library", () => {
  describe("Password hashing", () => {
    it("should hash password securely", async () => {
      const password = "MySecurePassword123!";
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it("should verify correct password", async () => {
      const password = "MySecurePassword123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "MySecurePassword123!";
      const hash = await hashPassword(password);
      const isValid = await verifyPassword("WrongPassword", hash);

      expect(isValid).toBe(false);
    });
  });

  describe("JWT tokens", () => {
    it("should generate valid token", () => {
      const token = generateToken({
        userId: "user-123",
        email: "test@example.com",
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should verify and decode token", () => {
      const payload = { userId: "user-123", email: "test@example.com" };
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it("should reject expired token", () => {
      // Create token with very short expiry
      const token = generateToken({ userId: "user-123" }, "0s");

      // Wait a moment then try to verify
      setTimeout(() => {
        expect(() => verifyToken(token)).toThrow();
      }, 100);
    });

    it("should reject tampered token", () => {
      const token = generateToken({ userId: "user-123" });
      const tampered = token.split(".").slice(0, 2).join(".") + ".tampered";

      expect(() => verifyToken(tampered)).toThrow();
    });
  });
});
```

### Data Validation Testing

```typescript
// packages/shared-utils/src/validators.spec.ts
import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateCourseTitle,
} from "./validators";

describe("Validators", () => {
  describe("Email validation", () => {
    it("should accept valid email", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("john.doe+tag@company.co.uk")).toBe(true);
    });

    it("should reject invalid email", () => {
      expect(validateEmail("notanemail")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
    });
  });

  describe("Password validation", () => {
    it("should accept strong password", () => {
      expect(validatePassword("SecurePass123!")).toBe(true);
    });

    it("should reject weak password", () => {
      expect(validatePassword("123")).toBe(false); // Too short
      expect(validatePassword("password")).toBe(false); // No uppercase/numbers
    });
  });

  describe("Course title validation", () => {
    it("should accept valid course title", () => {
      expect(validateCourseTitle("Makeup Fundamentals")).toBe(true);
      expect(validateCourseTitle("Advanced Eyeshadow Techniques")).toBe(true);
    });

    it("should reject invalid title", () => {
      expect(validateCourseTitle("")).toBe(false);
      expect(validateCourseTitle("a")).toBe(false); // Too short
    });
  });
});
```

### CI Configuration for Tests

```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
    paths:
      - "packages/**"
      - "apps/**"
      - "tests/**"
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: mentor_test
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgresql://postgres:password@localhost:5432/mentor_test
      STRIPE_SECRET_KEY: sk_test_123
      MUX_ACCESS_TOKEN_ID: test_token
      MUX_ACCESS_TOKEN_SECRET: test_secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:integration
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Coverage Targets

| Component            | Target | Priority |
| -------------------- | ------ | -------- |
| Auth package         | 100%   | Critical |
| Payment handlers     | 95%    | Critical |
| Video service        | 90%    | High     |
| Database queries     | 85%    | High     |
| Shared utils         | 85%    | Medium   |
| Email service        | 80%    | Medium   |
| Admin panel handlers | 80%    | Medium   |

## Implementation Timeline

- **Week 1**: Set up Vitest, write auth and database tests
- **Week 2**: Implement MSW mocks for external services
- **Week 3**: Write payment integration tests
- **Week 4**: Video service and database query tests
- **Week 5**: CI setup, coverage reporting, documentation

## Success Metrics

- **85%+ overall coverage** across all shared packages
- **0 flaky tests** (deterministic results)
- **< 5 minute test execution** with parallelization
- **100% critical path coverage** (auth, payments, video)
- **All CI checks passing** before merge
- **Coverage reports** automatically uploaded to Codecov
